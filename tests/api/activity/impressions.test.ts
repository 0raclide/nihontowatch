/**
 * Impression Fan-out API Tests
 *
 * Tests that the /api/activity POST route correctly fans out
 * listing_impression events to the listing_impressions table:
 * - Correct row shape (listing_id, dealer_id, session_id, position, impression_date)
 * - Dedup: 23505 unique constraint violations are silently ignored
 * - Non-impression events are not fanned out
 * - Multiple impressions in one batch are each inserted
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// Mock Setup
// =============================================================================

const mockInsert = vi.fn();
const mockFrom = vi.fn();

const mockServiceClient = {
  from: mockFrom,
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => mockServiceClient),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    logError: vi.fn(),
  },
}));

import { POST } from '@/app/api/activity/route';
import { logger } from '@/lib/logger';

// =============================================================================
// Helpers
// =============================================================================

function createRequest(payload: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost:3000/api/activity'), {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeImpressionEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'listing_impression',
    timestamp: '2026-03-06T10:00:00.000Z',
    sessionId: 'sess_abc',
    listingId: 42,
    dealerId: 7,
    position: 3,
    ...overrides,
  };
}

function makeBatchPayload(events: unknown[], sessionId = 'sess_abc', visitorId = 'vis_xyz') {
  return {
    sessionId,
    visitorId,
    events,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/activity — listing_impression fan-out', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: all table writes succeed
    mockFrom.mockImplementation((table: string) => {
      if (table === 'activity_events') {
        return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }
      if (table === 'listing_impressions') {
        return { insert: mockInsert };
      }
      // Other fan-out tables (dealer_clicks, listing_views, user_searches)
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    mockInsert.mockResolvedValue({ data: null, error: null });
  });

  it('inserts impression with correct row shape', async () => {
    const event = makeImpressionEvent();
    const payload = makeBatchPayload([event]);
    const request = createRequest(payload);

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Find the listing_impressions insert call
    const impressionCalls = mockFrom.mock.calls.filter(
      ([table]: [string]) => table === 'listing_impressions'
    );
    expect(impressionCalls).toHaveLength(1);

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertedRow = mockInsert.mock.calls[0][0];

    expect(insertedRow).toEqual({
      listing_id: 42,
      dealer_id: 7,
      session_id: 'sess_abc',
      visitor_id: 'vis_xyz',
      position: 3,
      impression_date: '2026-03-06',
      created_at: '2026-03-06T10:00:00.000Z',
    });
  });

  it('extracts impression_date from event timestamp', async () => {
    const event = makeImpressionEvent({
      timestamp: '2026-12-25T23:59:59.999Z',
    });
    const payload = makeBatchPayload([event]);
    const request = createRequest(payload);

    await POST(request);

    const insertedRow = mockInsert.mock.calls[0][0];
    expect(insertedRow.impression_date).toBe('2026-12-25');
  });

  it('handles multiple impressions in one batch', async () => {
    const events = [
      makeImpressionEvent({ listingId: 1, position: 0 }),
      makeImpressionEvent({ listingId: 2, position: 1 }),
      makeImpressionEvent({ listingId: 3, position: 2 }),
    ];
    const payload = makeBatchPayload(events);
    const request = createRequest(payload);

    await POST(request);

    expect(mockInsert).toHaveBeenCalledTimes(3);
    expect(mockInsert.mock.calls[0][0].listing_id).toBe(1);
    expect(mockInsert.mock.calls[1][0].listing_id).toBe(2);
    expect(mockInsert.mock.calls[2][0].listing_id).toBe(3);
  });

  it('silently ignores 23505 duplicate key errors (dedup)', async () => {
    mockInsert.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });

    const event = makeImpressionEvent();
    const payload = makeBatchPayload([event]);
    const request = createRequest(payload);

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Should NOT log an error for 23505
    const errorCalls = (logger.error as ReturnType<typeof vi.fn>).mock.calls;
    const impressionErrors = errorCalls.filter(
      ([msg]: [string]) => msg.includes('listing_impressions')
    );
    expect(impressionErrors).toHaveLength(0);
  });

  it('silently ignores 42P01 table-not-found errors', async () => {
    mockInsert.mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    });

    const event = makeImpressionEvent();
    const payload = makeBatchPayload([event]);
    const request = createRequest(payload);

    const response = await POST(request);
    expect(response.status).toBe(200);

    const errorCalls = (logger.error as ReturnType<typeof vi.fn>).mock.calls;
    const impressionErrors = errorCalls.filter(
      ([msg]: [string]) => msg.includes('listing_impressions')
    );
    expect(impressionErrors).toHaveLength(0);
  });

  it('logs real errors (non-dedup, non-table-missing)', async () => {
    mockInsert.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    const event = makeImpressionEvent();
    const payload = makeBatchPayload([event]);
    const request = createRequest(payload);

    await POST(request);

    const errorCalls = (logger.error as ReturnType<typeof vi.fn>).mock.calls;
    const impressionErrors = errorCalls.filter(
      ([msg]: [string]) => msg.includes('listing_impressions')
    );
    expect(impressionErrors).toHaveLength(1);
  });

  it('does NOT fan out non-impression events to listing_impressions', async () => {
    const events = [
      {
        type: 'page_view',
        timestamp: '2026-03-06T10:00:00.000Z',
        sessionId: 'sess_abc',
        path: '/browse',
      },
      {
        type: 'listing_view',
        timestamp: '2026-03-06T10:00:00.000Z',
        sessionId: 'sess_abc',
        listingId: 42,
        durationMs: 5000,
      },
    ];
    const payload = makeBatchPayload(events);
    const request = createRequest(payload);

    await POST(request);

    // listing_impressions.insert should NOT be called
    const impressionCalls = mockFrom.mock.calls.filter(
      ([table]: [string]) => table === 'listing_impressions'
    );
    expect(impressionCalls).toHaveLength(0);
  });

  it('handles null visitor_id gracefully', async () => {
    const event = makeImpressionEvent();
    const payload = {
      sessionId: 'sess_abc',
      events: [event],
      // No visitorId
    };
    const request = createRequest(payload);

    await POST(request);

    const insertedRow = mockInsert.mock.calls[0][0];
    expect(insertedRow.visitor_id).toBeNull();
  });

  it('handles zero/missing position and dealerId', async () => {
    const event = makeImpressionEvent({
      position: undefined,
      dealerId: undefined,
    });
    // Remove undefined keys to simulate what the client actually sends
    delete (event as Record<string, unknown>).position;
    delete (event as Record<string, unknown>).dealerId;

    const payload = makeBatchPayload([event]);
    const request = createRequest(payload);

    await POST(request);

    const insertedRow = mockInsert.mock.calls[0][0];
    // Should default gracefully (0 or null)
    expect(insertedRow.dealer_id).toBe(0);
    expect(insertedRow.position).toBeNull();
  });

  it('returns success even when impression fan-out fails', async () => {
    // Fan-out is best-effort — main activity_events insert succeeds
    mockInsert.mockRejectedValue(new Error('network timeout'));

    const event = makeImpressionEvent();
    const payload = makeBatchPayload([event]);
    const request = createRequest(payload);

    const response = await POST(request);
    const json = await response.json();

    // API should still return 200 — fan-outs use Promise.allSettled
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.eventsReceived).toBe(1);
  });
});
