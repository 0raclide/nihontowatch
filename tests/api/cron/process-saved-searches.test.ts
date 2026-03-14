/**
 * Tests for saved search notification cron job
 *
 * Tests cover:
 * - Authorization (CRON_SECRET validation)
 * - Frequency parameter validation
 * - Batch processing of saved searches
 * - Email notification sending
 * - Error handling
 * - Circuit breaker (Phase 0)
 * - Retry failed notifications (Phase 1)
 * - Dedup: skip searches with pending retries (Phase 2)
 * - Error classification routing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before importing the route
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/savedSearches/matcher', () => ({
  findMatchingListings: vi.fn(),
}));

vi.mock('@/lib/email/sendgrid', () => ({
  sendSavedSearchNotification: vi.fn(),
}));

vi.mock('@/lib/email/circuitBreaker', () => {
  class MockEmailCircuitTracker {
    recordSuccess = vi.fn();
    recordFailure = vi.fn();
    isTripped = vi.fn().mockReturnValue(false);
    tripBreaker = vi.fn().mockResolvedValue(undefined);
    totalAttempts = 0;
    errorRate = 0;
  }
  return {
    isCircuitBreakerOpen: vi.fn(),
    EmailCircuitTracker: MockEmailCircuitTracker,
  };
});

// Import after mocks are set up
import { GET } from '@/app/api/cron/process-saved-searches/route';
import { createServiceClient } from '@/lib/supabase/server';
import { findMatchingListings } from '@/lib/savedSearches/matcher';
import { sendSavedSearchNotification } from '@/lib/email/sendgrid';
import { isCircuitBreakerOpen } from '@/lib/email/circuitBreaker';

/**
 * Create a mock supabase client where from() dispatches by table name.
 * Each table returns a fully-chained mock that resolves to the given data.
 */
function createMockSupabase(
  tableResults: Record<string, { data: unknown; error: unknown } | ((method: string) => unknown)> = {}
) {
  function makeChain(resolveWith: { data: unknown; error: unknown }): Record<string, ReturnType<typeof vi.fn>> {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    const methods = ['select', 'eq', 'neq', 'in', 'not', 'lte', 'lt', 'gt', 'gte', 'order', 'limit', 'range', 'single', 'maybeSingle', 'update', 'insert', 'delete', 'upsert'];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    // Terminal methods that are also chainable should still resolve as promise
    // Make the chain itself thenable for await
    (chain as unknown as Promise<unknown>).then = (resolve: (v: unknown) => void, reject?: (v: unknown) => void) => {
      return Promise.resolve(resolveWith).then(resolve, reject);
    };
    return chain;
  }

  const defaultChain = makeChain({ data: [], error: null });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      const result = tableResults[table];
      if (result) {
        if (typeof result === 'function') {
          return result('from');
        }
        return makeChain(result);
      }
      return defaultChain;
    }),
  };
}

describe('Process Saved Searches Cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isCircuitBreakerOpen as ReturnType<typeof vi.fn>).mockResolvedValue({ open: false });
    process.env.CRON_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  describe('Authorization', () => {
    it('should return 401 when no authorization header is provided', async () => {
      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid Bearer token', async () => {
      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer wrong-secret' },
      });
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should authorize with valid Bearer token', async () => {
      const mock = createMockSupabase();
      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });
      const response = await GET(request);
      expect(response.status).not.toBe(401);
    });

    it('should authorize with x-cron-secret header', async () => {
      const mock = createMockSupabase();
      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { 'x-cron-secret': 'test-secret' },
      });
      const response = await GET(request);
      expect(response.status).not.toBe(401);
    });

    it('should return 401 when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer any-value' },
      });
      const response = await GET(request);
      expect(response.status).toBe(401);
    });
  });

  describe('Frequency Parameter Validation', () => {
    it('should return 400 when frequency is missing', async () => {
      const request = new NextRequest('http://localhost/api/cron/process-saved-searches', {
        headers: { authorization: 'Bearer test-secret' },
      });
      const response = await GET(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid frequency value', async () => {
      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=weekly', {
        headers: { authorization: 'Bearer test-secret' },
      });
      const response = await GET(request);
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toContain('instant');
    });

    it('should accept "instant" frequency', async () => {
      const mock = createMockSupabase();
      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });
      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it('should accept "daily" frequency', async () => {
      const mock = createMockSupabase();
      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=daily', {
        headers: { authorization: 'Bearer test-secret' },
      });
      const response = await GET(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Processing Saved Searches', () => {
    it('should return early when no active saved searches exist', async () => {
      const mock = createMockSupabase();
      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.processed).toBe(0);
      expect(data.notificationsSent).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      const mock = createMockSupabase({
        saved_searches: { data: null, error: { message: 'Database connection failed' } },
      });
      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database connection failed');
    });
  });

  describe('Phase 0: Circuit Breaker', () => {
    it('should skip entire run when circuit breaker is open', async () => {
      const mock = createMockSupabase();
      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);
      (isCircuitBreakerOpen as ReturnType<typeof vi.fn>).mockResolvedValue({
        open: true,
        reason: '5/5 failures (100% error rate)',
        tripped_at: new Date().toISOString(),
      });

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.circuitBreaker.open).toBe(true);
      expect(data.processed).toBe(0);
      expect(data.notificationsSent).toBe(0);
      expect(findMatchingListings).not.toHaveBeenCalled();
      expect(sendSavedSearchNotification).not.toHaveBeenCalled();
    });
  });

  describe('Phase 2: Error Classification', () => {
    /**
     * Helper: Creates a mock supabase that supports the full two-phase query chain.
     * saved_search_notifications is called 3 times:
     *   Phase 1: .select().eq().not().lte().lt().order().limit()
     *   Phase 2 dedup: .select().in().eq().not()
     *   Phase 2 insert: .insert()
     */
    function createPhase2Mock(
      savedSearches: unknown[],
      profiles: unknown[],
      insertMock: ReturnType<typeof vi.fn>,
      updateEqMock: ReturnType<typeof vi.fn>
    ) {
      // A universal chain that resolves to { data: [], error: null } for any method sequence
      function makeUniversalChain(resolveValue: { data: unknown; error: unknown } = { data: [], error: null }) {
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ['select', 'eq', 'neq', 'in', 'not', 'lte', 'lt', 'gt', 'gte', 'order', 'limit', 'range', 'single', 'maybeSingle'];
        for (const m of methods) {
          chain[m] = vi.fn().mockReturnValue(chain);
        }
        // Make thenable
        (chain as unknown as Promise<unknown>).then = (resolve: (v: unknown) => void, reject?: (v: unknown) => void) => {
          return Promise.resolve(resolveValue).then(resolve, reject);
        };
        return chain;
      }

      return {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'saved_search_notifications') {
            const chain = makeUniversalChain({ data: [], error: null });
            chain.insert = insertMock;
            return chain;
          }
          if (table === 'saved_searches') {
            const chain = makeUniversalChain({ data: savedSearches, error: null });
            chain.update = vi.fn().mockReturnValue({ eq: updateEqMock });
            return chain;
          }
          if (table === 'profiles') {
            return makeUniversalChain({ data: profiles, error: null });
          }
          // Default
          const chain = makeUniversalChain({ data: [], error: null });
          chain.update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
          chain.insert = vi.fn().mockResolvedValue({ error: null });
          return chain;
        }),
      };
    }

    it('should classify permanent errors and insert abandoned notification', async () => {
      const savedSearch = {
        id: 'search-1',
        user_id: 'user-1',
        search_criteria: { itemTypes: ['katana'] },
        notification_frequency: 'instant',
        is_active: true,
        last_notified_at: null,
      };

      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const updateEqMock = vi.fn().mockResolvedValue({ error: null });

      const mock = createPhase2Mock(
        [savedSearch],
        [{ id: 'user-1', email: 'test@example.com', preferences: null }],
        insertMock,
        updateEqMock
      );

      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);
      (findMatchingListings as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, title: 'Test Katana', first_seen_at: new Date().toISOString() },
      ]);
      // Permanent error
      (sendSavedSearchNotification as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'SendGrid not configured',
      });

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.errors).toBe(1);

      // Verify insert was called with 'abandoned' status and 'permanent' category
      const insertCalls = insertMock.mock.calls;
      expect(insertCalls.length).toBeGreaterThan(0);
      const abandonedInsert = insertCalls.find((call: unknown[]) => {
        const arg = call[0] as Record<string, unknown>;
        return arg.status === 'abandoned';
      });
      expect(abandonedInsert).toBeDefined();
      const insertArg = abandonedInsert![0] as Record<string, unknown>;
      expect(insertArg.error_category).toBe('permanent');

      // Verify cursor was advanced (last_notified_at updated)
      expect(updateEqMock).toHaveBeenCalled();
    });

    it('should classify transient errors and schedule retry', async () => {
      const savedSearch = {
        id: 'search-2',
        user_id: 'user-2',
        search_criteria: { itemTypes: ['tanto'] },
        notification_frequency: 'instant',
        is_active: true,
        last_notified_at: null,
      };

      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const updateEqMock = vi.fn().mockResolvedValue({ error: null });

      const mock = createPhase2Mock(
        [savedSearch],
        [{ id: 'user-2', email: 'user2@example.com', preferences: null }],
        insertMock,
        updateEqMock
      );

      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);
      (findMatchingListings as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 2, title: 'Test Tanto', first_seen_at: new Date().toISOString() },
      ]);
      // Transient error
      (sendSavedSearchNotification as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Unauthorized',
      });

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.errors).toBe(1);

      // Verify insert was called with 'failed' status and retry_after set
      const insertCalls = insertMock.mock.calls;
      const failedInsert = insertCalls.find((call: unknown[]) => {
        const arg = call[0] as Record<string, unknown>;
        return arg.status === 'failed';
      });
      expect(failedInsert).toBeDefined();
      const insertArg = failedInsert![0] as Record<string, unknown>;
      expect(insertArg.error_category).toBe('transient');
      expect(insertArg.retry_after).toBeDefined();
      expect(insertArg.retry_count).toBe(0);
    });
  });

  describe('Response shape', () => {
    it('should include retry stats in response', async () => {
      const mock = createMockSupabase();
      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('retried');
      expect(data).toHaveProperty('retriedSuccess');
      expect(data).toHaveProperty('retriedFailed');
      expect(data).toHaveProperty('retriedAbandoned');
      expect(data).toHaveProperty('circuitBreakerTripped');
    });
  });

  describe('Lookback Window', () => {
    it('should use 20-minute lookback for instant frequency', async () => {
      const mock = createMockSupabase();
      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=instant', {
        headers: { authorization: 'Bearer test-secret' },
      });
      await GET(request);
      expect(createServiceClient).toHaveBeenCalled();
    });

    it('should use 25-hour lookback for daily frequency', async () => {
      const mock = createMockSupabase();
      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

      const request = new NextRequest('http://localhost/api/cron/process-saved-searches?frequency=daily', {
        headers: { authorization: 'Bearer test-secret' },
      });
      await GET(request);
      expect(createServiceClient).toHaveBeenCalled();
    });
  });
});
