/**
 * Track API Tests
 *
 * Tests for /api/track endpoint that handles activity event batching.
 * Critical: viewport_dwell events must be accepted for dealer analytics.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase
const mockInsert = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  })),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    logError: vi.fn(),
  },
}));

// Import after mocks
import { POST } from '@/app/api/track/route';

// =============================================================================
// Test Helpers
// =============================================================================

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/track', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function createValidPayload(events: unknown[]) {
  return {
    sessionId: 'sess_test123',
    events,
  };
}

function createBaseEvent(type: string, extra: Record<string, unknown> = {}) {
  return {
    type,
    timestamp: new Date().toISOString(),
    sessionId: 'sess_test123',
    ...extra,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/track', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('event type validation', () => {
    it('accepts viewport_dwell events', async () => {
      const payload = createValidPayload([
        createBaseEvent('viewport_dwell', {
          listingId: 123,
          dwellMs: 2500,
          intersectionRatio: 0.8,
          isRevisit: false,
        }),
      ]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.eventsReceived).toBe(1);
    });

    it('accepts external_link_click events', async () => {
      const payload = createValidPayload([
        createBaseEvent('external_link_click', {
          url: 'https://dealer.com/listing/123',
          listingId: 123,
          dealerName: 'Aoi Art',
        }),
      ]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.eventsReceived).toBe(1);
    });

    it('accepts page_view events', async () => {
      const payload = createValidPayload([
        createBaseEvent('page_view', {
          path: '/browse',
        }),
      ]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.eventsReceived).toBe(1);
    });

    it('accepts listing_view events', async () => {
      const payload = createValidPayload([
        createBaseEvent('listing_view', {
          listingId: 456,
          durationMs: 5000,
        }),
      ]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.eventsReceived).toBe(1);
    });

    it('rejects unknown event types', async () => {
      const payload = createValidPayload([
        createBaseEvent('unknown_event_type', {}),
      ]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Event should be filtered out
      expect(data.eventsReceived).toBe(0);
    });

    it('filters invalid events but accepts valid ones in same batch', async () => {
      const payload = createValidPayload([
        createBaseEvent('viewport_dwell', { listingId: 1, dwellMs: 1000 }),
        createBaseEvent('invalid_type', {}),
        createBaseEvent('external_link_click', { url: 'https://test.com', listingId: 2 }),
      ]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.eventsReceived).toBe(2); // Only valid events counted
    });
  });

  describe('viewport_dwell validation', () => {
    it('requires listingId for viewport_dwell', async () => {
      const payload = createValidPayload([
        createBaseEvent('viewport_dwell', {
          dwellMs: 2500,
          // Missing listingId
        }),
      ]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(data.eventsReceived).toBe(0);
    });

    it('requires dwellMs for viewport_dwell', async () => {
      const payload = createValidPayload([
        createBaseEvent('viewport_dwell', {
          listingId: 123,
          // Missing dwellMs
        }),
      ]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(data.eventsReceived).toBe(0);
    });

    it('accepts viewport_dwell with all required fields', async () => {
      const payload = createValidPayload([
        createBaseEvent('viewport_dwell', {
          listingId: 123,
          dwellMs: 2500,
        }),
      ]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(data.eventsReceived).toBe(1);
    });
  });

  describe('external_link_click validation', () => {
    it('requires url for external_link_click', async () => {
      const payload = createValidPayload([
        createBaseEvent('external_link_click', {
          listingId: 123,
          // Missing url
        }),
      ]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(data.eventsReceived).toBe(0);
    });
  });

  describe('payload validation', () => {
    it('rejects invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/track', {
        method: 'POST',
        body: 'not valid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON');
    });

    it('rejects missing sessionId', async () => {
      const payload = { events: [] };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid payload structure');
    });

    it('rejects invalid sessionId format', async () => {
      const payload = {
        sessionId: 'invalid_format',
        events: [],
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid payload structure');
    });

    it('accepts valid sessionId format (sess_ prefix)', async () => {
      const payload = createValidPayload([]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('timestamp validation', () => {
    it('rejects events with timestamps too far in the past', async () => {
      const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      const payload = createValidPayload([
        {
          type: 'page_view',
          timestamp: oldTimestamp,
          sessionId: 'sess_test123',
          path: '/browse',
        },
      ]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(data.eventsReceived).toBe(0);
    });

    it('accepts events with recent timestamps', async () => {
      const payload = createValidPayload([
        createBaseEvent('page_view', { path: '/browse' }),
      ]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(data.eventsReceived).toBe(1);
    });
  });

  describe('database insertion', () => {
    it('inserts valid events to activity_events table', async () => {
      const payload = createValidPayload([
        createBaseEvent('viewport_dwell', { listingId: 123, dwellMs: 2500 }),
      ]);

      await POST(createRequest(payload));

      expect(mockInsert).toHaveBeenCalled();
      const insertedRecords = mockInsert.mock.calls[0][0];
      expect(insertedRecords).toHaveLength(1);
      expect(insertedRecords[0].event_type).toBe('viewport_dwell');
      expect(insertedRecords[0].session_id).toBe('sess_test123');
      expect(insertedRecords[0].event_data).toEqual({
        listingId: 123,
        dwellMs: 2500,
      });
    });

    it('handles database errors gracefully', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'DB error' } });

      const payload = createValidPayload([
        createBaseEvent('page_view', { path: '/browse' }),
      ]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      // Should still return success (best-effort tracking)
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

// =============================================================================
// All Event Types Test
// =============================================================================

describe('All supported event types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  const eventTypes = [
    { type: 'page_view', extra: { path: '/browse' } },
    { type: 'listing_view', extra: { listingId: 1, durationMs: 1000 } },
    { type: 'search', extra: { query: 'katana' } },
    { type: 'filter_change', extra: { changedFilter: 'certification' } },
    { type: 'favorite_add', extra: { listingId: 1 } },
    { type: 'favorite_remove', extra: { listingId: 1 } },
    { type: 'alert_create', extra: {} },
    { type: 'alert_delete', extra: {} },
    { type: 'external_link_click', extra: { url: 'https://test.com' } },
    { type: 'viewport_dwell', extra: { listingId: 1, dwellMs: 2000 } },
  ];

  eventTypes.forEach(({ type, extra }) => {
    it(`accepts ${type} events`, async () => {
      const payload = createValidPayload([createBaseEvent(type, extra)]);

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.eventsReceived).toBe(1);
    });
  });
});
