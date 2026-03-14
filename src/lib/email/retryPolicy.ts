/**
 * Retry policy for email notification failures.
 *
 * Backoff schedule aligned to 15-min cron boundaries:
 *   Retry 0 → 15m, Retry 1 → 30m, Retry 2 → 1h, Retry 3 → 2h, Retry 4 → 4h
 *   Retry 5 → abandon (null)
 */

export const MAX_RETRY_COUNT = 5;

/** Backoff delays in milliseconds, indexed by retry count */
const BACKOFF_MS: number[] = [
  15 * 60 * 1000,   // 15 minutes
  30 * 60 * 1000,   // 30 minutes
  60 * 60 * 1000,   // 1 hour
  120 * 60 * 1000,  // 2 hours
  240 * 60 * 1000,  // 4 hours
];

/**
 * Returns the next retry_after timestamp, or null if max retries exceeded.
 */
export function getNextRetryAfter(retryCount: number): Date | null {
  if (retryCount >= MAX_RETRY_COUNT) {
    return null;
  }
  const delayMs = BACKOFF_MS[retryCount] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
  return new Date(Date.now() + delayMs);
}

/**
 * Whether this notification should be abandoned (no more retries).
 */
export function shouldAbandon(retryCount: number): boolean {
  return retryCount >= MAX_RETRY_COUNT;
}
