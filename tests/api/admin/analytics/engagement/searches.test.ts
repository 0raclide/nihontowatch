/**
 * Popular Searches API Unit Tests
 *
 * Tests the /api/admin/analytics/engagement/searches endpoint.
 * Verifies authentication, response structure, and parameter handling.
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
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

import { GET } from '@/app/api/admin/analytics/engagement/searches/route';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/analytics/engagement/searches');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

function createMockQueryBuilder(
  data: unknown[] | null = [],
  count: number | null = 0
) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chain = () => builder;

  builder.select = vi.fn(() => chain());
  builder.eq = vi.fn(() => chain());
  builder.gt = vi.fn(() => chain());
  builder.gte = vi.fn(() => chain());
  builder.lte = vi.fn(() => chain());
  builder.lt = vi.fn(() => chain());
  builder.not = vi.fn(() => chain());
  builder.limit = vi.fn(() => chain());
  builder.order = vi.fn(() => chain());
  builder.single = vi.fn(() => Promise.resolve({ data: { role: 'admin' }, error: null }));

  builder.then = vi.fn((resolve: (result: { data: unknown[] | null; error: null; count: number | null }) => void) => {
    resolve({ data, error: null, count });
  });

  Object.defineProperty(builder, 'data', { get: () => data });
  Object.defineProperty(builder, 'error', { get: () => null });
  Object.defineProperty(builder, 'count', { get: () => count });

  return builder;
}

function setupAdminAuth() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'admin-123' } },
    error: null,
  });
}

function setupCompleteMocks() {
  setupAdminAuth();

  const profileBuilder = createMockQueryBuilder();
  profileBuilder.single = vi.fn(() =>
    Promise.resolve({ data: { role: 'admin' }, error: null })
  );

  // Mock admin IDs query (for getAdminUserIds)
  const adminProfilesBuilder = createMockQueryBuilder([]);

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'profiles') return profileBuilder;
    return createMockQueryBuilder();
  });

  // Mock the RPC calls for get_top_searches and get_search_totals
  const allSearchRows = [
    { query_normalized: 'katana', search_count: 2, unique_users: 2, avg_results: 50, has_click: 0 },
    { query_normalized: 'tsuba', search_count: 1, unique_users: 1, avg_results: 25, has_click: 1 },
    { query_normalized: 'wakizashi', search_count: 1, unique_users: 1, avg_results: 30, has_click: 0 },
  ];

  mockSupabaseClient.rpc.mockImplementation((fnName: string, args?: Record<string, unknown>) => {
    if (fnName === 'get_top_searches') {
      const limit = (args?.p_limit as number) || 20;
      return Promise.resolve({
        data: allSearchRows.slice(0, limit),
        error: null,
      });
    }
    if (fnName === 'get_search_totals') {
      return Promise.resolve({
        data: [
          { total_searches: 4, unique_searchers: 3, total_clicks: 1 },
        ],
        error: null,
      });
    }
    return Promise.resolve({ data: [], error: null });
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('GET /api/admin/analytics/engagement/searches', () => {
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
      expect(json.error).toBe('Forbidden');
    });

    it('allows admin users to access the endpoint', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  // ===========================================================================
  // RESPONSE STRUCTURE TESTS
  // ===========================================================================

  describe('response structure', () => {
    it('returns correct response structure with all required fields', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({
        searches: expect.any(Array),
        totals: expect.objectContaining({
          totalSearches: expect.any(Number),
          uniqueSearchers: expect.any(Number),
          avgClickThroughRate: expect.any(Number),
        }),
        period: expect.any(String),
      });
    });

    it('returns search terms with correct structure', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(json.data.searches.length).toBeGreaterThan(0);
      const search = json.data.searches[0];
      expect(search).toHaveProperty('term');
      expect(search).toHaveProperty('count');
      expect(search).toHaveProperty('uniqueUsers');
      expect(search).toHaveProperty('avgResultCount');
      expect(search).toHaveProperty('clickThroughRate');
    });

    it('returns aggregated search data from RPC', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      // RPC returns pre-aggregated data — katana has count 2
      const katanaSearch = json.data.searches.find((s: { term: string }) => s.term === 'katana');
      expect(katanaSearch).toBeDefined();
      expect(katanaSearch.count).toBe(2);
    });
  });

  // ===========================================================================
  // PERIOD PARAMETER TESTS
  // ===========================================================================

  describe('period parameter handling', () => {
    it('defaults to 30d when no period specified', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.period).toBe('30d');
    });

    it('accepts 7d period parameter', async () => {
      setupCompleteMocks();

      const request = createMockRequest({ period: '7d' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.period).toBe('7d');
    });

    it('accepts 90d period parameter', async () => {
      setupCompleteMocks();

      const request = createMockRequest({ period: '90d' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.period).toBe('90d');
    });
  });

  // ===========================================================================
  // LIMIT PARAMETER TESTS
  // ===========================================================================

  describe('limit parameter handling', () => {
    it('defaults to 20 when no limit specified', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      // With mock data we have fewer results than 20
      expect(json.data.searches.length).toBeLessThanOrEqual(20);
    });

    it('respects custom limit parameter', async () => {
      setupCompleteMocks();

      const request = createMockRequest({ limit: '2' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.searches.length).toBeLessThanOrEqual(2);
    });
  });

  // ===========================================================================
  // CACHE HEADER TESTS
  // ===========================================================================

  describe('cache headers', () => {
    it('sets proper cache headers', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);

      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toContain('max-age=300');
    });
  });
});
