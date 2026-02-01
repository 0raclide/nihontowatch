/**
 * Engagement Overview API Unit Tests
 *
 * Tests the /api/admin/analytics/engagement/overview endpoint.
 * Verifies authentication, response structure, and period handling.
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

// Import GET handler after mocks are set up
import { GET } from '@/app/api/admin/analytics/engagement/overview/route';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a mock NextRequest with given URL parameters
 */
function createMockRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/analytics/engagement/overview');
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

  // Terminal methods return the data
  builder.then = vi.fn((resolve: (result: { data: unknown[] | null; error: null; count: number | null }) => void) => {
    resolve({ data, error: null, count });
  });

  // Make it promise-like
  Object.defineProperty(builder, 'data', { get: () => data });
  Object.defineProperty(builder, 'error', { get: () => null });
  Object.defineProperty(builder, 'count', { get: () => count });

  return builder;
}

/**
 * Setup admin user authentication
 */
function setupAdminAuth() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'admin-123' } },
    error: null,
  });
}

/**
 * Setup complete mock responses for all tables
 */
function setupCompleteMocks() {
  setupAdminAuth();

  const profileBuilder = createMockQueryBuilder([], 100);
  profileBuilder.single = vi.fn(() =>
    Promise.resolve({ data: { role: 'admin' }, error: null })
  );

  const sessionsBuilder = createMockQueryBuilder([
    { total_duration_ms: 120000, page_views: 5 },
    { total_duration_ms: 60000, page_views: 2 },
    { total_duration_ms: 30000, page_views: 1 },
  ], 3);

  const eventsBuilder = createMockQueryBuilder([], 50);
  const favoritesBuilder = createMockQueryBuilder([], 10);

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'profiles') return profileBuilder;
    if (table === 'user_sessions') return sessionsBuilder;
    if (table === 'activity_events') return eventsBuilder;
    if (table === 'user_favorites') return favoritesBuilder;
    return createMockQueryBuilder();
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('GET /api/admin/analytics/engagement/overview', () => {
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
        users: expect.objectContaining({
          total: expect.any(Number),
          newInPeriod: expect.any(Number),
          newPrevPeriod: expect.any(Number),
          changePercent: expect.any(Number),
          activeToday: expect.any(Number),
          activeInPeriod: expect.any(Number),
        }),
        sessions: expect.objectContaining({
          total: expect.any(Number),
          avgDurationSeconds: expect.any(Number),
          avgPageViews: expect.any(Number),
          bounceRate: expect.any(Number),
          totalPrevPeriod: expect.any(Number),
          changePercent: expect.any(Number),
        }),
        engagement: expect.objectContaining({
          totalViews: expect.any(Number),
          totalSearches: expect.any(Number),
          totalFavorites: expect.any(Number),
          viewsPrevPeriod: expect.any(Number),
          searchesPrevPeriod: expect.any(Number),
          favoritesPrevPeriod: expect.any(Number),
        }),
        asOf: expect.any(String),
        period: expect.any(String),
      });
      expect(json.timestamp).toBeDefined();
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

    it('defaults to 30d for invalid period parameter', async () => {
      setupCompleteMocks();

      const request = createMockRequest({ period: 'invalid' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.period).toBe('30d');
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
      expect(cacheControl).toContain('max-age=60');
    });
  });
});
