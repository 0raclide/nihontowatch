import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isCircuitBreakerOpen,
  EmailCircuitTracker,
  SYSTEM_STATE_KEY,
  COOLDOWN_MS,
} from '@/lib/email/circuitBreaker';

describe('circuitBreaker', () => {
  describe('isCircuitBreakerOpen', () => {
    function createMockSupabase(data: { value: string; updated_at: string } | null, error: unknown = null) {
      return {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data, error }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      } as unknown as Parameters<typeof isCircuitBreakerOpen>[0];
    }

    it('should return closed when key does not exist', async () => {
      const supabase = createMockSupabase(null);
      const result = await isCircuitBreakerOpen(supabase);
      expect(result.open).toBe(false);
    });

    it('should return closed when DB query errors', async () => {
      const supabase = createMockSupabase(null, { message: 'DB error' });
      const result = await isCircuitBreakerOpen(supabase);
      expect(result.open).toBe(false);
    });

    it('should return open when breaker is tripped and within cooldown', async () => {
      const state = {
        open: true,
        tripped_at: new Date().toISOString(),
        reason: '3/3 failures',
      };
      const supabase = createMockSupabase({
        value: JSON.stringify(state),
        updated_at: new Date().toISOString(),
      });

      const result = await isCircuitBreakerOpen(supabase);
      expect(result.open).toBe(true);
      expect(result.reason).toBe('3/3 failures');
    });

    it('should return closed when cooldown has expired', async () => {
      const trippedAt = new Date(Date.now() - COOLDOWN_MS - 1000).toISOString();
      const state = {
        open: true,
        tripped_at: trippedAt,
        reason: '3/3 failures',
      };
      const supabase = createMockSupabase({
        value: JSON.stringify(state),
        updated_at: trippedAt,
      });

      const result = await isCircuitBreakerOpen(supabase);
      expect(result.open).toBe(false);
    });

    it('should handle corrupted JSON gracefully', async () => {
      const supabase = createMockSupabase({
        value: 'not valid json{{{',
        updated_at: new Date().toISOString(),
      });

      const result = await isCircuitBreakerOpen(supabase);
      expect(result.open).toBe(false);
    });

    it('should return closed when state has open=false', async () => {
      const state = { open: false };
      const supabase = createMockSupabase({
        value: JSON.stringify(state),
        updated_at: new Date().toISOString(),
      });

      const result = await isCircuitBreakerOpen(supabase);
      expect(result.open).toBe(false);
    });
  });

  describe('EmailCircuitTracker', () => {
    it('should start with 0 attempts', () => {
      const tracker = new EmailCircuitTracker();
      expect(tracker.totalAttempts).toBe(0);
      expect(tracker.errorRate).toBe(0);
      expect(tracker.isTripped()).toBe(false);
    });

    it('should not trip below MIN_ATTEMPTS (3)', () => {
      const tracker = new EmailCircuitTracker();
      tracker.recordFailure();
      tracker.recordFailure();
      // 2 failures, 2 total — 100% error rate but only 2 attempts
      expect(tracker.totalAttempts).toBe(2);
      expect(tracker.isTripped()).toBe(false);
    });

    it('should trip at >=80% failure rate after >=3 attempts', () => {
      const tracker = new EmailCircuitTracker();
      tracker.recordFailure();
      tracker.recordFailure();
      tracker.recordFailure();
      // 3 failures, 3 total — 100% error rate, 3 attempts
      expect(tracker.isTripped()).toBe(true);
    });

    it('should not trip below 80% error rate', () => {
      const tracker = new EmailCircuitTracker();
      tracker.recordSuccess();
      tracker.recordSuccess();
      tracker.recordFailure();
      // 1 failure, 3 total — 33% error rate
      expect(tracker.totalAttempts).toBe(3);
      expect(tracker.isTripped()).toBe(false);
    });

    it('should trip at exactly 80% error rate', () => {
      const tracker = new EmailCircuitTracker();
      tracker.recordSuccess();
      tracker.recordFailure();
      tracker.recordFailure();
      tracker.recordFailure();
      tracker.recordFailure();
      // 4/5 = 80%
      expect(tracker.errorRate).toBe(0.8);
      expect(tracker.isTripped()).toBe(true);
    });

    it('should not trip at 79% error rate', () => {
      const tracker = new EmailCircuitTracker();
      // Need to get just below 80%. 3 failures out of 4 = 75%
      tracker.recordSuccess();
      tracker.recordFailure();
      tracker.recordFailure();
      tracker.recordFailure();
      // 3/4 = 75%
      expect(tracker.errorRate).toBe(0.75);
      expect(tracker.isTripped()).toBe(false);
    });

    it('should persist state via tripBreaker', async () => {
      const tracker = new EmailCircuitTracker();
      tracker.recordFailure();
      tracker.recordFailure();
      tracker.recordFailure();

      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          upsert: upsertMock,
        }),
      } as unknown as Parameters<typeof isCircuitBreakerOpen>[0];

      await tracker.tripBreaker(mockSupabase);

      expect(upsertMock).toHaveBeenCalledOnce();
      const call = upsertMock.mock.calls[0][0];
      expect(call.key).toBe(SYSTEM_STATE_KEY);

      const persisted = JSON.parse(call.value);
      expect(persisted.open).toBe(true);
      expect(persisted.error_count).toBe(3);
      expect(persisted.total_count).toBe(3);
      expect(persisted.tripped_at).toBeDefined();
    });
  });
});
