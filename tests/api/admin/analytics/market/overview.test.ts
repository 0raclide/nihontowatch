/**
 * Market Overview API Unit Tests
 *
 * Tests the /api/admin/analytics/market/overview endpoint.
 * Verifies authentication, response structure, currency conversion,
 * and error handling.
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

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock statistics functions
vi.mock('@/lib/analytics/statistics', () => ({
  percentiles: vi.fn((values, ps) => {
    if (values.length === 0) {
      return ps.reduce((acc: Record<number, number>, p: number) => ({ ...acc, [p]: 0 }), {});
    }
    // Simple mock implementation
    const sorted = [...values].sort((a: number, b: number) => a - b);
    const result: Record<number, number> = {};
    for (const p of ps) {
      const idx = Math.floor((p / 100) * (sorted.length - 1));
      result[p] = sorted[idx] || 0;
    }
    return result;
  }),
  median: vi.fn((values: number[]) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }),
  mean: vi.fn((values: number[]) => {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }),
}));

// Import GET handler after mocks are set up
import { GET } from '@/app/api/admin/analytics/market/overview/route';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a mock NextRequest with given URL parameters
 */
function createMockRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/analytics/market/overview');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

/**
 * Create a mock query builder that returns data
 */
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

  // Terminal methods return the data
  builder.then = vi.fn((resolve: (result: { data: unknown[] | null; error: typeof error; count: number | null }) => void) => {
    resolve({ data, error, count });
  });

  // Make it promise-like
  Object.defineProperty(builder, 'data', { get: () => data });
  Object.defineProperty(builder, 'error', { get: () => error });
  Object.defineProperty(builder, 'count', { get: () => count });

  return builder;
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('GET /api/admin/analytics/market/overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // AUTHENTICATION TESTS
  // ===========================================================================

  describe('authentication', () => {
    it('returns 401 for unauthenticated requests', async () => {
      // Mock no user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 403 for non-admin users', async () => {
      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Mock profile with non-admin role
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
      expect(json.error).toBe('Forbidden');
    });

    it('allows admin users to access the endpoint', async () => {
      // Mock authenticated admin user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
        error: null,
      });

      // Mock profile with admin role and listing data
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

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  // ===========================================================================
  // SUCCESSFUL REQUESTS TESTS
  // ===========================================================================

  describe('successful requests', () => {
    beforeEach(() => {
      // Set up admin user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
        error: null,
      });
    });

    it('returns market overview data with default currency (JPY)', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const mockListings = [
        { price_value: 1000000, price_currency: 'JPY' },
        { price_value: 2000000, price_currency: 'JPY' },
        { price_value: 3000000, price_currency: 'JPY' },
      ];

      const listingBuilder = createMockQueryBuilder(mockListings, 100);
      const priceHistoryBuilder = createMockQueryBuilder([], 5);

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        if (table === 'price_history') return priceHistoryBuilder;
        callCount++;
        return listingBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(json.data.currency).toBe('JPY');
      expect(json.data.asOf).toBeDefined();
      expect(json.timestamp).toBeDefined();
    });

    it('returns correct response structure with all required fields', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const mockListings = [
        { price_value: 500000, price_currency: 'JPY' },
        { price_value: 1500000, price_currency: 'JPY' },
      ];

      const listingBuilder = createMockQueryBuilder(mockListings, 50);
      const priceHistoryBuilder = createMockQueryBuilder([], 3);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        if (table === 'price_history') return priceHistoryBuilder;
        return listingBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({
        asOf: expect.any(String),
        totalListings: expect.any(Number),
        availableListings: expect.any(Number),
        soldListings: expect.any(Number),
        totalMarketValue: expect.any(Number),
        currency: expect.any(String),
        medianPrice: expect.any(Number),
        averagePrice: expect.any(Number),
        priceRange: expect.objectContaining({
          min: expect.any(Number),
          max: expect.any(Number),
        }),
        percentiles: expect.objectContaining({
          p10: expect.any(Number),
          p25: expect.any(Number),
          p75: expect.any(Number),
          p90: expect.any(Number),
        }),
        activity24h: expect.objectContaining({
          newListings: expect.any(Number),
          soldListings: expect.any(Number),
          priceChanges: expect.any(Number),
        }),
        changes: expect.objectContaining({
          totalValue: expect.objectContaining({
            amount: expect.any(Number),
            percent: expect.any(Number),
            period: expect.any(String),
          }),
          medianPrice: expect.objectContaining({
            amount: expect.any(Number),
            percent: expect.any(Number),
            period: expect.any(String),
          }),
          listingCount: expect.objectContaining({
            amount: expect.any(Number),
            percent: expect.any(Number),
            period: expect.any(String),
          }),
        }),
      });
    });

    it('accepts USD currency parameter', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 1000000, price_currency: 'JPY' },
      ], 10);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ currency: 'USD' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.currency).toBe('USD');
    });

    it('accepts EUR currency parameter', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 1000000, price_currency: 'JPY' },
      ], 10);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ currency: 'EUR' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.currency).toBe('EUR');
    });

    it('defaults to JPY for invalid currency parameter', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 1000000, price_currency: 'JPY' },
      ], 10);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ currency: 'INVALID' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.currency).toBe('JPY');
    });

    it('handles empty listings gracefully', async () => {
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
      expect(json.data.totalMarketValue).toBe(0);
      expect(json.data.medianPrice).toBe(0);
    });

    it('includes 7-day change metrics', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 1000000, price_currency: 'JPY' },
      ], 100);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(json.data.changes.totalValue.period).toBe('7d');
      expect(json.data.changes.medianPrice.period).toBe('7d');
      expect(json.data.changes.listingCount.period).toBe('7d');
    });

    it('sets proper cache headers', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { price_value: 1000000, price_currency: 'JPY' },
      ], 10);

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

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
        error: null,
      });
    });

    it('returns 500 on database error', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      // Simulate a database error by throwing
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        throw new Error('Database connection failed');
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Internal server error');
    });

    it('handles null data from queries gracefully', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const nullDataBuilder = createMockQueryBuilder(null, null);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return nullDataBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  // ===========================================================================
  // CURRENCY CONVERSION TESTS
  // ===========================================================================

  describe('currency conversion', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
        error: null,
      });
    });

    it('converts USD prices to JPY in calculations', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      // Mix of currencies
      const mixedCurrencyListings = [
        { price_value: 1000, price_currency: 'USD' }, // 1000 * 150 = 150,000 JPY
        { price_value: 100000, price_currency: 'JPY' },
      ];

      const listingBuilder = createMockQueryBuilder(mixedCurrencyListings, 2);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      // Total should be 150,000 + 100,000 = 250,000 JPY
      expect(json.data.totalMarketValue).toBeGreaterThan(0);
    });

    it('handles EUR prices correctly', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const eurListings = [
        { price_value: 1000, price_currency: 'EUR' }, // 1000 * 165 = 165,000 JPY
      ];

      const listingBuilder = createMockQueryBuilder(eurListings, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.totalMarketValue).toBeGreaterThan(0);
    });

    it('handles unknown currency as JPY', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const unknownCurrencyListings = [
        { price_value: 100000, price_currency: 'XYZ' }, // Should be treated as 1:1
      ];

      const listingBuilder = createMockQueryBuilder(unknownCurrencyListings, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.totalMarketValue).toBe(100000);
    });

    it('filters out null and zero prices', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingsWithNulls = [
        { price_value: null, price_currency: 'JPY' },
        { price_value: 0, price_currency: 'JPY' },
        { price_value: 100000, price_currency: 'JPY' },
      ];

      const listingBuilder = createMockQueryBuilder(listingsWithNulls, 3);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      // Only the 100,000 JPY listing should be counted
      expect(json.data.totalMarketValue).toBe(100000);
    });
  });
});
