-- =============================================================================
-- CREATE MISSING PROFILE FOR kabe@kabe.sk
-- Migration: 159_create_profile_kabe.sql
-- Description: The handle_new_user() trigger failed to create this user's
--              profile row on signup. Creates the profile and sets inner_circle tier.
-- =============================================================================

-- Insert profile if missing (using auth.users id), set as inner_circle
INSERT INTO profiles (id, email, display_name, subscription_tier, created_at, updated_at)
SELECT
  u.id,
  u.email,
  split_part(u.email, '@', 1),  -- 'kabe'
  'inner_circle',
  COALESCE(u.created_at, NOW()),
  NOW()
FROM auth.users u
WHERE u.email = 'kabe@kabe.sk'
ON CONFLICT (id) DO UPDATE SET
  subscription_tier = 'inner_circle',
  updated_at = NOW();
