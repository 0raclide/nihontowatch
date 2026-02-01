/**
 * Admin Stats API Unit Tests
 *
 * Tests the /api/admin/stats endpoint.
 * Verifies authentication, basic stats, detailed analytics,
 * and proper use of service role client for activity data.
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

import { GET } from '@/app/api/admin/stats/route';
import { createServiceClient } from '@/lib/supabase/server';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/stats');
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
  builder.gt = vi.fn(() => chain());
  builder.gte = vi.fn(() => chain());
  builder.lte = vi.fn(() => chain());
  builder.not = vi.fn(() => chain());
  builder.limit = vi.fn(() => chain());
  builder.range = vi.fn(() => chain());
  builder.or = vi.fn(() => chain());
  builder.in = vi.fn(() => chain());
  builder.is = vi.fn(() => chain());
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

  const usersBuilder = createMockQueryBuilder([], 10);
  const listingsBuilder = createMockQueryBuilder([], 100);
  const favoritesBuilder = createMockQueryBuilder([], 50);
  const signupsBuilder = createMockQueryBuilder([
    { id: '1', email: 'test@example.com', display_name: 'Test User', created_at: new Date().toISOString() },
  ], 1);

  mockSupabaseClient.from.mockImplementation((table: string) => {
    switch (table) {
      case 'profiles':
        return profileBuilder;
      case 'listings':
        return listingsBuilder;
      case 'user_favorites':
        return favoritesBuilder;
      default:
        return usersBuilder;
    }
  });

  // Setup service client mocks for listing_views (now queried even in basic stats)
  const viewsBuilder = createMockQueryBuilder([], 0);
  mockServiceClient.from.mockImplementation((table: string) => {
    if (table === 'listing_views') return viewsBuilder;
    return createMockQueryBuilder();
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('GET /api/admin/stats', () => {
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
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const profileBuilder = createMockQueryBuilder([{ role: 'user' }], 1);
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
      expect(json.error).toBe('Forbidden');
    });
  });

  // ===========================================================================
  // BASIC STATS TESTS
  // ===========================================================================

  describe('basic stats', () => {
    it('returns basic stats without detailed parameter', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toHaveProperty('totalUsers');
      expect(json).toHaveProperty('totalListings');
      expect(json).toHaveProperty('favoritesCount');
      expect(json).toHaveProperty('recentSignups');
      expect(json).toHaveProperty('popularListings');
    });

    it('does not include detailed analytics without parameter', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).not.toHaveProperty('sessionStats');
      expect(json).not.toHaveProperty('popularSearchTerms');
      expect(json).not.toHaveProperty('conversionFunnel');
    });
  });

  // ===========================================================================
  // DETAILED ANALYTICS TESTS
  // ===========================================================================

  describe('detailed analytics', () => {
    it('returns detailed analytics when requested', async () => {
      // Setup service client mocks for detailed queries
      const sessionsBuilder = createMockQueryBuilder([
        { total_duration_ms: 120000, page_views: 5 },
        { total_duration_ms: 180000, page_views: 8 },
      ], 2);

      const searchEventsBuilder = createMockQueryBuilder([
        { query_normalized: 'katana' },
        { query_normalized: 'wakizashi' },
        { query_normalized: 'katana' },
      ], 3);

      const alertsBuilder = createMockQueryBuilder([], 5);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'user_sessions') return sessionsBuilder;
        if (table === 'user_searches') return searchEventsBuilder;
        return createMockQueryBuilder();
      });

      // Setup profile and alerts builders separately (avoid recursive mock)
      const profileBuilder = createMockQueryBuilder([{ role: 'admin' }], 1);
      profileBuilder.single = vi.fn(() => Promise.resolve({ data: { role: 'admin' }, error: null }));

      const usersBuilder = createMockQueryBuilder([], 10);
      const listingsBuilder = createMockQueryBuilder([], 100);
      const favoritesBuilder = createMockQueryBuilder([{ listing_id: 1, listings: { id: 1, title: 'Test' } }], 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        switch (table) {
          case 'profiles':
            return profileBuilder;
          case 'listings':
            return listingsBuilder;
          case 'user_favorites':
            return favoritesBuilder;
          case 'alerts':
            return alertsBuilder;
          default:
            return usersBuilder;
        }
      });

      const request = createMockRequest({ detailed: 'true' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toHaveProperty('sessionStats');
      expect(json).toHaveProperty('popularSearchTerms');
      expect(json).toHaveProperty('conversionFunnel');
    });

    it('uses service client for user_searches queries', async () => {
      const searchEventsBuilder = createMockQueryBuilder([
        { query_normalized: 'test search' },
      ], 1);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'user_searches') return searchEventsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest({ detailed: 'true' });
      await GET(request);

      // Verify service client was used for user_searches
      expect(createServiceClient).toHaveBeenCalled();
      expect(mockServiceClient.from).toHaveBeenCalledWith('user_searches');
    });

    it('uses service client for user_sessions queries', async () => {
      const sessionsBuilder = createMockQueryBuilder([
        { total_duration_ms: 60000, page_views: 3 },
      ], 1);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest({ detailed: 'true' });
      await GET(request);

      // Verify service client was used for user_sessions
      expect(createServiceClient).toHaveBeenCalled();
      expect(mockServiceClient.from).toHaveBeenCalledWith('user_sessions');
    });

    it('aggregates search terms correctly', async () => {
      // user_searches table stores pre-normalized queries in query_normalized column
      const searchEventsBuilder = createMockQueryBuilder([
        { query_normalized: 'katana' },
        { query_normalized: 'katana' },
        { query_normalized: 'katana' },
        { query_normalized: 'wakizashi' },
      ], 4);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'user_searches') return searchEventsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest({ detailed: 'true' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.popularSearchTerms).toBeDefined();

      // Terms should be aggregated by count
      const katanaTerm = json.popularSearchTerms.find((t: { term: string }) => t.term === 'katana');
      expect(katanaTerm).toBeDefined();
      expect(katanaTerm.count).toBe(3);
    });

    it('calculates session statistics correctly', async () => {
      const sessionsBuilder = createMockQueryBuilder([
        { total_duration_ms: 120000, page_views: 4 },  // 2 minutes, 4 pages
        { total_duration_ms: 180000, page_views: 6 },  // 3 minutes, 6 pages
      ], 2);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest({ detailed: 'true' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.sessionStats).toBeDefined();
      expect(json.sessionStats.totalSessions).toBe(2);
      // avgDuration should be (120 + 180) / 2 / 1000 = 150 seconds
      expect(json.sessionStats.avgDuration).toBe(150);
      // avgPageViews should be (4 + 6) / 2 = 5
      expect(json.sessionStats.avgPageViews).toBe(5);
    });
  });

  // ===========================================================================
  // TIME RANGE TESTS
  // ===========================================================================

  describe('time range filtering', () => {
    it('accepts 7d range parameter', async () => {
      const request = createMockRequest({ range: '7d', detailed: 'true' });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('accepts 30d range parameter', async () => {
      const request = createMockRequest({ range: '30d', detailed: 'true' });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('accepts 90d range parameter', async () => {
      const request = createMockRequest({ range: '90d', detailed: 'true' });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('defaults to 30d when no range specified', async () => {
      const sessionsBuilder = createMockQueryBuilder([], 0);
      sessionsBuilder.gte = vi.fn(() => sessionsBuilder);

      mockServiceClient.from.mockImplementation(() => sessionsBuilder);

      const request = createMockRequest({ detailed: 'true' });
      await GET(request);

      // Verify gte was called (date filtering)
      expect(sessionsBuilder.gte).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // SEARCH TERMS AGGREGATION TESTS
  // ===========================================================================

  describe('search terms aggregation', () => {
    it('returns top 20 search terms', async () => {
      // Create 25 unique search terms
      const searchEvents = Array.from({ length: 25 }, (_, i) => ({
        query_normalized: `search term ${i}`,
      }));

      const searchEventsBuilder = createMockQueryBuilder(searchEvents, 25);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'user_searches') return searchEventsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest({ detailed: 'true' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.popularSearchTerms.length).toBeLessThanOrEqual(20);
    });

    it('sorts search terms by count descending', async () => {
      const searchEventsBuilder = createMockQueryBuilder([
        { query_normalized: 'rare term' },
        { query_normalized: 'common term' },
        { query_normalized: 'common term' },
        { query_normalized: 'common term' },
      ], 4);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'user_searches') return searchEventsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest({ detailed: 'true' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.popularSearchTerms[0].term).toBe('common term');
      expect(json.popularSearchTerms[0].count).toBe(3);
    });

    it('handles empty search terms gracefully', async () => {
      const searchEventsBuilder = createMockQueryBuilder([
        { query_normalized: '' },
        { query_normalized: null },
        { query_normalized: '' },
      ], 3);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'user_searches') return searchEventsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest({ detailed: 'true' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      // Empty/null queries should not appear in results
      expect(json.popularSearchTerms.length).toBe(0);
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    it('returns 500 on unexpected error', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Unexpected database error');
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });

    it('handles missing user_searches table gracefully', async () => {
      const errorBuilder = createMockQueryBuilder(null, null, {
        message: 'relation "user_searches" does not exist',
        code: '42P01',
      });

      mockServiceClient.from.mockImplementation(() => errorBuilder);

      const request = createMockRequest({ detailed: 'true' });
      const response = await GET(request);

      // Should not crash, just return empty data
      expect(response.status).toBe(200);
    });
  });
});
