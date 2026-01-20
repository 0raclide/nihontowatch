import { describe, it, expect } from 'vitest';

// Use environment variable for API base URL, defaulting to production
const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

describe('Listing API', () => {
  describe('GET /api/listing/[id]', () => {
    it('should return listing data for valid ID', async () => {
      // First, get a valid listing ID from browse
      const browseRes = await fetch(`${API_BASE}/api/browse?limit=1`);
      const browseData = await browseRes.json();

      if (!browseData.listings || browseData.listings.length === 0) {
        console.warn('No listings available for testing');
        return;
      }

      const listingId = browseData.listings[0].id;
      const res = await fetch(`${API_BASE}/api/listing/${listingId}`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('listing');
      expect(data.listing).toHaveProperty('id');
      expect(data.listing).toHaveProperty('title');
      expect(data.listing).toHaveProperty('url');
    });

    it('should return 404 for non-existent listing', async () => {
      const res = await fetch(`${API_BASE}/api/listing/999999999`);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toHaveProperty('error');
    });

    it('should return 400 for invalid ID format', async () => {
      const res = await fetch(`${API_BASE}/api/listing/not-a-number`);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Invalid');
    });

    it('should include dealer information', async () => {
      // Get a valid listing ID
      const browseRes = await fetch(`${API_BASE}/api/browse?limit=1`);
      const browseData = await browseRes.json();

      if (!browseData.listings || browseData.listings.length === 0) {
        console.warn('No listings available for testing');
        return;
      }

      const listingId = browseData.listings[0].id;
      const res = await fetch(`${API_BASE}/api/listing/${listingId}`);
      const data = await res.json();

      expect(data.listing).toHaveProperty('dealers');
      expect(data.listing.dealers).toHaveProperty('id');
      expect(data.listing.dealers).toHaveProperty('name');
      expect(data.listing.dealers).toHaveProperty('domain');
    });

    it('should include dealer_earliest_seen_at for new badge', async () => {
      // Get a valid listing ID
      const browseRes = await fetch(`${API_BASE}/api/browse?limit=1`);
      const browseData = await browseRes.json();

      if (!browseData.listings || browseData.listings.length === 0) {
        console.warn('No listings available for testing');
        return;
      }

      const listingId = browseData.listings[0].id;
      const res = await fetch(`${API_BASE}/api/listing/${listingId}`);
      const data = await res.json();

      // dealer_earliest_seen_at should be present (may be null for very old dealers)
      expect(data.listing).toHaveProperty('dealer_earliest_seen_at');
    });

    it('should include all required listing fields', async () => {
      // Get a valid listing ID
      const browseRes = await fetch(`${API_BASE}/api/browse?limit=1`);
      const browseData = await browseRes.json();

      if (!browseData.listings || browseData.listings.length === 0) {
        console.warn('No listings available for testing');
        return;
      }

      const listingId = browseData.listings[0].id;
      const res = await fetch(`${API_BASE}/api/listing/${listingId}`);
      const data = await res.json();

      // Check all expected fields are present
      const requiredFields = [
        'id',
        'url',
        'title',
        'item_type',
        'price_value',
        'price_currency',
        'status',
        'is_available',
        'dealer_id',
        'first_seen_at',
      ];

      for (const field of requiredFields) {
        expect(data.listing).toHaveProperty(field);
      }
    });
  });

  describe('Cache headers', () => {
    it('should have Cache-Control header', async () => {
      // Get a valid listing ID
      const browseRes = await fetch(`${API_BASE}/api/browse?limit=1`);
      const browseData = await browseRes.json();

      if (!browseData.listings || browseData.listings.length === 0) {
        console.warn('No listings available for testing');
        return;
      }

      const listingId = browseData.listings[0].id;
      const res = await fetch(`${API_BASE}/api/listing/${listingId}`);

      const cacheControl = res.headers.get('cache-control');
      // Vercel may process headers - just verify we get some cache directive
      expect(cacheControl).toBeTruthy();
    });

    it('should be publicly cacheable', async () => {
      // Get a valid listing ID
      const browseRes = await fetch(`${API_BASE}/api/browse?limit=1`);
      const browseData = await browseRes.json();

      if (!browseData.listings || browseData.listings.length === 0) {
        console.warn('No listings available for testing');
        return;
      }

      const listingId = browseData.listings[0].id;
      const res = await fetch(`${API_BASE}/api/listing/${listingId}`);

      const cacheControl = res.headers.get('cache-control');
      // Should contain public directive for CDN caching
      expect(cacheControl).toContain('public');
    });
  });

  describe('Performance', () => {
    it('should respond within reasonable time (<2s)', async () => {
      // Get a valid listing ID
      const browseRes = await fetch(`${API_BASE}/api/browse?limit=1`);
      const browseData = await browseRes.json();

      if (!browseData.listings || browseData.listings.length === 0) {
        console.warn('No listings available for testing');
        return;
      }

      const listingId = browseData.listings[0].id;

      const start = Date.now();
      await fetch(`${API_BASE}/api/listing/${listingId}`);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000); // 2 seconds max
    });
  });
});
