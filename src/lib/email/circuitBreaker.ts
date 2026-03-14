/**
 * Circuit breaker for email sending.
 *
 * Persists state in the `system_state` table so it survives across
 * Vercel serverless invocations. Follows the stale-refresh pattern:
 * - MIN_ATTEMPTS before the breaker can trip
 * - ERROR_RATE threshold (80%)
 * - COOLDOWN_MS before the breaker auto-resets (30 min)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const SYSTEM_STATE_KEY = 'email_circuit_breaker';
const MIN_ATTEMPTS = 3;
const ERROR_RATE_THRESHOLD = 0.8;
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export interface CircuitBreakerState {
  open: boolean;
  tripped_at?: string;
  reason?: string;
  error_count?: number;
  total_count?: number;
}

/**
 * Check whether the circuit breaker is currently open (email sending blocked).
 * Reads from system_state table. Returns closed if key doesn't exist or has expired.
 */
export async function isCircuitBreakerOpen(
  supabase: SupabaseClient
): Promise<CircuitBreakerState> {
  try {
    const { data, error } = await supabase
      .from('system_state')
      .select('value, updated_at')
      .eq('key', SYSTEM_STATE_KEY)
      .maybeSingle();

    if (error || !data) {
      return { open: false };
    }

    let state: CircuitBreakerState;
    try {
      state = JSON.parse(data.value);
    } catch {
      // Corrupted state — treat as closed and clean up
      await supabase.from('system_state').delete().eq('key', SYSTEM_STATE_KEY);
      return { open: false };
    }

    if (!state.open) {
      return { open: false };
    }

    // Check if cooldown has elapsed
    if (state.tripped_at) {
      const trippedAt = new Date(state.tripped_at).getTime();
      if (Date.now() - trippedAt > COOLDOWN_MS) {
        // Cooldown expired — clear the breaker
        await supabase.from('system_state').delete().eq('key', SYSTEM_STATE_KEY);
        return { open: false };
      }
    }

    return state;
  } catch {
    // If we can't read state, fail open (allow sending)
    return { open: false };
  }
}

/**
 * In-memory tracker for the current cron run.
 * Call recordSuccess/recordFailure for each send attempt.
 * After the run (or mid-run), check isTripped() to see if the breaker should open.
 */
export class EmailCircuitTracker {
  private successes = 0;
  private failures = 0;

  recordSuccess(): void {
    this.successes++;
  }

  recordFailure(): void {
    this.failures++;
  }

  get totalAttempts(): number {
    return this.successes + this.failures;
  }

  get errorRate(): number {
    if (this.totalAttempts === 0) return 0;
    return this.failures / this.totalAttempts;
  }

  /**
   * Whether the breaker should trip based on accumulated data.
   */
  isTripped(): boolean {
    return this.totalAttempts >= MIN_ATTEMPTS && this.errorRate >= ERROR_RATE_THRESHOLD;
  }

  /**
   * Persist the tripped state to system_state so subsequent cron runs see it.
   */
  async tripBreaker(supabase: SupabaseClient): Promise<void> {
    const state: CircuitBreakerState = {
      open: true,
      tripped_at: new Date().toISOString(),
      reason: `${this.failures}/${this.totalAttempts} failures (${Math.round(this.errorRate * 100)}% error rate)`,
      error_count: this.failures,
      total_count: this.totalAttempts,
    };

    await supabase
      .from('system_state')
      .upsert({ key: SYSTEM_STATE_KEY, value: JSON.stringify(state) } as never);
  }
}

// Exported for tests
export { SYSTEM_STATE_KEY, MIN_ATTEMPTS, ERROR_RATE_THRESHOLD, COOLDOWN_MS };
