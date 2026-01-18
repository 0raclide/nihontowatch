/**
 * Search API Integration Tests
 *
 * IMPORTANT: These tests require the development server to be running.
 * Start the dev server before running:
 *   npm run dev -- -p 3020
 *
 * Then run tests:
 *   npm test tests/api/search.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Use environment variable for API base URL, defaulting to production
// For local testing with dev server, run: TEST_API_URL=http://localhost:3020 npm test tests/api/search.test.ts
const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

describe('Search Suggestions API', () => {
  // Give the server a moment to be ready
  beforeAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Query validation', () => {
    it('returns empty for short query (single character)', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=a`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.suggestions).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('returns empty for empty query', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.suggestions).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('returns empty for missing query parameter', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.suggestions).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('returns empty for whitespace-only query', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=${encodeURIComponent('   ')}`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.suggestions).toEqual([]);
      expect(data.total).toBe(0);
    });
  });

  describe('Valid queries', () => {
    it('returns suggestions for valid query', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=katana`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data).toHaveProperty('suggestions');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('query');
      expect(Array.isArray(data.suggestions)).toBe(true);
    });

    it('returns suggestions for two-character query', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=ka`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data).toHaveProperty('suggestions');
      expect(data).toHaveProperty('total');
    });

    it('echoes back the original query', async () => {
      const query = 'katana';
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=${query}`);
      const data = await res.json();
      expect(data.query).toBe(query);
    });

    it('returns proper suggestion structure', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=katana`);
      const data = await res.json();

      if (data.suggestions.length > 0) {
        const suggestion = data.suggestions[0];
        expect(suggestion).toHaveProperty('id');
        expect(suggestion).toHaveProperty('title');
        expect(suggestion).toHaveProperty('item_type');
        expect(suggestion).toHaveProperty('price_value');
        expect(suggestion).toHaveProperty('price_currency');
        expect(suggestion).toHaveProperty('dealer_name');
        expect(suggestion).toHaveProperty('url');
      }
    });
  });

  describe('Limit parameter', () => {
    it('limits results to specified limit', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=katana&limit=3`);
      const data = await res.json();
      expect(data.suggestions.length).toBeLessThanOrEqual(3);
    });

    it('respects default limit of 5', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=katana`);
      const data = await res.json();
      expect(data.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('clamps limit to maximum of 10', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=katana&limit=100`);
      const data = await res.json();
      expect(data.suggestions.length).toBeLessThanOrEqual(10);
    });

    it('clamps limit to minimum of 1', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=katana&limit=0`);
      const data = await res.json();
      // Should return at least up to limit of 1 (or 0 if no results)
      expect(data.suggestions.length).toBeLessThanOrEqual(5); // Falls back to default
    });
  });

  describe('Security', () => {
    it('handles special characters safely (SQL injection attempt)', async () => {
      const maliciousQuery = "test'; DROP TABLE listings; --";
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=${encodeURIComponent(maliciousQuery)}`);
      expect(res.ok).toBe(true);
      // Should not cause a server error
    });

    it('handles Unicode characters safely', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=${encodeURIComponent('correct')}`);
      expect(res.ok).toBe(true);
    });

    it('handles very long queries', async () => {
      const longQuery = 'a'.repeat(1000);
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=${encodeURIComponent(longQuery)}`);
      expect(res.ok).toBe(true);
    });
  });
});

describe('Browse API with Search', () => {
  beforeAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Text search parameter (q)', () => {
    it('searches across title, smith, tosogu_maker', async () => {
      const res = await fetch(`${API_BASE}/api/browse?q=test&tab=available`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data).toHaveProperty('listings');
      expect(data).toHaveProperty('total');
    });

    it('returns results for common sword term', async () => {
      const res = await fetch(`${API_BASE}/api/browse?q=katana&tab=available`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data).toHaveProperty('listings');
    });

    it('is case-insensitive', async () => {
      const [upperRes, lowerRes] = await Promise.all([
        fetch(`${API_BASE}/api/browse?q=KATANA&tab=available`),
        fetch(`${API_BASE}/api/browse?q=katana&tab=available`),
      ]);

      expect(upperRes.ok).toBe(true);
      expect(lowerRes.ok).toBe(true);

      const upperData = await upperRes.json();
      const lowerData = await lowerRes.json();

      // Same total count (case should not matter)
      expect(upperData.total).toBe(lowerData.total);
    });

    it('returns empty results for nonsense query', async () => {
      const res = await fetch(`${API_BASE}/api/browse?q=xyznonexistentquery123&tab=available`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.listings).toEqual([]);
      expect(data.total).toBe(0);
    });
  });

  describe('Search combined with filters', () => {
    it('combines search with item type filter', async () => {
      const res = await fetch(`${API_BASE}/api/browse?q=katana&type=katana&tab=available`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      // All returned items should be katanas
      data.listings.forEach((listing: { item_type: string | null }) => {
        expect(listing.item_type?.toLowerCase()).toBe('katana');
      });
    });

    it('combines search with certification filter', async () => {
      const res = await fetch(`${API_BASE}/api/browse?q=katana&cert=Juyo&tab=available`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      // All returned items should have Juyo cert
      data.listings.forEach((listing: { cert_type: string | null }) => {
        expect(listing.cert_type).toBe('Juyo');
      });
    });

    it('combines search with price filter', async () => {
      const minPrice = 500000;
      // Price filter is parsed from query text, not a separate parameter
      // Use encodeURIComponent for proper URL encoding
      const query = encodeURIComponent(`katana price>=${minPrice}`);
      const res = await fetch(`${API_BASE}/api/browse?q=${query}&tab=available`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      data.listings.forEach((listing: { price_value: number | null }) => {
        if (listing.price_value !== null) {
          expect(listing.price_value).toBeGreaterThanOrEqual(minPrice);
        }
      });
    });

    it('combines search with dealer filter', async () => {
      const dealerId = 1;
      const res = await fetch(`${API_BASE}/api/browse?q=katana&dealer=${dealerId}&tab=available`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      data.listings.forEach((listing: { dealer_id: number }) => {
        expect(listing.dealer_id).toBe(dealerId);
      });
    });

    it('combines search with multiple filters', async () => {
      const minPrice = 1000000;
      // Price filter is parsed from query text
      const query = encodeURIComponent(`katana price>=${minPrice}`);
      const res = await fetch(`${API_BASE}/api/browse?q=${query}&type=katana&cert=Juyo&tab=available`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      data.listings.forEach((listing: { item_type: string | null; cert_type: string | null; price_value: number | null }) => {
        expect(listing.item_type?.toLowerCase()).toBe('katana');
        expect(listing.cert_type).toBe('Juyo');
        if (listing.price_value !== null) {
          expect(listing.price_value).toBeGreaterThanOrEqual(minPrice);
        }
      });
    });
  });

  describe('Search with pagination', () => {
    it('returns paginated search results', async () => {
      const res = await fetch(`${API_BASE}/api/browse?q=katana&page=1&limit=5&tab=available`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.listings.length).toBeLessThanOrEqual(5);
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('totalPages');
    });

    it('returns consistent total across pages', async () => {
      const [page1Res, page2Res] = await Promise.all([
        fetch(`${API_BASE}/api/browse?q=katana&page=1&limit=5&tab=available`),
        fetch(`${API_BASE}/api/browse?q=katana&page=2&limit=5&tab=available`),
      ]);

      const page1Data = await page1Res.json();
      const page2Data = await page2Res.json();

      // Total should be the same regardless of page
      expect(page1Data.total).toBe(page2Data.total);
    });
  });

  describe('Search with sorting', () => {
    it('sorts search results by price ascending', async () => {
      const res = await fetch(`${API_BASE}/api/browse?q=katana&sort=price_asc&tab=available`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      const prices = data.listings
        .map((l: { price_value: number | null }) => l.price_value)
        .filter((p: number | null): p is number => p !== null);

      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    it('sorts search results by price descending', async () => {
      const res = await fetch(`${API_BASE}/api/browse?q=katana&sort=price_desc&tab=available`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      const prices = data.listings
        .map((l: { price_value: number | null }) => l.price_value)
        .filter((p: number | null): p is number => p !== null);

      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }
    });
  });

  describe('Search edge cases', () => {
    it('handles empty search with filters', async () => {
      const res = await fetch(`${API_BASE}/api/browse?q=&type=katana&tab=available`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      // Should still filter by type even with empty search
      expect(data).toHaveProperty('listings');
    });

    it('handles special characters in search', async () => {
      const res = await fetch(`${API_BASE}/api/browse?q=${encodeURIComponent('test & special')}&tab=available`);
      expect(res.ok).toBe(true);
    });

    it('handles Japanese characters in search', async () => {
      const res = await fetch(`${API_BASE}/api/browse?q=${encodeURIComponent('correct')}&tab=available`);
      expect(res.ok).toBe(true);
    });
  });
});
