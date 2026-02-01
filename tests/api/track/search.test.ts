/**
 * Search Tracking API Tests
 *
 * Tests for POST /api/track/search endpoint that tracks user searches.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase service client
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'user_searches') {
        return {
          insert: mockInsert.mockReturnValue({
            select: mockSelect.mockReturnValue({
              single: mockSingle,
            }),
          }),
          update: mockUpdate.mockReturnValue({
            eq: mockEq,
          }),
        };
      }
      return {
        insert: mockInsert,
        update: mockUpdate,
      };
    }),
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
import { POST, PATCH } from '@/app/api/track/search/route';

// =============================================================================
// Test Helpers
// =============================================================================

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/track/search', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/track/search', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// =============================================================================
// POST Tests
// =============================================================================

describe('POST /api/track/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: 42 }, error: null });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('successful tracking', () => {
    it('returns 200 success with searchId for valid data', async () => {
      const payload = {
        query: 'katana',
        resultCount: 15,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createPostRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.searchId).toBe(42);
    });

    it('accepts optional filters', async () => {
      const payload = {
        query: 'shinto katana',
        filters: {
          itemType: 'KATANA',
          certification: 'Juyo',
          priceMin: 1000000,
          priceMax: 5000000,
        },
        resultCount: 5,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createPostRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('accepts optional userId', async () => {
      const payload = {
        query: 'wakizashi',
        resultCount: 8,
        sessionId: 'sess_abc123',
        userId: 'user-uuid-12345',
      };

      const response = await POST(createPostRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('accepts empty query string', async () => {
      const payload = {
        query: '',
        resultCount: 100,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createPostRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('accepts zero result count', async () => {
      const payload = {
        query: 'nonexistent sword',
        resultCount: 0,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createPostRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('query normalization', () => {
    it('normalizes query to lowercase', async () => {
      const payload = {
        query: 'KATANA',
        resultCount: 10,
        sessionId: 'sess_abc123',
      };

      await POST(createPostRequest(payload));

      expect(mockInsert).toHaveBeenCalled();
      const insertedData = mockInsert.mock.calls[0][0];
      expect(insertedData.query).toBe('KATANA'); // Original preserved
      expect(insertedData.query_normalized).toBe('katana'); // Normalized
    });

    it('trims whitespace from query', async () => {
      const payload = {
        query: '  katana  ',
        resultCount: 10,
        sessionId: 'sess_abc123',
      };

      await POST(createPostRequest(payload));

      const insertedData = mockInsert.mock.calls[0][0];
      expect(insertedData.query_normalized).toBe('katana');
    });

    it('collapses multiple spaces', async () => {
      const payload = {
        query: 'shinto   katana   blade',
        resultCount: 5,
        sessionId: 'sess_abc123',
      };

      await POST(createPostRequest(payload));

      const insertedData = mockInsert.mock.calls[0][0];
      expect(insertedData.query_normalized).toBe('shinto katana blade');
    });
  });

  describe('validation errors', () => {
    it('returns 400 when query is missing', async () => {
      const payload = {
        resultCount: 10,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createPostRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('query');
    });

    it('returns 400 when sessionId is missing', async () => {
      const payload = {
        query: 'katana',
        resultCount: 10,
      };

      const response = await POST(createPostRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('sessionId');
    });

    it('returns 400 when sessionId is empty', async () => {
      const payload = {
        query: 'katana',
        resultCount: 10,
        sessionId: '',
      };

      const response = await POST(createPostRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('sessionId');
    });

    it('returns 400 when resultCount is missing', async () => {
      const payload = {
        query: 'katana',
        sessionId: 'sess_abc123',
      };

      const response = await POST(createPostRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('resultCount');
    });

    it('returns 400 when resultCount is negative', async () => {
      const payload = {
        query: 'katana',
        resultCount: -1,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createPostRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/track/search', {
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

  describe('database error handling', () => {
    it('returns success when table does not exist', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      });

      const payload = {
        query: 'katana',
        resultCount: 10,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createPostRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns success on database errors (best-effort)', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST', message: 'some error' },
      });

      const payload = {
        query: 'katana',
        resultCount: 10,
        sessionId: 'sess_abc123',
      };

      const response = await POST(createPostRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

// =============================================================================
// PATCH Tests (CTR tracking)
// =============================================================================

describe('PATCH /api/track/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('successful click tracking', () => {
    it('returns 200 success for valid click data', async () => {
      const payload = {
        searchId: 42,
        listingId: 123,
      };

      const response = await PATCH(createPatchRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('updates the correct search record', async () => {
      const payload = {
        searchId: 42,
        listingId: 123,
      };

      await PATCH(createPatchRequest(payload));

      expect(mockUpdate).toHaveBeenCalled();
      const updateData = mockUpdate.mock.calls[0][0];
      expect(updateData.clicked_listing_id).toBe(123);
      expect(updateData.clicked_at).toBeDefined();

      expect(mockEq).toHaveBeenCalledWith('id', 42);
    });
  });

  describe('validation errors', () => {
    it('returns 400 when searchId is missing', async () => {
      const payload = {
        listingId: 123,
      };

      const response = await PATCH(createPatchRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('searchId');
    });

    it('returns 400 when listingId is missing', async () => {
      const payload = {
        searchId: 42,
      };

      const response = await PATCH(createPatchRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('listingId');
    });

    it('returns 400 when searchId is zero', async () => {
      const payload = {
        searchId: 0,
        listingId: 123,
      };

      const response = await PATCH(createPatchRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 when listingId is negative', async () => {
      const payload = {
        searchId: 42,
        listingId: -1,
      };

      const response = await PATCH(createPatchRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('database error handling', () => {
    it('returns success on database errors (best-effort)', async () => {
      mockEq.mockResolvedValue({
        error: { code: 'PGRST', message: 'some error' },
      });

      const payload = {
        searchId: 42,
        listingId: 123,
      };

      const response = await PATCH(createPatchRequest(payload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
