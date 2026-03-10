/**
 * Shared utility for matching a listing/collection item against saved searches.
 *
 * Extracted from /api/collection/items/[id]/intelligence — reused by both that
 * route and the new criteria aggregation endpoint.
 *
 * Mirrors the SQL RPC `count_matching_saved_searches` logic in JS, used when
 * the item doesn't have a listing ID yet (collection items pre-promotion).
 */

import type { CriteriaFacetEntry, CriteriaSummary } from '@/lib/dealer/intelligence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal item shape needed for matching */
export interface MatchableItem {
  item_type?: string | null;
  item_category?: string | null;
  cert_type?: string | null;
  price_value?: number | null;
  school?: string | null;
  tosogu_school?: string | null;
}

/** Shape of a saved search row from the DB */
export interface SavedSearchRow {
  id: string;
  user_id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  search_criteria: any;
}

export interface MatchResult {
  matchCount: number;
  matchedSearches: SavedSearchRow[];
}

// ---------------------------------------------------------------------------
// Cert alias expansion (mirrors SQL RPC)
// ---------------------------------------------------------------------------

const CERT_ALIASES: Record<string, string[]> = {
  juyo: ['juyo', 'juyo tosogu'],
  hozon: ['hozon', 'hozon tosogu'],
  'tokubetsu hozon': ['tokubetsu hozon', 'tokubetsu hozon tosogu', 'tokuhozon'],
  'tokubetsu juyo': ['tokubetsu juyo', 'tokuju'],
};

function certMatches(searchCert: string, itemCert: string): boolean {
  const cl = searchCert.toLowerCase();
  const il = itemCert.toLowerCase();
  if (cl === il) return true;
  const aliases = CERT_ALIASES[cl];
  return aliases ? aliases.includes(il) : false;
}

// ---------------------------------------------------------------------------
// Core matching
// ---------------------------------------------------------------------------

/**
 * Test whether a single saved search matches the given item.
 * Returns false for searches with text queries or sold-tab (conservative).
 */
export function searchMatchesItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: any,
  item: MatchableItem
): boolean {
  if (!c) return false;

  // Exclude searches with text queries (conservative, mirrors SQL RPC)
  if (c.query && typeof c.query === 'string' && c.query.trim() !== '') return false;

  // Exclude sold-tab searches — they monitor sold archive, not new listings
  if (c.tab === 'sold') return false;

  // item_type match
  if (c.itemTypes && c.itemTypes.length > 0) {
    const itemTypeLower = (item.item_type ?? '').toLowerCase();
    if (!c.itemTypes.some((t: string) => t.toLowerCase() === itemTypeLower)) return false;
  }

  // certification match (with alias expansion)
  if (c.certifications && c.certifications.length > 0) {
    const certLower = (item.cert_type ?? '').toLowerCase();
    if (!certLower) return false;
    const matches = c.certifications.some((cert: string) => certMatches(cert, certLower));
    if (!matches) return false;
  }

  // category match ('all' or empty = no restriction)
  if (c.category && c.category !== 'all' && c.category !== '') {
    if (c.category.toLowerCase() !== (item.item_category ?? '').toLowerCase()) return false;
  }

  // price range match
  if (c.minPrice != null && (item.price_value == null || item.price_value < c.minPrice)) return false;
  if (c.maxPrice != null && (item.price_value == null || item.price_value > c.maxPrice)) return false;

  // schools filter (ILIKE substring match)
  if (c.schools && c.schools.length > 0) {
    const schoolLower = (item.school ?? '').toLowerCase();
    const tosoguSchoolLower = (item.tosogu_school ?? '').toLowerCase();
    const schoolMatch = c.schools.some((s: string) => {
      const sl = s.toLowerCase();
      return schoolLower.includes(sl) || tosoguSchoolLower.includes(sl);
    });
    if (!schoolMatch) return false;
  }

  // askOnly filter — only match inquiry-priced listings
  if (c.askOnly === true && item.price_value != null) return false;

  return true;
}

/**
 * Match an item against all saved searches, returning the count of distinct
 * matching users and the list of matched searches (for criteria aggregation).
 */
export function matchItemAgainstSearches(
  item: MatchableItem,
  searches: SavedSearchRow[]
): MatchResult {
  const matchedUserIds = new Set<string>();
  const matchedSearches: SavedSearchRow[] = [];

  for (const search of searches) {
    const c = search.search_criteria;
    if (!searchMatchesItem(c, item)) continue;

    matchedSearches.push(search);
    if (search.user_id) {
      matchedUserIds.add(search.user_id);
    }
  }

  return {
    matchCount: matchedUserIds.size,
    matchedSearches,
  };
}

// ---------------------------------------------------------------------------
// Criteria aggregation
// ---------------------------------------------------------------------------

/** Price range bucket labels (consistent with browse UI convention) */
const PRICE_BUCKETS = [
  { label: 'Under ¥300K', max: 300000 },
  { label: '¥300K – ¥1M', min: 300000, max: 1000000 },
  { label: '¥1M – ¥3M', min: 1000000, max: 3000000 },
  { label: 'Over ¥3M', min: 3000000 },
] as const;

function bucketPriceRange(minPrice?: number | null, maxPrice?: number | null): string | null {
  if (minPrice == null && maxPrice == null) return null;
  for (const b of PRICE_BUCKETS) {
    const bMin = 'min' in b ? b.min : undefined;
    const bMax = 'max' in b ? b.max : undefined;
    // Exact match on bucket boundaries
    if (maxPrice != null && bMax != null && maxPrice <= bMax && (minPrice == null || (bMin != null && minPrice >= bMin))) {
      return b.label;
    }
    if (minPrice != null && bMin != null && minPrice >= bMin && maxPrice == null && bMax == null) {
      return b.label;
    }
  }
  // Fallback: describe the range
  if (minPrice != null && maxPrice != null) {
    return `¥${(minPrice / 1000).toFixed(0)}K – ¥${(maxPrice / 1000).toFixed(0)}K`;
  }
  if (minPrice != null) return `Over ¥${(minPrice / 1000).toFixed(0)}K`;
  if (maxPrice != null) return `Under ¥${(maxPrice / 1000).toFixed(0)}K`;
  return null;
}

/**
 * Aggregate matched searches into a CriteriaSummary with faceted counts.
 * Deduplicates by user_id per facet value so one user's 3 searches for
 * "Katana" counts as 1 collector interested in Katana.
 */
export function aggregateCriteria(
  matchResult: MatchResult
): CriteriaSummary {
  // Track user sets per facet value to deduplicate
  const itemTypeCounts = new Map<string, Set<string>>();
  const certCounts = new Map<string, Set<string>>();
  const schoolCounts = new Map<string, Set<string>>();
  const priceCounts = new Map<string, Set<string>>();

  for (const search of matchResult.matchedSearches) {
    const c = search.search_criteria;
    const uid = search.user_id;
    if (!c || !uid) continue;

    // Item types
    if (c.itemTypes && Array.isArray(c.itemTypes)) {
      for (const t of c.itemTypes) {
        const key = String(t).charAt(0).toUpperCase() + String(t).slice(1).toLowerCase();
        if (!itemTypeCounts.has(key)) itemTypeCounts.set(key, new Set());
        itemTypeCounts.get(key)!.add(uid);
      }
    }

    // Certifications
    if (c.certifications && Array.isArray(c.certifications)) {
      for (const cert of c.certifications) {
        const key = String(cert).charAt(0).toUpperCase() + String(cert).slice(1).toLowerCase();
        if (!certCounts.has(key)) certCounts.set(key, new Set());
        certCounts.get(key)!.add(uid);
      }
    }

    // Schools
    if (c.schools && Array.isArray(c.schools)) {
      for (const s of c.schools) {
        const key = String(s);
        if (!schoolCounts.has(key)) schoolCounts.set(key, new Set());
        schoolCounts.get(key)!.add(uid);
      }
    }

    // Price ranges
    const priceLabel = bucketPriceRange(c.minPrice, c.maxPrice);
    if (priceLabel) {
      if (!priceCounts.has(priceLabel)) priceCounts.set(priceLabel, new Set());
      priceCounts.get(priceLabel)!.add(uid);
    }
  }

  const toFacetEntries = (map: Map<string, Set<string>>): CriteriaFacetEntry[] =>
    Array.from(map.entries())
      .map(([value, users]) => ({ value, count: users.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

  return {
    totalCollectors: matchResult.matchCount,
    facets: {
      itemTypes: toFacetEntries(itemTypeCounts),
      certifications: toFacetEntries(certCounts),
      schools: toFacetEntries(schoolCounts),
      priceRanges: toFacetEntries(priceCounts),
    },
  };
}
