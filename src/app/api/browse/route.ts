import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeSearchText, expandSearchAliases } from '@/lib/search';
import { parseNumericFilters } from '@/lib/search/numericFilters';
import { parseSemanticQuery } from '@/lib/search/semanticQueryParser';
import { CACHE, PAGINATION, LISTING_FILTERS } from '@/lib/constants';

// Facets are computed fresh for each request to reflect current filters
// No caching - facet counts must accurately reflect user's filter selections

interface BrowseParams {
  tab: 'available' | 'sold' | 'all';
  category?: 'all' | 'nihonto' | 'tosogu' | 'armor';
  itemTypes?: string[];
  certifications?: string[];
  schools?: string[];
  dealers?: number[];
  historicalPeriods?: string[];
  signatureStatuses?: string[];
  askOnly?: boolean;
  /** Filter to only show catalog-enriched listings */
  enriched?: boolean;
  query?: string;
  sort?: string;
  page?: number;
  limit?: number;
  /** Explicit offset for pagination - takes precedence over page-based calculation */
  offset?: number;
}

// Item type categories for filtering
const NIHONTO_TYPES = [
  'katana', 'wakizashi', 'tanto', 'tachi', 'kodachi',
  'naginata', 'naginata naoshi', 'naginata-naoshi',  // Support both formats
  'yari', 'ken', 'daisho',
];

// Comprehensive tosogu types - includes all fittings and variants for database compatibility
const TOSOGU_TYPES = [
  'tsuba',
  'fuchi-kashira', 'fuchi_kashira',  // fuchi+kashira set variants
  'fuchi', 'kashira',  // individual pieces
  'kozuka', 'kogatana',  // utility knife handle
  'kogai',  // hair pick
  'menuki',
  'futatokoro',  // 2-piece set (kozuka + kogai)
  'mitokoromono',  // 3-piece set (kozuka + kogai + menuki)
  'koshirae',  // complete mounting
  'tosogu',  // generic/unspecified fitting
];

// Armor & accessories
const ARMOR_TYPES = [
  'armor', 'yoroi', 'gusoku',  // Full armor suits
  'helmet', 'kabuto',  // Helmets
  'menpo', 'mengu',  // Face masks
  'kote',  // Gauntlets
  'suneate',  // Shin guards
  'do',  // Chest armor
];

// Types to exclude from browse results (non-collectibles)
const EXCLUDED_TYPES = ['stand', 'book', 'other'];

// Compute sold data with confidence indicator for sold items
// Items with 0-3 days between first_seen and status_changed are treated as
// "unreliable" because they were likely already sold when discovered.
function computeSoldData(listing: { is_sold: boolean; status_changed_at?: string | null; first_seen_at?: string | null }) {
  if (!listing.is_sold) {
    return null;
  }

  const statusChangedAt = listing.status_changed_at ? new Date(listing.status_changed_at) : null;
  const firstSeenAt = listing.first_seen_at ? new Date(listing.first_seen_at) : null;

  // Format sale date
  const saleDate = statusChangedAt
    ? statusChangedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  // Calculate days on market
  if (!firstSeenAt || !statusChangedAt) {
    return {
      sale_date: saleDate,
      days_on_market: null,
      days_on_market_display: null,
      confidence: 'unknown' as const
    };
  }

  const days = Math.floor((statusChangedAt.getTime() - firstSeenAt.getTime()) / (1000 * 60 * 60 * 24));
  const daysPositive = Math.max(0, days);

  // 0-3 days: Unreliable - likely discovered as already sold
  // Don't show DOM as it would be misleading
  if (daysPositive < 4) {
    return {
      sale_date: saleDate,
      days_on_market: null,
      days_on_market_display: null,
      confidence: 'unknown' as const
    };
  }

  let confidence: 'high' | 'medium' | 'low';
  let display: string;

  if (daysPositive >= 30) {
    confidence = 'high';
    display = `${daysPositive} days`;
  } else if (daysPositive >= 7) {
    confidence = 'medium';
    display = `~${daysPositive} days`;
  } else {
    // 4-6 days: low confidence
    confidence = 'low';
    display = `${daysPositive}+ days`;
  }

  return {
    sale_date: saleDate,
    days_on_market: daysPositive,
    days_on_market_display: display,
    confidence
  };
}

function parseParams(searchParams: URLSearchParams): BrowseParams {
  const itemTypesRaw = searchParams.get('type');
  const certificationsRaw = searchParams.get('cert');
  const schoolsRaw = searchParams.get('school');
  const dealersRaw = searchParams.get('dealer');
  const historicalPeriodsRaw = searchParams.get('period');
  const signatureStatusesRaw = searchParams.get('sig');
  const categoryRaw = searchParams.get('cat') as 'all' | 'nihonto' | 'tosogu' | 'armor' | null;

  // Parse offset if provided (explicit offset takes precedence over page-based calculation)
  const offsetRaw = searchParams.get('offset');
  const explicitOffset = offsetRaw ? Number(offsetRaw) : undefined;

  return {
    tab: (searchParams.get('tab') as 'available' | 'sold') || 'available',
    category: categoryRaw || 'all',
    itemTypes: itemTypesRaw ? itemTypesRaw.split(',').map(t => t.toLowerCase()) : undefined,
    certifications: certificationsRaw ? certificationsRaw.split(',') : undefined,
    schools: schoolsRaw ? schoolsRaw.split(',') : undefined,
    dealers: dealersRaw ? dealersRaw.split(',').map(Number) : undefined,
    historicalPeriods: historicalPeriodsRaw ? historicalPeriodsRaw.split(',') : undefined,
    signatureStatuses: signatureStatusesRaw ? signatureStatusesRaw.split(',') : undefined,
    askOnly: searchParams.get('ask') === 'true',
    enriched: searchParams.get('enriched') === 'true',
    query: searchParams.get('q') || undefined,
    sort: searchParams.get('sort') || 'recent',
    page: Number(searchParams.get('page')) || 1,
    limit: Math.min(Number(searchParams.get('limit')) || PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE),
    offset: explicitOffset,
  };
}

// Status filter constant - used by both main query and facets
const STATUS_AVAILABLE = 'status.eq.available,is_available.eq.true';
const STATUS_SOLD = 'status.eq.sold,status.eq.presumed_sold,is_sold.eq.true';

// Helper to apply minimum price filter to queries
// Uses price_jpy (normalized JPY price) to filter consistently regardless of original currency
// Allows NULL price_jpy (ASK listings) while filtering out low-price items
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyMinPriceFilter<T extends { or: (condition: string) => T }>(query: T): T {
  if (LISTING_FILTERS.MIN_PRICE_JPY > 0) {
    // Allow ASK listings (NULL) OR items with price >= minimum
    return query.or(`price_jpy.is.null,price_jpy.gte.${LISTING_FILTERS.MIN_PRICE_JPY}`);
  }
  return query;
}

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
    // Use explicit offset if provided, otherwise calculate from page
    // Explicit offset is needed for infinite scroll where page sizes vary
    const offset = params.offset !== undefined
      ? Math.max(0, params.offset)
      : (safePage - 1) * params.limit!;
    // Status filter: 'all' = no filter, 'sold' = sold only, otherwise available only (default)
    const statusFilter = params.tab === 'all'
      ? null
      : (params.tab === 'sold' ? STATUS_SOLD : STATUS_AVAILABLE);

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
        price_jpy,
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
        weight_g,
        description,
        description_en,
        title_en,
        setsumei_text_en,
        setsumei_text_ja,
        setsumei_metadata,
        setsumei_processed_at,
        images,
        stored_images,
        images_stored_at,
        first_seen_at,
        status_changed_at,
        last_scraped_at,
        status,
        is_available,
        is_sold,
        dealer_id,
        dealers:dealers!inner(id, name, domain)
      `, { count: 'exact' });

    // Status filter (only apply if not 'all' - null means show both available and sold)
    if (statusFilter) {
      query = query.or(statusFilter);
    }

    // Minimum price filter (excludes books, accessories, low-quality items)
    query = applyMinPriceFilter(query);

    // Exclude non-collectibles (stands, books, other accessories)
    query = query.not('item_type', 'ilike', 'stand');
    query = query.not('item_type', 'ilike', 'book');
    query = query.not('item_type', 'ilike', 'other');

    // Item type filter - use ILIKE for case-insensitive matching
    // Database has mixed case (e.g., "Katana" and "katana")
    // If specific itemTypes are provided, use those; otherwise use category filter
    const effectiveItemTypes = params.itemTypes?.length
      ? params.itemTypes
      : params.category === 'nihonto'
        ? NIHONTO_TYPES
        : params.category === 'tosogu'
          ? TOSOGU_TYPES
          : params.category === 'armor'
            ? ARMOR_TYPES
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

    // Historical period filter
    if (params.historicalPeriods?.length) {
      query = query.in('historical_period', params.historicalPeriods);
    }

    // Signature status filter (mei_type: signed = has mei, unsigned/mumei = no mei)
    if (params.signatureStatuses?.length) {
      query = query.in('signature_status', params.signatureStatuses);
    }

    // NBTHK Zufu translation filter - only show listings with OCR setsumei
    if (params.enriched) {
      query = query.not('setsumei_text_en', 'is', null);
    }

    // Process query with semantic extraction, numeric filters, and text search
    if (params.query && params.query.trim().length >= 2) {
      // Step 1: Extract semantic filters (certifications, item types) from query
      // This ensures "Tanto Juyo" filters by Juyo certification, not text match
      const { extractedFilters, remainingTerms } = parseSemanticQuery(params.query);

      // Apply extracted certification filters (exact match on cert_type)
      // Only apply if no explicit certification filter was already set via URL params
      if (extractedFilters.certifications.length > 0 && !params.certifications?.length) {
        const certVariants = extractedFilters.certifications.flatMap(c => CERT_VARIANTS[c] || [c]);
        query = query.in('cert_type', certVariants);
      }

      // Apply extracted item type filters (exact match on item_type)
      // Only apply if no explicit item type filter was already set via URL params
      if (extractedFilters.itemTypes.length > 0 && !params.itemTypes?.length && params.category === 'all') {
        const typeConditions = extractedFilters.itemTypes
          .map(t => `item_type.ilike.${t}`)
          .join(',');
        query = query.or(typeConditions);
      }

      // Apply extracted signature status filters (exact match on signature_status)
      // Only apply if no explicit signature status filter was already set via URL params
      if (extractedFilters.signatureStatuses?.length && !params.signatureStatuses?.length) {
        query = query.in('signature_status', extractedFilters.signatureStatuses);
      }

      // Step 2: Parse numeric filters from remaining terms
      const remainingQuery = remainingTerms.join(' ');
      const { filters, textWords } = parseNumericFilters(remainingQuery);

      // Apply numeric filters
      for (const { field, op, value } of filters) {
        query = query.filter(field, op, value);
      }

      // Step 3: Text search on remaining words (artisan names, provinces, etc.)
      // Uses PostgreSQL Full-Text Search with word boundary matching
      // This prevents substring pollution (e.g., "rai" matching "grained")
      if (textWords.length > 0) {
        // Build FTS query parts for each word, expanding aliases with OR
        const queryParts: string[] = [];

        for (const word of textWords) {
          // Get aliases for this word (e.g., 'koto' -> ['koto', 'kotou'])
          const aliases = expandSearchAliases(word)
            .map(normalizeSearchText)
            .filter(term => term.length >= 2);

          if (aliases.length === 0) continue;

          if (aliases.length === 1) {
            // Single term - use prefix match
            queryParts.push(`${aliases[0]}:*`);
          } else {
            // Multiple aliases - join with OR, wrap in parens
            // e.g., (koto:* | kotou:*)
            const orParts = aliases.map(a => `${a}:*`).join(' | ');
            queryParts.push(`(${orParts})`);
          }
        }

        if (queryParts.length > 0) {
          // Join all word groups with AND
          // e.g., "(koto:* | kotou:*) & tanto:*"
          const tsquery = queryParts.join(' & ');

          query = query.textSearch('search_vector', tsquery, {
            config: 'simple',  // 'simple' config for Japanese romanization (no stemming)
          });
        }
      }
    }

    // Sorting - use price_jpy for currency-normalized price sorting (cross-currency fix)
    switch (params.sort) {
      case 'price_asc':
        query = query.order('price_jpy', { ascending: true, nullsFirst: false });
        break;
      case 'price_desc':
        // ASK items (NULL price) appear last, after all priced items
        query = query.order('price_jpy', { ascending: false, nullsFirst: false });
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

    // Get dealer baselines for "new" badge logic
    // A dealer's baseline is their earliest listing's first_seen_at date
    // This prevents showing "NEW" badges on items that were part of initial import
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let enrichedListings: any[] = listings || [];

    if (listings && listings.length > 0) {
      // Get unique dealer IDs from results
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dealerIds = [...new Set(listings.map((l: any) => l.dealer_id as number))];

      // Query earliest first_seen_at for each dealer individually
      // This avoids the 1000-row Supabase limit that was causing missing baselines
      const baselinePromises = dealerIds.map(async (dealerId) => {
        const { data } = await supabase
          .from('listings')
          .select('dealer_id, first_seen_at')
          .eq('dealer_id', dealerId)
          .order('first_seen_at', { ascending: true })
          .limit(1)
          .single();
        return data as { dealer_id: number; first_seen_at: string } | null;
      });

      const baselines = await Promise.all(baselinePromises);

      // Build map of dealer_id -> earliest first_seen_at
      const baselineMap: Record<number, string> = {};
      for (const row of baselines) {
        if (row) {
          baselineMap[row.dealer_id] = row.first_seen_at;
        }
      }

      // Enrich listings with dealer baseline and sold data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      enrichedListings = listings.map((listing: any) => ({
        ...listing,
        dealer_earliest_seen_at: baselineMap[listing.dealer_id] || null,
        sold_data: computeSoldData(listing),
      }));
    }

    // Get facet counts - computed fresh to reflect current filter state
    // Each facet is filtered by all OTHER active filters (standard faceted search pattern)
    const [typesFacet, certsFacet, dealersFacet, periodsFacet, signatureFacet] = await Promise.all([
      // Item type facets: filtered by certifications, dealers, askOnly (NOT by category/itemTypes)
      getItemTypeFacets(supabase, statusFilter, {
        certifications: params.certifications,
        dealers: params.dealers,
        historicalPeriods: params.historicalPeriods,
        signatureStatuses: params.signatureStatuses,
        askOnly: params.askOnly,
        query: params.query,
      }),
      // Certification facets: filtered by category/itemTypes, dealers, askOnly
      getCertificationFacets(supabase, statusFilter, {
        category: params.category,
        itemTypes: params.itemTypes,
        dealers: params.dealers,
        historicalPeriods: params.historicalPeriods,
        signatureStatuses: params.signatureStatuses,
        askOnly: params.askOnly,
        query: params.query,
      }),
      // Dealer facets: filtered by category/itemTypes, certifications, askOnly
      getDealerFacets(supabase, statusFilter, {
        category: params.category,
        itemTypes: params.itemTypes,
        certifications: params.certifications,
        historicalPeriods: params.historicalPeriods,
        signatureStatuses: params.signatureStatuses,
        askOnly: params.askOnly,
        query: params.query,
      }),
      // Historical period facets
      getHistoricalPeriodFacets(supabase, statusFilter, {
        category: params.category,
        itemTypes: params.itemTypes,
        certifications: params.certifications,
        dealers: params.dealers,
        signatureStatuses: params.signatureStatuses,
        askOnly: params.askOnly,
        query: params.query,
      }),
      // Signature status facets
      getSignatureStatusFacets(supabase, statusFilter, {
        category: params.category,
        itemTypes: params.itemTypes,
        certifications: params.certifications,
        dealers: params.dealers,
        historicalPeriods: params.historicalPeriods,
        askOnly: params.askOnly,
        query: params.query,
      }),
    ]);

    // Get the most recent scrape timestamp for freshness indicator
    let freshnessQuery = supabase
      .from('listings')
      .select('last_scraped_at');
    if (statusFilter) {
      freshnessQuery = freshnessQuery.or(statusFilter);
    }
    const { data: freshnessData } = await freshnessQuery
      .order('last_scraped_at', { ascending: false })
      .limit(1)
      .single();

    const lastUpdated = (freshnessData as { last_scraped_at: string } | null)?.last_scraped_at || null;

    // Create response with cache headers
    const response = NextResponse.json({
      listings: enrichedListings,
      total: count || 0,
      page: safePage,
      totalPages: Math.ceil((count || 0) / params.limit!),
      facets: {
        itemTypes: typesFacet,
        certifications: certsFacet,
        dealers: dealersFacet,
        historicalPeriods: periodsFacet,
        signatureStatuses: signatureFacet,
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
  category?: 'all' | 'nihonto' | 'tosogu' | 'armor';
  itemTypes?: string[];
  certifications?: string[];
  dealers?: number[];
  historicalPeriods?: string[];
  signatureStatuses?: string[];
  askOnly?: boolean;
  query?: string;
}

// Facet functions - apply filters to reflect user's current selection
// Uses JS-side filtering for category/itemTypes since Supabase .or() calls
// don't combine with AND when filtering by both status and item type
//
// IMPORTANT: Supabase limits queries to 1000 rows by default, so we must
// paginate to get accurate facet counts for large result sets.

const FACET_PAGE_SIZE = 1000;

async function getItemTypeFacets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statusFilter: string | null,
  options: FacetFilterOptions
) {
  // Aggregate counts with pagination
  const counts: Record<string, number> = {};
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Build query with filters (excluding category/itemTypes since we're counting those)
    let query = supabase
      .from('listings')
      .select('item_type')
      .not('item_type', 'ilike', 'stand')  // Exclude non-collectibles to match main query
      .not('item_type', 'ilike', 'book')
      .not('item_type', 'ilike', 'other');

    // Status filter (only apply if not 'all')
    if (statusFilter) {
      query = query.or(statusFilter);
    }

    // Apply minimum price filter
    query = applyMinPriceFilter(query);

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

    // Fetch page
    const { data, error } = await query.range(offset, offset + FACET_PAGE_SIZE - 1);
    if (error || !data) break;

    // Count this page
    (data as Array<{ item_type: string | null }>).forEach(row => {
      const type = row.item_type;
      if (type) {
        const normalized = type.toLowerCase().replace('fuchi_kashira', 'fuchi-kashira');
        counts[normalized] = (counts[normalized] || 0) + 1;
      }
    });

    hasMore = data.length === FACET_PAGE_SIZE;
    offset += FACET_PAGE_SIZE;

    // Safety limit
    if (offset > 50000) break;
  }

  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

async function getCertificationFacets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statusFilter: string | null,
  options: FacetFilterOptions
) {
  // Determine which item types to include based on category
  const effectiveItemTypes = options.itemTypes?.length
    ? options.itemTypes
    : options.category === 'nihonto'
      ? NIHONTO_TYPES
      : options.category === 'tosogu'
        ? TOSOGU_TYPES
        : options.category === 'armor'
          ? ARMOR_TYPES
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

  // Aggregate counts with pagination
  const counts: Record<string, number> = {};
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Build query - fetch item_type along with cert_type for JS-side filtering
    let query = supabase
      .from('listings')
      .select('cert_type, item_type')
      .not('item_type', 'ilike', 'stand')  // Exclude non-collectibles to match main query
      .not('item_type', 'ilike', 'book')
      .not('item_type', 'ilike', 'other');

    // Status filter (only apply if not 'all')
    if (statusFilter) {
      query = query.or(statusFilter);
    }

    // Apply minimum price filter
    query = applyMinPriceFilter(query);

    // Apply dealer filter at DB level (this works with AND)
    if (options.dealers?.length) {
      query = query.in('dealer_id', options.dealers);
    }
    if (options.askOnly) {
      query = query.is('price_value', null);
    }

    // Fetch page
    const { data, error } = await query.range(offset, offset + FACET_PAGE_SIZE - 1);
    if (error || !data) break;

    // Filter and count this page
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

    hasMore = data.length === FACET_PAGE_SIZE;
    offset += FACET_PAGE_SIZE;

    // Safety limit
    if (offset > 50000) break;
  }

  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

async function getDealerFacets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statusFilter: string | null,
  options: FacetFilterOptions
) {
  // Determine which item types to include based on category
  const effectiveItemTypes = options.itemTypes?.length
    ? options.itemTypes
    : options.category === 'nihonto'
      ? NIHONTO_TYPES
      : options.category === 'tosogu'
        ? TOSOGU_TYPES
        : options.category === 'armor'
          ? ARMOR_TYPES
          : undefined;

  // Aggregate counts with pagination
  const counts: Record<string, { id: number; name: string; count: number }> = {};
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Build query - fetch item_type and cert_type for JS-side filtering
    let query = supabase
      .from('listings')
      .select('dealer_id, dealers!inner(name), item_type')
      .not('item_type', 'ilike', 'stand')  // Exclude non-collectibles to match main query
      .not('item_type', 'ilike', 'book')
      .not('item_type', 'ilike', 'other');

    // Status filter (only apply if not 'all')
    if (statusFilter) {
      query = query.or(statusFilter);
    }

    // Apply minimum price filter
    query = applyMinPriceFilter(query);

    // Apply certification filter at DB level (this works with AND)
    if (options.certifications?.length) {
      const allVariants = options.certifications.flatMap(c => CERT_VARIANTS[c] || [c]);
      query = query.in('cert_type', allVariants);
    }
    if (options.askOnly) {
      query = query.is('price_value', null);
    }

    // Fetch page
    const { data, error } = await query.range(offset, offset + FACET_PAGE_SIZE - 1);
    if (error || !data) break;

    // Filter and count this page
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

    hasMore = data.length === FACET_PAGE_SIZE;
    offset += FACET_PAGE_SIZE;

    // Safety limit
    if (offset > 50000) break;
  }

  return Object.values(counts).sort((a, b) => b.count - a.count);
}

// Historical period order (chronological)
const HISTORICAL_PERIOD_ORDER = [
  'Heian', 'Kamakura', 'Nanbokucho', 'Muromachi', 'Momoyama',
  'Edo', 'Meiji', 'Taisho', 'Showa', 'Heisei', 'Reiwa'
];

async function getHistoricalPeriodFacets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statusFilter: string | null,
  options: FacetFilterOptions
) {
  // Determine which item types to include based on category
  const effectiveItemTypes = options.itemTypes?.length
    ? options.itemTypes
    : options.category === 'nihonto'
      ? NIHONTO_TYPES
      : options.category === 'tosogu'
        ? TOSOGU_TYPES
        : options.category === 'armor'
          ? ARMOR_TYPES
          : undefined;

  // Aggregate counts with pagination
  const counts: Record<string, number> = {};
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('listings')
      .select('historical_period, item_type')
      .not('item_type', 'ilike', 'stand')  // Exclude non-collectibles
      .not('item_type', 'ilike', 'book')
      .not('item_type', 'ilike', 'other');

    // Status filter (only apply if not 'all')
    if (statusFilter) {
      query = query.or(statusFilter);
    }

    // Apply minimum price filter
    query = applyMinPriceFilter(query);

    // Apply filters
    if (options.certifications?.length) {
      const allVariants = options.certifications.flatMap(c => CERT_VARIANTS[c] || [c]);
      query = query.in('cert_type', allVariants);
    }
    if (options.dealers?.length) {
      query = query.in('dealer_id', options.dealers);
    }
    if (options.signatureStatuses?.length) {
      query = query.in('signature_status', options.signatureStatuses);
    }
    if (options.askOnly) {
      query = query.is('price_value', null);
    }

    const { data, error } = await query.range(offset, offset + FACET_PAGE_SIZE - 1);
    if (error || !data) break;

    (data as Array<{ historical_period: string | null; item_type: string | null }>).forEach(row => {
      // Filter by item type if category is set
      if (effectiveItemTypes) {
        const itemType = row.item_type?.toLowerCase().replace('fuchi_kashira', 'fuchi-kashira');
        if (!itemType || !effectiveItemTypes.some(t => t.toLowerCase() === itemType)) {
          return;
        }
      }

      const period = row.historical_period;
      if (period && period !== 'null') {
        counts[period] = (counts[period] || 0) + 1;
      }
    });

    hasMore = data.length === FACET_PAGE_SIZE;
    offset += FACET_PAGE_SIZE;
    if (offset > 50000) break;
  }

  // Sort by chronological order
  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      const aIdx = HISTORICAL_PERIOD_ORDER.indexOf(a.value);
      const bIdx = HISTORICAL_PERIOD_ORDER.indexOf(b.value);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
}

async function getSignatureStatusFacets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statusFilter: string | null,
  options: FacetFilterOptions
) {
  // Determine which item types to include based on category
  const effectiveItemTypes = options.itemTypes?.length
    ? options.itemTypes
    : options.category === 'nihonto'
      ? NIHONTO_TYPES
      : options.category === 'tosogu'
        ? TOSOGU_TYPES
        : options.category === 'armor'
          ? ARMOR_TYPES
          : undefined;

  // Aggregate counts with pagination
  const counts: Record<string, number> = {};
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('listings')
      .select('signature_status, item_type')
      .not('item_type', 'ilike', 'stand')  // Exclude non-collectibles
      .not('item_type', 'ilike', 'book')
      .not('item_type', 'ilike', 'other');

    // Status filter (only apply if not 'all')
    if (statusFilter) {
      query = query.or(statusFilter);
    }

    // Apply minimum price filter
    query = applyMinPriceFilter(query);

    // Apply filters
    if (options.certifications?.length) {
      const allVariants = options.certifications.flatMap(c => CERT_VARIANTS[c] || [c]);
      query = query.in('cert_type', allVariants);
    }
    if (options.dealers?.length) {
      query = query.in('dealer_id', options.dealers);
    }
    if (options.historicalPeriods?.length) {
      query = query.in('historical_period', options.historicalPeriods);
    }
    if (options.askOnly) {
      query = query.is('price_value', null);
    }

    const { data, error } = await query.range(offset, offset + FACET_PAGE_SIZE - 1);
    if (error || !data) break;

    (data as Array<{ signature_status: string | null; item_type: string | null }>).forEach(row => {
      // Filter by item type if category is set
      if (effectiveItemTypes) {
        const itemType = row.item_type?.toLowerCase().replace('fuchi_kashira', 'fuchi-kashira');
        if (!itemType || !effectiveItemTypes.some(t => t.toLowerCase() === itemType)) {
          return;
        }
      }

      const status = row.signature_status;
      if (status && status !== 'null') {
        counts[status] = (counts[status] || 0) + 1;
      }
    });

    hasMore = data.length === FACET_PAGE_SIZE;
    offset += FACET_PAGE_SIZE;
    if (offset > 50000) break;
  }

  // Sort: signed first, then unsigned/mumei
  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (a.value === 'signed') return -1;
      if (b.value === 'signed') return 1;
      return a.value.localeCompare(b.value);
    });
}
