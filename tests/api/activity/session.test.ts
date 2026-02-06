/**
 * Session API Unit Tests
 *
 * Tests the /api/activity/session endpoint for:
 * - Session creation (POST)
 * - Session ending (PATCH)
 * - Validation and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockServiceClient = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => mockServiceClient),
}));

import { POST, PATCH } from '@/app/api/activity/session/route';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockRequest(body: unknown, method: string = 'POST'): NextRequest {
  const url = new URL('http://localhost:3000/api/activity/session');
  const request = new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  return request;
}

function createMockQueryBuilder(error: { code?: string; message: string } | null = null) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  builder.insert = vi.fn(() => Promise.resolve({ data: null, error }));
  builder.update = vi.fn(() => builder);
  builder.eq = vi.fn(() => Promise.resolve({ data: null, error }));

  return builder;
}

// =============================================================================
// POST - Session Creation Tests
// =============================================================================

describe('POST /api/activity/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validation', () => {
    it('returns 400 for invalid JSON', async () => {
      const url = new URL('http://localhost:3000/api/activity/session');
      const request = new NextRequest(url, {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Invalid JSON');
    });

    it('returns 400 for missing action', async () => {
      const request = createMockRequest({ sessionId: 'sess_123' });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Invalid payload structure');
    });

    it('returns 400 for invalid action', async () => {
      const request = createMockRequest({ action: 'invalid', sessionId: 'sess_123' });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Invalid payload structure');
    });

    it('returns 400 for missing sessionId', async () => {
      const request = createMockRequest({ action: 'create' });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Invalid payload structure');
    });

    it('accepts end action on POST (sendBeacon compatibility)', async () => {
      // sendBeacon can only send POST requests, so POST must handle 'end' action
      const queryBuilder = createMockQueryBuilder(null);
      mockServiceClient.from.mockReturnValue(queryBuilder);

      const request = createMockRequest({
        action: 'end',
        sessionId: 'sess_123',
        endedAt: new Date().toISOString(),
        totalDurationMs: 60000,
        pageViews: 5,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('session creation', () => {
    it('creates session successfully', async () => {
      const queryBuilder = createMockQueryBuilder(null);
      mockServiceClient.from.mockReturnValue(queryBuilder);

      const request = createMockRequest({
        action: 'create',
        sessionId: 'sess_abc123',
        userAgent: 'Mozilla/5.0',
        screenWidth: 1920,
        screenHeight: 1080,
        timezone: 'America/New_York',
        language: 'en-US',
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.sessionId).toBe('sess_abc123');

      // Verify insert was called with correct data
      expect(mockServiceClient.from).toHaveBeenCalledWith('user_sessions');
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'sess_abc123',
          user_agent: 'Mozilla/5.0',
          screen_width: 1920,
          screen_height: 1080,
          timezone: 'America/New_York',
          language: 'en-US',
          page_views: 0,
        })
      );
    });

    it('creates session with minimal data', async () => {
      const queryBuilder = createMockQueryBuilder(null);
      mockServiceClient.from.mockReturnValue(queryBuilder);

      const request = createMockRequest({
        action: 'create',
        sessionId: 'sess_minimal',
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // Verify null values for optional fields
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'sess_minimal',
          user_agent: null,
          screen_width: null,
          screen_height: null,
          timezone: null,
          language: null,
        })
      );
    });

    it('handles duplicate session gracefully', async () => {
      const queryBuilder = createMockQueryBuilder({ code: '23505', message: 'duplicate key' });
      mockServiceClient.from.mockReturnValue(queryBuilder);

      const request = createMockRequest({
        action: 'create',
        sessionId: 'sess_duplicate',
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.existing).toBe(true);
    });

    it('handles missing table gracefully', async () => {
      const queryBuilder = createMockQueryBuilder({ code: '42P01', message: 'table not found' });
      mockServiceClient.from.mockReturnValue(queryBuilder);

      const request = createMockRequest({
        action: 'create',
        sessionId: 'sess_notable',
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.warning).toBe('Sessions table not configured');
    });

    it('uses service client to bypass RLS', async () => {
      const queryBuilder = createMockQueryBuilder(null);
      mockServiceClient.from.mockReturnValue(queryBuilder);

      const request = createMockRequest({
        action: 'create',
        sessionId: 'sess_service',
      });

      await POST(request);

      // Verify service client was used (not regular client)
      expect(mockServiceClient.from).toHaveBeenCalled();
    });

    it('uses session_id column not id column', async () => {
      const queryBuilder = createMockQueryBuilder(null);
      mockServiceClient.from.mockReturnValue(queryBuilder);

      const request = createMockRequest({
        action: 'create',
        sessionId: 'sess_column_check',
      });

      await POST(request);

      // Verify session_id is used, not id
      const insertCall = queryBuilder.insert.mock.calls[0][0];
      expect(insertCall).toHaveProperty('session_id', 'sess_column_check');
      expect(insertCall).not.toHaveProperty('id');
    });
  });
});

// =============================================================================
// POST - Session End Tests (sendBeacon compatibility)
// =============================================================================

describe('POST /api/activity/session - end action (sendBeacon)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ends session successfully via POST', async () => {
    const queryBuilder = createMockQueryBuilder(null);
    mockServiceClient.from.mockReturnValue(queryBuilder);

    const endedAt = new Date().toISOString();
    const request = createMockRequest({
      action: 'end',
      sessionId: 'sess_beacon123',
      endedAt,
      totalDurationMs: 300000,
      pageViews: 15,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.sessionId).toBe('sess_beacon123');

    // Verify update was called
    expect(mockServiceClient.from).toHaveBeenCalledWith('user_sessions');
    expect(queryBuilder.update).toHaveBeenCalledWith({
      ended_at: endedAt,
      total_duration_ms: 300000,
      page_views: 15,
    });
  });

  it('queries by session_id not id when ending via POST', async () => {
    const queryBuilder = createMockQueryBuilder(null);
    mockServiceClient.from.mockReturnValue(queryBuilder);

    const request = createMockRequest({
      action: 'end',
      sessionId: 'sess_beacon_column',
      endedAt: new Date().toISOString(),
      totalDurationMs: 60000,
      pageViews: 5,
    });

    await POST(request);

    // Verify eq was called with session_id, not id
    expect(queryBuilder.eq).toHaveBeenCalledWith('session_id', 'sess_beacon_column');
  });

  it('handles missing table gracefully when ending via POST', async () => {
    const queryBuilder = createMockQueryBuilder({ code: '42P01', message: 'table not found' });
    mockServiceClient.from.mockReturnValue(queryBuilder);

    const request = createMockRequest({
      action: 'end',
      sessionId: 'sess_beacon_notable',
      endedAt: new Date().toISOString(),
      totalDurationMs: 60000,
      pageViews: 5,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.warning).toBe('Sessions table not configured');
  });
});

// =============================================================================
// PATCH - Session End Tests
// =============================================================================

describe('PATCH /api/activity/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validation', () => {
    it('returns 400 for invalid JSON', async () => {
      const url = new URL('http://localhost:3000/api/activity/session');
      const request = new NextRequest(url, {
        method: 'PATCH',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PATCH(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Invalid JSON');
    });

    it('returns 400 for wrong action type on PATCH', async () => {
      const request = createMockRequest({ action: 'create', sessionId: 'sess_123' }, 'PATCH');

      const response = await PATCH(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Invalid action for PATCH');
    });
  });

  describe('session ending', () => {
    it('ends session successfully', async () => {
      const queryBuilder = createMockQueryBuilder(null);
      mockServiceClient.from.mockReturnValue(queryBuilder);

      const endedAt = new Date().toISOString();
      const request = createMockRequest({
        action: 'end',
        sessionId: 'sess_end123',
        endedAt,
        totalDurationMs: 300000,
        pageViews: 15,
      }, 'PATCH');

      const response = await PATCH(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.sessionId).toBe('sess_end123');

      // Verify update was called
      expect(mockServiceClient.from).toHaveBeenCalledWith('user_sessions');
      expect(queryBuilder.update).toHaveBeenCalledWith({
        ended_at: endedAt,
        total_duration_ms: 300000,
        page_views: 15,
      });
    });

    it('queries by session_id not id', async () => {
      const queryBuilder = createMockQueryBuilder(null);
      mockServiceClient.from.mockReturnValue(queryBuilder);

      const request = createMockRequest({
        action: 'end',
        sessionId: 'sess_column_check',
        endedAt: new Date().toISOString(),
        totalDurationMs: 60000,
        pageViews: 5,
      }, 'PATCH');

      await PATCH(request);

      // Verify eq was called with session_id, not id
      expect(queryBuilder.eq).toHaveBeenCalledWith('session_id', 'sess_column_check');
    });

    it('handles missing table gracefully', async () => {
      const queryBuilder = createMockQueryBuilder({ code: '42P01', message: 'table not found' });
      mockServiceClient.from.mockReturnValue(queryBuilder);

      const request = createMockRequest({
        action: 'end',
        sessionId: 'sess_notable',
        endedAt: new Date().toISOString(),
        totalDurationMs: 60000,
        pageViews: 5,
      }, 'PATCH');

      const response = await PATCH(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.warning).toBe('Sessions table not configured');
    });

    it('uses service client to bypass RLS', async () => {
      const queryBuilder = createMockQueryBuilder(null);
      mockServiceClient.from.mockReturnValue(queryBuilder);

      const request = createMockRequest({
        action: 'end',
        sessionId: 'sess_service',
        endedAt: new Date().toISOString(),
        totalDurationMs: 60000,
        pageViews: 5,
      }, 'PATCH');

      await PATCH(request);

      // Verify service client was used
      expect(mockServiceClient.from).toHaveBeenCalled();
    });
  });
});

// =============================================================================
// Integration-style Tests
// =============================================================================

describe('Session API - Full Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles create then end flow via PATCH', async () => {
    const queryBuilder = createMockQueryBuilder(null);
    mockServiceClient.from.mockReturnValue(queryBuilder);

    const sessionId = 'sess_lifecycle_test';
    const startTime = new Date();

    // Create session
    const createRequest = createMockRequest({
      action: 'create',
      sessionId,
      userAgent: 'Test Browser',
    });

    const createResponse = await POST(createRequest);
    const createJson = await createResponse.json();

    expect(createResponse.status).toBe(200);
    expect(createJson.success).toBe(true);

    // End session via PATCH
    const endTime = new Date(startTime.getTime() + 300000); // 5 minutes later
    const endRequest = createMockRequest({
      action: 'end',
      sessionId,
      endedAt: endTime.toISOString(),
      totalDurationMs: 300000,
      pageViews: 10,
    }, 'PATCH');

    const endResponse = await PATCH(endRequest);
    const endJson = await endResponse.json();

    expect(endResponse.status).toBe(200);
    expect(endJson.success).toBe(true);

    // Verify both operations used correct session_id
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: sessionId })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith('session_id', sessionId);
  });

  it('handles create then end flow via POST (sendBeacon)', async () => {
    const queryBuilder = createMockQueryBuilder(null);
    mockServiceClient.from.mockReturnValue(queryBuilder);

    const sessionId = 'sess_sendbeacon_lifecycle';
    const startTime = new Date();

    // Create session
    const createRequest = createMockRequest({
      action: 'create',
      sessionId,
      userAgent: 'Test Browser',
    });

    const createResponse = await POST(createRequest);
    const createJson = await createResponse.json();

    expect(createResponse.status).toBe(200);
    expect(createJson.success).toBe(true);

    // End session via POST (simulating sendBeacon)
    const endTime = new Date(startTime.getTime() + 180000); // 3 minutes later
    const endRequest = createMockRequest({
      action: 'end',
      sessionId,
      endedAt: endTime.toISOString(),
      totalDurationMs: 180000,
      pageViews: 7,
    }); // POST by default

    const endResponse = await POST(endRequest);
    const endJson = await endResponse.json();

    expect(endResponse.status).toBe(200);
    expect(endJson.success).toBe(true);

    // Verify both operations used correct session_id
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: sessionId })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith('session_id', sessionId);
  });
});
