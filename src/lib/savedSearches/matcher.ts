import { SupabaseClient } from '@supabase/supabase-js';
import type { SavedSearchCriteria, Listing } from '@/types';
import { normalizeSearchText, expandSearchAliases } from '@/lib/search';
import { parseNumericFilters } from '@/lib/search/numericFilters';
import { parseSemanticQuery } from '@/lib/search/semanticQueryParser';
import { resolveArtisanCodesFromText } from '@/lib/supabase/yuhinkai';

// Artisan code pattern (same as browse API) — detects codes like MAS590, NS-Ko-Bizen, etc.
const ARTISAN_CODE_PATTERN = /^[A-Z]{1,4}\d{1,5}(?:[.\-]\d)?[A-Za-z]?$|^NS-[A-Za-z]+(?:-[A-Za-z]+)*$|^NC-[A-Z]+\d+[A-Za-z]?$|^tmp[A-Z]{1,4}\d+[A-Za-z]?$|^[A-Z]+(?:_[A-Z]+)+\d+$/i;

// Item type categories
const NIHONTO_TYPES = [
  'katana',
  'wakizashi',
  'tanto',
  'tachi',
  'naginata',
  'yari',
  'kodachi',
  'ken',
  'naginata naoshi',
  'sword',
];

const TOSOGU_TYPES = [
  'tsuba',
  'fuchi-kashira',
  'fuchi_kashira',
  'fuchi',
  'kashira',
  'kozuka',
  'kogatana',
  'kogai',
  'menuki',
  'koshirae',
  'tosogu',
  'mitokoromono',
];

// Certification variants mapping
const CERT_VARIANTS: Record<string, string[]> = {
  'Juyo Bijutsuhin': ['Juyo Bijutsuhin', 'JuBi', 'jubi'], // Pre-war government designation
  Juyo: ['Juyo', 'juyo'],
  Tokuju: ['Tokuju', 'tokuju', 'Tokubetsu Juyo', 'tokubetsu_juyo'],
  TokuHozon: ['TokuHozon', 'Tokubetsu Hozon', 'tokubetsu_hozon'],
  Hozon: ['Hozon', 'hozon'],
  TokuKicho: ['TokuKicho', 'Tokubetsu Kicho', 'tokubetsu_kicho'],
};

// Status filter constants
const STATUS_AVAILABLE = 'status.eq.available,is_available.eq.true';
const STATUS_SOLD = 'status.eq.sold,status.eq.presumed_sold,is_sold.eq.true';

/**
 * Find listings that match a saved search's criteria.
 * Optionally filter to only listings created/updated since a given timestamp.
 */
export async function findMatchingListings(
  supabase: SupabaseClient,
  criteria: SavedSearchCriteria,
  sinceTimestamp?: Date,
  limit: number = 50
): Promise<Listing[]> {
  // Determine status filter
  const statusFilter =
    criteria.tab === 'sold' ? STATUS_SOLD : STATUS_AVAILABLE;

  // Build query
  let query = supabase
    .from('listings')
    .select(
      `
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
      status,
      is_available,
      is_sold,
      dealer_id,
      dealers!inner(id, name, domain)
    `
    )
    .or(statusFilter)
    .neq('item_type', 'Stand');

  // Time filter for new listings
  if (sinceTimestamp) {
    query = query.gte('first_seen_at', sinceTimestamp.toISOString());
  }

  // Item type filter
  const effectiveItemTypes = criteria.itemTypes?.length
    ? criteria.itemTypes
    : criteria.category === 'nihonto'
    ? NIHONTO_TYPES
    : criteria.category === 'tosogu'
    ? TOSOGU_TYPES
    : undefined;

  if (effectiveItemTypes?.length) {
    const typeConditions = effectiveItemTypes
      .map((t) => `item_type.ilike.${t}`)
      .join(',');
    query = query.or(typeConditions);
  }

  // Ask only filter
  if (criteria.askOnly) {
    query = query.is('price_value', null);
  }

  // Certification filter
  if (criteria.certifications?.length) {
    const allVariants = criteria.certifications.flatMap(
      (c) => CERT_VARIANTS[c] || [c]
    );
    query = query.in('cert_type', allVariants);
  }

  // School filter
  if (criteria.schools?.length) {
    const schoolConditions = criteria.schools
      .map((s) => `school.ilike.%${s}%,tosogu_school.ilike.%${s}%`)
      .join(',');
    query = query.or(schoolConditions);
  }

  // Dealer filter
  if (criteria.dealers?.length) {
    query = query.in('dealer_id', criteria.dealers);
  }

  // Price filters
  if (criteria.minPrice !== undefined) {
    query = query.gte('price_value', criteria.minPrice);
  }
  if (criteria.maxPrice !== undefined) {
    query = query.lte('price_value', criteria.maxPrice);
  }

  // Query/text search with semantic parsing and numeric filters
  // This matches the browse API behavior to ensure consistent results
  if (criteria.query && criteria.query.trim().length >= 2) {
    // Step 1: Extract semantic filters (certifications, item types) from query
    // This ensures "Juyo" is treated as a certification filter, not text search
    // which would match listings that merely mention "Juyo" in related items
    const { extractedFilters, remainingTerms } = parseSemanticQuery(criteria.query);

    // Apply extracted certification filters (exact match on cert_type)
    // Only apply if no explicit certification filter was already set
    if (extractedFilters.certifications.length > 0 && !criteria.certifications?.length) {
      const certVariants = extractedFilters.certifications.flatMap(
        (c) => CERT_VARIANTS[c] || [c]
      );
      query = query.in('cert_type', certVariants);
    }

    // Apply extracted item type filters (exact match on item_type)
    // Only apply if no explicit item type filter was already set
    // Note: category === 'all' means no category restriction, so semantic extraction should apply
    if (extractedFilters.itemTypes.length > 0 && !criteria.itemTypes?.length && (!criteria.category || criteria.category === 'all')) {
      const typeConditions = extractedFilters.itemTypes
        .map((t) => `item_type.ilike.${t}`)
        .join(',');
      query = query.or(typeConditions);
    }

    // Apply extracted signature status filters (exact match on signature_status)
    // Only apply if no explicit signature status filter was already set
    if (extractedFilters.signatureStatuses?.length && !criteria.signatureStatuses?.length) {
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
    // Only non-semantic terms reach here - certifications/item types are handled above
    if (textWords.length > 0) {
      const searchFields = [
        'title',
        'description',
        'smith',
        'tosogu_maker',
        'school',
        'tosogu_school',
        'province',
        'era',
        'mei_type',
      ];

      // Fix A: Detect artisan codes (e.g., "MAS590") and search artisan_id directly
      const potentialArtisanCode = textWords.find(w => ARTISAN_CODE_PATTERN.test(w));
      if (potentialArtisanCode) {
        query = query.ilike('artisan_id', `%${potentialArtisanCode}%`);
      }

      // Fix B: Resolve artisan names to codes via Yuhinkai
      // e.g., "norishige" → [NOR312, NOR567] so artisan-matched listings are found
      const nonCodeWords = potentialArtisanCode
        ? textWords.filter(w => w !== potentialArtisanCode)
        : textWords;

      if (nonCodeWords.length > 0) {
        const artisanCodes = await resolveArtisanCodesFromText(
          nonCodeWords.map(w => normalizeSearchText(w)).filter(w => w.length >= 2)
        );
        const artisanConditions = artisanCodes.map(code => `artisan_id.eq.${code}`);

        for (const word of nonCodeWords) {
          const expandedTerms = expandSearchAliases(word).map(normalizeSearchText);
          const conditions = expandedTerms.flatMap((term) =>
            searchFields.map((field) => `${field}.ilike.%${term}%`)
          );
          // Add artisan_id conditions alongside field ILIKEs
          query = query.or([...conditions, ...artisanConditions].join(','));
        }
      }
    }
  }

  // Sort by newest first
  query = query.order('first_seen_at', { ascending: false }).limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('Error finding matching listings:', error);
    return [];
  }

  return (data as unknown as Listing[]) || [];
}

/**
 * Count how many listings match a saved search's criteria
 */
export async function countMatchingListings(
  supabase: SupabaseClient,
  criteria: SavedSearchCriteria,
  sinceTimestamp?: Date
): Promise<number> {
  // Similar query but only get count
  const statusFilter =
    criteria.tab === 'sold' ? STATUS_SOLD : STATUS_AVAILABLE;

  let query = supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .or(statusFilter)
    .neq('item_type', 'Stand');

  if (sinceTimestamp) {
    query = query.gte('first_seen_at', sinceTimestamp.toISOString());
  }

  // Apply same filters as findMatchingListings...
  const effectiveItemTypes = criteria.itemTypes?.length
    ? criteria.itemTypes
    : criteria.category === 'nihonto'
    ? NIHONTO_TYPES
    : criteria.category === 'tosogu'
    ? TOSOGU_TYPES
    : undefined;

  if (effectiveItemTypes?.length) {
    const typeConditions = effectiveItemTypes
      .map((t) => `item_type.ilike.${t}`)
      .join(',');
    query = query.or(typeConditions);
  }

  if (criteria.askOnly) {
    query = query.is('price_value', null);
  }

  if (criteria.certifications?.length) {
    const allVariants = criteria.certifications.flatMap(
      (c) => CERT_VARIANTS[c] || [c]
    );
    query = query.in('cert_type', allVariants);
  }

  if (criteria.schools?.length) {
    const schoolConditions = criteria.schools
      .map((s) => `school.ilike.%${s}%,tosogu_school.ilike.%${s}%`)
      .join(',');
    query = query.or(schoolConditions);
  }

  if (criteria.dealers?.length) {
    query = query.in('dealer_id', criteria.dealers);
  }

  if (criteria.minPrice !== undefined) {
    query = query.gte('price_value', criteria.minPrice);
  }
  if (criteria.maxPrice !== undefined) {
    query = query.lte('price_value', criteria.maxPrice);
  }

  // Process query with semantic parsing (same as findMatchingListings)
  if (criteria.query && criteria.query.trim().length >= 2) {
    const { extractedFilters, remainingTerms } = parseSemanticQuery(criteria.query);

    // Apply extracted certification filters
    if (extractedFilters.certifications.length > 0 && !criteria.certifications?.length) {
      const certVariants = extractedFilters.certifications.flatMap(
        (c) => CERT_VARIANTS[c] || [c]
      );
      query = query.in('cert_type', certVariants);
    }

    // Apply extracted item type filters
    // Note: category === 'all' means no category restriction, so semantic extraction should apply
    if (extractedFilters.itemTypes.length > 0 && !criteria.itemTypes?.length && (!criteria.category || criteria.category === 'all')) {
      const typeConditions = extractedFilters.itemTypes
        .map((t) => `item_type.ilike.${t}`)
        .join(',');
      query = query.or(typeConditions);
    }

    // Apply extracted signature status filters
    if (extractedFilters.signatureStatuses?.length && !criteria.signatureStatuses?.length) {
      query = query.in('signature_status', extractedFilters.signatureStatuses);
    }

    // Parse and apply numeric filters + text search
    const remainingQuery = remainingTerms.join(' ');
    const { filters, textWords } = parseNumericFilters(remainingQuery);
    for (const { field, op, value } of filters) {
      query = query.filter(field, op, value);
    }

    // Fix C: Apply text search (was previously dropped, inflating counts)
    if (textWords.length > 0) {
      const searchFields = [
        'title',
        'description',
        'smith',
        'tosogu_maker',
        'school',
        'tosogu_school',
        'province',
        'era',
        'mei_type',
      ];

      // Detect artisan codes
      const potentialArtisanCode = textWords.find(w => ARTISAN_CODE_PATTERN.test(w));
      if (potentialArtisanCode) {
        query = query.ilike('artisan_id', `%${potentialArtisanCode}%`);
      }

      // Resolve artisan names to codes via Yuhinkai
      const nonCodeWords = potentialArtisanCode
        ? textWords.filter(w => w !== potentialArtisanCode)
        : textWords;

      if (nonCodeWords.length > 0) {
        const artisanCodes = await resolveArtisanCodesFromText(
          nonCodeWords.map(w => normalizeSearchText(w)).filter(w => w.length >= 2)
        );
        const artisanConditions = artisanCodes.map(code => `artisan_id.eq.${code}`);

        for (const word of nonCodeWords) {
          const expandedTerms = expandSearchAliases(word).map(normalizeSearchText);
          const conditions = expandedTerms.flatMap((term) =>
            searchFields.map((field) => `${field}.ilike.%${term}%`)
          );
          query = query.or([...conditions, ...artisanConditions].join(','));
        }
      }
    }
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error counting matching listings:', error);
    return 0;
  }

  return count || 0;
}
