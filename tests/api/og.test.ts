import { describe, it, expect } from 'vitest';

// Use environment variable for API base URL, defaulting to production
const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

// PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Check if a buffer starts with PNG magic bytes
 */
function isPngBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 8) return false;
  const bytes = new Uint8Array(buffer, 0, 8);
  return PNG_MAGIC_BYTES.every((byte, i) => bytes[i] === byte);
}

/**
 * Helper to get a valid listing ID from the browse API
 */
async function getValidListingId(): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE}/api/browse?limit=1`);
    const data = await res.json();
    if (data.listings && data.listings.length > 0) {
      return data.listings[0].id;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

describe('OG Image API (/api/og)', () => {
  describe('Default OG Image (no listing ID)', () => {
    it('should return valid PNG for default OG', async () => {
      const res = await fetch(`${API_BASE}/api/og`);

      expect(res.status).toBe(200);

      const buffer = await res.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
      expect(isPngBuffer(buffer)).toBe(true);
    });

    it('should have correct Content-Type header', async () => {
      const res = await fetch(`${API_BASE}/api/og`);

      expect(res.headers.get('content-type')).toBe('image/png');
    });

    it('should have reasonable file size (5KB - 100KB)', async () => {
      const res = await fetch(`${API_BASE}/api/og`);
      const buffer = await res.arrayBuffer();

      // Default OG should be between 5KB and 100KB
      expect(buffer.byteLength).toBeGreaterThan(5000);
      expect(buffer.byteLength).toBeLessThan(100000);
    });
  });

  describe('Listing OG Image (with valid ID)', () => {
    it('should return valid PNG for valid listing', async () => {
      const listingId = await getValidListingId();
      if (!listingId) {
        console.warn('No listings available for testing');
        return;
      }

      const res = await fetch(`${API_BASE}/api/og?id=${listingId}`);

      expect(res.status).toBe(200);

      const buffer = await res.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
      expect(isPngBuffer(buffer)).toBe(true);
    });

    it('should have correct Content-Type header', async () => {
      const listingId = await getValidListingId();
      if (!listingId) {
        console.warn('No listings available for testing');
        return;
      }

      const res = await fetch(`${API_BASE}/api/og?id=${listingId}`);

      expect(res.headers.get('content-type')).toBe('image/png');
    });

    it('should have reasonable file size (5KB - 100KB)', async () => {
      const listingId = await getValidListingId();
      if (!listingId) {
        console.warn('No listings available for testing');
        return;
      }

      const res = await fetch(`${API_BASE}/api/og?id=${listingId}`);
      const buffer = await res.arrayBuffer();

      // Text-only OG should be between 5KB and 100KB
      expect(buffer.byteLength).toBeGreaterThan(5000);
      expect(buffer.byteLength).toBeLessThan(100000);
    });
  });

  describe('Error Handling - Non-existent Listing', () => {
    it('should return fallback OG for non-existent listing (not empty)', async () => {
      // Use a very high ID that likely doesn't exist
      const res = await fetch(`${API_BASE}/api/og?id=999999999`);

      expect(res.status).toBe(200);

      const buffer = await res.arrayBuffer();
      // CRITICAL: Must NOT be empty - this is the bug we're fixing
      expect(buffer.byteLength).toBeGreaterThan(0);
      expect(isPngBuffer(buffer)).toBe(true);
    });

    it('should return fallback OG for invalid ID format', async () => {
      const res = await fetch(`${API_BASE}/api/og?id=not-a-number`);

      expect(res.status).toBe(200);

      const buffer = await res.arrayBuffer();
      // Should return fallback, not error
      expect(buffer.byteLength).toBeGreaterThan(0);
      expect(isPngBuffer(buffer)).toBe(true);
    });

    it('should return fallback OG for negative ID', async () => {
      const res = await fetch(`${API_BASE}/api/og?id=-1`);

      expect(res.status).toBe(200);

      const buffer = await res.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
      expect(isPngBuffer(buffer)).toBe(true);
    });

    it('should return fallback OG for zero ID', async () => {
      const res = await fetch(`${API_BASE}/api/og?id=0`);

      expect(res.status).toBe(200);

      const buffer = await res.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
      expect(isPngBuffer(buffer)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should respond within 5 seconds for default OG', async () => {
      const start = Date.now();
      await fetch(`${API_BASE}/api/og`);
      const duration = Date.now() - start;

      // OG generation should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should respond within 5 seconds for listing OG', async () => {
      const listingId = await getValidListingId();
      if (!listingId) {
        console.warn('No listings available for testing');
        return;
      }

      const start = Date.now();
      await fetch(`${API_BASE}/api/og?id=${listingId}`);
      const duration = Date.now() - start;

      // OG generation should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Caching', () => {
    it('should have Cache-Control header', async () => {
      const res = await fetch(`${API_BASE}/api/og`);

      const cacheControl = res.headers.get('cache-control');
      // Vercel may set this, or we should set it
      expect(cacheControl).toBeTruthy();
    });
  });

  describe('Consistency', () => {
    it('should return consistent size for same listing', async () => {
      const listingId = await getValidListingId();
      if (!listingId) {
        console.warn('No listings available for testing');
        return;
      }

      // Fetch the same listing twice
      const [res1, res2] = await Promise.all([
        fetch(`${API_BASE}/api/og?id=${listingId}`),
        fetch(`${API_BASE}/api/og?id=${listingId}`),
      ]);

      const buffer1 = await res1.arrayBuffer();
      const buffer2 = await res2.arrayBuffer();

      // Should be the same (or very close due to potential timestamp differences)
      expect(buffer1.byteLength).toBe(buffer2.byteLength);
    });
  });

  describe('Multiple Listing IDs', () => {
    it('should handle multiple different listing IDs', async () => {
      // Get multiple listing IDs
      const res = await fetch(`${API_BASE}/api/browse?limit=5`);
      const data = await res.json();

      if (!data.listings || data.listings.length < 2) {
        console.warn('Not enough listings for multi-ID test');
        return;
      }

      // Test first 3 listings in parallel
      const listingsToTest = data.listings.slice(0, 3);
      const results = await Promise.all(
        listingsToTest.map(async (listing: { id: number }) => {
          const ogRes = await fetch(`${API_BASE}/api/og?id=${listing.id}`);
          const buffer = await ogRes.arrayBuffer();
          return {
            id: listing.id,
            status: ogRes.status,
            size: buffer.byteLength,
            isPng: isPngBuffer(buffer),
          };
        })
      );

      // All should succeed
      for (const result of results) {
        expect(result.status).toBe(200);
        expect(result.size).toBeGreaterThan(0);
        expect(result.isPng).toBe(true);
      }
    });
  });
});
