import { SupabaseClient } from '@supabase/supabase-js';
import type { SavedSearchCriteria, Listing } from '@/types';
import { normalizeSearchText, expandSearchAliases } from '@/lib/search';
import { parseNumericFilters } from '@/lib/search/numericFilters';

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

  // Query/text search with numeric filters
  if (criteria.query && criteria.query.trim().length >= 2) {
    const { filters, textWords } = parseNumericFilters(criteria.query);

    // Apply numeric filters
    for (const { field, op, value } of filters) {
      query = query.filter(field, op, value);
    }

    // Text search on remaining words
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
      'cert_type',
      'item_type',
      'item_category',
      'tosogu_material',
    ];

    for (const word of textWords) {
      const expandedTerms = expandSearchAliases(word).map(normalizeSearchText);
      const conditions = expandedTerms.flatMap((term) =>
        searchFields.map((field) => `${field}.ilike.%${term}%`)
      );
      query = query.or(conditions.join(','));
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

  const { count, error } = await query;

  if (error) {
    console.error('Error counting matching listings:', error);
    return 0;
  }

  return count || 0;
}
