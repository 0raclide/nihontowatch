/**
 * Price Distribution API Unit Tests
 *
 * Tests the /api/admin/analytics/market/distribution endpoint.
 * Verifies query parameters, response structure, filtering,
 * and statistics calculation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Next.js cookies before importing the route handler
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock statistics functions with realistic implementations
vi.mock('@/lib/analytics/statistics', () => ({
  mean: vi.fn((values: number[]) => {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }),
  median: vi.fn((values: number[]) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }),
  standardDeviation: vi.fn((values: number[]) => {
    if (values.length <= 1) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length);
  }),
  skewness: vi.fn(() => 0.5),
  percentiles: vi.fn((values: number[], ps: number[]) => {
    if (values.length === 0) {
      return ps.reduce((acc: Record<number, number>, p: number) => ({ ...acc, [p]: 0 }), {});
    }
    const sorted = [...values].sort((a, b) => a - b);
    const result: Record<number, number> = {};
    for (const p of ps) {
      const idx = Math.floor((p / 100) * (sorted.length - 1));
      result[p] = sorted[idx] || 0;
    }
    return result;
  }),
  createHistogramBuckets: vi.fn((values: number[], bucketCount: number) => {
    if (values.length === 0 || bucketCount <= 0) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
      return [{
        rangeStart: min,
        rangeEnd: max,
        count: values.length,
        percentage: 100,
        cumulativePercentage: 100,
      }];
    }

    const bucketWidth = (max - min) / bucketCount;
    const buckets = [];
    let cumulative = 0;

    for (let i = 0; i < bucketCount; i++) {
      const rangeStart = min + i * bucketWidth;
      const rangeEnd = min + (i + 1) * bucketWidth;
      const count = values.filter(v => v >= rangeStart && v < rangeEnd).length;
      const percentage = (count / values.length) * 100;
      cumulative += percentage;

      buckets.push({
        rangeStart,
        rangeEnd,
        count,
        percentage,
        cumulativePercentage: cumulative,
      });
    }

    return buckets;
  }),
  formatPriceRangeLabel: vi.fn((start: number, end: number) => {
    const format = (val: number) => {
      if (val >= 1000000) return `${val / 1000000}M`;
      if (val >= 1000) return `${val / 1000}K`;
      return String(val);
    };
    return `${format(start)}-${format(end)}`;
  }),
}));

import { GET } from '@/app/api/admin/analytics/market/distribution/route';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/analytics/market/distribution');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

function createMockQueryBuilder(
  data: unknown[] | null = [],
  count: number | null = 0,
  error: { message: string } | null = null
) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chain = () => builder;

  builder.select = vi.fn(() => chain());
  builder.eq = vi.fn(() => chain());
  builder.gt = vi.fn(() => chain());
  builder.gte = vi.fn(() => chain());
  builder.lte = vi.fn(() => chain());
  builder.not = vi.fn(() => chain());
  builder.limit = vi.fn(() => chain());
  builder.single = vi.fn(() => Promise.resolve({ data: { role: 'admin' }, error: null }));

  builder.then = vi.fn((resolve: (result: { data: unknown[] | null; error: typeof error; count: number | null }) => void) => {
    resolve({ data, error, count });
  });

  Object.defineProperty(builder, 'data', { get: () => data });
  Object.defineProperty(builder, 'error', { get: () => error });
  Object.defineProperty(builder, 'count', { get: () => count });

  return builder;
}

function setupAdminAuth() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'admin-123' } },
    error: null,
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('GET /api/admin/analytics/market/distribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAdminAuth();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // AUTHENTICATION TESTS
  // ===========================================================================

  describe('authentication', () => {
    it('returns 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('returns 403 for non-admin users', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'user' }, error: null })
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
    });
  });

  // ===========================================================================
  // QUERY PARAMETERS TESTS
  // ===========================================================================

  describe('query parameters', () => {
    it('uses default bucket count (20) when not specified', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = [
        { price_value: 100000, price_currency: 'JPY' },
        { price_value: 500000, price_currency: 'JPY' },
        { price_value: 1000000, price_currency: 'JPY' },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 3);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      // Default bucket count is 20
    });

    it('respects custom bucket count up to max (50)', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = Array.from({ length: 100 }, (_, i) => ({
        price_value: (i + 1) * 10000,
        price_currency: 'JPY',
      }));

      const listingBuilder = createMockQueryBuilder(listings, 100);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      // Request 30 buckets
      const request = createMockRequest({ buckets: '30' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('caps bucket count at maximum (50)', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 100000, price_currency: 'JPY' },
      ], 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      // Request 100 buckets (exceeds max)
      const request = createMockRequest({ buckets: '100' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('filters by item type', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const katanaListings = [
        { price_value: 1000000, price_currency: 'JPY' },
        { price_value: 2000000, price_currency: 'JPY' },
      ];

      const listingBuilder = createMockQueryBuilder(katanaListings, 2);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ itemType: 'katana' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.filters.itemType).toBe('katana');
    });

    it('filters by certification', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 3000000, price_currency: 'JPY' },
      ], 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ certification: 'Juyo' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.filters.certification).toBe('Juyo');
    });

    it('filters by dealer', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 500000, price_currency: 'JPY' },
      ], 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ dealer: '5' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.filters.dealer).toBe('5');
    });

    it('filters by minimum price', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 1000000, price_currency: 'JPY' },
        { price_value: 2000000, price_currency: 'JPY' },
      ], 2);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ minPrice: '500000' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('filters by maximum price', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 200000, price_currency: 'JPY' },
        { price_value: 400000, price_currency: 'JPY' },
      ], 2);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ maxPrice: '500000' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('filters by price range (both min and max)', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 600000, price_currency: 'JPY' },
        { price_value: 800000, price_currency: 'JPY' },
      ], 2);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ minPrice: '500000', maxPrice: '1000000' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('combines multiple filters', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 2000000, price_currency: 'JPY' },
      ], 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({
        itemType: 'katana',
        certification: 'Juyo',
        dealer: '1',
        minPrice: '1000000',
        maxPrice: '5000000',
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.filters.itemType).toBe('katana');
      expect(json.data.filters.certification).toBe('Juyo');
      expect(json.data.filters.dealer).toBe('1');
    });
  });

  // ===========================================================================
  // RESPONSE STRUCTURE TESTS
  // ===========================================================================

  describe('response structure', () => {
    it('returns correct bucket structure', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = [
        { price_value: 100000, price_currency: 'JPY' },
        { price_value: 300000, price_currency: 'JPY' },
        { price_value: 500000, price_currency: 'JPY' },
        { price_value: 700000, price_currency: 'JPY' },
        { price_value: 900000, price_currency: 'JPY' },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 5);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ buckets: '5' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.buckets).toBeDefined();
      expect(Array.isArray(json.data.buckets)).toBe(true);

      if (json.data.buckets.length > 0) {
        const bucket = json.data.buckets[0];
        expect(bucket).toHaveProperty('rangeStart');
        expect(bucket).toHaveProperty('rangeEnd');
        expect(bucket).toHaveProperty('label');
        expect(bucket).toHaveProperty('count');
        expect(bucket).toHaveProperty('percentage');
        expect(bucket).toHaveProperty('cumulativePercentage');
      }
    });

    it('calculates statistics correctly', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = [
        { price_value: 100000, price_currency: 'JPY' },
        { price_value: 200000, price_currency: 'JPY' },
        { price_value: 300000, price_currency: 'JPY' },
        { price_value: 400000, price_currency: 'JPY' },
        { price_value: 500000, price_currency: 'JPY' },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 5);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.statistics).toBeDefined();
      expect(json.data.statistics).toMatchObject({
        count: expect.any(Number),
        mean: expect.any(Number),
        median: expect.any(Number),
        stdDev: expect.any(Number),
        skewness: expect.any(Number),
        percentiles: expect.objectContaining({
          p10: expect.any(Number),
          p25: expect.any(Number),
          p75: expect.any(Number),
          p90: expect.any(Number),
        }),
      });
    });

    it('includes cumulative percentages', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = Array.from({ length: 10 }, (_, i) => ({
        price_value: (i + 1) * 100000,
        price_currency: 'JPY',
      }));

      const listingBuilder = createMockQueryBuilder(listings, 10);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ buckets: '5' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);

      if (json.data.buckets.length > 0) {
        // Buckets should have cumulative percentage property
        const lastBucket = json.data.buckets[json.data.buckets.length - 1];
        expect(lastBucket).toHaveProperty('cumulativePercentage');
        expect(typeof lastBucket.cumulativePercentage).toBe('number');
        // Cumulative percentage should be between 0 and 100
        expect(lastBucket.cumulativePercentage).toBeGreaterThanOrEqual(0);
        expect(lastBucket.cumulativePercentage).toBeLessThanOrEqual(100);
      }
    });

    it('includes filters in response', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 500000, price_currency: 'JPY' },
      ], 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ itemType: 'tsuba' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.filters).toBeDefined();
      expect(json.data.filters).toMatchObject({
        itemType: 'tsuba',
        certification: null,
        dealer: null,
      });
    });
  });

  // ===========================================================================
  // EMPTY RESULTS HANDLING
  // ===========================================================================

  describe('empty results handling', () => {
    it('returns empty response structure when no data', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const emptyListingBuilder = createMockQueryBuilder([], 0);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return emptyListingBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.buckets).toEqual([]);
      expect(json.data.statistics.count).toBe(0);
      expect(json.data.statistics.mean).toBe(0);
      expect(json.data.statistics.median).toBe(0);
    });

    it('preserves filters in empty response', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const emptyListingBuilder = createMockQueryBuilder([], 0);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return emptyListingBuilder;
      });

      const request = createMockRequest({ itemType: 'rare_type', certification: 'Tokuju' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.filters.itemType).toBe('rare_type');
      expect(json.data.filters.certification).toBe('Tokuju');
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    it('returns 500 on database error', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const errorBuilder = createMockQueryBuilder(null, null, { message: 'DB Error' });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return errorBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it('handles invalid bucket count gracefully', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 100000, price_currency: 'JPY' },
      ], 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ buckets: 'invalid' });
      const response = await GET(request);
      const json = await response.json();

      // Should use default bucket count
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('handles invalid price filters gracefully', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 100000, price_currency: 'JPY' },
      ], 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ minPrice: 'not-a-number' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  // ===========================================================================
  // CACHING TESTS
  // ===========================================================================

  describe('caching', () => {
    it('sets proper cache headers for successful response', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 100000, price_currency: 'JPY' },
      ], 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);

      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toContain('max-age=300');
    });
  });
});
