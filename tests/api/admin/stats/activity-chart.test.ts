/**
 * Activity Chart API Unit Tests
 *
 * Tests the /api/admin/stats/activity-chart endpoint.
 * Verifies authentication, response structure, and data aggregation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const mockServiceClient = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
  createServiceClient: vi.fn(() => mockServiceClient),
}));

import { GET } from '@/app/api/admin/stats/activity-chart/route';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/stats/activity-chart');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

function createMockQueryBuilder(
  data: unknown[] | null = [],
  count: number | null = 0,
  error: { message: string; code?: string } | null = null
) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chain = () => builder;

  builder.select = vi.fn(() => chain());
  builder.eq = vi.fn(() => chain());
  builder.gte = vi.fn(() => chain());
  builder.lte = vi.fn(() => chain());
  builder.limit = vi.fn(() => chain());
  builder.order = vi.fn(() => chain());
  builder.single = vi.fn(() => Promise.resolve({ data: data?.[0] ?? null, error }));

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

function setupStandardMocks() {
  const profileBuilder = createMockQueryBuilder([{ role: 'admin' }], 1);
  profileBuilder.single = vi.fn(() => Promise.resolve({ data: { role: 'admin' }, error: null }));

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'profiles') return profileBuilder;
    if (table === 'user_favorites') return createMockQueryBuilder([], 0);
    return createMockQueryBuilder();
  });

  mockServiceClient.from.mockImplementation((table: string) => {
    if (table === 'listing_views') return createMockQueryBuilder([], 0);
    if (table === 'user_searches') return createMockQueryBuilder([], 0);
    return createMockQueryBuilder();
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('GET /api/admin/stats/activity-chart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAdminAuth();
    setupStandardMocks();
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
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 403 for non-admin users', async () => {
      const profileBuilder = createMockQueryBuilder([{ role: 'user' }], 1);
      profileBuilder.single = vi.fn(() => Promise.resolve({ data: { role: 'user' }, error: null }));

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('returns 200 for admin users', async () => {
      const request = createMockRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  // ===========================================================================
  // RESPONSE STRUCTURE TESTS
  // ===========================================================================

  describe('response structure', () => {
    it('returns correct response structure', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toHaveProperty('dataPoints');
      expect(json).toHaveProperty('totals');
      expect(json).toHaveProperty('period');
    });

    it('returns 7 data points by default', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(json.dataPoints).toHaveLength(7);
    });

    it('each data point has required fields', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      const point = json.dataPoints[0];
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('dayLabel');
      expect(point).toHaveProperty('views');
      expect(point).toHaveProperty('searches');
      expect(point).toHaveProperty('favorites');
    });

    it('totals includes all metrics', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(json.totals).toHaveProperty('views');
      expect(json.totals).toHaveProperty('searches');
      expect(json.totals).toHaveProperty('favorites');
    });

    it('includes period in response', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(json.period).toBe('7d');
    });
  });

  // ===========================================================================
  // DAYS PARAMETER TESTS
  // ===========================================================================

  describe('days parameter', () => {
    it('accepts custom days parameter', async () => {
      const request = createMockRequest({ days: '14' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.dataPoints).toHaveLength(14);
      expect(json.period).toBe('14d');
    });

    it('caps days at 30', async () => {
      const request = createMockRequest({ days: '60' });
      const response = await GET(request);
      const json = await response.json();

      expect(json.dataPoints).toHaveLength(30);
      expect(json.period).toBe('30d');
    });

    it('defaults to 7 for invalid input', async () => {
      const request = createMockRequest({ days: 'invalid' });
      const response = await GET(request);
      const json = await response.json();

      expect(json.dataPoints).toHaveLength(7);
    });
  });

  // ===========================================================================
  // DATA AGGREGATION TESTS
  // ===========================================================================

  describe('data aggregation', () => {
    it('aggregates views by date', async () => {
      const today = new Date().toISOString().split('T')[0];
      const viewsBuilder = createMockQueryBuilder([
        { viewed_at: `${today}T10:00:00Z` },
        { viewed_at: `${today}T11:00:00Z` },
        { viewed_at: `${today}T12:00:00Z` },
      ], 3);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'listing_views') return viewsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      // Today should have 3 views
      const todayPoint = json.dataPoints.find((p: { date: string }) => p.date === today);
      expect(todayPoint?.views).toBe(3);
      expect(json.totals.views).toBe(3);
    });

    it('aggregates searches by date', async () => {
      const today = new Date().toISOString().split('T')[0];
      const searchesBuilder = createMockQueryBuilder([
        { searched_at: `${today}T10:00:00Z` },
        { searched_at: `${today}T11:00:00Z` },
      ], 2);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'user_searches') return searchesBuilder;
        if (table === 'listing_views') return createMockQueryBuilder();
        return createMockQueryBuilder();
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      const todayPoint = json.dataPoints.find((p: { date: string }) => p.date === today);
      expect(todayPoint?.searches).toBe(2);
      expect(json.totals.searches).toBe(2);
    });

    it('aggregates favorites by date', async () => {
      const today = new Date().toISOString().split('T')[0];
      const favoritesBuilder = createMockQueryBuilder([
        { created_at: `${today}T10:00:00Z` },
      ], 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          const b = createMockQueryBuilder([{ role: 'admin' }], 1);
          b.single = vi.fn(() => Promise.resolve({ data: { role: 'admin' }, error: null }));
          return b;
        }
        if (table === 'user_favorites') return favoritesBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      const todayPoint = json.dataPoints.find((p: { date: string }) => p.date === today);
      expect(todayPoint?.favorites).toBe(1);
      expect(json.totals.favorites).toBe(1);
    });

    it('fills missing dates with zeros', async () => {
      // No data returned from any table
      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      // All data points should exist with zero values
      expect(json.dataPoints).toHaveLength(7);
      json.dataPoints.forEach((point: { views: number; searches: number; favorites: number }) => {
        expect(point.views).toBe(0);
        expect(point.searches).toBe(0);
        expect(point.favorites).toBe(0);
      });
    });
  });

  // ===========================================================================
  // CACHE HEADER TESTS
  // ===========================================================================

  describe('caching', () => {
    it('includes cache-control header', async () => {
      const request = createMockRequest();
      const response = await GET(request);

      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toContain('max-age=300');
    });
  });
});
