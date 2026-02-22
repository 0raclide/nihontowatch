/**
 * User Growth API Unit Tests
 *
 * Tests the /api/admin/analytics/engagement/growth endpoint.
 * Verifies authentication, response structure, period/granularity handling.
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

import { GET } from '@/app/api/admin/analytics/engagement/growth/route';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/analytics/engagement/growth');
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

  // range() support for fetchAllRows pagination — returns data for offset 0,
  // empty for subsequent offsets so fetchAllRows terminates.
  builder.range = vi.fn((from: number) =>
    Promise.resolve({ data: from === 0 ? (data || []) : [], error: null })
  );

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

  const profileBuilder = createMockQueryBuilder([
    { id: 'user-1', created_at: '2026-01-10T10:00:00Z' },
    { id: 'user-2', created_at: '2026-01-11T10:00:00Z' },
    { id: 'user-3', created_at: '2026-01-11T15:00:00Z' },
  ], 50);
  profileBuilder.single = vi.fn(() =>
    Promise.resolve({ data: { role: 'admin' }, error: null })
  );

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'profiles') return profileBuilder;
    return createMockQueryBuilder();
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('GET /api/admin/analytics/engagement/growth', () => {
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
        dataPoints: expect.any(Array),
        summary: expect.objectContaining({
          totalNewUsers: expect.any(Number),
          avgDailySignups: expect.any(Number),
          peakDay: expect.any(String),
          peakCount: expect.any(Number),
        }),
        period: expect.any(String),
        granularity: expect.any(String),
      });
    });

    it('returns data points with correct structure', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(json.data.dataPoints.length).toBeGreaterThan(0);
      const point = json.data.dataPoints[0];
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('newUsers');
      expect(point).toHaveProperty('cumulativeUsers');
    });
  });

  // ===========================================================================
  // PERIOD PARAMETER TESTS
  // ===========================================================================

  describe('period parameter handling', () => {
    it('defaults to 90d when no period specified', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.period).toBe('90d');
    });

    it('accepts 7d period parameter', async () => {
      setupCompleteMocks();

      const request = createMockRequest({ period: '7d' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.period).toBe('7d');
    });

    it('accepts 30d period parameter', async () => {
      setupCompleteMocks();

      const request = createMockRequest({ period: '30d' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.period).toBe('30d');
    });
  });

  // ===========================================================================
  // GRANULARITY PARAMETER TESTS
  // ===========================================================================

  describe('granularity parameter handling', () => {
    it('defaults to daily when no granularity specified', async () => {
      setupCompleteMocks();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.granularity).toBe('daily');
    });

    it('accepts weekly granularity parameter', async () => {
      setupCompleteMocks();

      const request = createMockRequest({ granularity: 'weekly' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.granularity).toBe('weekly');
    });

    it('accepts monthly granularity parameter', async () => {
      setupCompleteMocks();

      const request = createMockRequest({ granularity: 'monthly' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.granularity).toBe('monthly');
    });

    it('defaults to daily for invalid granularity parameter', async () => {
      setupCompleteMocks();

      const request = createMockRequest({ granularity: 'invalid' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.granularity).toBe('daily');
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
