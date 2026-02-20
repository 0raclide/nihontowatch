/**
 * Conversion Funnel API Unit Tests
 *
 * Tests the /api/admin/analytics/engagement/funnel endpoint.
 * Verifies authentication, response structure, and funnel calculations.
 *
 * The funnel has 8 stages, all normalized to unique users/visitors:
 *   1. Visitors (sessions)
 *   2. Searched (sessions that searched)
 *   3. Viewed Listing (sessions that opened a listing)
 *   4. Signed Up (accounts created)
 *   5. Favorited (users who favorited, from user_favorites table)
 *   6. Saved Search (users who created saved searches)
 *   7. Clicked to Dealer (visitors who clicked through to dealer website)
 *   8. Generated Draft (users who generated inquiry email drafts)
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

import { GET } from '@/app/api/admin/analytics/engagement/funnel/route';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/analytics/engagement/funnel');
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

  // Mock session rows (visitors) — fetched as full rows with user_id for admin filtering
  const sessionsBuilder = createMockQueryBuilder(
    Array.from({ length: 1000 }, (_, i) => ({ id: `sess-${i}`, user_id: null })),
    1000
  );

  // Mock search events
  const searchEventsBuilder = createMockQueryBuilder([
    { session_id: 's1', user_id: null },
    { session_id: 's2', user_id: null },
    { session_id: 's3', user_id: null },
  ], 3);

  // Mock view events
  const viewEventsBuilder = createMockQueryBuilder([
    { session_id: 's1', user_id: null },
    { session_id: 's2', user_id: null },
  ], 2);

  // Mock favorites from user_favorites table (NOT activity_events)
  const favoritesBuilder = createMockQueryBuilder([
    { user_id: 'user-1' },
  ], 1);

  // Mock saved searches (unique users)
  const savedSearchesBuilder = createMockQueryBuilder([
    { user_id: 'user-1' },
  ], 1);

  // Mock dealer clicks
  const dealerClicksBuilder = createMockQueryBuilder([
    { visitor_id: 'v1', session_id: 's1' },
    { visitor_id: 'v2', session_id: 's2' },
  ], 2);

  // Mock inquiry drafts (unique users)
  const inquiriesBuilder = createMockQueryBuilder([
    { user_id: 'user-1' },
  ], 1);

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'profiles') return profileBuilder;
    if (table === 'user_sessions') return sessionsBuilder;
    if (table === 'user_searches') return searchEventsBuilder;
    if (table === 'listing_views') return viewEventsBuilder;
    if (table === 'user_favorites') return favoritesBuilder;
    if (table === 'saved_searches') return savedSearchesBuilder;
    if (table === 'dealer_clicks') return dealerClicksBuilder;
    if (table === 'inquiry_history') return inquiriesBuilder;
    return createMockQueryBuilder();
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('GET /api/admin/analytics/engagement/funnel', () => {
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
        stages: expect.any(Array),
        overallConversionRate: expect.any(Number),
        period: expect.any(String),
      });
    });

    it('returns exactly 8 funnel stages', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(json.data.stages.length).toBe(8);
    });

    it('returns stages in correct order with correct labels', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      const expectedStages = [
        { stage: 'visitors', label: 'Visitors' },
        { stage: 'searchers', label: 'Searched' },
        { stage: 'viewers', label: 'Viewed Listing' },
        { stage: 'signed_up', label: 'Signed Up' },
        { stage: 'engagers', label: 'Favorited' },
        { stage: 'high_intent', label: 'Saved Search' },
        { stage: 'dealer_click', label: 'Clicked to Dealer' },
        { stage: 'converted', label: 'Generated Draft' },
      ];

      json.data.stages.forEach((stage: { stage: string; label: string }, index: number) => {
        expect(stage.stage).toBe(expectedStages[index].stage);
        expect(stage.label).toBe(expectedStages[index].label);
      });
    });

    it('returns stages with correct structure', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      const stage = json.data.stages[0];
      expect(stage).toHaveProperty('stage');
      expect(stage).toHaveProperty('label');
      expect(stage).toHaveProperty('count');
      expect(stage).toHaveProperty('conversionRate');
      expect(stage).toHaveProperty('dropoffRate');
    });

    it('first stage (visitors) has 100% conversion rate and 0% dropoff', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      const visitorsStage = json.data.stages[0];
      expect(visitorsStage.stage).toBe('visitors');
      expect(visitorsStage.conversionRate).toBe(100);
      expect(visitorsStage.dropoffRate).toBe(0);
    });

    it('reads favorites from user_favorites table, not activity_events', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      await GET(request);

      // Verify user_favorites was queried
      const fromCalls = mockSupabaseClient.from.mock.calls.map((c: string[]) => c[0]);
      expect(fromCalls).toContain('user_favorites');
      // activity_events should NOT be queried for favorites
      expect(fromCalls).not.toContain('activity_events');
    });

    it('reads dealer clicks from dealer_clicks table', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      await GET(request);

      const fromCalls = mockSupabaseClient.from.mock.calls.map((c: string[]) => c[0]);
      expect(fromCalls).toContain('dealer_clicks');
    });

    it('labels final stage as "Generated Draft" not "Sent Inquiry"', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      const lastStage = json.data.stages[json.data.stages.length - 1];
      expect(lastStage.label).toBe('Generated Draft');
      expect(lastStage.label).not.toBe('Sent Inquiry');
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
      expect(cacheControl).toContain('max-age=300');
    });
  });
});
