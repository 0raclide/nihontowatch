import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeSearchText, expandSearchAliases } from '@/lib/search';
import { parseNumericFilters } from '@/lib/search/numericFilters';
import { CACHE } from '@/lib/constants';

// Facets are computed fresh for each request to reflect current filters
// No caching - facet counts must accurately reflect user's filter selections

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
        cert_session,
        cert_organization,
        era,
        province,
        mei_type,
        nagasa_cm,
        sori_cm,
        motohaba_cm,
        sakihaba_cm,
        kasane_cm,
        nakago_cm,
        weight_g,
        height_cm,
        width_cm,
        thickness_mm,
        material,
        description,
        description_en,
        images,
        stored_images,
        images_stored_at,
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

    // Get facet counts - computed fresh to reflect current filter state
    // Each facet is filtered by all OTHER active filters (standard faceted search pattern)
    const [typesFacet, certsFacet, dealersFacet] = await Promise.all([
      // Item type facets: filtered by certifications, dealers, askOnly (NOT by category/itemTypes)
      getItemTypeFacets(supabase, statusFilter, {
        certifications: params.certifications,
        dealers: params.dealers,
        askOnly: params.askOnly,
        query: params.query,
      }),
      // Certification facets: filtered by category/itemTypes, dealers, askOnly
      getCertificationFacets(supabase, statusFilter, {
        category: params.category,
        itemTypes: params.itemTypes,
        dealers: params.dealers,
        askOnly: params.askOnly,
        query: params.query,
      }),
      // Dealer facets: filtered by category/itemTypes, certifications, askOnly
      getDealerFacets(supabase, statusFilter, {
        category: params.category,
        itemTypes: params.itemTypes,
        certifications: params.certifications,
        askOnly: params.askOnly,
        query: params.query,
      }),
    ]);

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

    // Cache for short duration with SWR for quick invalidation
    response.headers.set('Cache-Control', `public, s-maxage=${CACHE.BROWSE_RESULTS}, stale-while-revalidate=${CACHE.SWR_WINDOW}`);

    return response;
  } catch (error) {
    console.error('Browse API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Facet filter options
interface FacetFilterOptions {
  category?: 'all' | 'nihonto' | 'tosogu';
  itemTypes?: string[];
  certifications?: string[];
  dealers?: number[];
  askOnly?: boolean;
  query?: string;
}

// Facet functions - apply filters to reflect user's current selection
// Uses JS-side filtering for category/itemTypes since Supabase .or() calls
// don't combine with AND when filtering by both status and item type

async function getItemTypeFacets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statusFilter: string,
  options: FacetFilterOptions
) {
  // Build query with filters (excluding category/itemTypes since we're counting those)
  let query = supabase
    .from('listings')
    .select('item_type')
    .or(statusFilter);

  // Apply certification, dealer, askOnly filters
  if (options.certifications?.length) {
    const allVariants = options.certifications.flatMap(c => CERT_VARIANTS[c] || [c]);
    query = query.in('cert_type', allVariants);
  }
  if (options.dealers?.length) {
    query = query.in('dealer_id', options.dealers);
  }
  if (options.askOnly) {
    query = query.is('price_value', null);
  }

  // Fetch with high limit
  const { data } = await query.limit(50000);
  if (!data) return [];

  // Aggregate counts
  const counts: Record<string, number> = {};
  (data as Array<{ item_type: string | null }>).forEach(row => {
    const type = row.item_type;
    if (type) {
      const normalized = type.toLowerCase().replace('fuchi_kashira', 'fuchi-kashira');
      counts[normalized] = (counts[normalized] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

async function getCertificationFacets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statusFilter: string,
  options: FacetFilterOptions
) {
  // Build query - fetch item_type along with cert_type for JS-side filtering
  let query = supabase
    .from('listings')
    .select('cert_type, item_type, dealer_id, price_value')
    .or(statusFilter);

  // Apply dealer filter at DB level (this works with AND)
  if (options.dealers?.length) {
    query = query.in('dealer_id', options.dealers);
  }
  if (options.askOnly) {
    query = query.is('price_value', null);
  }

  // Fetch with high limit
  const { data } = await query.limit(50000);
  if (!data) return [];

  // Determine which item types to include based on category
  const effectiveItemTypes = options.itemTypes?.length
    ? options.itemTypes
    : options.category === 'nihonto'
      ? NIHONTO_TYPES
      : options.category === 'tosogu'
        ? TOSOGU_TYPES
        : undefined;

  // Normalize cert function
  const normalizeCert = (cert: string): string => {
    const lower = cert.toLowerCase();
    if (lower === 'juyo') return 'Juyo';
    if (['tokuju', 'tokubetsu juyo', 'tokubetsu_juyo'].includes(lower)) return 'Tokuju';
    if (['tokuhozon', 'tokubetsu hozon', 'tokubetsu_hozon'].includes(lower)) return 'TokuHozon';
    if (lower === 'hozon') return 'Hozon';
    if (['tokukicho', 'tokubetsu kicho', 'tokubetsu_kicho'].includes(lower)) return 'TokuKicho';
    return cert;
  };

  // Filter and aggregate in JS
  const counts: Record<string, number> = {};
  (data as Array<{ cert_type: string | null; item_type: string | null }>).forEach(row => {
    // Filter by item type if category is set
    if (effectiveItemTypes) {
      const itemType = row.item_type?.toLowerCase().replace('fuchi_kashira', 'fuchi-kashira');
      if (!itemType || !effectiveItemTypes.some(t => t.toLowerCase() === itemType)) {
        return; // Skip this row - doesn't match category
      }
    }

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

async function getDealerFacets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statusFilter: string,
  options: FacetFilterOptions
) {
  // Build query - fetch item_type and cert_type for JS-side filtering
  let query = supabase
    .from('listings')
    .select('dealer_id, dealers!inner(name), item_type, cert_type, price_value')
    .or(statusFilter);

  // Apply certification filter at DB level (this works with AND)
  if (options.certifications?.length) {
    const allVariants = options.certifications.flatMap(c => CERT_VARIANTS[c] || [c]);
    query = query.in('cert_type', allVariants);
  }
  if (options.askOnly) {
    query = query.is('price_value', null);
  }

  // Fetch with high limit
  const { data } = await query.limit(50000);
  if (!data) return [];

  // Determine which item types to include based on category
  const effectiveItemTypes = options.itemTypes?.length
    ? options.itemTypes
    : options.category === 'nihonto'
      ? NIHONTO_TYPES
      : options.category === 'tosogu'
        ? TOSOGU_TYPES
        : undefined;

  // Filter and aggregate in JS
  const counts: Record<string, { id: number; name: string; count: number }> = {};
  (data as Array<{ dealer_id: number; dealers: { name: string }; item_type: string | null }>).forEach(row => {
    // Filter by item type if category is set
    if (effectiveItemTypes) {
      const itemType = row.item_type?.toLowerCase().replace('fuchi_kashira', 'fuchi-kashira');
      if (!itemType || !effectiveItemTypes.some(t => t.toLowerCase() === itemType)) {
        return; // Skip this row - doesn't match category
      }
    }

    const id = row.dealer_id;
    const name = row.dealers?.name || 'Unknown';
    if (!counts[id]) {
      counts[id] = { id, name, count: 0 };
    }
    counts[id].count++;
  });

  return Object.values(counts).sort((a, b) => b.count - a.count);
}
