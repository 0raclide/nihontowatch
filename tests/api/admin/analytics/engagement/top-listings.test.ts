/**
 * Top Listings API Unit Tests
 *
 * Tests the /api/admin/analytics/engagement/top-listings endpoint.
 * Verifies authentication, response structure, and sorting/limit handling.
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

import { GET } from '@/app/api/admin/analytics/engagement/top-listings/route';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/analytics/engagement/top-listings');
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
  builder.in = vi.fn(() => chain());
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

  // Mock view events
  const viewEventsBuilder = createMockQueryBuilder([
    { event_data: { listing_id: 1 }, session_id: 's1', user_id: 'u1' },
    { event_data: { listing_id: 1 }, session_id: 's2', user_id: 'u2' },
    { event_data: { listing_id: 1 }, session_id: 's3', user_id: null },
    { event_data: { listing_id: 2 }, session_id: 's1', user_id: 'u1' },
    { event_data: { listing_id: 3 }, session_id: 's4', user_id: 'u3' },
  ], 5);

  // Mock favorites
  const favoritesBuilder = createMockQueryBuilder([
    { listing_id: 2 },
    { listing_id: 2 },
    { listing_id: 1 },
  ], 3);

  // Mock listings with dealer join
  const listingsBuilder = createMockQueryBuilder([
    { id: 1, title: 'Katana A', item_type: 'katana', price_jpy: 1000000, dealers: { name: 'Dealer A' } },
    { id: 2, title: 'Tsuba B', item_type: 'tsuba', price_jpy: 50000, dealers: { name: 'Dealer B' } },
    { id: 3, title: 'Wakizashi C', item_type: 'wakizashi', price_jpy: 800000, dealers: { name: 'Dealer A' } },
  ], 3);

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'profiles') return profileBuilder;
    if (table === 'activity_events') return viewEventsBuilder;
    if (table === 'user_favorites') return favoritesBuilder;
    if (table === 'listings') return listingsBuilder;
    return createMockQueryBuilder();
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('GET /api/admin/analytics/engagement/top-listings', () => {
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
        listings: expect.any(Array),
        period: expect.any(String),
        sortedBy: expect.any(String),
      });
    });

    it('returns listings with correct structure', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(json.data.listings.length).toBeGreaterThan(0);
      const listing = json.data.listings[0];
      expect(listing).toHaveProperty('id');
      expect(listing).toHaveProperty('title');
      expect(listing).toHaveProperty('itemType');
      expect(listing).toHaveProperty('dealerName');
      expect(listing).toHaveProperty('views');
      expect(listing).toHaveProperty('uniqueViewers');
      expect(listing).toHaveProperty('favorites');
      expect(listing).toHaveProperty('priceJPY');
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
  // SORTBY PARAMETER TESTS
  // ===========================================================================

  describe('sortBy parameter handling', () => {
    it('defaults to views when no sortBy specified', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.sortedBy).toBe('views');
    });

    it('accepts favorites sortBy parameter', async () => {
      setupCompleteMocks();

      const request = createMockRequest({ sortBy: 'favorites' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.sortedBy).toBe('favorites');
    });

    it('defaults to views for invalid sortBy parameter', async () => {
      setupCompleteMocks();

      const request = createMockRequest({ sortBy: 'invalid' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.sortedBy).toBe('views');
    });
  });

  // ===========================================================================
  // LIMIT PARAMETER TESTS
  // ===========================================================================

  describe('limit parameter handling', () => {
    it('defaults to 10 when no limit specified', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.listings.length).toBeLessThanOrEqual(10);
    });

    it('respects custom limit parameter', async () => {
      setupCompleteMocks();

      const request = createMockRequest({ limit: '2' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.listings.length).toBeLessThanOrEqual(2);
    });
  });

  // ===========================================================================
  // EMPTY DATA HANDLING
  // ===========================================================================

  describe('empty data handling', () => {
    it('returns empty listings array when no data', async () => {
      setupAdminAuth();

      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const emptyBuilder = createMockQueryBuilder([], 0);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return emptyBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.listings).toEqual([]);
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
