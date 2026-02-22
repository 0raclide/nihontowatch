import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeSearchText, expandSearchAliases } from '@/lib/search';
import { toTraditionalKanji, hasKanjiVariants } from '@/lib/search/textNormalization';
import { containsCJK } from '@/lib/search/cjkDetection';
import { detectUrlQuery } from '@/lib/search/urlDetection';
import { parseNumericFilters } from '@/lib/search/numericFilters';
import { parseSemanticQuery, PROVINCE_VARIANTS } from '@/lib/search/semanticQueryParser';
import { CACHE, PAGINATION, LISTING_FILTERS } from '@/lib/constants';
import { getArtisanNames, resolveArtisanCodesFromText } from '@/lib/supabase/yuhinkai';
import { getArtisanDisplayName, getArtisanDisplayNameKanji, getArtisanAlias } from '@/lib/artisan/displayName';
import { getArtisanTier } from '@/lib/artisan/tier';
import { getAttributionName } from '@/lib/listing/attribution';
import { expandArtisanCodes } from '@/lib/artisan/schoolExpansion';
import { getUserSubscription, getDataDelayCutoff } from '@/lib/subscription/server';
import { logger } from '@/lib/logger';

// Force dynamic rendering - needed for subscription-based data filtering
// Without this, Vercel edge might cache responses before auth check runs
export const dynamic = 'force-dynamic';

// Facets are computed fresh for each request to reflect current filters
// No caching - facet counts must accurately reflect user's filter selections

interface BrowseParams {
  tab: 'available' | 'sold' | 'all';
  category?: 'nihonto' | 'tosogu' | 'armor';
  itemTypes?: string[];
  certifications?: string[];
  schools?: string[];
  dealers?: number[];
  historicalPeriods?: string[];
  signatureStatuses?: string[];
  askOnly?: boolean;
  /** Price range filter (JPY) — min threshold */
  priceMin?: number;
  /** Price range filter (JPY) — max threshold */
  priceMax?: number;
  /** Admin filter: show Juyo/Tokuju items missing setsumei (no OCR and no manual Yuhinkai) */
  missingSetsumei?: boolean;
  /** Admin filter: show items missing artisan code match */
  missingArtisanCode?: boolean;
  /** Artisan code filter (substring match) */
  artisanCode?: string;
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

// Artisan code pattern — used both for pre-scan (skip category filter) and in-query detection
// Covers: standard (1-4 letters + 1-5 digits + optional suffix), NS-*, NC-*, tmp*, underscore
const ARTISAN_CODE_PATTERN = /^[A-Z]{1,4}\d{1,5}(?:[.\-]\d)?[A-Za-z]?$|^NS-[A-Za-z]+(?:-[A-Za-z]+)*$|^NC-[A-Z]+\d+[A-Za-z]?$|^tmp[A-Z]{1,4}\d+[A-Za-z]?$|^[A-Z]+(?:_[A-Z]+)+\d+$/i;

// Armor & accessories
const ARMOR_TYPES = [
  'armor', 'yoroi', 'gusoku',  // Full armor suits
  'helmet', 'kabuto',  // Helmets
  'menpo', 'mengu',  // Face masks
  'kote',  // Gauntlets
  'suneate',  // Shin guards
  'do',  // Chest armor
  // Firearms (grouped with armor as military equipment)
  'tanegashima', 'hinawaju',  // Matchlock guns (火縄銃/種子島)
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
  const categoryRaw = searchParams.get('cat') as 'nihonto' | 'tosogu' | 'armor' | null;

  // Parse offset if provided (explicit offset takes precedence over page-based calculation)
  const offsetRaw = searchParams.get('offset');
  const explicitOffset = offsetRaw ? Number(offsetRaw) : undefined;

  // Parse price range
  const priceMinRaw = searchParams.get('priceMin');
  const priceMaxRaw = searchParams.get('priceMax');

  return {
    tab: (searchParams.get('tab') as 'available' | 'sold') || 'available',
    category: categoryRaw || 'nihonto',
    itemTypes: itemTypesRaw ? itemTypesRaw.split(',').map(t => t.toLowerCase()) : undefined,
    certifications: certificationsRaw ? certificationsRaw.split(',') : undefined,
    schools: schoolsRaw ? schoolsRaw.split(',') : undefined,
    dealers: dealersRaw ? dealersRaw.split(',').map(Number) : undefined,
    historicalPeriods: historicalPeriodsRaw ? historicalPeriodsRaw.split(',') : undefined,
    signatureStatuses: signatureStatusesRaw ? signatureStatusesRaw.split(',') : undefined,
    askOnly: searchParams.get('ask') === 'true',
    priceMin: priceMinRaw ? Number(priceMinRaw) : undefined,
    priceMax: priceMaxRaw ? Number(priceMaxRaw) : undefined,
    missingSetsumei: searchParams.get('missing_setsumei') === 'true',
    missingArtisanCode: searchParams.get('missing_artisan') === 'true',
    artisanCode: searchParams.get('artisan') || undefined,
    query: searchParams.get('q') || undefined,
    sort: searchParams.get('sort') || 'featured',
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
// ASK listings (price_value IS NULL) are allowed through; priced items must meet minimum
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyMinPriceFilter<T extends { or: (condition: string) => T }>(query: T): T {
  if (LISTING_FILTERS.MIN_PRICE_JPY > 0) {
    // Allow ASK listings (no price_value) OR items with price_jpy >= minimum
    // Using price_value.is.null (not price_jpy) ensures we only allow true ASK listings
    return query.or(`price_value.is.null,price_jpy.gte.${LISTING_FILTERS.MIN_PRICE_JPY}`);
  }
  return query;
}

// Certification variants mapping (for backward compatibility until data is normalized)
const CERT_VARIANTS: Record<string, string[]> = {
  'Juyo Bijutsuhin': ['Juyo Bijutsuhin', 'JuBi', 'jubi'], // Pre-war government designation
  'Juyo': ['Juyo', 'juyo'],
  'Tokuju': ['Tokuju', 'tokuju', 'Tokubetsu Juyo', 'tokubetsu_juyo'],
  'TokuHozon': ['TokuHozon', 'Tokubetsu Hozon', 'tokubetsu_hozon'],
  'Hozon': ['Hozon', 'hozon'],
  'TokuKicho': ['TokuKicho', 'Tokubetsu Kicho', 'tokubetsu_kicho'],
};

/**
 * Rerank listings to ensure no more than maxConsecutive items from the same dealer
 * appear in a row. Preserves original score ordering as much as possible.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyDealerDiversity(listings: any[], maxConsecutive: number = 2): any[] {
  if (listings.length <= maxConsecutive) return listings;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any[] = [];
  const remaining = [...listings];

  while (remaining.length > 0) {
    const recentDealerIds = result.slice(-maxConsecutive).map(l => l.dealer_id);
    const idx = remaining.findIndex(l => {
      const consecutive = recentDealerIds.filter(d => d === l.dealer_id).length;
      return consecutive < maxConsecutive;
    });
    if (idx === -1) {
      // No candidate breaks the streak — append remaining as-is
      result.push(...remaining);
      break;
    }
    result.push(remaining.splice(idx, 1)[0]);
  }
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const params = parseParams(request.nextUrl.searchParams);

    // Step 0: URL detection — short-circuits the entire search pipeline
    // When a user pastes a dealer URL, we search the url column directly
    const detectedUrl = params.query ? detectUrlQuery(params.query) : null;

    // Get user subscription to determine data delay
    const subscription = await getUserSubscription();

    // Ensure page is reasonable
    const safePage = Math.max(1, Math.min(params.page || 1, 1000));
    // Use explicit offset if provided, otherwise calculate from page
    // Explicit offset is needed for infinite scroll where page sizes vary
    const offset = params.offset !== undefined
      ? Math.max(0, params.offset)
      : (safePage - 1) * params.limit!;
    // Status filter: 'all' = no filter, 'sold' = sold only, otherwise available only (default)
    // URL searches override to null (search all statuses — available, sold, etc.)
    const statusFilter = detectedUrl
      ? null
      : params.tab === 'all'
        ? null
        : (params.tab === 'sold' ? STATUS_SOLD : STATUS_AVAILABLE);

    // Build query
    // Note: listing_yuhinkai_enrichment view already filters to DEFINITIVE matches
    // that are either manual (confirmed) or auto-matched, so presence = valid enrichment
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
        is_initial_import,
        admin_hidden,
        status_admin_locked,
        dealer_id,
        artisan_id,
        artisan_confidence,
        artisan_method,
        artisan_candidates,
        artisan_verified,
        featured_score,
        focal_x,
        focal_y,
        dealers:dealers!inner(id, name, domain, earliest_listing_at),
        listing_yuhinkai_enrichment(
          setsumei_en,
          match_confidence,
          connection_source,
          verification_status
        )
      `, { count: 'exact' });

    // Status filter (only apply if not 'all' - null means show both available and sold)
    if (statusFilter) {
      query = query.or(statusFilter);
    }

    // 7-day data delay for free tier users
    // Free users only see listings discovered more than 7 days ago
    if (subscription.isDelayed) {
      const delayCutoff = getDataDelayCutoff();
      query = query.lte('first_seen_at', delayCutoff);
    }

    // Minimum price filter (excludes books, accessories, low-quality items)
    // Skip for URL searches — specific item lookup shouldn't be filtered by price
    if (!detectedUrl) {
      query = applyMinPriceFilter(query);
    }

    // Hide admin-hidden listings from non-admin users
    if (!subscription.isAdmin) {
      query = query.eq('admin_hidden', false);
    }

    // Exclude non-collectibles (stands, books, other accessories)
    // Skip for URL searches — specific item lookup should find any item type
    if (!detectedUrl) {
      query = query.not('item_type', 'ilike', 'stand');
      query = query.not('item_type', 'ilike', 'book');
      query = query.not('item_type', 'ilike', 'other');
    }

    // Item type filter - use ILIKE for case-insensitive matching
    // Database has mixed case (e.g., "Katana" and "katana")
    // If specific itemTypes are provided, use those; otherwise use category filter
    //
    // Skip category filter when an artisan code is present (query or explicit param).
    // Artisan codes are cross-category — a smith code like YOS1434 should return blades
    // even when the user is on the tosogu tab.
    const hasArtisanCode = params.artisanCode ||
      (params.query && params.query.trim().split(/\s+/).some(w => ARTISAN_CODE_PATTERN.test(w)));

    const effectiveItemTypes = params.itemTypes?.length
      ? params.itemTypes
      : hasArtisanCode
        ? undefined  // artisan code overrides category
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

    // Price range filter (uses price_jpy for currency-normalized comparison)
    // When a user explicitly selects a price bracket, ASK items (no price) are excluded
    if (params.priceMin) {
      query = query.gte('price_jpy', params.priceMin);
    }
    if (params.priceMax) {
      query = query.lte('price_jpy', params.priceMax);
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

    // Artisan code filter (substring match for admin research)
    // For school codes (NS-*), expand to include all member artisan codes
    if (params.artisanCode) {
      const expanded = await expandArtisanCodes(params.artisanCode);
      if (expanded.length > 1) {
        query = query.in('artisan_id' as string, expanded);
      } else {
        query = query.ilike('artisan_id', `%${params.artisanCode}%`);
      }
    }

    // Admin filter: Missing setsumei - Juyo/Tokuju items without OCR setsumei
    // Only apply for admins (checked via subscription.isAdmin)
    if (params.missingSetsumei && subscription.isAdmin) {
      // Filter for Juyo/Tokuju certifications (eligible for setsumei)
      const juyoCerts = ['Juyo', 'juyo', 'Tokuju', 'tokuju', 'Tokubetsu Juyo', 'tokubetsu_juyo'];
      query = query.in('cert_type', juyoCerts);
      // Filter where setsumei_text_en IS NULL (no OCR translation)
      query = query.is('setsumei_text_en', null);

      // Also exclude listings with valid manual Yuhinkai enrichments
      // These already have setsumei via the enrichment system (not OCR)
      const { data: manualEnrichments } = await supabase
        .from('yuhinkai_enrichments')
        .select('listing_id')
        .eq('connection_source', 'manual')
        .eq('verification_status', 'confirmed')
        .eq('match_confidence', 'DEFINITIVE')
        .not('setsumei_en', 'is', null) as { data: { listing_id: number | null }[] | null };

      if (manualEnrichments?.length) {
        const excludeIds = manualEnrichments.map(e => e.listing_id).filter((id): id is number => id !== null);
        if (excludeIds.length > 0) {
          query = query.not('id', 'in', `(${excludeIds.join(',')})`);
        }
      }
    }

    // Admin filter: Missing artisan code - items without Yuhinkai artisan match
    // Only apply for admins (checked via subscription.isAdmin)
    if (params.missingArtisanCode && subscription.isAdmin) {
      query = query.is('artisan_id', null);
    }

    // URL search: ILIKE match on url column, skip entire semantic/FTS pipeline
    if (detectedUrl) {
      query = query.ilike('url', `%${detectedUrl}%`);
    }

    // Process query with semantic extraction, numeric filters, and text search
    // Skip entirely if URL was detected (already handled above)
    if (!detectedUrl && params.query && params.query.trim().length >= 2) {
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
      if (extractedFilters.itemTypes.length > 0 && !params.itemTypes?.length) {
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

      // Apply extracted province filters (ILIKE on province/school/tosogu_school)
      // Only apply if no explicit school filter was already set via URL params
      if (extractedFilters.provinces?.length && !params.schools?.length) {
        const allVariants = extractedFilters.provinces.flatMap(
          p => PROVINCE_VARIANTS[p] || [p]
        );
        const provinceConditions = allVariants
          .flatMap(v => [
            `province.ilike.%${v}%`,
            `school.ilike.%${v}%`,
            `tosogu_school.ilike.%${v}%`,
          ])
          .join(',');
        query = query.or(provinceConditions);
      }

      // Step 2: Parse numeric filters from remaining terms
      const remainingQuery = remainingTerms.join(' ');
      const { filters, textWords } = parseNumericFilters(remainingQuery);

      // Apply numeric filters
      for (const { field, op, value } of filters) {
        query = query.filter(field, op, value);
      }

      // Step 3: Check if query looks like an artisan code (e.g., "MAS590", "MYO3", "NS-Ko-Bizen")
      const potentialArtisanCode = textWords.find(w => ARTISAN_CODE_PATTERN.test(w));
      if (potentialArtisanCode) {
        // Search artisan_id field directly (case-insensitive substring match)
        query = query.ilike('artisan_id', `%${potentialArtisanCode}%`);
      }

      // Step 4: Text search on remaining words (artisan names, provinces, etc.)
      // Uses PostgreSQL Full-Text Search with word boundary matching
      // This prevents substring pollution (e.g., "rai" matching "grained")
      // Skip FTS if we already matched an artisan code (avoid zero results from FTS miss)
      if (textWords.length > 0 && !potentialArtisanCode) {
        // Check if any text words contain CJK characters (kanji/kana)
        const hasCJK = textWords.some(containsCJK);

        if (hasCJK) {
          // CJK search path: ILIKE on structured fields + description
          // PostgreSQL FTS with 'simple' config can't tokenize CJK, so we bypass it entirely
          // Also resolve artisan codes from Yuhinkai (name_kanji search)
          const artisanCodes = await resolveArtisanCodesFromText(
            textWords.filter(w => w.length >= 1)
          );
          const artisanConditions = artisanCodes.map(code => `artisan_id.eq.${code}`);

          for (const word of textWords) {
            // Build search variants: original + traditional kanji form
            const variants = [word];
            if (hasKanjiVariants(word)) {
              variants.push(toTraditionalKanji(word));
            }
            const fieldConditions = variants.flatMap(term => [
              `title.ilike.%${term}%`,
              `smith.ilike.%${term}%`,
              `tosogu_maker.ilike.%${term}%`,
              `school.ilike.%${term}%`,
              `tosogu_school.ilike.%${term}%`,
              `description.ilike.%${term}%`,
            ]);
            query = query.or([...fieldConditions, ...artisanConditions].join(','));
          }
        } else {
          // Romaji search path (existing FTS pipeline)
          // Resolve artisan codes from Yuhinkai for name-based search
          // e.g., "norishige" → [NOR312, NOR567] so artisan-matched listings are found
          const artisanCodes = await resolveArtisanCodesFromText(
            textWords.map(w => normalizeSearchText(w)).filter(w => w.length >= 2)
          );

          if (artisanCodes.length > 0) {
            // Artisan codes found — use ILIKE on structured fields + artisan_id match
            // Each word gets its own .or() call, creating AND across words
            // A listing matches if for EVERY word, it matches either a field ILIKE or has a matching artisan_id
            const artisanConditions = artisanCodes.map(code => `artisan_id.eq.${code}`);

            for (const word of textWords) {
              const expandedTerms = expandSearchAliases(word).map(normalizeSearchText);
              const fieldConditions = expandedTerms.flatMap(term => [
                `title.ilike.%${term}%`,
                `smith.ilike.%${term}%`,
                `tosogu_maker.ilike.%${term}%`,
                `school.ilike.%${term}%`,
                `tosogu_school.ilike.%${term}%`,
              ]);
              query = query.or([...fieldConditions, ...artisanConditions].join(','));
            }
          } else {
            // No artisan match — use existing FTS path
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
      }
    }

    // Sorting - use price_jpy for currency-normalized price sorting (cross-currency fix)
    // Price sorts use has_price (generated column) as primary key to reliably push
    // ASK items (NULL price) to the end. Boolean DESC puts TRUE before FALSE.
    switch (params.sort) {
      case 'price_asc':
        query = query
          .order('has_price', { ascending: false })
          .order('price_jpy', { ascending: true });
        break;
      case 'price_desc':
        query = query
          .order('has_price', { ascending: false })
          .order('price_jpy', { ascending: false });
        break;
      case 'name':
        query = query.order('title', { ascending: true });
        break;
      case 'sale_date':
        // For sold tab: sort by when items sold (newest sales first)
        // Items WITH a sale date appear first, sorted by date descending
        // Items WITHOUT a sale date appear last, sorted by first_seen_at descending
        // Note: Supabase nullsFirst only affects position within the sort, not a separate group
        // So we use a compound sort: first by having a date, then by the date itself
        query = query
          .order('status_changed_at', { ascending: false, nullsFirst: false })
          .order('first_seen_at', { ascending: false });
        break;
      case 'elite_factor':
        // Sort by artisan's bayesian elite factor (admin-only feature)
        // Higher elite factor = more prestigious maker
        // Listings without artisan match appear last (nullsFirst: false)
        query = query.order('artisan_elite_factor', { ascending: false, nullsFirst: false });
        break;
      case 'featured':
        // Algorithmic sort by precomputed featured_score (quality + heat × freshness)
        // Higher score = more impressive items first
        // Listings without scores (NULL) appear last
        query = query.order('featured_score', { ascending: false, nullsFirst: false });
        break;
      default:
        // "Newest" sort: Genuine new inventory first, then bulk imports
        // is_initial_import: FALSE (genuine new) sorts before TRUE (bulk import)
        // Within each group, sort by discovery date (newest first)
        query = query
          .order('is_initial_import', { ascending: true, nullsFirst: false })
          .order('first_seen_at', { ascending: false });
    }

    // Pagination
    query = query.range(offset, offset + params.limit! - 1);

    const { data: listings, error, count } = await query;

    if (error) {
      logger.error('Browse query error', { error });
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

    // Enrich listings with dealer baseline (from join) and sold data
    // dealer.earliest_listing_at is a synced column on the dealers table (migration 037)
    // This eliminates N+1 queries that previously fetched baselines per dealer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let enrichedListings: any[] = listings || [];

    if (listings && listings.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      enrichedListings = listings.map((listing: any) => ({
        ...listing,
        dealer_earliest_seen_at: listing.dealers?.earliest_listing_at || null,
        sold_data: computeSoldData(listing),
        // Normalize Supabase relation name to the key expected by hasSetsumeiData/hasVerifiedEnrichment
        yuhinkai_enrichment: listing.listing_yuhinkai_enrichment?.[0] || null,
      }));

      // Enrich listings with artisan display names from Yuhinkai
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const artisanCodes = [...new Set(enrichedListings.map((l: any) => l.artisan_id).filter(Boolean))] as string[];
      if (artisanCodes.length > 0) {
        const artisanNameMap = await getArtisanNames(artisanCodes);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        enrichedListings = enrichedListings.map((listing: any) => {
          if (listing.artisan_id && artisanNameMap.has(listing.artisan_id)) {
            const entry = artisanNameMap.get(listing.artisan_id)!;
            return {
              ...listing,
              artisan_display_name: getArtisanAlias(listing.artisan_id) || getArtisanDisplayName(entry.name_romaji, entry.school, listing.artisan_id),
              artisan_name_kanji: getArtisanDisplayNameKanji(entry.name_kanji, listing.artisan_id),
              artisan_tier: getArtisanTier(entry),
            };
          }
          // Fallback: use smith/tosogu_maker when Yuhinkai lookup misses
          if (listing.artisan_id && !listing.artisan_display_name) {
            return {
              ...listing,
              artisan_display_name: getAttributionName(listing),
            };
          }
          return listing;
        });
      }
    }

    // Enrich sold items with sale price from price_history
    // When items sell, price_value becomes NULL - retrieve from history
    if (params.tab === 'sold' && enrichedListings.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const soldIdsWithoutPrice = enrichedListings
        .filter((l: any) => l.is_sold && !l.price_value)
        .map((l: any) => l.id as number);

      if (soldIdsWithoutPrice.length > 0) {
        const { data: priceHistoryData } = await supabase
          .from('price_history')
          .select('listing_id, old_price, old_currency')
          .in('listing_id', soldIdsWithoutPrice)
          .in('change_type', ['sold', 'presumed_sold']) as {
            data: Array<{ listing_id: number; old_price: number | null; old_currency: string | null }> | null
          };

        if (priceHistoryData && priceHistoryData.length > 0) {
          // Build lookup map: listing_id -> sale price data
          const salePriceMap = new Map<number, { sale_price: number; sale_currency: string }>();
          for (const ph of priceHistoryData) {
            if (ph.old_price && ph.listing_id) {
              salePriceMap.set(ph.listing_id, {
                sale_price: ph.old_price,
                sale_currency: ph.old_currency || 'JPY'
              });
            }
          }

          // Enrich listings with sale price from history
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          enrichedListings = enrichedListings.map((listing: any) => {
            if (listing.is_sold && !listing.price_value) {
              const saleData = salePriceMap.get(listing.id);
              if (saleData) {
                return {
                  ...listing,
                  price_value: saleData.sale_price,
                  price_currency: saleData.sale_currency,
                  price_from_history: true
                };
              }
            }
            return listing;
          });
        }
      }
    }

    // Dealer diversity: rerank featured sort to prevent long runs from one dealer
    // Skip when exactly 1 dealer is selected — user explicitly chose that dealer
    if (params.sort === 'featured' && (!params.dealers || params.dealers.length !== 1)) {
      enrichedListings = applyDealerDiversity(enrichedListings);
    }

    // Get data delay cutoff for free tier (used by facets too)
    const delayCutoff = subscription.isDelayed ? getDataDelayCutoff() : undefined;

    // Shared RPC params (used by both facets and histogram)
    const rpcBaseParams = {
      p_tab: params.tab === 'all' ? 'all' : params.tab,
      p_admin_hidden: subscription.isAdmin || false,
      p_delay_cutoff: delayCutoff || null,
      p_min_price_jpy: LISTING_FILTERS.MIN_PRICE_JPY,
      p_item_types: params.itemTypes || null,
      p_category: params.category || 'nihonto',
      p_certifications: params.certifications || null,
      p_dealers: params.dealers || null,
      p_historical_periods: params.historicalPeriods || null,
      p_signature_statuses: params.signatureStatuses || null,
      p_ask_only: params.askOnly || false,
    };

    // Get facet counts + price histogram in parallel via SQL RPC calls
    // Each facet dimension is filtered by all OTHER active filters (standard cross-filter pattern)
    // Histogram is cross-filtered by all dimensions EXCEPT price (shows full price distribution)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [facetsResult, histogramResult] = await Promise.all([
      (supabase.rpc as any)('get_browse_facets', rpcBaseParams),
      (supabase.rpc as any)('get_price_histogram', rpcBaseParams),
    ]);

    const { data: facetsData, error: facetsError } = facetsResult;
    const { data: histogramData, error: histogramError } = histogramResult;

    // Parse facets from RPC response (already in the correct shape for FilterContent)
    const facets = facetsError ? {
      itemTypes: [] as { value: string; count: number }[],
      certifications: [] as { value: string; count: number }[],
      dealers: [] as { id: number; name: string; count: number }[],
      historicalPeriods: [] as { value: string; count: number }[],
      signatureStatuses: [] as { value: string; count: number }[],
    } : facetsData as {
      itemTypes: { value: string; count: number }[];
      certifications: { value: string; count: number }[];
      dealers: { id: number; name: string; count: number }[];
      historicalPeriods: { value: string; count: number }[];
      signatureStatuses: { value: string; count: number }[];
    };

    if (facetsError) {
      logger.error('Facets RPC error', { error: facetsError });
    }

    if (histogramError) {
      logger.error('Histogram RPC error', { error: histogramError });
    }

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

    // Total active dealer count (independent of status filter, for subtitle text)
    const { count: totalDealerCount } = await supabase
      .from('dealers')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    // Parse histogram from RPC response
    const priceHistogram = histogramError ? null : (histogramData as {
      buckets: { idx: number; count: number }[];
      boundaries: number[];
      totalPriced: number;
      maxPrice: number;
    } | null);

    // Create response with cache headers
    const response = NextResponse.json({
      listings: enrichedListings,
      total: count || 0,
      page: safePage,
      totalPages: Math.ceil((count || 0) / params.limit!),
      facets,
      priceHistogram,
      totalDealerCount: totalDealerCount || 0,
      lastUpdated,
      // Data freshness indicator for subscription tier
      isDelayed: subscription.isDelayed,
      subscriptionTier: subscription.tier,
      // Admin flag for admin-only filters
      isAdmin: subscription.isAdmin,
      // URL search flag for "report missing URL" feature
      isUrlSearch: !!detectedUrl,
    });

    // Always use private caching to prevent CDN from caching isAdmin=false responses
    // This fixes a race condition where the first request might not have auth cookies ready
    response.headers.set('Cache-Control', 'private, no-store, must-revalidate');

    return response;
  } catch (error) {
    logger.logError('Browse API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

