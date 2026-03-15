# Session: Notification Retry System with Circuit Breaker

**Date:** 2026-03-14
**Commit:** `de91903b` — feat: notification retry system with circuit breaker and exponential backoff
**Migration:** 157 — `saved_search_notifications` retry columns + partial index

---

## Problem

When SendGrid goes down (e.g., the Mar 11 incident), the saved search cron creates a **new `failed` notification row for every search on every run**. With 15-minute cron intervals, a 4-hour outage produces 15+ duplicate failure rows per search. Users receive no notifications, and when service recovers, the matched listings have already moved past the `last_notified_at` cursor — they're silently lost.

**Three compounding issues:**
1. **No retry** — failed notifications are written once and abandoned
2. **Duplicate failures** — each cron run re-matches and re-fails the same listings
3. **No circuit breaker** — cron keeps hammering a known-down service

---

## Solution: Two-Phase Cron with Circuit Breaker

The cron (`/api/cron/process-saved-searches`) was restructured into a three-phase pipeline:

### Phase 0: Circuit Breaker Check

Before any work, check `system_state` table for an active circuit breaker. If open and cooldown (30 min) hasn't elapsed, skip the entire run. Returns immediately with circuit breaker status.

### Phase 1: Retry Failed Notifications

Picks up `failed` notifications whose `retry_after` timestamp has elapsed (cap: 50 per run). For each:

1. Re-fetch the saved search and user profile
2. Re-fetch the matched listings by ID (may have sold since original failure)
3. Re-send the email
4. **Success** → mark `sent`, advance `last_notified_at` cursor
5. **Failure** → classify error, increment `retry_count`, compute next backoff
6. **Max retries (5) or permanent error** → mark `abandoned`, advance cursor

Edge cases handled:
- Saved search deleted since failure → abandon
- No email for user → abandon (permanent)
- All matched listings no longer available → abandon, advance cursor
- Circuit breaker trips mid-phase → stop retrying, persist breaker state

### Phase 2: Process New Matches (Enhanced)

The existing matching logic, now with:

- **Dedup** — skip searches that already have a pending retry (`status='failed' AND retry_after IS NOT NULL`). Prevents duplicate failure rows.
- **Error classification** — on failure, categorize as `transient` or `permanent`
- **Transient errors** → insert with `status='failed'`, `retry_after` set, DO NOT advance `last_notified_at` (retry will handle it)
- **Permanent errors** → insert as `abandoned`, advance cursor immediately
- **Circuit breaker check** — mid-batch abort if breaker trips

---

## Components

### Error Classifier (`src/lib/email/errorClassifier.ts`)

Pattern-based classification of email error messages:

| Category | Patterns | Behavior |
|----------|----------|----------|
| **permanent** | `invalid email`, `does not exist`, `suppression`, `unsubscribed`, `bounced`, `blocked`, `spam`, `sendgrid not configured` | Abandon immediately, never retry |
| **transient** | Everything else (rate limits, auth failures, network errors, budget exhaustion) | Retry with exponential backoff |

Unknown errors default to `transient` (safe to retry).

### Retry Policy (`src/lib/email/retryPolicy.ts`)

Exponential backoff aligned to 15-minute cron boundaries:

| Retry # | Delay | Cumulative |
|---------|-------|------------|
| 0 | 15 min | 15 min |
| 1 | 30 min | 45 min |
| 2 | 1 hour | 1h 45m |
| 3 | 2 hours | 3h 45m |
| 4 | 4 hours | 7h 45m |
| 5 | — | Abandon |

`MAX_RETRY_COUNT = 5`. After 5 attempts, notification is marked `abandoned` and the cursor advances.

### Circuit Breaker (`src/lib/email/circuitBreaker.ts`)

Two-layer design:

1. **`EmailCircuitTracker`** (in-memory) — tracks send attempts within a single cron run. `recordSuccess()` / `recordFailure()` per send. `isTripped()` returns true when `totalAttempts >= 3 AND errorRate >= 80%`.

2. **`system_state` table** (persistent) — when the tracker trips, it writes state to `system_state` with key `email_circuit_breaker`. Subsequent cron invocations (separate Vercel serverless instances) read this state in Phase 0.

**Cooldown:** 30 minutes. After cooldown, the breaker auto-clears (row deleted on next read).

**Fail-open:** If `system_state` can't be read (DB error), the breaker defaults to closed (allow sending).

### Migration 157

```sql
-- New columns on saved_search_notifications
retry_count    INT NOT NULL DEFAULT 0
retry_after    TIMESTAMPTZ
error_category TEXT  -- CHECK: NULL | 'transient' | 'permanent'

-- Status CHECK expanded
CHECK (status IN ('pending', 'sent', 'failed', 'abandoned'))

-- Partial index for Phase 1 queries
idx_notifications_retryable ON (status, retry_after)
  WHERE status = 'failed' AND retry_after IS NOT NULL
```

All columns have defaults — safe to apply on a live database with existing rows.

---

## Admin UI Changes (`/admin/alerts`)

| Element | Before | After |
|---------|--------|-------|
| `failed` status pill | Red, "Failed" | Orange, "Retrying" |
| `abandoned` status pill | — (didn't exist) | Red, "Abandoned" |
| Circuit breaker banner | — | Amber warning bar when breaker is open, shows reason + tripped time + "auto-resets after 30 minutes" |
| History records | Status + error only | Status + retry count (`Retry 2/5`) + next retry time |

The admin stats API (`/api/admin/stats`) also returns circuit breaker state for the alerts page.

---

## Type Changes

```typescript
// src/types/database.ts — SavedSearchNotificationRow
retry_count: number;      // DEFAULT 0
retry_after: string | null;
error_category: 'transient' | 'permanent' | null;

// src/types/index.ts — NotificationStatus
type NotificationStatus = 'pending' | 'sent' | 'failed' | 'abandoned';
```

---

## Dealer Source Guard

The cron uses `createServiceClient()` (service role key) and re-fetches listings by ID for retries. Added to `KNOWN_SAFE_FILES` in the dealer source guard test to prevent false positives.

---

## Test Coverage

| File | Tests | Coverage |
|------|-------|----------|
| `tests/lib/email/errorClassifier.test.ts` | 14 | All permanent patterns, transient defaults, case insensitivity |
| `tests/lib/email/retryPolicy.test.ts` | 12 | Backoff schedule, max retry boundary, `shouldAbandon()` |
| `tests/lib/email/circuitBreaker.test.ts` | 13 | `EmailCircuitTracker` (trip/no-trip/reset), `isCircuitBreakerOpen` (cooldown, corrupted state, missing key, fail-open) |
| `tests/api/cron/process-saved-searches.test.ts` | 18 | Phase 0 (breaker blocks run), Phase 1 (retry success/failure/abandon/deleted search), Phase 2 (dedup, permanent vs transient, cursor behavior), + 19 existing template tests |

**Total: 57 new tests** (+ existing 19 saved-search template tests in same file).

---

## Key Design Decisions

1. **Dedup over idempotency** — Phase 2 skips searches with pending retries rather than trying to make re-inserts idempotent. Simpler and avoids edge cases around changing match sets.

2. **Cursor advance on abandon** — When a notification is permanently failed or exhausts retries, `last_notified_at` advances so the same listings aren't re-matched next run. This means the user misses those specific listings, but avoids infinite retry loops.

3. **In-memory + persistent breaker** — The tracker accumulates within a run (fast, no DB round-trips per check), then persists once if tripped. Subsequent serverless invocations read the persisted state. This handles Vercel's serverless isolation (no shared memory between invocations).

4. **Fail-open on DB errors** — If `system_state` is unreachable, we'd rather attempt sending (might work) than silently skip all notifications.

5. **Re-fetch listings on retry** — Don't cache the original listing data. Items may have sold or been updated since the failure. Filter to `is_available = true` so users don't get notified about items that sold during the retry window.

---

## File Index

| Component | Location |
|-----------|----------|
| Cron (3-phase) | `src/app/api/cron/process-saved-searches/route.ts` |
| Error classifier | `src/lib/email/errorClassifier.ts` |
| Retry policy | `src/lib/email/retryPolicy.ts` |
| Circuit breaker | `src/lib/email/circuitBreaker.ts` |
| Admin alerts UI | `src/app/admin/alerts/page.tsx` |
| Admin stats API | `src/app/api/admin/stats/route.ts` |
| DB types | `src/types/database.ts`, `src/types/index.ts` |
| Migration | `supabase/migrations/157_notification_retry_system.sql` |
| Tests (57) | `tests/lib/email/errorClassifier.test.ts`, `tests/lib/email/retryPolicy.test.ts`, `tests/lib/email/circuitBreaker.test.ts`, `tests/api/cron/process-saved-searches.test.ts` |
| Dealer source guard | `tests/lib/dealer-source-guard.test.ts` (updated allowlist) |
