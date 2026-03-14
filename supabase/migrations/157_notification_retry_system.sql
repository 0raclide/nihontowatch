-- Notification retry system: adds retry tracking and circuit breaker support
-- to saved_search_notifications for exponential backoff on transient failures.

-- 1. Add retry columns
ALTER TABLE saved_search_notifications
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_category TEXT;

-- 2. Expand status CHECK to include 'abandoned'
-- Drop existing constraint first (name may vary — use pg_constraint lookup)
DO $$
DECLARE
  _con_name TEXT;
BEGIN
  SELECT c.conname INTO _con_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'saved_search_notifications'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status%'
  LIMIT 1;

  IF _con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE saved_search_notifications DROP CONSTRAINT %I', _con_name);
  END IF;
END $$;

ALTER TABLE saved_search_notifications
  ADD CONSTRAINT saved_search_notifications_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'abandoned'));

-- 3. Add CHECK on error_category
ALTER TABLE saved_search_notifications
  ADD CONSTRAINT saved_search_notifications_error_category_check
  CHECK (error_category IS NULL OR error_category IN ('transient', 'permanent'));

-- 4. Index for Phase 1 retry queries:
--    "find failed notifications whose retry_after has elapsed"
CREATE INDEX IF NOT EXISTS idx_notifications_retryable
  ON saved_search_notifications (status, retry_after)
  WHERE status = 'failed' AND retry_after IS NOT NULL;
