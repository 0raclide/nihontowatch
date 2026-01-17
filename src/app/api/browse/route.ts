import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeSearchText, expandSearchAliases } from '@/lib/search';
import { parseNumericFilters } from '@/lib/search/numericFilters';
import { CACHE } from '@/lib/constants';

// In-memory cache for facet data (reduces DB queries)
interface FacetCache {
  data: {
    itemTypes: Array<{ value: string; count: number }>;
    certifications: Array<{ value: string; count: number }>;
    dealers: Array<{ id: number; name: string; count: number }>;
  } | null;
  timestamp: number;
  tab: string;
}

// Cache version: 2026-01-17-v2 (bump to invalidate)
let facetCache: FacetCache = { data: null, timestamp: 0, tab: '' };
const FACET_CACHE_TTL = 60000; // 60 seconds in-memory cache

interface BrowseParams {
  tab: 'available' | 'sold';
  category?: 'all' | 'nihonto' | 'tosogu';
  itemTypes?: string[];
  certifications?: string[];
  schools?: string[];
  dealers?: number[];
  askOnly?: boolean;
  query?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

// Item type categories for filtering
const NIHONTO_TYPES = ['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'kodachi', 'ken', 'naginata naoshi', 'sword'];
// Comprehensive tosogu types - includes all fittings and variants for database compatibility
const TOSOGU_TYPES = [
  'tsuba',
  'fuchi-kashira', 'fuchi_kashira',  // fuchi+kashira set variants
  'fuchi', 'kashira',  // individual pieces
  'kozuka', 'kogatana',  // utility knife handle
  'kogai',  // hair pick
  'menuki',
  'koshirae',  // complete mounting
  'tosogu',  // generic/unspecified fitting
  'mitokoromono',  // matched set of kozuka, kogai, menuki
];

function parseParams(searchParams: URLSearchParams): BrowseParams {
  const itemTypesRaw = searchParams.get('type');
  const certificationsRaw = searchParams.get('cert');
  const schoolsRaw = searchParams.get('school');
  const dealersRaw = searchParams.get('dealer');
  const categoryRaw = searchParams.get('cat') as 'all' | 'nihonto' | 'tosogu' | null;

  return {
    tab: (searchParams.get('tab') as 'available' | 'sold') || 'available',
    category: categoryRaw || 'all',
    itemTypes: itemTypesRaw ? itemTypesRaw.split(',').map(t => t.toLowerCase()) : undefined,
    certifications: certificationsRaw ? certificationsRaw.split(',') : undefined,
    schools: schoolsRaw ? schoolsRaw.split(',') : undefined,
    dealers: dealersRaw ? dealersRaw.split(',').map(Number) : undefined,
    askOnly: searchParams.get('ask') === 'true',
    query: searchParams.get('q') || undefined,
    sort: searchParams.get('sort') || 'recent',
    page: Number(searchParams.get('page')) || 1,
    limit: Math.min(Number(searchParams.get('limit')) || 30, 100),
  };
}

// Status filter constant - used by both main query and facets
const STATUS_AVAILABLE = 'status.eq.available,is_available.eq.true';
const STATUS_SOLD = 'status.eq.sold,status.eq.presumed_sold,is_sold.eq.true';

// Certification variants mapping (for backward compatibility until data is normalized)
const CERT_VARIANTS: Record<string, string[]> = {
  'Juyo': ['Juyo', 'juyo'],
  'Tokuju': ['Tokuju', 'tokuju', 'Tokubetsu Juyo', 'tokubetsu_juyo'],
  'TokuHozon': ['TokuHozon', 'Tokubetsu Hozon', 'tokubetsu_hozon'],
  'Hozon': ['Hozon', 'hozon'],
  'TokuKicho': ['TokuKicho', 'Tokubetsu Kicho', 'tokubetsu_kicho'],
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const params = parseParams(request.nextUrl.searchParams);

    // Ensure page is reasonable
    const safePage = Math.max(1, Math.min(params.page || 1, 1000));
    const offset = (safePage - 1) * params.limit!;
    const statusFilter = params.tab === 'available' ? STATUS_AVAILABLE : STATUS_SOLD;

    // Build query
    let query = supabase
      .from('listings')
      .select(`
        id,
        url,
        title,
        item_type,
        price_value,
        price_currency,
        smith,
        tosogu_maker,
        school,
        tosogu_school,
        cert_type,
        nagasa_cm,
        images,
        first_seen_at,
        last_scraped_at,
        freshness_source,
        freshness_confidence,
        listing_published_at,
        wayback_first_archive_at,
        wayback_checked_at,
        status,
        is_available,
        is_sold,
        dealer_id,
        dealers!inner(id, name, domain)
      `, { count: 'exact' });

    // Status filter
    query = query.or(statusFilter);

    // Exclude stands/racks (display accessories, not collectibles)
    query = query.neq('item_type', 'Stand');

    // Item type filter - use ILIKE for case-insensitive matching
    // Database has mixed case (e.g., "Katana" and "katana")
    // If specific itemTypes are provided, use those; otherwise use category filter
    const effectiveItemTypes = params.itemTypes?.length
      ? params.itemTypes
      : params.category === 'nihonto'
        ? NIHONTO_TYPES
        : params.category === 'tosogu'
          ? TOSOGU_TYPES
          : undefined;

    if (effectiveItemTypes?.length) {
      // Build OR condition for case-insensitive matching
      const typeConditions = effectiveItemTypes
        .map(t => `item_type.ilike.${t}`)
        .join(',');
      query = query.or(typeConditions);
    }

    // Ask only filter (price on request)
    if (params.askOnly) {
      query = query.is('price_value', null);
    }

    // Certification filter (handles variants until data is normalized)
    if (params.certifications?.length) {
      const allVariants = params.certifications.flatMap(c => CERT_VARIANTS[c] || [c]);
      query = query.in('cert_type', allVariants);
    }

    // School filter
    if (params.schools?.length) {
      const schoolConditions = params.schools
        .map(s => `school.ilike.%${s}%,tosogu_school.ilike.%${s}%`)
        .join(',');
      query = query.or(schoolConditions);
    }

    // Dealer filter
    if (params.dealers?.length) {
      query = query.in('dealer_id', params.dealers);
    }

    // Process query with numeric filters
    if (params.query && params.query.trim().length >= 2) {
      const { filters, textWords } = parseNumericFilters(params.query);

      // Apply numeric filters
      for (const { field, op, value } of filters) {
        query = query.filter(field, op, value);
      }

      // Text search on remaining words - include all relevant metadata fields
      const searchFields = [
        'title',
        'description',
        // Attribution
        'smith',
        'tosogu_maker',
        'school',
        'tosogu_school',
        'province',
        'era',
        'mei_type',
        // Classification
        'cert_type',
        'item_type',
        'item_category',
        // Tosogu-specific
        'tosogu_material',
      ];

      for (const word of textWords) {
        // Expand word to include aliases (e.g., "tokuju" -> ["tokuju", "tokubetsu juyo", "tokubetsu_juyo"])
        const expandedTerms = expandSearchAliases(word).map(normalizeSearchText);

        // Build OR conditions: each expanded term can match in any field
        const conditions = expandedTerms.flatMap(term =>
          searchFields.map(field => `${field}.ilike.%${term}%`)
        );

        // Each word (with its aliases) must match somewhere
        if (conditions.length > 0) {
          query = query.or(conditions.join(','));
        }
      }
    }

    // Sorting
    switch (params.sort) {
      case 'price_asc':
        query = query.order('price_value', { ascending: true, nullsFirst: false });
        break;
      case 'price_desc':
        query = query.order('price_value', { ascending: false, nullsFirst: false });
        break;
      case 'name':
        query = query.order('title', { ascending: true });
        break;
      default:
        query = query.order('first_seen_at', { ascending: false });
    }

    // Pagination
    query = query.range(offset, offset + params.limit! - 1);

    const { data: listings, error, count } = await query;

    if (error) {
      console.error('Browse query error:', error);
      // Handle range/pagination errors gracefully
      const errorMsg = error.message || '';
      if (errorMsg.includes('range') || errorMsg.includes('{"') || error.code === 'PGRST103') {
        return NextResponse.json({
          listings: [],
          total: 0,
          page: safePage,
          totalPages: 0,
          facets: { itemTypes: [], certifications: [], dealers: [] },
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get facet counts - use in-memory cache to reduce DB queries
    // Facets don't change frequently, so we can cache them for 60 seconds
    let typesFacet, certsFacet, dealersFacet;
    const now = Date.now();

    if (
      facetCache.data &&
      facetCache.tab === params.tab &&
      now - facetCache.timestamp < FACET_CACHE_TTL
    ) {
      // Use cached facets
      typesFacet = facetCache.data.itemTypes;
      certsFacet = facetCache.data.certifications;
      dealersFacet = facetCache.data.dealers;
    } else {
      // Fetch fresh facets using SQL aggregation (avoids row limit issues)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: facetData, error: facetError } = await (supabase.rpc as any)('get_listing_facets', {
        p_tab: params.tab,
        p_item_types: params.itemTypes || null,
        p_certifications: params.certifications || null,
        p_dealers: params.dealers || null,
        p_query: params.query || null,
        p_ask_only: params.askOnly || false
      });

      // Fallback to JS-based facet computation if RPC doesn't exist
      if (facetError?.code === 'PGRST202') {
        // RPC not found - use fallback functions
        [typesFacet, certsFacet, dealersFacet] = await Promise.all([
          getItemTypeFacets(supabase, statusFilter),
          getCertificationFacets(supabase, statusFilter),
          getDealerFacets(supabase, statusFilter),
        ]);
      } else if (facetError) {
        console.error('Facet RPC error:', facetError);
        // Use fallback on other errors too
        [typesFacet, certsFacet, dealersFacet] = await Promise.all([
          getItemTypeFacets(supabase, statusFilter),
          getCertificationFacets(supabase, statusFilter),
          getDealerFacets(supabase, statusFilter),
        ]);
      } else {
        // Use RPC results
        typesFacet = facetData?.itemTypes || [];
        certsFacet = facetData?.certifications || [];
        dealersFacet = facetData?.dealers || [];
      }

      // Update cache
      facetCache = {
        data: {
          itemTypes: typesFacet,
          certifications: certsFacet,
          dealers: dealersFacet,
        },
        timestamp: now,
        tab: params.tab,
      };
    }

    // Get the most recent scrape timestamp for freshness indicator
    const { data: freshnessData } = await supabase
      .from('listings')
      .select('last_scraped_at')
      .or(statusFilter)
      .order('last_scraped_at', { ascending: false })
      .limit(1)
      .single();

    const lastUpdated = (freshnessData as { last_scraped_at: string } | null)?.last_scraped_at || null;

    // Create response with cache headers
    const response = NextResponse.json({
      listings: listings || [],
      total: count || 0,
      page: safePage,
      totalPages: Math.ceil((count || 0) / params.limit!),
      facets: {
        itemTypes: typesFacet,
        certifications: certsFacet,
        dealers: dealersFacet,
      },
      lastUpdated,
    });

    // Add cache headers - allow edge caching for 5 minutes, stale-while-revalidate for 10 minutes
    response.headers.set(
      'Cache-Control',
      `public, s-maxage=${CACHE.BROWSE_RESULTS}, stale-while-revalidate=${CACHE.SWR_WINDOW}`
    );

    return response;
  } catch (error) {
    console.error('Browse API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Facet functions - use same status filter as main query for concordance

async function getItemTypeFacets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statusFilter: string
) {
  // Paginate through ALL results since Supabase has a max_rows limit (typically 1000)
  const PAGE_SIZE = 1000;
  const counts: Record<string, number> = {};
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from('listings')
      .select('item_type')
      .or(statusFilter)
      .range(offset, offset + PAGE_SIZE - 1);

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    // Aggregate this page
    (data as Array<{ item_type: string | null }>).forEach(row => {
      const type = row.item_type;
      if (type) {
        const normalized = type.toLowerCase().replace('fuchi_kashira', 'fuchi-kashira');
        counts[normalized] = (counts[normalized] || 0) + 1;
      }
    });

    offset += PAGE_SIZE;
    hasMore = data.length === PAGE_SIZE;
  }

  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

async function getCertificationFacets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statusFilter: string
) {
  // Use SQL aggregation to count ALL matching items efficiently
  // Supabase defaults to 1000 rows which causes incorrect facet counts
  const isAvailable = statusFilter === STATUS_AVAILABLE;

  // Build SQL for status filter - same logic as main query
  const statusCondition = isAvailable
    ? "(status = 'available' OR is_available = true)"
    : "(status = 'sold' OR status = 'presumed_sold' OR is_sold = true)";

  // Use RPC to run aggregation query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_cert_facets', {
    status_condition: statusCondition
  });

  // Fallback to regular query if RPC doesn't exist
  if (error?.code === 'PGRST202') {
    // RPC not found - use full data fetch with high limit
    const { data: fullData } = await supabase
      .from('listings')
      .select('cert_type')
      .or(statusFilter)
      .limit(50000);

    if (!fullData) return [];

    const normalizeCert = (cert: string): string => {
      const lower = cert.toLowerCase();
      if (lower === 'juyo') return 'Juyo';
      if (['tokuju', 'tokubetsu juyo', 'tokubetsu_juyo'].includes(lower)) return 'Tokuju';
      if (['tokuhozon', 'tokubetsu hozon', 'tokubetsu_hozon'].includes(lower)) return 'TokuHozon';
      if (lower === 'hozon') return 'Hozon';
      if (['tokukicho', 'tokubetsu kicho', 'tokubetsu_kicho'].includes(lower)) return 'TokuKicho';
      return cert;
    };

    const counts: Record<string, number> = {};
    fullData.forEach((row: { cert_type: string | null }) => {
      const cert = row.cert_type;
      if (cert && cert !== 'null') {
        const normalized = normalizeCert(cert);
        counts[normalized] = (counts[normalized] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }

  if (!data) return [];

  // Normalize RPC results
  const normalizeCert = (cert: string): string => {
    const lower = cert.toLowerCase();
    if (lower === 'juyo') return 'Juyo';
    if (['tokuju', 'tokubetsu juyo', 'tokubetsu_juyo'].includes(lower)) return 'Tokuju';
    if (['tokuhozon', 'tokubetsu hozon', 'tokubetsu_hozon'].includes(lower)) return 'TokuHozon';
    if (lower === 'hozon') return 'Hozon';
    if (['tokukicho', 'tokubetsu kicho', 'tokubetsu_kicho'].includes(lower)) return 'TokuKicho';
    return cert;
  };

  const counts: Record<string, number> = {};
  (data as Array<{ cert_type: string; count: number }>).forEach(row => {
    if (row.cert_type && row.cert_type !== 'null') {
      const normalized = normalizeCert(row.cert_type);
      counts[normalized] = (counts[normalized] || 0) + row.count;
    }
  });

  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

async function getDealerFacets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statusFilter: string
) {
  // Use high limit to get ALL matching items (Supabase defaults to 1000)
  const { data } = await supabase
    .from('listings')
    .select('dealer_id, dealers!inner(name)')
    .or(statusFilter)
    .limit(50000);

  if (!data) return [];

  const counts: Record<string, { id: number; name: string; count: number }> = {};
  data.forEach((row: { dealer_id: number; dealers: { name: string } }) => {
    const id = row.dealer_id;
    const name = row.dealers?.name || 'Unknown';
    if (!counts[id]) {
      counts[id] = { id, name, count: 0 };
    }
    counts[id].count++;
  });

  return Object.values(counts).sort((a, b) => b.count - a.count);
}
