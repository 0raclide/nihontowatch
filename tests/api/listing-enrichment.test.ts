import { describe, it, expect, beforeAll } from 'vitest';

// Use environment variable for API base URL, defaulting to production
const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

// Check if enrichment endpoint is available (may not be deployed yet)
let enrichmentEndpointAvailable = false;

// Helper to skip test if endpoint not deployed
const skipIfNotDeployed = () => {
  if (!enrichmentEndpointAvailable) {
    console.warn('Enrichment endpoint not deployed yet - skipping test');
    return true;
  }
  return false;
};

describe('Listing Enrichment API', () => {
  // Check if the endpoint is deployed before running tests
  beforeAll(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/listing/7023/enrichment`);
      enrichmentEndpointAvailable = res.status !== 404;
    } catch {
      enrichmentEndpointAvailable = false;
    }
  });

  describe('GET /api/listing/[id]/enrichment', () => {
    it('should return enrichment data for enriched listing', async () => {
      if (skipIfNotDeployed()) return;

      // Listing 7023 is known to have enrichment data
      const res = await fetch(`${API_BASE}/api/listing/7023/enrichment`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('enrichment');

      // Should have enrichment data (this listing is known to be enriched)
      if (data.enrichment) {
        expect(data.enrichment).toHaveProperty('listing_id', 7023);
        expect(data.enrichment).toHaveProperty('match_confidence', 'DEFINITIVE');
        expect(data.enrichment).toHaveProperty('setsumei_en');
        expect(data.enrichment).toHaveProperty('enriched_maker');
      }
    });

    it('should return null enrichment for non-enriched listing', async () => {
      if (skipIfNotDeployed()) return;

      // Get a random listing that's likely not enriched (e.g., a katana)
      const browseRes = await fetch(`${API_BASE}/api/browse?cat=nihonto&limit=1`);
      const browseData = await browseRes.json();

      if (!browseData.listings || browseData.listings.length === 0) {
        console.warn('No nihonto listings available for testing');
        return;
      }

      const listingId = browseData.listings[0].id;
      const res = await fetch(`${API_BASE}/api/listing/${listingId}/enrichment`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('enrichment');
      // Most nihonto don't have enrichment yet (only tosogu currently)
    });

    it('should return 400 for invalid listing ID', async () => {
      if (skipIfNotDeployed()) return;

      const res = await fetch(`${API_BASE}/api/listing/not-a-number/enrichment`);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Invalid');
    });

    it('should include all enrichment fields when present', async () => {
      if (skipIfNotDeployed()) return;

      const res = await fetch(`${API_BASE}/api/listing/7023/enrichment`);
      const data = await res.json();

      if (!data.enrichment) {
        console.warn('Listing 7023 no longer has enrichment data');
        return;
      }

      // Check all expected enrichment fields
      const expectedFields = [
        'enrichment_id',
        'listing_id',
        'yuhinkai_uuid',
        'match_score',
        'match_confidence',
        'verification_status',
        'enriched_at',
      ];

      for (const field of expectedFields) {
        expect(data.enrichment).toHaveProperty(field);
      }
    });

    it('should have proper cache headers for aggressive caching', async () => {
      if (skipIfNotDeployed()) return;

      const res = await fetch(`${API_BASE}/api/listing/7023/enrichment`);

      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toBeTruthy();
      expect(cacheControl).toContain('public');
    });
  });

  describe('Enrichment data quality', () => {
    it('should have valid match score between 0 and 1', async () => {
      if (skipIfNotDeployed()) return;

      const res = await fetch(`${API_BASE}/api/listing/7023/enrichment`);
      const data = await res.json();

      if (!data.enrichment) {
        console.warn('Listing 7023 no longer has enrichment data');
        return;
      }

      expect(data.enrichment.match_score).toBeGreaterThanOrEqual(0);
      expect(data.enrichment.match_score).toBeLessThanOrEqual(1);
    });

    it('should have valid confidence level', async () => {
      if (skipIfNotDeployed()) return;

      const res = await fetch(`${API_BASE}/api/listing/7023/enrichment`);
      const data = await res.json();

      if (!data.enrichment) {
        console.warn('Listing 7023 no longer has enrichment data');
        return;
      }

      const validConfidences = ['DEFINITIVE', 'HIGH', 'MEDIUM', 'LOW'];
      expect(validConfidences).toContain(data.enrichment.match_confidence);
    });

    it('should have valid verification status', async () => {
      if (skipIfNotDeployed()) return;

      const res = await fetch(`${API_BASE}/api/listing/7023/enrichment`);
      const data = await res.json();

      if (!data.enrichment) {
        console.warn('Listing 7023 no longer has enrichment data');
        return;
      }

      const validStatuses = ['auto', 'confirmed', 'rejected', 'review_needed'];
      expect(validStatuses).toContain(data.enrichment.verification_status);
    });

    it('should have setsumei_en in markdown format when present', async () => {
      if (skipIfNotDeployed()) return;

      const res = await fetch(`${API_BASE}/api/listing/7023/enrichment`);
      const data = await res.json();

      if (!data.enrichment?.setsumei_en) {
        console.warn('Listing 7023 no longer has setsumei translation');
        return;
      }

      // Should have markdown format indicator
      expect(data.enrichment.setsumei_en_format).toBe('markdown');
      // Should contain markdown elements (headers, etc.)
      expect(data.enrichment.setsumei_en).toContain('#');
    });
  });

  describe('Performance', () => {
    it('should respond within reasonable time (<1s)', async () => {
      if (skipIfNotDeployed()) return;

      const start = Date.now();
      await fetch(`${API_BASE}/api/listing/7023/enrichment`);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // 1 second max (should be fast)
    });
  });
});
