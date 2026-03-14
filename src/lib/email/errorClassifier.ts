/**
 * Classifies email delivery errors as transient (retryable) or permanent (abandon).
 *
 * - permanent: per-recipient issues that won't self-heal (invalid address, suppressed, etc.)
 * - transient: everything else (auth failures, rate limits, network errors, budget exhaustion)
 *
 * The circuit breaker handles the "everything is failing" case for transient errors.
 */

const PERMANENT_PATTERNS = [
  'invalid email',
  'does not exist',
  'suppression',
  'unsubscribed',
  'sendgrid not configured',
  'bounced',
  'blocked',
  'spam',
];

export type ErrorCategory = 'transient' | 'permanent';

/**
 * Classify an email error message as transient or permanent.
 * Unknown errors default to transient (safe to retry).
 */
export function classifyEmailError(errorMessage: string): ErrorCategory {
  const lower = errorMessage.toLowerCase();
  for (const pattern of PERMANENT_PATTERNS) {
    if (lower.includes(pattern)) {
      return 'permanent';
    }
  }
  return 'transient';
}
