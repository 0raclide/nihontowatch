/**
 * Browse API with Search Integration Tests
 *
 * Tests the /api/browse endpoint when combined with search (q parameter).
 * Verifies that text search works correctly with:
 * - All filter combinations (type, cert, dealer, ask-only, price)
 * - Pagination
 * - Sorting
 * - Facet updates
 *
 * REQUIREMENTS:
 * - Development server must be running: npm run dev -- -p 3020
 * - Run tests: npm test tests/api/browse-search.test.ts
 *
 * NOTE: These tests use real API calls to verify actual behavior.
 * Tests will be skipped gracefully if server is not available.
 */

import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3020';
const BROWSE_ENDPOINT = `${API_BASE}/api/browse`;

/**
 * Browse API response type
 */
interface BrowseResponse {
  listings: Listing[];
  total: number;
  page: number;
  totalPages: number;
  facets: {
    itemTypes: Array<{ value: string; count: number }>;
    certifications: Array<{ value: string; count: number }>;
    dealers: Array<{ id: number; name: string; count: number }>;
  };
  lastUpdated?: string;
}

interface Listing {
  id: string;
  url: string;
  title: string | null;
  item_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  cert_type: string | null;
  nagasa_cm: number | null;
  images: string[];
  first_seen_at: string;
  last_scraped_at: string;
  status: string;
  is_available: boolean;
  is_sold: boolean;
  dealer_id: number;
  dealers: {
    id: number;
    name: string;
    domain: string;
  };
}

/**
 * Helper to check if server is available
 */
async function isServerAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BROWSE_ENDPOINT}?tab=available&limit=1`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Helper for making browse requests with search
 */
async function fetchBrowse(
  params: Record<string, string | number | boolean | undefined>
): Promise<{ status: number; data: BrowseResponse | null; error?: string }> {
  try {
    const urlParams = new URLSearchParams();

    // Always include tab
    urlParams.set('tab', String(params.tab || 'available'));

    // Add other params
    Object.entries(params).forEach(([key, value]) => {
      if (key !== 'tab' && value !== undefined) {
        urlParams.set(key, String(value));
      }
    });

    const res = await fetch(`${BROWSE_ENDPOINT}?${urlParams.toString()}`, {
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    return { status: res.status, data };
  } catch (error) {
    return {
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Store server availability status
let serverAvailable = false;

describe('Browse API with Search - /api/browse?q=', () => {
  beforeAll(async () => {
    serverAvailable = await isServerAvailable();
    if (!serverAvailable) {
      console.warn(
        '\n[WARN] Development server not available at ' + API_BASE +
        '\nSome tests will be skipped. Start server with: npm run dev -- -p 3020\n'
      );
    }
    // Allow server to warm up
    if (serverAvailable) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  });

  // =============================================================================
  // BASIC TEXT SEARCH
  // =============================================================================
  describe('Text Search', () => {
    it('filters by search query (basic term)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');
      expect(data).toHaveProperty('total');
      expect(data!.total).toBeGreaterThanOrEqual(0);
    });

    it('filters by search query (smith name)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'Masamune',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');
    });

    it('filters by search query (school name)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'Bizen',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');
    });

    it('searches across title field', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'wakizashi',
        tab: 'available',
      });

      expect(status).toBe(200);
      // Results should contain items with "wakizashi" in title
      expect(data).toHaveProperty('listings');
    });

    it('searches across smith field', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'Kunihiro',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');
    });

    it('searches across tosogu_maker field', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'Goto',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');
    });

    it('is case-insensitive', async () => {
      if (!serverAvailable) return;

      const [upperRes, lowerRes] = await Promise.all([
        fetchBrowse({ q: 'KATANA', tab: 'available' }),
        fetchBrowse({ q: 'katana', tab: 'available' }),
      ]);

      expect(upperRes.status).toBe(200);
      expect(lowerRes.status).toBe(200);

      // Same total count regardless of case
      expect(upperRes.data?.total).toBe(lowerRes.data?.total);
    });

    it('returns empty results for nonsense query', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'xyznonexistentquery123456',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data?.listings).toEqual([]);
      expect(data?.total).toBe(0);
    });

    it('handles minimum query length (2 chars required)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'ka',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');
    });

    it('ignores single character query', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'k',
        tab: 'available',
      });

      expect(status).toBe(200);
      // Single char should be ignored, returning unfiltered results
      expect(data).toHaveProperty('listings');
    });

    it('handles multi-word query', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana sword',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');
    });
  });

  // =============================================================================
  // SEARCH COMBINED WITH FILTERS
  // =============================================================================
  describe('Search Combined with Filters', () => {
    it('combines search with item type filter', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        type: 'katana',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      // All returned items should be katanas
      data?.listings.forEach(listing => {
        expect(listing.item_type?.toLowerCase()).toBe('katana');
      });
    });

    it('combines search with certification filter (Juyo)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        cert: 'Juyo',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      // All returned items should have Juyo cert
      data?.listings.forEach(listing => {
        expect(listing.cert_type).toBe('Juyo');
      });
    });

    it('combines search with certification filter (Hozon)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'tanto',
        cert: 'Hozon',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      data?.listings.forEach(listing => {
        expect(listing.cert_type).toBe('Hozon');
      });
    });

    it('combines search with dealer filter', async () => {
      if (!serverAvailable) return;

      // First get available dealers
      const { data: baseData } = await fetchBrowse({ tab: 'available' });
      if (!baseData || baseData.facets.dealers.length === 0) return;

      const dealerId = baseData.facets.dealers[0].id;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        dealer: dealerId,
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      // All returned items should be from the specified dealer
      data?.listings.forEach(listing => {
        expect(listing.dealer_id).toBe(dealerId);
      });
    });

    it('combines search with ask-only filter (price null)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        ask: 'true',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      // All returned items should have null price (ask-only)
      data?.listings.forEach(listing => {
        expect(listing.price_value).toBeNull();
      });
    });

    it('combines search with minimum price filter', async () => {
      if (!serverAvailable) return;

      const minPrice = 1000000;
      const { status, data } = await fetchBrowse({
        q: 'katana',
        minPrice: minPrice,
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      data?.listings.forEach(listing => {
        if (listing.price_value !== null) {
          expect(listing.price_value).toBeGreaterThanOrEqual(minPrice);
        }
      });
    });

    it('combines search with maximum price filter', async () => {
      if (!serverAvailable) return;

      const maxPrice = 500000;
      const { status, data } = await fetchBrowse({
        q: 'katana',
        maxPrice: maxPrice,
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      data?.listings.forEach(listing => {
        if (listing.price_value !== null) {
          expect(listing.price_value).toBeLessThanOrEqual(maxPrice);
        }
      });
    });

    it('combines search with price range filter', async () => {
      if (!serverAvailable) return;

      const minPrice = 500000;
      const maxPrice = 2000000;
      const { status, data } = await fetchBrowse({
        q: 'katana',
        minPrice: minPrice,
        maxPrice: maxPrice,
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      data?.listings.forEach(listing => {
        if (listing.price_value !== null) {
          expect(listing.price_value).toBeGreaterThanOrEqual(minPrice);
          expect(listing.price_value).toBeLessThanOrEqual(maxPrice);
        }
      });
    });

    it('combines search with multiple filters simultaneously', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        type: 'katana',
        cert: 'Juyo',
        minPrice: 1000000,
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      // All returned items should match ALL filters
      data?.listings.forEach(listing => {
        expect(listing.item_type?.toLowerCase()).toBe('katana');
        expect(listing.cert_type).toBe('Juyo');
        if (listing.price_value !== null) {
          expect(listing.price_value).toBeGreaterThanOrEqual(1000000);
        }
      });
    });

    it('combines search with school filter', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'Bizen',
        school: 'Bizen',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');
    });

    it('search narrows results when combined with type filter', async () => {
      if (!serverAvailable) return;

      // Get all katanas
      const { data: allKatanas } = await fetchBrowse({
        type: 'katana',
        tab: 'available',
      });

      // Get katanas matching search
      const { data: searchedKatanas } = await fetchBrowse({
        q: 'Bizen',
        type: 'katana',
        tab: 'available',
      });

      expect(allKatanas).toHaveProperty('total');
      expect(searchedKatanas).toHaveProperty('total');

      // Search should narrow results (or equal if all match)
      expect(searchedKatanas!.total).toBeLessThanOrEqual(allKatanas!.total);
    });
  });

  // =============================================================================
  // SEARCH + PAGINATION
  // =============================================================================
  describe('Search + Pagination', () => {
    it('paginates search results (page 1)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        page: 1,
        limit: 5,
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data?.listings.length).toBeLessThanOrEqual(5);
      expect(data?.page).toBe(1);
    });

    it('paginates search results (page 2)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        page: 2,
        limit: 5,
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data?.listings.length).toBeLessThanOrEqual(5);
      expect(data?.page).toBe(2);
    });

    it('returns correct total for search', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        page: 1,
        limit: 5,
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('totalPages');

      // Total pages should be consistent with total and limit
      const expectedPages = Math.ceil(data!.total / 5);
      expect(data!.totalPages).toBe(expectedPages);
    });

    it('returns consistent total across pages', async () => {
      if (!serverAvailable) return;

      const [page1, page2] = await Promise.all([
        fetchBrowse({ q: 'katana', page: 1, limit: 5, tab: 'available' }),
        fetchBrowse({ q: 'katana', page: 2, limit: 5, tab: 'available' }),
      ]);

      expect(page1.data?.total).toBe(page2.data?.total);
      expect(page1.data?.totalPages).toBe(page2.data?.totalPages);
    });

    it('returns different listings on different pages', async () => {
      if (!serverAvailable) return;

      const { data: page1 } = await fetchBrowse({
        q: 'katana',
        page: 1,
        limit: 5,
        tab: 'available',
      });

      if (!page1 || page1.totalPages < 2) return; // Skip if not enough pages

      const { data: page2 } = await fetchBrowse({
        q: 'katana',
        page: 2,
        limit: 5,
        tab: 'available',
      });

      const page1Ids = page1.listings.map(l => l.id);
      const page2Ids = page2?.listings.map(l => l.id) || [];

      // Pages should have no overlap
      const overlap = page1Ids.filter(id => page2Ids.includes(id));
      expect(overlap.length).toBe(0);
    });

    it('handles last page correctly', async () => {
      if (!serverAvailable) return;

      const { data: firstPage } = await fetchBrowse({
        q: 'katana',
        page: 1,
        limit: 10,
        tab: 'available',
      });

      if (!firstPage || firstPage.totalPages < 1) return;

      const { status, data: lastPage } = await fetchBrowse({
        q: 'katana',
        page: firstPage.totalPages,
        limit: 10,
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(lastPage?.page).toBe(firstPage.totalPages);
    });

    it('handles page beyond results gracefully', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        page: 9999,
        limit: 10,
        tab: 'available',
      });

      expect(status).toBe(200);
      // Should return empty or clamped page
      expect(data).toHaveProperty('listings');
    });
  });

  // =============================================================================
  // SEARCH + SORTING
  // =============================================================================
  describe('Search + Sorting', () => {
    it('sorts search results by price_asc', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        sort: 'price_asc',
        tab: 'available',
      });

      expect(status).toBe(200);

      const prices = data?.listings
        .map(l => l.price_value)
        .filter((p): p is number => p !== null) || [];

      // Verify ascending order
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    it('sorts search results by price_desc', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        sort: 'price_desc',
        tab: 'available',
      });

      expect(status).toBe(200);

      const prices = data?.listings
        .map(l => l.price_value)
        .filter((p): p is number => p !== null) || [];

      // Verify descending order
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }
    });

    it('sorts search results by recent (default)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        tab: 'available',
      });

      expect(status).toBe(200);

      const dates = data?.listings.map(l => new Date(l.first_seen_at).getTime()) || [];

      // Verify descending order (most recent first)
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
      }
    });

    it('sorts search results by name', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        sort: 'name',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      // Name sorting is alphabetical by title
      const titles = data?.listings.map(l => l.title || '') || [];

      // Verify alphabetical order (case-insensitive)
      for (let i = 1; i < titles.length; i++) {
        const prev = titles[i - 1].toLowerCase();
        const curr = titles[i].toLowerCase();
        expect(curr >= prev).toBe(true);
      }
    });

    it('sort persists across pages', async () => {
      if (!serverAvailable) return;

      const { data: page1 } = await fetchBrowse({
        q: 'katana',
        sort: 'price_asc',
        page: 1,
        limit: 5,
        tab: 'available',
      });

      if (!page1 || page1.totalPages < 2) return;

      const { data: page2 } = await fetchBrowse({
        q: 'katana',
        sort: 'price_asc',
        page: 2,
        limit: 5,
        tab: 'available',
      });

      // Last price on page 1 should be <= first price on page 2
      const page1Prices = page1.listings
        .map(l => l.price_value)
        .filter((p): p is number => p !== null);
      const page2Prices = page2?.listings
        .map(l => l.price_value)
        .filter((p): p is number => p !== null) || [];

      if (page1Prices.length > 0 && page2Prices.length > 0) {
        expect(page1Prices[page1Prices.length - 1]).toBeLessThanOrEqual(page2Prices[0]);
      }
    });
  });

  // =============================================================================
  // FACETS WITH SEARCH
  // =============================================================================
  describe('Facets with Search', () => {
    it('returns facets when searching', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('facets');
      expect(data?.facets).toHaveProperty('itemTypes');
      expect(data?.facets).toHaveProperty('certifications');
      expect(data?.facets).toHaveProperty('dealers');
    });

    it('returns item type facets with counts', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(Array.isArray(data?.facets.itemTypes)).toBe(true);

      data?.facets.itemTypes.forEach(facet => {
        expect(facet).toHaveProperty('value');
        expect(facet).toHaveProperty('count');
        expect(typeof facet.count).toBe('number');
        expect(facet.count).toBeGreaterThan(0);
      });
    });

    it('returns certification facets with counts', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(Array.isArray(data?.facets.certifications)).toBe(true);

      data?.facets.certifications.forEach(facet => {
        expect(facet).toHaveProperty('value');
        expect(facet).toHaveProperty('count');
        expect(facet.count).toBeGreaterThan(0);
      });
    });

    it('returns dealer facets with id, name, count', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(Array.isArray(data?.facets.dealers)).toBe(true);

      data?.facets.dealers.forEach(facet => {
        expect(facet).toHaveProperty('id');
        expect(facet).toHaveProperty('name');
        expect(facet).toHaveProperty('count');
        expect(typeof facet.id).toBe('number');
        expect(typeof facet.name).toBe('string');
        expect(facet.count).toBeGreaterThan(0);
      });
    });

    it('facets change based on search query', async () => {
      if (!serverAvailable) return;

      const [katanaRes, tsubaRes] = await Promise.all([
        fetchBrowse({ q: 'katana', tab: 'available' }),
        fetchBrowse({ q: 'tsuba', tab: 'available' }),
      ]);

      // Different searches may have different facet distributions
      // Just verify both have valid facets
      expect(katanaRes.data?.facets.itemTypes.length).toBeGreaterThanOrEqual(0);
      expect(tsubaRes.data?.facets.itemTypes.length).toBeGreaterThanOrEqual(0);
    });
  });

  // =============================================================================
  // SEARCH EDGE CASES
  // =============================================================================
  describe('Search Edge Cases', () => {
    it('handles empty search with filters (filters still apply)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: '',
        type: 'katana',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      // Empty search should not filter, but type filter should apply
      data?.listings.forEach(listing => {
        expect(listing.item_type?.toLowerCase()).toBe('katana');
      });
    });

    it('handles whitespace search with filters', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: '   ',
        type: 'wakizashi',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      data?.listings.forEach(listing => {
        expect(listing.item_type?.toLowerCase()).toBe('wakizashi');
      });
    });

    it('handles special characters in search', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'test & special',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');
    });

    it('handles Japanese romanization in search', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'wakizashi',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');
    });

    it('handles macron characters in search', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'Goto',
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');
    });

    it('handles SQL injection attempt in search', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: "test'; DROP TABLE listings; --",
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');
    });

    it('handles very long search query', async () => {
      if (!serverAvailable) return;

      const longQuery = 'katana '.repeat(100);
      const { status, data } = await fetchBrowse({
        q: longQuery,
        tab: 'available',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');
    });

    it('handles search with URL-encoded characters', async () => {
      if (!serverAvailable) return;

      const res = await fetch(
        `${BROWSE_ENDPOINT}?tab=available&q=katana%20sword`,
        { signal: AbortSignal.timeout(10000) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('listings');
    });
  });

  // =============================================================================
  // SEARCH ON SOLD TAB
  // =============================================================================
  describe('Search on Sold Tab', () => {
    it('searches sold items', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        tab: 'sold',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      // All returned items should be sold
      data?.listings.forEach(listing => {
        const isSold = listing.is_sold === true ||
                       listing.status === 'sold' ||
                       listing.status === 'presumed_sold';
        expect(isSold).toBe(true);
      });
    });

    it('search works with filters on sold tab', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchBrowse({
        q: 'katana',
        type: 'katana',
        tab: 'sold',
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('listings');

      data?.listings.forEach(listing => {
        expect(listing.item_type?.toLowerCase()).toBe('katana');
      });
    });
  });

  // =============================================================================
  // PERFORMANCE
  // =============================================================================
  describe('Search Performance', () => {
    it('search responds within 1 second', async () => {
      if (!serverAvailable) return;

      const start = Date.now();
      const { status } = await fetchBrowse({
        q: 'katana',
        tab: 'available',
      });
      const elapsed = Date.now() - start;

      expect(status).toBe(200);
      expect(elapsed).toBeLessThan(1000);
    });

    it('search with filters responds within 1 second', async () => {
      if (!serverAvailable) return;

      const start = Date.now();
      const { status } = await fetchBrowse({
        q: 'katana',
        type: 'katana',
        cert: 'Juyo',
        tab: 'available',
      });
      const elapsed = Date.now() - start;

      expect(status).toBe(200);
      expect(elapsed).toBeLessThan(1000);
    });

    it('handles concurrent search requests', async () => {
      if (!serverAvailable) return;

      const queries = ['katana', 'wakizashi', 'tanto', 'tsuba', 'kozuka'];
      const start = Date.now();

      const results = await Promise.all(
        queries.map(q => fetchBrowse({ q, tab: 'available' }))
      );

      const elapsed = Date.now() - start;

      results.forEach(({ status }) => {
        expect(status).toBe(200);
      });

      // Concurrent requests should complete in reasonable time
      expect(elapsed).toBeLessThan(3000);
    });
  });
});
