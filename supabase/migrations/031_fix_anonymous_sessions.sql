-- =============================================================================
-- Migration 031: Fix Anonymous Sessions
-- =============================================================================
--
-- Problem: The user_sessions table requires user_id (NOT NULL) which prevents
-- anonymous session tracking. Activity events are recorded but sessions aren't.
--
-- Changes:
-- 1. Allow NULL user_id for anonymous sessions
-- 2. Add RLS policy for anonymous session inserts (via service role)
-- 3. Drop the foreign key constraint that requires profiles reference
-- =============================================================================

-- 1. Drop the existing foreign key constraint
ALTER TABLE user_sessions
  DROP CONSTRAINT IF EXISTS user_sessions_user_id_fkey;

-- 2. Allow NULL user_id for anonymous sessions
ALTER TABLE user_sessions
  ALTER COLUMN user_id DROP NOT NULL;

-- 3. Re-add foreign key with ON DELETE SET NULL (optional - keeps data if user deleted)
ALTER TABLE user_sessions
  ADD CONSTRAINT user_sessions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- 4. Add index for queries filtering by user_id IS NULL (anonymous sessions)
CREATE INDEX IF NOT EXISTS idx_user_sessions_anonymous
  ON user_sessions(session_id)
  WHERE user_id IS NULL;

-- =============================================================================
-- Verification
-- =============================================================================
-- After running this migration, verify with:
--
-- -- Check column allows NULL:
-- SELECT column_name, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'user_sessions' AND column_name = 'user_id';
--
-- -- Should return: user_id | YES
-- =============================================================================
