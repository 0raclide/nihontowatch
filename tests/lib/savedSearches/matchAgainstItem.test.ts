import { describe, it, expect } from 'vitest';
import {
  searchMatchesItem,
  matchItemAgainstSearches,
  aggregateCriteria,
  type MatchableItem,
  type SavedSearchRow,
} from '@/lib/savedSearches/matchAgainstItem';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<MatchableItem> = {}): MatchableItem {
  return {
    item_type: 'katana',
    item_category: 'nihonto',
    cert_type: 'Juyo',
    price_value: 500000,
    school: 'Bizen',
    tosogu_school: null,
    smith: 'Masamune',
    tosogu_maker: null,
    artisan_id: 'MAS590',
    title: 'Katana by Masamune',
    ...overrides,
  };
}

function makeSearch(criteria: Record<string, unknown>, userId = 'user-1'): SavedSearchRow {
  return {
    id: `search-${Math.random().toString(36).slice(2)}`,
    user_id: userId,
    search_criteria: criteria,
  };
}

// ---------------------------------------------------------------------------
// searchMatchesItem
// ---------------------------------------------------------------------------

describe('searchMatchesItem', () => {
  it('matches when criteria is empty (catch-all search)', () => {
    expect(searchMatchesItem({}, makeItem())).toBe(true);
  });

  it('matches text query against smith name', () => {
    expect(searchMatchesItem({ query: 'masamune' }, makeItem())).toBe(true);
    expect(searchMatchesItem({ query: 'Masamune' }, makeItem())).toBe(true);
  });

  it('matches text query against artisan_id code', () => {
    expect(searchMatchesItem({ query: 'MAS590' }, makeItem())).toBe(true);
  });

  it('rejects text query that does not match any field', () => {
    expect(searchMatchesItem({ query: 'norishige' }, makeItem())).toBe(false);
  });

  it('requires all query words to match (AND semantics)', () => {
    // "masamune bizen" — both words match (smith + school)
    expect(searchMatchesItem({ query: 'masamune bizen' }, makeItem())).toBe(true);
    // "masamune yamashiro" — masamune matches but yamashiro doesn't
    expect(searchMatchesItem({ query: 'masamune yamashiro' }, makeItem())).toBe(false);
  });

  it('ignores single-character query words', () => {
    // "a" is too short, filtered out → empty words → no match
    expect(searchMatchesItem({ query: 'a' }, makeItem())).toBe(false);
  });

  it('excludes sold-tab searches', () => {
    expect(searchMatchesItem({ tab: 'sold' }, makeItem())).toBe(false);
  });

  it('allows available-tab searches', () => {
    expect(searchMatchesItem({ tab: 'available' }, makeItem())).toBe(true);
  });

  it('matches item_type correctly', () => {
    expect(searchMatchesItem({ itemTypes: ['katana'] }, makeItem())).toBe(true);
    expect(searchMatchesItem({ itemTypes: ['Katana'] }, makeItem())).toBe(true); // case-insensitive
    expect(searchMatchesItem({ itemTypes: ['wakizashi'] }, makeItem())).toBe(false);
  });

  it('matches item_type from multi-value array', () => {
    expect(searchMatchesItem({ itemTypes: ['wakizashi', 'katana'] }, makeItem())).toBe(true);
  });

  it('matches certification with exact match', () => {
    expect(searchMatchesItem({ certifications: ['Juyo'] }, makeItem())).toBe(true);
    expect(searchMatchesItem({ certifications: ['Hozon'] }, makeItem())).toBe(false);
  });

  it('matches certification with alias expansion (juyo → juyo tosogu)', () => {
    const tsoguItem = makeItem({ cert_type: 'Juyo Tosogu' });
    expect(searchMatchesItem({ certifications: ['Juyo'] }, tsoguItem)).toBe(true);
  });

  it('matches certification alias: tokubetsu hozon → tokuhozon', () => {
    const item = makeItem({ cert_type: 'Tokuhozon' });
    expect(searchMatchesItem({ certifications: ['Tokubetsu Hozon'] }, item)).toBe(true);
  });

  it('matches certification alias: tokubetsu juyo → tokuju', () => {
    const item = makeItem({ cert_type: 'Tokuju' });
    expect(searchMatchesItem({ certifications: ['Tokubetsu Juyo'] }, item)).toBe(true);
  });

  it('rejects when item has no cert but search requires one', () => {
    expect(searchMatchesItem({ certifications: ['Juyo'] }, makeItem({ cert_type: null }))).toBe(false);
  });

  it('matches category (nihonto)', () => {
    expect(searchMatchesItem({ category: 'nihonto' }, makeItem())).toBe(true);
    expect(searchMatchesItem({ category: 'tosogu' }, makeItem())).toBe(false);
  });

  it('ignores category when "all" or empty', () => {
    expect(searchMatchesItem({ category: 'all' }, makeItem())).toBe(true);
    expect(searchMatchesItem({ category: '' }, makeItem())).toBe(true);
  });

  it('matches price range (min only)', () => {
    expect(searchMatchesItem({ minPrice: 300000 }, makeItem({ price_value: 500000 }))).toBe(true);
    expect(searchMatchesItem({ minPrice: 600000 }, makeItem({ price_value: 500000 }))).toBe(false);
  });

  it('matches price range (max only)', () => {
    expect(searchMatchesItem({ maxPrice: 1000000 }, makeItem({ price_value: 500000 }))).toBe(true);
    expect(searchMatchesItem({ maxPrice: 100000 }, makeItem({ price_value: 500000 }))).toBe(false);
  });

  it('rejects price range when item has no price', () => {
    expect(searchMatchesItem({ minPrice: 100 }, makeItem({ price_value: null }))).toBe(false);
  });

  it('matches school substring (case-insensitive)', () => {
    expect(searchMatchesItem({ schools: ['Bizen'] }, makeItem())).toBe(true);
    expect(searchMatchesItem({ schools: ['bizen'] }, makeItem())).toBe(true);
    expect(searchMatchesItem({ schools: ['Soshu'] }, makeItem())).toBe(false);
  });

  it('matches tosogu_school', () => {
    const item = makeItem({ school: null, tosogu_school: 'Goto' });
    expect(searchMatchesItem({ schools: ['Goto'] }, item)).toBe(true);
  });

  it('matches askOnly filter', () => {
    expect(searchMatchesItem({ askOnly: true }, makeItem({ price_value: null }))).toBe(true);
    expect(searchMatchesItem({ askOnly: true }, makeItem({ price_value: 500000 }))).toBe(false);
  });

  it('returns false for null criteria', () => {
    expect(searchMatchesItem(null, makeItem())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// matchItemAgainstSearches
// ---------------------------------------------------------------------------

describe('matchItemAgainstSearches', () => {
  it('counts distinct users (dedup)', () => {
    const item = makeItem();
    const searches = [
      makeSearch({ itemTypes: ['katana'] }, 'user-1'),
      makeSearch({ category: 'nihonto' }, 'user-1'), // same user
      makeSearch({}, 'user-2'),
    ];
    const result = matchItemAgainstSearches(item, searches);
    expect(result.matchCount).toBe(2); // 2 distinct users
    expect(result.matchedSearches).toHaveLength(3); // 3 matching searches
  });

  it('returns 0 when no searches match', () => {
    const item = makeItem({ item_type: 'katana' });
    const searches = [
      makeSearch({ itemTypes: ['wakizashi'] }, 'user-1'),
    ];
    const result = matchItemAgainstSearches(item, searches);
    expect(result.matchCount).toBe(0);
    expect(result.matchedSearches).toHaveLength(0);
  });

  it('includes text query searches that match item fields', () => {
    const searches = [
      makeSearch({ query: 'masamune' }, 'user-1'), // matches smith
      makeSearch({}, 'user-2'),
    ];
    const result = matchItemAgainstSearches(makeItem(), searches);
    expect(result.matchCount).toBe(2);
  });

  it('excludes text query searches that do not match item fields', () => {
    const searches = [
      makeSearch({ query: 'norishige' }, 'user-1'), // doesn't match
      makeSearch({}, 'user-2'),
    ];
    const result = matchItemAgainstSearches(makeItem(), searches);
    expect(result.matchCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// aggregateCriteria
// ---------------------------------------------------------------------------

describe('aggregateCriteria', () => {
  const defaultItem = makeItem(); // katana, Juyo, Bizen, ¥500K

  it('aggregates item types with user dedup per facet', () => {
    const searches = [
      makeSearch({ itemTypes: ['katana'] }, 'user-1'),
      makeSearch({ itemTypes: ['katana'] }, 'user-1'), // same user
      makeSearch({ itemTypes: ['katana'] }, 'user-2'),
      makeSearch({ itemTypes: ['wakizashi'] }, 'user-3'), // won't appear — doesn't match item
    ];
    const matchResult = { matchCount: 3, matchedSearches: searches };
    const summary = aggregateCriteria(matchResult, defaultItem);

    expect(summary.totalCollectors).toBe(3);
    const katana = summary.facets.itemTypes.find(e => e.value === 'Katana');
    expect(katana?.count).toBe(2); // user-1 deduped
    // Wakizashi filtered out because item is katana
    const waki = summary.facets.itemTypes.find(e => e.value === 'Wakizashi');
    expect(waki).toBeUndefined();
  });

  it('aggregates certifications — only matching values', () => {
    const searches = [
      makeSearch({ certifications: ['Juyo'] }, 'user-1'),
      makeSearch({ certifications: ['Hozon', 'Juyo'] }, 'user-2'),
    ];
    const matchResult = { matchCount: 2, matchedSearches: searches };
    const summary = aggregateCriteria(matchResult, defaultItem); // item cert = Juyo

    // Only Juyo shown (matches item). Hozon filtered out.
    expect(summary.facets.certifications).toHaveLength(1);
    expect(summary.facets.certifications[0].value).toBe('Juyo');
    expect(summary.facets.certifications[0].count).toBe(2);
  });

  it('merges cert aliases under item cert name (Tokubetsu Juyo + Tokuju → Tokuju ×2)', () => {
    const tokujuItem = makeItem({ cert_type: 'Tokuju' });
    const searches = [
      makeSearch({ certifications: ['Tokubetsu Juyo'] }, 'user-1'),
      makeSearch({ certifications: ['Tokuju'] }, 'user-2'),
      makeSearch({ certifications: ['Juyo bijutsuhin'] }, 'user-3'), // no alias → filtered
    ];
    const matchResult = { matchCount: 3, matchedSearches: searches };
    const summary = aggregateCriteria(matchResult, tokujuItem);

    expect(summary.facets.certifications).toHaveLength(1);
    expect(summary.facets.certifications[0].value).toBe('Tokuju');
    expect(summary.facets.certifications[0].count).toBe(2); // user-1 + user-2 merged
  });

  it('aggregates schools', () => {
    const searches = [
      makeSearch({ schools: ['Bizen'] }, 'user-1'),
      makeSearch({ schools: ['Bizen'] }, 'user-2'),
    ];
    const matchResult = { matchCount: 2, matchedSearches: searches };
    const summary = aggregateCriteria(matchResult, defaultItem);

    expect(summary.facets.schools).toHaveLength(1);
    expect(summary.facets.schools[0]).toEqual({ value: 'Bizen', count: 2 });
  });

  it('filters out non-matching schools', () => {
    const searches = [
      makeSearch({ schools: ['Soshu'] }, 'user-1'), // doesn't match Bizen item
    ];
    const matchResult = { matchCount: 1, matchedSearches: searches };
    const summary = aggregateCriteria(matchResult, defaultItem);

    expect(summary.facets.schools).toHaveLength(0);
  });

  it('buckets price ranges', () => {
    const searches = [
      makeSearch({ maxPrice: 300000 }, 'user-1'),
      makeSearch({ minPrice: 300000, maxPrice: 1000000 }, 'user-2'),
      makeSearch({ minPrice: 3000000 }, 'user-3'),
    ];
    const matchResult = { matchCount: 3, matchedSearches: searches };
    const summary = aggregateCriteria(matchResult, defaultItem);

    expect(summary.facets.priceRanges.length).toBeGreaterThanOrEqual(2);
  });

  it('caps facets at 5 entries', () => {
    // All types match the item (katana)
    const searches = Array.from({ length: 10 }, (_, i) =>
      makeSearch({ itemTypes: ['katana'] }, `user-${i}`)
    );
    const matchResult = { matchCount: 10, matchedSearches: searches };
    const summary = aggregateCriteria(matchResult, defaultItem);

    // Only 1 unique type value (katana) — all match
    expect(summary.facets.itemTypes.length).toBeLessThanOrEqual(5);
  });

  it('sorts facets by count descending', () => {
    const item = makeItem({ cert_type: 'Juyo' });
    const searches = [
      makeSearch({ certifications: ['Juyo'] }, 'user-2'),
      makeSearch({ certifications: ['Juyo'] }, 'user-3'),
      makeSearch({ certifications: ['Juyo'] }, 'user-4'),
    ];
    const matchResult = { matchCount: 3, matchedSearches: searches };
    const summary = aggregateCriteria(matchResult, item);

    expect(summary.facets.certifications[0].value).toBe('Juyo');
    expect(summary.facets.certifications[0].count).toBe(3);
  });

  it('skips empty facets gracefully', () => {
    const searches = [
      makeSearch({}, 'user-1'), // no criteria at all
    ];
    const matchResult = { matchCount: 1, matchedSearches: searches };
    const summary = aggregateCriteria(matchResult, defaultItem);

    expect(summary.facets.itemTypes).toHaveLength(0);
    expect(summary.facets.certifications).toHaveLength(0);
    expect(summary.facets.schools).toHaveLength(0);
    expect(summary.facets.priceRanges).toHaveLength(0);
    expect(summary.facets.queries).toHaveLength(0);
  });

  it('aggregates text query terms as pills', () => {
    const searches = [
      makeSearch({ query: 'masamune' }, 'user-1'),
      makeSearch({ query: 'masamune' }, 'user-2'),
      makeSearch({ query: 'bizen katana' }, 'user-3'),
    ];
    const matchResult = { matchCount: 3, matchedSearches: searches };
    const summary = aggregateCriteria(matchResult, defaultItem);

    expect(summary.facets.queries.length).toBeGreaterThanOrEqual(1);
    const masamune = summary.facets.queries.find(e => e.value === 'Masamune');
    expect(masamune?.count).toBe(2);
  });

  it('capitalizes query terms for display', () => {
    const searches = [
      makeSearch({ query: 'tokuju' }, 'user-1'),
    ];
    const matchResult = { matchCount: 1, matchedSearches: searches };
    const item = makeItem({ cert_type: 'Tokuju' });
    const summary = aggregateCriteria(matchResult, item);

    expect(summary.facets.queries[0].value).toBe('Tokuju');
  });
});
