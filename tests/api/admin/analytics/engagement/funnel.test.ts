/**
 * Conversion Funnel API Unit Tests
 *
 * Tests the /api/admin/analytics/engagement/funnel endpoint.
 * Verifies authentication, response structure, and funnel calculations.
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

  // Mock session counts (visitors)
  const sessionsBuilder = createMockQueryBuilder([], 1000);

  // Mock search events
  const searchEventsBuilder = createMockQueryBuilder([
    { session_id: 's1' },
    { session_id: 's2' },
    { session_id: 's3' },
  ], 3);

  // Mock view events
  const viewEventsBuilder = createMockQueryBuilder([
    { session_id: 's1' },
    { session_id: 's2' },
  ], 2);

  // Mock favorite events
  const favoriteEventsBuilder = createMockQueryBuilder([
    { session_id: 's1' },
  ], 1);

  // Mock saved searches
  const savedSearchesBuilder = createMockQueryBuilder([], 5);

  // Mock inquiries
  const inquiriesBuilder = createMockQueryBuilder([], 2);

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'profiles') return profileBuilder;
    if (table === 'user_sessions') return sessionsBuilder;
    if (table === 'saved_searches') return savedSearchesBuilder;
    if (table === 'inquiry_history') return inquiriesBuilder;
    if (table === 'activity_events') {
      // Return different data based on how the builder is used
      // This is a simplified mock - in reality you'd want more sophisticated tracking
      return createMockQueryBuilder([
        { session_id: 's1' },
        { session_id: 's2' },
        { session_id: 's3' },
      ], 3);
    }
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

    it('returns exactly 6 funnel stages', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(json.data.stages.length).toBe(6);
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
        { stage: 'engagers', label: 'Favorited' },
        { stage: 'high_intent', label: 'Saved Search' },
        { stage: 'converted', label: 'Sent Inquiry' },
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
