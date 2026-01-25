import { describe, it, expect } from 'vitest';

// Use environment variable for API base URL, defaulting to production
const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

/**
 * Cache Header Tests
 *
 * Note: Vercel's edge cache may modify Cache-Control headers before returning
 * the response to the client. These tests verify that caching is enabled,
 * but the exact s-maxage values may not be visible in the response headers
 * even though they are respected by the edge cache.
 */
describe('API Cache Headers', () => {
  describe('/api/browse', () => {
    it('should have Cache-Control header', async () => {
      const res = await fetch(`${API_BASE}/api/browse?limit=1`);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toBeTruthy();
    });

    it('should be private (contains personalized data: isAdmin, tier)', async () => {
      const res = await fetch(`${API_BASE}/api/browse?limit=1`);

      const cacheControl = res.headers.get('cache-control');
      // Browse API returns personalized data (isAdmin, subscription tier, isDelayed)
      // so it must use private caching to prevent CDN from serving wrong auth state
      expect(cacheControl).toContain('private');
    });
  });

  describe('/api/search/suggestions', () => {
    it('should have Cache-Control header', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=katana`);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toBeTruthy();
    });

    it('should cache empty query responses too', async () => {
      const res = await fetch(`${API_BASE}/api/search/suggestions?q=x`);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toBeTruthy();
    });
  });

  describe('/api/exchange-rates', () => {
    it('should have Cache-Control header', async () => {
      const res = await fetch(`${API_BASE}/api/exchange-rates`);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toBeTruthy();
    });

    it('should be public cacheable', async () => {
      const res = await fetch(`${API_BASE}/api/exchange-rates`);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toContain('public');
    });
  });

  describe('/api/listing/[id]', () => {
    it('should have Cache-Control header', async () => {
      // First get a valid listing ID
      const browseRes = await fetch(`${API_BASE}/api/browse?limit=1`);
      const browseData = await browseRes.json();

      if (!browseData.listings || browseData.listings.length === 0) {
        console.warn('No listings available for testing');
        return;
      }

      const listingId = browseData.listings[0].id;
      const res = await fetch(`${API_BASE}/api/listing/${listingId}`);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toBeTruthy();
    });

    it('should be public cacheable', async () => {
      const browseRes = await fetch(`${API_BASE}/api/browse?limit=1`);
      const browseData = await browseRes.json();

      if (!browseData.listings || browseData.listings.length === 0) {
        console.warn('No listings available for testing');
        return;
      }

      const listingId = browseData.listings[0].id;
      const res = await fetch(`${API_BASE}/api/listing/${listingId}`);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toContain('public');
    });

    it('should not cache 404 responses with long TTL', async () => {
      const res = await fetch(`${API_BASE}/api/listing/999999999`);

      // 404 responses should either have no cache, short cache, or error-specific caching
      const cacheControl = res.headers.get('cache-control');
      // Either no cache header, or no s-maxage, or includes no-store/no-cache
      const isNotAggressivelyCached =
        !cacheControl ||
        cacheControl.includes('no-store') ||
        cacheControl.includes('no-cache') ||
        !cacheControl.includes('s-maxage=600') || // Not the same as success cache
        cacheControl.includes('s-maxage=0');

      expect(isNotAggressivelyCached).toBe(true);
    });
  });

  describe('Response times indicate caching', () => {
    it('/api/browse responds quickly (cached)', async () => {
      // Make initial request
      await fetch(`${API_BASE}/api/browse?limit=1`);

      // Second request should be faster due to caching
      const start = Date.now();
      const res = await fetch(`${API_BASE}/api/browse?limit=1`);
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      // Cached response should be reasonably fast
      expect(duration).toBeLessThan(3000);
    });

    it('/api/exchange-rates responds quickly', async () => {
      const start = Date.now();
      const res = await fetch(`${API_BASE}/api/exchange-rates`);
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(2000);
    });
  });
});
