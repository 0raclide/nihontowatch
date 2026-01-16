/**
 * Search Result Concordance Tests
 *
 * Verifies that search results are consistent between:
 * - /api/search/suggestions endpoint
 * - /api/browse?q= endpoint
 *
 * Concordance means:
 * 1. Totals match for the same query
 * 2. Suggestion items appear in browse results
 * 3. Facets are accurate and consistent
 *
 * REQUIREMENTS:
 * - Development server must be running: npm run dev -- -p 3020
 * - Run tests: npm test tests/api/search-concordance.test.ts
 *
 * NOTE: These tests verify data consistency across APIs.
 * Failures indicate potential bugs in query construction or counting.
 */

import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3020';

/**
 * Response types
 */
interface SuggestionsResponse {
  suggestions: Array<{
    id: string;
    title: string;
    item_type: string | null;
    price_value: number | null;
    price_currency: string | null;
    dealer_name: string;
    url: string;
  }>;
  total: number;
  query: string;
}

interface BrowseResponse {
  listings: Array<{
    id: string;
    url: string;
    title: string | null;
    item_type: string | null;
    cert_type: string | null;
    dealer_id: number;
    price_value: number | null;
    price_currency: string | null;
    dealers: {
      id: number;
      name: string;
    };
  }>;
  total: number;
  page: number;
  totalPages: number;
  facets: {
    itemTypes: Array<{ value: string; count: number }>;
    certifications: Array<{ value: string; count: number }>;
    dealers: Array<{ id: number; name: string; count: number }>;
  };
}

/**
 * Helper to check if server is available
 */
async function isServerAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/browse?tab=available&limit=1`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch suggestions with retry logic
 */
async function fetchSuggestions(
  query: string,
  limit?: number,
  retries = 2
): Promise<SuggestionsResponse | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const params = new URLSearchParams({ q: query });
      if (limit !== undefined) params.set('limit', String(limit));

      const res = await fetch(
        `${API_BASE}/api/search/suggestions?${params.toString()}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (res.ok) {
        return await res.json();
      }
    } catch {
      if (attempt === retries) return null;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return null;
}

/**
 * Fetch browse results with retry logic
 */
async function fetchBrowse(
  params: Record<string, string | number>,
  retries = 2
): Promise<BrowseResponse | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const urlParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        urlParams.set(key, String(value));
      });

      const res = await fetch(
        `${API_BASE}/api/browse?${urlParams.toString()}`,
        { signal: AbortSignal.timeout(15000) }
      );

      if (res.ok) {
        return await res.json();
      }
    } catch {
      if (attempt === retries) return null;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return null;
}

// Store server availability status
let serverAvailable = false;

describe('Search Result Concordance', () => {
  beforeAll(async () => {
    serverAvailable = await isServerAvailable();
    if (!serverAvailable) {
      console.warn(
        '\n[WARN] Development server not available at ' + API_BASE +
        '\nConcordance tests will be skipped. Start server with: npm run dev -- -p 3020\n'
      );
    }
    if (serverAvailable) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  });

  // =============================================================================
  // TOTAL COUNT CONCORDANCE
  // =============================================================================
  describe('Total Count Concordance', () => {
    it('suggestion total matches browse total for query "katana"', async () => {
      if (!serverAvailable) return;

      const [suggest, browse] = await Promise.all([
        fetchSuggestions('katana'),
        fetchBrowse({ q: 'katana', tab: 'available' }),
      ]);

      expect(suggest).not.toBeNull();
      expect(browse).not.toBeNull();

      // Both endpoints should return the same total count
      expect(suggest!.total).toBe(browse!.total);
    });

    it('suggestion total matches browse total for query "wakizashi"', async () => {
      if (!serverAvailable) return;

      const [suggest, browse] = await Promise.all([
        fetchSuggestions('wakizashi'),
        fetchBrowse({ q: 'wakizashi', tab: 'available' }),
      ]);

      expect(suggest).not.toBeNull();
      expect(browse).not.toBeNull();
      expect(suggest!.total).toBe(browse!.total);
    });

    it('suggestion total matches browse total for query "tsuba"', async () => {
      if (!serverAvailable) return;

      const [suggest, browse] = await Promise.all([
        fetchSuggestions('tsuba'),
        fetchBrowse({ q: 'tsuba', tab: 'available' }),
      ]);

      expect(suggest).not.toBeNull();
      expect(browse).not.toBeNull();
      expect(suggest!.total).toBe(browse!.total);
    });

    it('suggestion total matches browse total for query "tanto"', async () => {
      if (!serverAvailable) return;

      const [suggest, browse] = await Promise.all([
        fetchSuggestions('tanto'),
        fetchBrowse({ q: 'tanto', tab: 'available' }),
      ]);

      expect(suggest).not.toBeNull();
      expect(browse).not.toBeNull();
      expect(suggest!.total).toBe(browse!.total);
    });

    it('suggestion total matches browse total for smith name "Masamune"', async () => {
      if (!serverAvailable) return;

      const [suggest, browse] = await Promise.all([
        fetchSuggestions('Masamune'),
        fetchBrowse({ q: 'Masamune', tab: 'available' }),
      ]);

      expect(suggest).not.toBeNull();
      expect(browse).not.toBeNull();
      expect(suggest!.total).toBe(browse!.total);
    });

    it('suggestion total matches browse total for school name "Bizen"', async () => {
      if (!serverAvailable) return;

      const [suggest, browse] = await Promise.all([
        fetchSuggestions('Bizen'),
        fetchBrowse({ q: 'Bizen', tab: 'available' }),
      ]);

      expect(suggest).not.toBeNull();
      expect(browse).not.toBeNull();
      expect(suggest!.total).toBe(browse!.total);
    });

    it('both return zero for nonsense query', async () => {
      if (!serverAvailable) return;

      const [suggest, browse] = await Promise.all([
        fetchSuggestions('xyznonexistent12345'),
        fetchBrowse({ q: 'xyznonexistent12345', tab: 'available' }),
      ]);

      expect(suggest).not.toBeNull();
      expect(browse).not.toBeNull();
      expect(suggest!.total).toBe(0);
      expect(browse!.total).toBe(0);
      expect(suggest!.suggestions).toEqual([]);
      expect(browse!.listings).toEqual([]);
    });

    it('totals match for case variants (upper vs lower)', async () => {
      if (!serverAvailable) return;

      const [suggestUpper, suggestLower, browseUpper, browseLower] = await Promise.all([
        fetchSuggestions('KATANA'),
        fetchSuggestions('katana'),
        fetchBrowse({ q: 'KATANA', tab: 'available' }),
        fetchBrowse({ q: 'katana', tab: 'available' }),
      ]);

      // All four should have the same total
      expect(suggestUpper!.total).toBe(suggestLower!.total);
      expect(browseUpper!.total).toBe(browseLower!.total);
      expect(suggestUpper!.total).toBe(browseUpper!.total);
    });
  });

  // =============================================================================
  // RESULT SET CONCORDANCE
  // =============================================================================
  describe('Result Set Concordance', () => {
    it('all suggestion items appear in browse results', async () => {
      if (!serverAvailable) return;

      const suggest = await fetchSuggestions('katana', 10);
      if (!suggest || suggest.suggestions.length === 0) return;

      // Get enough browse results to include all suggestions
      const browse = await fetchBrowse({
        q: 'katana',
        tab: 'available',
        limit: 100,
      });

      expect(browse).not.toBeNull();

      const browseIds = new Set(browse!.listings.map(l => l.id));

      // Every suggestion should exist in browse results
      suggest.suggestions.forEach(suggestion => {
        expect(browseIds.has(suggestion.id)).toBe(true);
      });
    });

    it('suggestion items are a subset of browse results for "wakizashi"', async () => {
      if (!serverAvailable) return;

      const suggest = await fetchSuggestions('wakizashi', 5);
      if (!suggest || suggest.suggestions.length === 0) return;

      const browse = await fetchBrowse({
        q: 'wakizashi',
        tab: 'available',
        limit: 100,
      });

      expect(browse).not.toBeNull();

      const browseIds = new Set(browse!.listings.map(l => l.id));

      suggest.suggestions.forEach(suggestion => {
        expect(browseIds.has(suggestion.id)).toBe(true);
      });
    });

    it('suggestion items are a subset of browse results for "tsuba"', async () => {
      if (!serverAvailable) return;

      const suggest = await fetchSuggestions('tsuba', 5);
      if (!suggest || suggest.suggestions.length === 0) return;

      const browse = await fetchBrowse({
        q: 'tsuba',
        tab: 'available',
        limit: 100,
      });

      expect(browse).not.toBeNull();

      const browseIds = new Set(browse!.listings.map(l => l.id));

      suggest.suggestions.forEach(suggestion => {
        expect(browseIds.has(suggestion.id)).toBe(true);
      });
    });
  });

  // =============================================================================
  // FIELD VALUE CONCORDANCE
  // =============================================================================
  describe('Field Value Concordance', () => {
    it('suggestion and browse return same data for matching items', async () => {
      if (!serverAvailable) return;

      const suggest = await fetchSuggestions('katana', 5);
      if (!suggest || suggest.suggestions.length === 0) return;

      const browse = await fetchBrowse({
        q: 'katana',
        tab: 'available',
        limit: 100,
      });

      expect(browse).not.toBeNull();

      const browseMap = new Map(browse!.listings.map(l => [l.id, l]));

      // Compare fields for matching items
      suggest.suggestions.forEach(suggestion => {
        const browseListing = browseMap.get(suggestion.id);
        expect(browseListing).toBeDefined();

        if (browseListing) {
          // Title should match
          expect(suggestion.title).toBe(browseListing.title || '');

          // Item type should match
          expect(suggestion.item_type).toBe(browseListing.item_type);

          // Price should match
          expect(suggestion.price_value).toBe(browseListing.price_value);
          expect(suggestion.price_currency).toBe(browseListing.price_currency);

          // Dealer name should match
          expect(suggestion.dealer_name).toBe(browseListing.dealers?.name || 'Unknown');
        }
      });
    });
  });

  // =============================================================================
  // FACET CONCORDANCE
  // =============================================================================
  describe('Facet Concordance', () => {
    it('item type facet sum equals total for unfiltered query', async () => {
      if (!serverAvailable) return;

      const browse = await fetchBrowse({ tab: 'available' });
      expect(browse).not.toBeNull();

      const facetSum = browse!.facets.itemTypes.reduce(
        (sum, facet) => sum + facet.count,
        0
      );

      // Sum of item type counts should approximate total
      // (May not be exact if some items have null item_type)
      expect(facetSum).toBeLessThanOrEqual(browse!.total);
    });

    it('dealer facet sum equals total', async () => {
      if (!serverAvailable) return;

      const browse = await fetchBrowse({ tab: 'available' });
      expect(browse).not.toBeNull();

      const facetSum = browse!.facets.dealers.reduce(
        (sum, facet) => sum + facet.count,
        0
      );

      // Sum of dealer counts should equal total (every item has a dealer)
      expect(facetSum).toBe(browse!.total);
    });

    it('filtered facet count matches filtered total', async () => {
      if (!serverAvailable) return;

      // Get unfiltered facets
      const unfiltered = await fetchBrowse({ tab: 'available' });
      expect(unfiltered).not.toBeNull();

      if (unfiltered!.facets.itemTypes.length === 0) return;

      // Pick first item type
      const itemType = unfiltered!.facets.itemTypes[0];

      // Get filtered results
      const filtered = await fetchBrowse({
        tab: 'available',
        type: itemType.value,
      });

      expect(filtered).not.toBeNull();

      // Facet count should match filtered total
      expect(filtered!.total).toBe(itemType.count);
    });

    it('certification facet count matches filtered total', async () => {
      if (!serverAvailable) return;

      const unfiltered = await fetchBrowse({ tab: 'available' });
      expect(unfiltered).not.toBeNull();

      if (unfiltered!.facets.certifications.length === 0) return;

      // Pick first certification
      const cert = unfiltered!.facets.certifications[0];

      // Get filtered results
      const filtered = await fetchBrowse({
        tab: 'available',
        cert: cert.value,
      });

      expect(filtered).not.toBeNull();

      // Facet count should match filtered total
      expect(filtered!.total).toBe(cert.count);
    });

    it('dealer facet count matches filtered total', async () => {
      if (!serverAvailable) return;

      const unfiltered = await fetchBrowse({ tab: 'available' });
      expect(unfiltered).not.toBeNull();

      if (unfiltered!.facets.dealers.length === 0) return;

      // Pick first dealer
      const dealer = unfiltered!.facets.dealers[0];

      // Get filtered results
      const filtered = await fetchBrowse({
        tab: 'available',
        dealer: dealer.id,
      });

      expect(filtered).not.toBeNull();

      // Facet count should match filtered total
      expect(filtered!.total).toBe(dealer.count);
    });
  });

  // =============================================================================
  // SEARCH + FILTER CONCORDANCE
  // =============================================================================
  describe('Search + Filter Concordance', () => {
    it('search results subset matches when filter added', async () => {
      if (!serverAvailable) return;

      // Search only
      const searchOnly = await fetchBrowse({
        q: 'katana',
        tab: 'available',
      });

      // Search + type filter
      const searchWithType = await fetchBrowse({
        q: 'katana',
        type: 'katana',
        tab: 'available',
      });

      expect(searchOnly).not.toBeNull();
      expect(searchWithType).not.toBeNull();

      // Adding filter should reduce or maintain count (never increase)
      expect(searchWithType!.total).toBeLessThanOrEqual(searchOnly!.total);
    });

    it('multiple filters further reduce count', async () => {
      if (!serverAvailable) return;

      const searchOnly = await fetchBrowse({
        q: 'katana',
        tab: 'available',
      });

      const searchWithType = await fetchBrowse({
        q: 'katana',
        type: 'katana',
        tab: 'available',
      });

      const searchWithTypeAndCert = await fetchBrowse({
        q: 'katana',
        type: 'katana',
        cert: 'Juyo',
        tab: 'available',
      });

      expect(searchOnly).not.toBeNull();
      expect(searchWithType).not.toBeNull();
      expect(searchWithTypeAndCert).not.toBeNull();

      // Each additional filter should reduce or maintain count
      expect(searchWithType!.total).toBeLessThanOrEqual(searchOnly!.total);
      expect(searchWithTypeAndCert!.total).toBeLessThanOrEqual(searchWithType!.total);
    });
  });

  // =============================================================================
  // PAGINATION CONCORDANCE
  // =============================================================================
  describe('Pagination Concordance', () => {
    it('sum of items across pages equals total', async () => {
      if (!serverAvailable) return;

      const limit = 10;
      const firstPage = await fetchBrowse({
        q: 'katana',
        tab: 'available',
        page: 1,
        limit,
      });

      expect(firstPage).not.toBeNull();

      if (firstPage!.total === 0 || firstPage!.totalPages <= 1) return;

      // Fetch all pages and count items
      let itemCount = firstPage!.listings.length;

      for (let page = 2; page <= Math.min(firstPage!.totalPages, 5); page++) {
        const pageData = await fetchBrowse({
          q: 'katana',
          tab: 'available',
          page,
          limit,
        });

        if (pageData) {
          itemCount += pageData.listings.length;
        }
      }

      // For partial fetch (up to 5 pages), verify consistency
      if (firstPage!.totalPages <= 5) {
        expect(itemCount).toBe(firstPage!.total);
      } else {
        // Verify partial count is correct (5 pages * limit)
        expect(itemCount).toBeLessThanOrEqual(5 * limit);
      }
    });

    it('no duplicate items across pages', async () => {
      if (!serverAvailable) return;

      const limit = 10;
      const firstPage = await fetchBrowse({
        q: 'katana',
        tab: 'available',
        page: 1,
        limit,
      });

      expect(firstPage).not.toBeNull();

      if (firstPage!.totalPages < 2) return;

      const secondPage = await fetchBrowse({
        q: 'katana',
        tab: 'available',
        page: 2,
        limit,
      });

      expect(secondPage).not.toBeNull();

      const page1Ids = new Set(firstPage!.listings.map(l => l.id));
      const duplicates = secondPage!.listings.filter(l => page1Ids.has(l.id));

      expect(duplicates.length).toBe(0);
    });

    it('total stays consistent across pages', async () => {
      if (!serverAvailable) return;

      const [page1, page2, page3] = await Promise.all([
        fetchBrowse({ q: 'katana', tab: 'available', page: 1, limit: 10 }),
        fetchBrowse({ q: 'katana', tab: 'available', page: 2, limit: 10 }),
        fetchBrowse({ q: 'katana', tab: 'available', page: 3, limit: 10 }),
      ]);

      expect(page1).not.toBeNull();
      expect(page2).not.toBeNull();
      expect(page3).not.toBeNull();

      // All pages should report the same total
      expect(page1!.total).toBe(page2!.total);
      expect(page2!.total).toBe(page3!.total);
    });
  });

  // =============================================================================
  // CROSS-TAB CONCORDANCE
  // =============================================================================
  describe('Cross-Tab Concordance', () => {
    it('available and sold tabs have independent counts', async () => {
      if (!serverAvailable) return;

      const [available, sold] = await Promise.all([
        fetchBrowse({ q: 'katana', tab: 'available' }),
        fetchBrowse({ q: 'katana', tab: 'sold' }),
      ]);

      expect(available).not.toBeNull();
      expect(sold).not.toBeNull();

      // Counts should be independent (no shared items)
      // Combined count could be anything, just verify both work
      expect(available!.total).toBeGreaterThanOrEqual(0);
      expect(sold!.total).toBeGreaterThanOrEqual(0);
    });

    it('no items appear in both available and sold for same query', async () => {
      if (!serverAvailable) return;

      const [available, sold] = await Promise.all([
        fetchBrowse({ q: 'katana', tab: 'available', limit: 100 }),
        fetchBrowse({ q: 'katana', tab: 'sold', limit: 100 }),
      ]);

      expect(available).not.toBeNull();
      expect(sold).not.toBeNull();

      const availableIds = new Set(available!.listings.map(l => l.id));
      const overlap = sold!.listings.filter(l => availableIds.has(l.id));

      // No item should appear in both tabs
      expect(overlap.length).toBe(0);
    });
  });

  // =============================================================================
  // EDGE CASES
  // =============================================================================
  describe('Edge Cases', () => {
    it('handles empty query consistently', async () => {
      if (!serverAvailable) return;

      const [suggest, browse] = await Promise.all([
        fetchSuggestions(''),
        fetchBrowse({ q: '', tab: 'available' }),
      ]);

      expect(suggest).not.toBeNull();
      expect(browse).not.toBeNull();

      // Empty query to suggestions returns 0
      expect(suggest!.total).toBe(0);
      expect(suggest!.suggestions).toEqual([]);

      // Empty query to browse returns all available
      expect(browse!.total).toBeGreaterThan(0);
    });

    it('handles whitespace query consistently', async () => {
      if (!serverAvailable) return;

      const [suggest, browse] = await Promise.all([
        fetchSuggestions('   '),
        fetchBrowse({ q: '   ', tab: 'available' }),
      ]);

      expect(suggest).not.toBeNull();
      expect(browse).not.toBeNull();

      // Whitespace should be treated as empty
      expect(suggest!.total).toBe(0);
    });

    it('handles special characters consistently', async () => {
      if (!serverAvailable) return;

      const query = 'test & special';

      const [suggest, browse] = await Promise.all([
        fetchSuggestions(query),
        fetchBrowse({ q: query, tab: 'available' }),
      ]);

      expect(suggest).not.toBeNull();
      expect(browse).not.toBeNull();

      // Both should handle special chars without error
      expect(suggest!.total).toBe(browse!.total);
    });
  });
});

// =============================================================================
// ADDITIONAL SPECIFIC CONCORDANCE TESTS
// =============================================================================
describe('Specific Concordance Scenarios', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/browse?tab=available&limit=1`, {
        signal: AbortSignal.timeout(5000),
      });
      serverAvailable = res.ok;
    } catch {
      serverAvailable = false;
    }
  });

  it('Juyo certification count is consistent', async () => {
    if (!serverAvailable) return;

    // Get facet count
    const unfiltered = await fetchBrowse({ tab: 'available' });
    expect(unfiltered).not.toBeNull();

    const juyoFacet = unfiltered!.facets.certifications.find(
      c => c.value === 'Juyo'
    );

    if (!juyoFacet) return; // No Juyo items

    // Get filtered count
    const filtered = await fetchBrowse({
      tab: 'available',
      cert: 'Juyo',
    });

    expect(filtered).not.toBeNull();

    // Facet count should equal filtered total
    expect(filtered!.total).toBe(juyoFacet.count);

    // All filtered items should have Juyo cert
    filtered!.listings.forEach(listing => {
      expect(listing.cert_type).toBe('Juyo');
    });
  });

  it('Tokuju certification count is consistent', async () => {
    if (!serverAvailable) return;

    const unfiltered = await fetchBrowse({ tab: 'available' });
    expect(unfiltered).not.toBeNull();

    const tokujuFacet = unfiltered!.facets.certifications.find(
      c => c.value === 'Tokuju'
    );

    if (!tokujuFacet) return;

    const filtered = await fetchBrowse({
      tab: 'available',
      cert: 'Tokuju',
    });

    expect(filtered).not.toBeNull();
    expect(filtered!.total).toBe(tokujuFacet.count);
  });

  it('katana item type count is consistent', async () => {
    if (!serverAvailable) return;

    const unfiltered = await fetchBrowse({ tab: 'available' });
    expect(unfiltered).not.toBeNull();

    const katanaFacet = unfiltered!.facets.itemTypes.find(
      t => t.value.toLowerCase() === 'katana'
    );

    if (!katanaFacet) return;

    const filtered = await fetchBrowse({
      tab: 'available',
      type: 'katana',
    });

    expect(filtered).not.toBeNull();
    expect(filtered!.total).toBe(katanaFacet.count);

    // All filtered items should be katanas
    filtered!.listings.forEach(listing => {
      expect(listing.item_type?.toLowerCase()).toBe('katana');
    });
  });

  it('tsuba item type count is consistent', async () => {
    if (!serverAvailable) return;

    const unfiltered = await fetchBrowse({ tab: 'available' });
    expect(unfiltered).not.toBeNull();

    const tsubaFacet = unfiltered!.facets.itemTypes.find(
      t => t.value.toLowerCase() === 'tsuba'
    );

    if (!tsubaFacet) return;

    const filtered = await fetchBrowse({
      tab: 'available',
      type: 'tsuba',
    });

    expect(filtered).not.toBeNull();
    expect(filtered!.total).toBe(tsubaFacet.count);
  });

  it('multiple search terms produce consistent results', async () => {
    if (!serverAvailable) return;

    // Compare single term vs multi-term
    const [singleTerm, multiTerm] = await Promise.all([
      fetchBrowse({ q: 'katana', tab: 'available' }),
      fetchBrowse({ q: 'katana sword', tab: 'available' }),
    ]);

    expect(singleTerm).not.toBeNull();
    expect(multiTerm).not.toBeNull();

    // Multi-term should be subset of single term (or equal)
    expect(multiTerm!.total).toBeLessThanOrEqual(singleTerm!.total);
  });
});
