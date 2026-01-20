/**
 * Visitor Detail API Unit Tests
 *
 * Tests the /api/admin/visitors/[visitorId] endpoint.
 * Verifies authentication, data retrieval, and response format.
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

import { GET } from '@/app/api/admin/visitors/[visitorId]/route';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockRequest(visitorId: string): NextRequest {
  const url = new URL(`http://localhost:3000/api/admin/visitors/${visitorId}`);
  return new NextRequest(url);
}

function createMockQueryBuilder(
  data: unknown[] | null = [],
  error: { message: string } | null = null
) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chain = () => builder;

  builder.select = vi.fn(() => chain());
  builder.eq = vi.fn(() => chain());
  builder.in = vi.fn(() => chain());
  builder.order = vi.fn(() => chain());
  builder.limit = vi.fn(() => chain());
  builder.single = vi.fn(() => Promise.resolve({ data: data?.[0] ?? null, error }));

  builder.then = vi.fn((resolve: (result: { data: unknown[] | null; error: typeof error }) => void) => {
    resolve({ data, error });
  });

  return builder;
}

function setupAdminAuth() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'admin-123' } },
    error: null,
  });

  const profileBuilder = createMockQueryBuilder([{ role: 'admin' }]);
  profileBuilder.single = vi.fn(() => Promise.resolve({ data: { role: 'admin' }, error: null }));

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'profiles') return profileBuilder;
    return createMockQueryBuilder();
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('GET /api/admin/visitors/[visitorId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 403 for non-admin users', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const profileBuilder = createMockQueryBuilder([{ role: 'user' }]);
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'user' }, error: null })
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });
  });

  // ===========================================================================
  // DATA RETRIEVAL TESTS
  // ===========================================================================

  describe('data retrieval', () => {
    beforeEach(() => {
      setupAdminAuth();
    });

    it('returns 404 for non-existent visitor', async () => {
      const eventsBuilder = createMockQueryBuilder([]);
      mockServiceClient.from.mockImplementation(() => eventsBuilder);

      const request = createMockRequest('vis_nonexistent');
      const params = Promise.resolve({ visitorId: 'vis_nonexistent' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe('Visitor not found');
    });

    it('returns visitor data with correct structure', async () => {
      const mockEvents = [
        {
          id: 1,
          session_id: 'sess_123',
          event_type: 'search',
          event_data: { query: 'katana' },
          ip_address: '1.2.3.4',
          created_at: '2026-01-20T10:00:00Z',
        },
        {
          id: 2,
          session_id: 'sess_123',
          event_type: 'page_view',
          event_data: { path: '/browse' },
          ip_address: '1.2.3.4',
          created_at: '2026-01-20T09:00:00Z',
        },
      ];

      const mockSessions = [
        {
          id: 'sess_123',
          started_at: '2026-01-20T09:00:00Z',
          ended_at: '2026-01-20T10:30:00Z',
          total_duration_ms: 5400000,
          page_views: 5,
          user_agent: 'Mozilla/5.0',
          screen_width: 1920,
          screen_height: 1080,
        },
      ];

      const eventsBuilder = createMockQueryBuilder(mockEvents);
      const sessionsBuilder = createMockQueryBuilder(mockSessions);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'activity_events') return eventsBuilder;
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);

      // Check structure
      expect(json).toHaveProperty('visitorId', 'vis_test_123');
      expect(json).toHaveProperty('ipAddresses');
      expect(json).toHaveProperty('firstSeen');
      expect(json).toHaveProperty('lastSeen');
      expect(json).toHaveProperty('totalEvents', 2);
      expect(json).toHaveProperty('totalSessions', 1);
      expect(json).toHaveProperty('totalDurationMs', 5400000);

      // Check summary stats
      expect(json).toHaveProperty('searchCount', 1);
      expect(json).toHaveProperty('pageViewCount', 1);

      // Check searches
      expect(json.topSearches).toHaveLength(1);
      expect(json.topSearches[0].query).toBe('katana');

      // Check sessions
      expect(json.sessions).toHaveLength(1);
      expect(json.sessions[0].durationMs).toBe(5400000);

      // Check activity timeline
      expect(json.recentActivity).toHaveLength(2);
    });

    it('aggregates search queries correctly', async () => {
      const mockEvents = [
        { id: 1, session_id: 'sess_1', event_type: 'search', event_data: { query: 'Katana' }, ip_address: null, created_at: '2026-01-20T10:00:00Z' },
        { id: 2, session_id: 'sess_1', event_type: 'search', event_data: { query: 'katana' }, ip_address: null, created_at: '2026-01-20T10:01:00Z' },
        { id: 3, session_id: 'sess_1', event_type: 'search', event_data: { query: 'KATANA' }, ip_address: null, created_at: '2026-01-20T10:02:00Z' },
        { id: 4, session_id: 'sess_1', event_type: 'search', event_data: { query: 'wakizashi' }, ip_address: null, created_at: '2026-01-20T10:03:00Z' },
      ];

      const eventsBuilder = createMockQueryBuilder(mockEvents);
      const sessionsBuilder = createMockQueryBuilder([]);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'activity_events') return eventsBuilder;
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.searchCount).toBe(4);

      // Should aggregate same queries (case-insensitive)
      expect(json.topSearches).toHaveLength(2);
      const katanaSearch = json.topSearches.find((s: { query: string }) => s.query === 'katana');
      expect(katanaSearch.count).toBe(3);
    });

    it('calculates total duration across sessions', async () => {
      const mockEvents = [
        { id: 1, session_id: 'sess_1', event_type: 'page_view', event_data: {}, ip_address: null, created_at: '2026-01-20T10:00:00Z' },
        { id: 2, session_id: 'sess_2', event_type: 'page_view', event_data: {}, ip_address: null, created_at: '2026-01-21T10:00:00Z' },
      ];

      const mockSessions = [
        { id: 'sess_1', started_at: '2026-01-20T09:00:00Z', ended_at: '2026-01-20T10:00:00Z', total_duration_ms: 60000, page_views: 3, user_agent: null, screen_width: null, screen_height: null },
        { id: 'sess_2', started_at: '2026-01-21T09:00:00Z', ended_at: '2026-01-21T10:00:00Z', total_duration_ms: 120000, page_views: 5, user_agent: null, screen_width: null, screen_height: null },
      ];

      const eventsBuilder = createMockQueryBuilder(mockEvents);
      const sessionsBuilder = createMockQueryBuilder(mockSessions);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'activity_events') return eventsBuilder;
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.totalSessions).toBe(2);
      expect(json.totalDurationMs).toBe(180000); // 60000 + 120000
    });

    it('tracks filter_change events and aggregates patterns', async () => {
      const mockEvents = [
        { id: 1, session_id: 'sess_1', event_type: 'filter_change', event_data: { newFilters: { category: 'swords', itemTypes: ['katana'] } }, ip_address: null, created_at: '2026-01-20T10:00:00Z' },
        { id: 2, session_id: 'sess_1', event_type: 'filter_change', event_data: { newFilters: { category: 'swords', itemTypes: ['katana'] } }, ip_address: null, created_at: '2026-01-20T10:01:00Z' },
        { id: 3, session_id: 'sess_1', event_type: 'filter_change', event_data: { newFilters: { category: 'tosogu', certifications: ['NBTHK'] } }, ip_address: null, created_at: '2026-01-20T10:02:00Z' },
      ];

      const eventsBuilder = createMockQueryBuilder(mockEvents);
      const sessionsBuilder = createMockQueryBuilder([]);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'activity_events') return eventsBuilder;
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.filterChangeCount).toBe(3);
      expect(json.filterPatterns).toHaveLength(2);

      // First pattern should be the one used twice
      expect(json.filterPatterns[0].count).toBe(2);
      expect(json.filterPatterns[0].filters.category).toBe('swords');
    });

    it('tracks external_link_click events for dealer clicks', async () => {
      const mockEvents = [
        { id: 1, session_id: 'sess_1', event_type: 'external_link_click', event_data: { dealerName: 'Aoi Art' }, ip_address: null, created_at: '2026-01-20T10:00:00Z' },
        { id: 2, session_id: 'sess_1', event_type: 'external_link_click', event_data: { dealerName: 'Aoi Art' }, ip_address: null, created_at: '2026-01-20T10:01:00Z' },
        { id: 3, session_id: 'sess_1', event_type: 'external_link_click', event_data: { dealerName: 'Nipponto' }, ip_address: null, created_at: '2026-01-20T10:02:00Z' },
      ];

      const eventsBuilder = createMockQueryBuilder(mockEvents);
      const sessionsBuilder = createMockQueryBuilder([]);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'activity_events') return eventsBuilder;
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.dealerClickCount).toBe(3);
      expect(json.dealersClicked).toHaveLength(2);
      expect(json.dealersClicked[0].name).toBe('Aoi Art');
      expect(json.dealersClicked[0].count).toBe(2);
      expect(json.dealersClicked[1].name).toBe('Nipponto');
      expect(json.dealersClicked[1].count).toBe(1);
    });

    it('tracks favorite_add and favorite_remove events', async () => {
      const mockEvents = [
        { id: 1, session_id: 'sess_1', event_type: 'favorite_add', event_data: { listingId: 123 }, ip_address: null, created_at: '2026-01-20T10:00:00Z' },
        { id: 2, session_id: 'sess_1', event_type: 'favorite_remove', event_data: { listingId: 123 }, ip_address: null, created_at: '2026-01-20T10:01:00Z' },
        { id: 3, session_id: 'sess_1', event_type: 'favorite_add', event_data: { listingId: 456 }, ip_address: null, created_at: '2026-01-20T10:02:00Z' },
      ];

      const eventsBuilder = createMockQueryBuilder(mockEvents);
      const sessionsBuilder = createMockQueryBuilder([]);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'activity_events') return eventsBuilder;
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.favoriteCount).toBe(3);
    });

    it('aggregates page views by path', async () => {
      const mockEvents = [
        { id: 1, session_id: 'sess_1', event_type: 'page_view', event_data: { path: '/browse' }, ip_address: null, created_at: '2026-01-20T10:00:00Z' },
        { id: 2, session_id: 'sess_1', event_type: 'page_view', event_data: { path: '/browse' }, ip_address: null, created_at: '2026-01-20T10:01:00Z' },
        { id: 3, session_id: 'sess_1', event_type: 'page_view', event_data: { path: '/listing/123' }, ip_address: null, created_at: '2026-01-20T10:02:00Z' },
      ];

      const eventsBuilder = createMockQueryBuilder(mockEvents);
      const sessionsBuilder = createMockQueryBuilder([]);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'activity_events') return eventsBuilder;
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.pageViewCount).toBe(3);
      expect(json.pagesViewed).toHaveLength(2);
      expect(json.pagesViewed[0].path).toBe('/browse');
      expect(json.pagesViewed[0].count).toBe(2);
    });

    it('collects multiple IP addresses from events', async () => {
      const mockEvents = [
        { id: 1, session_id: 'sess_1', event_type: 'page_view', event_data: {}, ip_address: '1.2.3.4', created_at: '2026-01-20T10:00:00Z' },
        { id: 2, session_id: 'sess_1', event_type: 'page_view', event_data: {}, ip_address: '1.2.3.4', created_at: '2026-01-20T10:01:00Z' },
        { id: 3, session_id: 'sess_2', event_type: 'page_view', event_data: {}, ip_address: '5.6.7.8', created_at: '2026-01-20T10:02:00Z' },
      ];

      const eventsBuilder = createMockQueryBuilder(mockEvents);
      const sessionsBuilder = createMockQueryBuilder([]);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'activity_events') return eventsBuilder;
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.ipAddresses).toHaveLength(2);
      expect(json.ipAddresses).toContain('1.2.3.4');
      expect(json.ipAddresses).toContain('5.6.7.8');
    });

    it('calculates firstSeen and lastSeen correctly', async () => {
      const mockEvents = [
        { id: 1, session_id: 'sess_1', event_type: 'page_view', event_data: {}, ip_address: null, created_at: '2026-01-18T08:00:00Z' },
        { id: 2, session_id: 'sess_1', event_type: 'page_view', event_data: {}, ip_address: null, created_at: '2026-01-20T15:00:00Z' },
        { id: 3, session_id: 'sess_1', event_type: 'page_view', event_data: {}, ip_address: null, created_at: '2026-01-19T12:00:00Z' },
      ];

      const eventsBuilder = createMockQueryBuilder(mockEvents);
      const sessionsBuilder = createMockQueryBuilder([]);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'activity_events') return eventsBuilder;
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.firstSeen).toBe('2026-01-18T08:00:00Z');
      expect(json.lastSeen).toBe('2026-01-20T15:00:00Z');
    });

    it('limits recent activity to 100 events', async () => {
      // Create 150 mock events
      const mockEvents = Array.from({ length: 150 }, (_, i) => ({
        id: i + 1,
        session_id: 'sess_1',
        event_type: 'page_view',
        event_data: { path: `/page/${i}` },
        ip_address: null,
        created_at: `2026-01-20T10:${String(i % 60).padStart(2, '0')}:00Z`,
      }));

      const eventsBuilder = createMockQueryBuilder(mockEvents);
      const sessionsBuilder = createMockQueryBuilder([]);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'activity_events') return eventsBuilder;
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.totalEvents).toBe(150);
      expect(json.recentActivity).toHaveLength(100);
    });

    it('handles sessions with null duration', async () => {
      const mockEvents = [
        { id: 1, session_id: 'sess_1', event_type: 'page_view', event_data: {}, ip_address: null, created_at: '2026-01-20T10:00:00Z' },
      ];

      const mockSessions = [
        { id: 'sess_1', started_at: '2026-01-20T09:00:00Z', ended_at: null, total_duration_ms: null, page_views: 1, user_agent: null, screen_width: null, screen_height: null },
      ];

      const eventsBuilder = createMockQueryBuilder(mockEvents);
      const sessionsBuilder = createMockQueryBuilder(mockSessions);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'activity_events') return eventsBuilder;
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.totalDurationMs).toBe(0);
      expect(json.sessions[0].durationMs).toBeNull();
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    beforeEach(() => {
      setupAdminAuth();
    });

    it('returns 500 on database error', async () => {
      const eventsBuilder = createMockQueryBuilder(null, { message: 'Database connection failed' });
      mockServiceClient.from.mockImplementation(() => eventsBuilder);

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Database error');
    });

    it('handles events with missing event_data gracefully', async () => {
      const mockEvents = [
        { id: 1, session_id: 'sess_1', event_type: 'search', event_data: null, ip_address: null, created_at: '2026-01-20T10:00:00Z' },
        { id: 2, session_id: 'sess_1', event_type: 'page_view', event_data: undefined, ip_address: null, created_at: '2026-01-20T10:01:00Z' },
      ];

      const eventsBuilder = createMockQueryBuilder(mockEvents);
      const sessionsBuilder = createMockQueryBuilder([]);

      mockServiceClient.from.mockImplementation((table: string) => {
        if (table === 'activity_events') return eventsBuilder;
        if (table === 'user_sessions') return sessionsBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest('vis_test_123');
      const params = Promise.resolve({ visitorId: 'vis_test_123' });
      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.searchCount).toBe(1);
      expect(json.topSearches).toHaveLength(0); // No query extracted from null data
    });
  });
});
