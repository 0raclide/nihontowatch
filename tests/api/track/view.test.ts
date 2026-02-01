/**
 * View Tracking API Tests
 *
 * Tests for POST /api/track/view endpoint that tracks listing views.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase service client
const mockInsert = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  })),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    logError: vi.fn(),
  },
}));

// Import after mocks
import { POST } from '@/app/api/track/view/route';

// =============================================================================
// Test Helpers
// =============================================================================

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/track/view', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/track/view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('successful tracking', () => {
    it('returns 200 success with valid data', async () => {
      const payload = {
        listingId: 123,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('accepts all valid referrer types', async () => {
      const referrerTypes = ['browse', 'search', 'direct', 'external', 'alert'];

      for (const referrer of referrerTypes) {
        mockInsert.mockResolvedValue({ error: null });

        const payload = {
          listingId: 123,
          sessionId: 'sess_abc123',
          referrer,
        };

        const response = await POST(createRequest(payload));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      }
    });

    it('accepts optional userId', async () => {
      const payload = {
        listingId: 123,
        sessionId: 'sess_abc123',
        userId: 'user-uuid-12345',
        referrer: 'browse',
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('inserts correct data to database', async () => {
      const payload = {
        listingId: 456,
        sessionId: 'sess_xyz789',
        userId: 'user-uuid',
        referrer: 'search',
      };

      await POST(createRequest(payload));

      expect(mockInsert).toHaveBeenCalled();
      const insertedData = mockInsert.mock.calls[0][0];
      expect(insertedData.listing_id).toBe(456);
      expect(insertedData.session_id).toBe('sess_xyz789');
      expect(insertedData.user_id).toBe('user-uuid');
      expect(insertedData.referrer).toBe('search');
      expect(insertedData.viewed_at).toBeDefined();
      expect(insertedData.view_date).toBeDefined();
      // view_date should be in YYYY-MM-DD format
      expect(insertedData.view_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('validation errors', () => {
    it('returns 400 when listingId is missing', async () => {
      const payload = {
        sessionId: 'sess_abc123',
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('listingId');
    });

    it('returns 400 when listingId is not a number', async () => {
      const payload = {
        listingId: 'not-a-number',
        sessionId: 'sess_abc123',
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('listingId');
    });

    it('returns 400 when listingId is negative', async () => {
      const payload = {
        listingId: -1,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 when listingId is zero', async () => {
      const payload = {
        listingId: 0,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 when sessionId is missing', async () => {
      const payload = {
        listingId: 123,
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('sessionId');
    });

    it('returns 400 when sessionId is empty string', async () => {
      const payload = {
        listingId: 123,
        sessionId: '',
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('sessionId');
    });

    it('returns 400 when sessionId is whitespace only', async () => {
      const payload = {
        listingId: 123,
        sessionId: '   ',
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/track/view', {
        method: 'POST',
        body: 'not valid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON');
    });
  });

  describe('deduplication handling', () => {
    it('returns success for duplicate views (unique constraint violation)', async () => {
      // Simulate unique constraint violation (code 23505)
      mockInsert.mockResolvedValue({
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });

      const payload = {
        listingId: 123,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('second call for same listing/session/day does not fail', async () => {
      // First call succeeds
      mockInsert.mockResolvedValue({ error: null });

      const payload = {
        listingId: 123,
        sessionId: 'sess_abc123',
      };

      const response1 = await POST(createRequest(payload));
      expect(response1.status).toBe(200);

      // Second call gets unique constraint violation but still succeeds
      mockInsert.mockResolvedValue({
        error: { code: '23505', message: 'duplicate key value' },
      });

      const response2 = await POST(createRequest(payload));
      const data2 = await response2.json();

      expect(response2.status).toBe(200);
      expect(data2.success).toBe(true);
    });
  });

  describe('database error handling', () => {
    it('returns success even when table does not exist', async () => {
      mockInsert.mockResolvedValue({
        error: { code: '42P01', message: 'relation "listing_views" does not exist' },
      });

      const payload = {
        listingId: 123,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      // Should return success (best-effort tracking)
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns success on other database errors (best-effort)', async () => {
      mockInsert.mockResolvedValue({
        error: { code: 'PGRST', message: 'some database error' },
      });

      const payload = {
        listingId: 123,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      // Best-effort: return success even on DB errors
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns success on unexpected exceptions (never break UX)', async () => {
      mockInsert.mockRejectedValue(new Error('Unexpected error'));

      const payload = {
        listingId: 123,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createRequest(payload));
      const data = await response.json();

      // Should still return success
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
