-- =============================================================================
-- FIX RLS POLICY RECURSION
-- Migration: 014_fix_rls_recursion.sql
-- Description: Fixes infinite recursion in RLS policies caused by admin checks
--              querying the profiles table within profiles RLS policies.
-- =============================================================================

-- The problem: profiles_select_admin policy queries the profiles table to check
-- if the user is admin, but that query itself triggers RLS checks, causing
-- infinite recursion and 500 errors.

-- The fix: Use the is_admin() SECURITY DEFINER function which bypasses RLS.

-- =============================================================================
-- DROP PROBLEMATIC POLICIES
-- =============================================================================

DROP POLICY IF EXISTS profiles_select_admin ON profiles;
DROP POLICY IF EXISTS user_favorites_select_admin ON user_favorites;
DROP POLICY IF EXISTS user_alerts_select_admin ON user_alerts;
DROP POLICY IF EXISTS user_activity_select_admin ON user_activity;
DROP POLICY IF EXISTS user_sessions_select_admin ON user_sessions;
DROP POLICY IF EXISTS alert_history_select_admin ON alert_history;

-- =============================================================================
-- RECREATE is_admin() FUNCTION WITH STABLE MARKER
-- =============================================================================

-- Recreate the function to ensure it's properly set up
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- RECREATE ADMIN POLICIES USING is_admin() FUNCTION
-- =============================================================================

-- Profiles: Admins can read all profiles
CREATE POLICY profiles_select_admin ON profiles
    FOR SELECT
    USING (is_admin());

-- User favorites: Admins can read all favorites
CREATE POLICY user_favorites_select_admin ON user_favorites
    FOR SELECT
    USING (is_admin());

-- User alerts: Admins can read all alerts
CREATE POLICY user_alerts_select_admin ON user_alerts
    FOR SELECT
    USING (is_admin());

-- User activity: Admins can read all activity
CREATE POLICY user_activity_select_admin ON user_activity
    FOR SELECT
    USING (is_admin());

-- User sessions: Admins can read all sessions
CREATE POLICY user_sessions_select_admin ON user_sessions
    FOR SELECT
    USING (is_admin());

-- Alert history: Admins can read all alert history
CREATE POLICY alert_history_select_admin ON alert_history
    FOR SELECT
    USING (is_admin());

-- =============================================================================
-- VERIFY
-- =============================================================================

-- After this migration, the RLS policies will use the SECURITY DEFINER function
-- is_admin() which bypasses RLS when checking admin status, preventing recursion.
