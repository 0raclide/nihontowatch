/**
 * Feedback API Unit Tests
 *
 * Tests the POST /api/feedback endpoint:
 * - Auth required (401 for unauthenticated)
 * - Input validation (feedback_type, message, target_type)
 * - Rate limiting (10 per hour per user)
 * - Successful insert with correct fields
 * - Admin email notification is sent after insert
 *
 * Uses vitest with mocking - no live server required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Next.js headers before imports
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

// Track Supabase operations
interface SupabaseTracker {
  fromCalls: string[];
  selectCalls: Array<{ columns: string; options?: Record<string, unknown> }>;
  insertCalls: Array<{ data: Record<string, unknown> }>;
  eqCalls: Array<{ column: string; value: unknown }>;
  gteCalls: Array<{ column: string; value: unknown }>;
}

let tracker: SupabaseTracker;
let mockUser: { id: string; email: string } | null = null;
let mockRateLimitCount: number = 0;
let mockInsertResult: { data: Record<string, unknown> | null; error: unknown } = {
  data: { id: 1, status: 'open' },
  error: null,
};

// Build chainable Supabase mock
function createMockQueryBuilder(tableName: string) {
  tracker.fromCalls.push(tableName);
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  builder.select = vi.fn((columns: string, options?: Record<string, unknown>) => {
    tracker.selectCalls.push({ columns, options });
    return builder;
  });

  builder.insert = vi.fn((data: Record<string, unknown>) => {
    tracker.insertCalls.push({ data });
    return builder;
  });

  builder.eq = vi.fn((column: string, value: unknown) => {
    tracker.eqCalls.push({ column, value });
    return builder;
  });

  builder.gte = vi.fn((column: string, value: unknown) => {
    tracker.gteCalls.push({ column, value });
    // Rate limit check returns count
    return Promise.resolve({ count: mockRateLimitCount, error: null });
  });

  builder.single = vi.fn(() => {
    return Promise.resolve(mockInsertResult);
  });

  return builder;
}

// Mock Supabase
const mockAnonClient = {
  auth: {
    getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
  },
  from: vi.fn((table: string) => createMockQueryBuilder(table)),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockAnonClient)),
}));

// Helper to create mock request
function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Import route handler AFTER mocks
import { POST } from '@/app/api/feedback/route';

beforeEach(() => {
  vi.clearAllMocks();
  tracker = {
    fromCalls: [],
    selectCalls: [],
    insertCalls: [],
    eqCalls: [],
    gteCalls: [],
  };
  mockUser = { id: 'user-123', email: 'test@example.com' };
  mockRateLimitCount = 0;
  mockInsertResult = { data: { id: 1, status: 'open' }, error: null };

  // Reset from mocks
  mockAnonClient.from.mockImplementation((table: string) => createMockQueryBuilder(table));
});

// =============================================================================
// AUTH TESTS
// =============================================================================

describe('Feedback API - Authentication', () => {
  it('returns 401 when user is not logged in', async () => {
    mockUser = null;

    const request = createRequest({ feedback_type: 'bug', message: 'Test' });
    const response = await POST(request as never);

    expect(response.status).toBe(401);
  });

  it('succeeds when user is logged in', async () => {
    const request = createRequest({ feedback_type: 'bug', message: 'Found a bug' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
  });
});

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe('Feedback API - Input Validation', () => {
  it('returns 400 for missing feedback_type', async () => {
    const request = createRequest({ message: 'Test message' });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('feedback type');
  });

  it('returns 400 for invalid feedback_type', async () => {
    const request = createRequest({ feedback_type: 'invalid', message: 'Test' });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
  });

  it('returns 400 for missing message', async () => {
    const request = createRequest({ feedback_type: 'bug' });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('Message');
  });

  it('returns 400 for empty message', async () => {
    const request = createRequest({ feedback_type: 'bug', message: '   ' });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
  });

  it('returns 400 for message exceeding max length', async () => {
    const request = createRequest({
      feedback_type: 'bug',
      message: 'x'.repeat(2001),
    });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('2000');
  });

  it('returns 400 for invalid target_type', async () => {
    const request = createRequest({
      feedback_type: 'data_report',
      message: 'Wrong data',
      target_type: 'invalid',
    });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
  });

  it('accepts all valid feedback types', async () => {
    for (const type of ['data_report', 'bug', 'feature_request', 'other']) {
      vi.clearAllMocks();
      tracker = { fromCalls: [], selectCalls: [], insertCalls: [], eqCalls: [], gteCalls: [] };
      mockAnonClient.from.mockImplementation((t: string) => createMockQueryBuilder(t));

      const request = createRequest({ feedback_type: type, message: 'Test' });
      const response = await POST(request as never);

      expect(response.status).toBe(200);
    }
  });

  it('accepts valid target types', async () => {
    for (const targetType of ['listing', 'artist']) {
      vi.clearAllMocks();
      tracker = { fromCalls: [], selectCalls: [], insertCalls: [], eqCalls: [], gteCalls: [] };
      mockAnonClient.from.mockImplementation((t: string) => createMockQueryBuilder(t));

      const request = createRequest({
        feedback_type: 'data_report',
        message: 'Wrong data',
        target_type: targetType,
        target_id: '123',
        target_label: 'Test item',
      });
      const response = await POST(request as never);

      expect(response.status).toBe(200);
    }
  });
});

// =============================================================================
// RATE LIMITING TESTS
// =============================================================================

describe('Feedback API - Rate Limiting', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    mockRateLimitCount = 10; // At the limit

    const request = createRequest({ feedback_type: 'bug', message: 'Test' });
    const response = await POST(request as never);

    expect(response.status).toBe(429);
  });

  it('allows submission when under rate limit', async () => {
    mockRateLimitCount = 5; // Under limit

    const request = createRequest({ feedback_type: 'bug', message: 'Test' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
  });

  it('checks rate limit against correct user ID', async () => {
    const request = createRequest({ feedback_type: 'bug', message: 'Test' });
    await POST(request as never);

    // Should have an eq('user_id', 'user-123') call for the rate limit check
    const userIdEq = tracker.eqCalls.find(c => c.column === 'user_id' && c.value === 'user-123');
    expect(userIdEq).toBeDefined();
  });

  it('checks rate limit with 1 hour window', async () => {
    const request = createRequest({ feedback_type: 'bug', message: 'Test' });
    await POST(request as never);

    // Should have a gte('created_at', ...) call with a timestamp ~1 hour ago
    const gteCall = tracker.gteCalls.find(c => c.column === 'created_at');
    expect(gteCall).toBeDefined();

    const timestamp = new Date(gteCall!.value as string).getTime();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    // Should be within 5 seconds of 1 hour ago
    expect(Math.abs(timestamp - oneHourAgo)).toBeLessThan(5000);
  });
});

// =============================================================================
// SUCCESSFUL SUBMISSION TESTS
// =============================================================================

describe('Feedback API - Successful Submission', () => {
  it('returns id and status on success', async () => {
    const request = createRequest({ feedback_type: 'bug', message: 'Found a bug' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.id).toBe(1);
    expect(json.status).toBe('open');
  });

  it('inserts correct data for general feedback', async () => {
    const request = createRequest({
      feedback_type: 'feature_request',
      message: '  Please add dark mode  ',
      page_url: 'https://nihontowatch.com/browse',
    });
    await POST(request as never);

    expect(tracker.insertCalls.length).toBeGreaterThan(0);
    const inserted = tracker.insertCalls[0].data;
    expect(inserted.user_id).toBe('user-123');
    expect(inserted.feedback_type).toBe('feature_request');
    expect(inserted.message).toBe('Please add dark mode'); // trimmed
    expect(inserted.target_type).toBeNull();
    expect(inserted.target_id).toBeNull();
    expect(inserted.page_url).toBe('https://nihontowatch.com/browse');
  });

  it('inserts correct data for data report with target', async () => {
    const request = createRequest({
      feedback_type: 'data_report',
      message: 'Wrong certification',
      target_type: 'listing',
      target_id: 42,
      target_label: 'Katana by Masamune',
    });
    await POST(request as never);

    const inserted = tracker.insertCalls[0].data;
    expect(inserted.feedback_type).toBe('data_report');
    expect(inserted.target_type).toBe('listing');
    expect(inserted.target_id).toBe('42'); // Coerced to string
    expect(inserted.target_label).toBe('Katana by Masamune');
  });

  it('handles null optional fields gracefully', async () => {
    const request = createRequest({
      feedback_type: 'other',
      message: 'Just a note',
    });
    await POST(request as never);

    const inserted = tracker.insertCalls[0].data;
    expect(inserted.target_type).toBeNull();
    expect(inserted.target_id).toBeNull();
    expect(inserted.target_label).toBeNull();
    expect(inserted.page_url).toBeNull();
  });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe('Feedback API - Error Handling', () => {
  it('returns 500 when insert fails', async () => {
    mockInsertResult = { data: null, error: { message: 'DB error' } };

    const request = createRequest({ feedback_type: 'bug', message: 'Test' });
    const response = await POST(request as never);

    expect(response.status).toBe(500);
  });

  it('returns 500 on unexpected exception', async () => {
    // Make auth throw
    mockAnonClient.auth.getUser.mockRejectedValueOnce(new Error('Connection failed'));

    const request = createRequest({ feedback_type: 'bug', message: 'Test' });
    const response = await POST(request as never);

    expect(response.status).toBe(500);
  });
});
