-- =============================================================================
-- LAST VISIT TRACKING
-- Migration: 043_add_last_visit_at.sql
-- Description: Adds last_visit_at field to profiles for "New Since Last Visit" feature
-- =============================================================================

-- Add column to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;

-- Index for efficient queries when calculating new items since last visit
-- Partial index only on non-null values for efficiency
CREATE INDEX IF NOT EXISTS idx_profiles_last_visit_at
  ON profiles(last_visit_at)
  WHERE last_visit_at IS NOT NULL;

COMMENT ON COLUMN profiles.last_visit_at IS 'Timestamp of user''s last visit to the browse page, used for "New Since Last Visit" banner';

-- RLS: Users can already SELECT/UPDATE their own profile via existing policies in 009_user_accounts.sql
-- No additional RLS policies needed
