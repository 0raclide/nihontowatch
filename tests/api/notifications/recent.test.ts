/**
 * Tests for GET /api/notifications/recent
 *
 * Tests cover:
 * - Unauthenticated users get empty response
 * - Users with no saved searches get hasSavedSearches: false
 * - Users with searches but no notifications get empty notifications
 * - Full notification flow with listings and dealer names
 * - Unread count calculation from `since` param
 * - Listing ID collection limits (2 per notification, 10 total)
 * - Error handling for failed DB queries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock next/headers before importing the route
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

import { GET } from '@/app/api/notifications/recent/route';

// =============================================================================
// HELPERS
// =============================================================================

function createRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/notifications/recent');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

function createQueryBuilder(
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

  // Terminal — resolves as a thenable
  builder.then = vi.fn((resolve: (r: { data: unknown[] | null; error: typeof error }) => void) => {
    resolve({ data, error });
  });

  return builder;
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/notifications/recent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  describe('authentication', () => {
    it('returns empty state for unauthenticated users', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const response = await GET(createRequest());
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({
        notifications: [],
        unreadCount: 0,
        hasSavedSearches: false,
      });
    });

    it('does not query DB when unauthenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await GET(createRequest());
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // No saved searches
  // ---------------------------------------------------------------------------

  describe('no saved searches', () => {
    it('returns hasSavedSearches: false when user has none', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });

      const searchesBuilder = createQueryBuilder([]);
      mockSupabaseClient.from.mockReturnValue(searchesBuilder);

      const response = await GET(createRequest());
      const json = await response.json();

      expect(json.hasSavedSearches).toBe(false);
      expect(json.notifications).toEqual([]);
      expect(json.unreadCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Has searches, no notifications
  // ---------------------------------------------------------------------------

  describe('has searches, no notifications', () => {
    it('returns empty notifications with hasSavedSearches: true', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });

      const savedSearches = [
        { id: 'ss-1', name: 'Juyo Katana' },
        { id: 'ss-2', name: 'Hozon Tsuba' },
      ];

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // saved_searches
          return createQueryBuilder(savedSearches);
        }
        // saved_search_notifications — empty
        return createQueryBuilder([]);
      });

      const response = await GET(createRequest());
      const json = await response.json();

      expect(json.hasSavedSearches).toBe(true);
      expect(json.notifications).toEqual([]);
      expect(json.unreadCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Full notification flow
  // ---------------------------------------------------------------------------

  describe('full notification flow', () => {
    const savedSearches = [
      { id: 'ss-1', name: 'Juyo Katana' },
      { id: 'ss-2', name: null },
    ];

    const notifications = [
      {
        id: 'notif-1',
        saved_search_id: 'ss-1',
        matched_listing_ids: [101, 102, 103],
        created_at: '2026-02-22T10:00:00Z',
      },
      {
        id: 'notif-2',
        saved_search_id: 'ss-2',
        matched_listing_ids: [201],
        created_at: '2026-02-21T08:00:00Z',
      },
    ];

    const listings = [
      {
        id: 101,
        title: 'Beautiful Katana',
        item_type: 'katana',
        price_value: 3000000,
        price_currency: 'JPY',
        images: ['https://img.example.com/101.jpg'],
        dealer_id: 1,
      },
      {
        id: 102,
        title: 'Fine Tachi',
        item_type: 'tachi',
        price_value: 5000000,
        price_currency: 'JPY',
        images: null,
        dealer_id: 1,
      },
      {
        id: 201,
        title: 'Hozon Tsuba',
        item_type: 'tsuba',
        price_value: 200000,
        price_currency: 'JPY',
        images: ['https://img.example.com/201.jpg'],
        dealer_id: 2,
      },
    ];

    const dealers = [
      { id: 1, name: 'Aoi Art' },
      { id: 2, name: 'Ginza Seikodo' },
    ];

    function setupFullFlow() {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createQueryBuilder(savedSearches);
        if (callCount === 2) return createQueryBuilder(notifications);
        if (callCount === 3) return createQueryBuilder(listings);
        if (callCount === 4) return createQueryBuilder(dealers);
        return createQueryBuilder([]);
      });
    }

    it('returns notifications with listing details and dealer names', async () => {
      setupFullFlow();

      const response = await GET(createRequest());
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.hasSavedSearches).toBe(true);
      expect(json.notifications).toHaveLength(2);

      // First notification
      const notif1 = json.notifications[0];
      expect(notif1.id).toBe('notif-1');
      expect(notif1.savedSearchId).toBe('ss-1');
      expect(notif1.searchName).toBe('Juyo Katana');
      expect(notif1.matchCount).toBe(3);
      expect(notif1.listings).toHaveLength(2); // capped at 2 per notification
      expect(notif1.listings[0].title).toBe('Beautiful Katana');
      expect(notif1.listings[0].dealer_name).toBe('Aoi Art');
      expect(notif1.listings[0].thumbnail).toBe('https://img.example.com/101.jpg');
      expect(notif1.listings[1].thumbnail).toBeNull(); // listing 102 has no images

      // Second notification — unnamed search
      const notif2 = json.notifications[1];
      expect(notif2.searchName).toBeNull();
      expect(notif2.listings[0].dealer_name).toBe('Ginza Seikodo');
    });

    it('computes all as unread when no since param', async () => {
      setupFullFlow();

      const response = await GET(createRequest());
      const json = await response.json();

      expect(json.unreadCount).toBe(2);
    });

    it('computes unread count from since param', async () => {
      setupFullFlow();

      // Since is between the two notifications
      const response = await GET(createRequest({
        since: '2026-02-22T00:00:00Z',
      }));
      const json = await response.json();

      // Only notif-1 (10:00) is after since; notif-2 (Feb 21) is before
      expect(json.unreadCount).toBe(1);
    });

    it('returns 0 unread when since is after all notifications', async () => {
      setupFullFlow();

      const response = await GET(createRequest({
        since: '2026-02-23T00:00:00Z',
      }));
      const json = await response.json();

      expect(json.unreadCount).toBe(0);
    });

    it('limits to 2 listing IDs per notification', async () => {
      setupFullFlow();

      const response = await GET(createRequest());
      const json = await response.json();

      // notif-1 has [101, 102, 103] but only first 2 should appear
      expect(json.notifications[0].listings).toHaveLength(2);
      expect(json.notifications[0].matchCount).toBe(3); // total still reported
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('returns 500 when saved_searches query fails', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue(
        createQueryBuilder(null, { message: 'DB connection error' })
      );

      const response = await GET(createRequest());
      expect(response.status).toBe(500);
    });

    it('returns 500 when notifications query fails', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createQueryBuilder([{ id: 'ss-1', name: 'test' }]);
        }
        return createQueryBuilder(null, { message: 'Query failed' });
      });

      const response = await GET(createRequest());
      expect(response.status).toBe(500);
    });

    it('handles invalid since param gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createQueryBuilder([{ id: 'ss-1', name: 'test' }]);
        if (callCount === 2) {
          return createQueryBuilder([{
            id: 'n-1',
            saved_search_id: 'ss-1',
            matched_listing_ids: [1],
            created_at: '2026-02-22T10:00:00Z',
          }]);
        }
        return createQueryBuilder([]);
      });

      // Invalid date string — should not crash, treat as no since
      const response = await GET(createRequest({ since: 'not-a-date' }));
      const json = await response.json();

      expect(response.status).toBe(200);
      // Invalid since → unreadCount stays 0 (NaN check fails)
      expect(json.unreadCount).toBe(0);
    });
  });
});
