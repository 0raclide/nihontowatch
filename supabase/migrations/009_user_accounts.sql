-- =============================================================================
-- USER ACCOUNTS SYSTEM
-- Migration: 009_user_accounts.sql
-- Description: Creates user profiles, favorites, alerts, activity tracking,
--              sessions, and alert history tables with RLS policies.
-- =============================================================================

-- =============================================================================
-- 1. PROFILES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

COMMENT ON TABLE profiles IS 'User profile information extending Supabase auth.users';
COMMENT ON COLUMN profiles.preferences IS 'User preferences JSON: { currency: "JPY"|"USD"|"EUR", theme: "light"|"dark", notifications: {...} }';

-- =============================================================================
-- 2. USER FAVORITES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, listing_id)
);

-- Index for user's favorites
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);

-- Index for listing's favorited count
CREATE INDEX IF NOT EXISTS idx_user_favorites_listing_id ON user_favorites(listing_id);

COMMENT ON TABLE user_favorites IS 'User favorited/saved listings';

-- =============================================================================
-- 3. USER ALERTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'new_listing', 'back_in_stock')),
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    target_price NUMERIC,
    search_criteria JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user's alerts
CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id ON user_alerts(user_id);

-- Index for active alerts processing
CREATE INDEX IF NOT EXISTS idx_user_alerts_active ON user_alerts(is_active) WHERE is_active = TRUE;

-- Index for listing-specific alerts
CREATE INDEX IF NOT EXISTS idx_user_alerts_listing_id ON user_alerts(listing_id);

-- Index for alert type filtering
CREATE INDEX IF NOT EXISTS idx_user_alerts_type ON user_alerts(alert_type);

COMMENT ON TABLE user_alerts IS 'User price and availability alerts';
COMMENT ON COLUMN user_alerts.search_criteria IS 'For new_listing alerts: { type: [], dealer: [], certification: [], minPrice: N, maxPrice: N, ... }';

-- =============================================================================
-- 4. USER ACTIVITY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'page_view',
        'listing_view',
        'search',
        'filter_change',
        'favorite_add',
        'favorite_remove',
        'alert_create',
        'alert_delete',
        'session_start',
        'session_end',
        'external_link_click'
    )),
    page_path TEXT,
    listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user activity lookups
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at);

-- Index for session-based queries
CREATE INDEX IF NOT EXISTS idx_user_activity_session_id ON user_activity(session_id);

-- Composite index for user + time range queries
CREATE INDEX IF NOT EXISTS idx_user_activity_user_time ON user_activity(user_id, created_at DESC);

COMMENT ON TABLE user_activity IS 'User activity tracking for analytics and personalization';
COMMENT ON COLUMN user_activity.metadata IS 'Additional context: search query, filter values, referrer, etc.';

-- =============================================================================
-- 5. USER SESSIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL UNIQUE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_duration_ms INTEGER,
    page_views INTEGER NOT NULL DEFAULT 0,
    device_info JSONB DEFAULT '{}'
);

-- Index for user's sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);

-- Index for active sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity_at);

COMMENT ON TABLE user_sessions IS 'User session tracking for analytics';
COMMENT ON COLUMN user_sessions.device_info IS 'Device info: { userAgent, browser, os, device, screen: { width, height } }';

-- =============================================================================
-- 6. ALERT HISTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES user_alerts(id) ON DELETE CASCADE,
    listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    email_sent BOOLEAN NOT NULL DEFAULT FALSE,
    email_sent_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Index for alert's history
CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON alert_history(alert_id);

-- Index for listing history
CREATE INDEX IF NOT EXISTS idx_alert_history_listing_id ON alert_history(listing_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at ON alert_history(triggered_at);

COMMENT ON TABLE alert_history IS 'History of triggered alerts and email notifications';
COMMENT ON COLUMN alert_history.metadata IS 'Alert context: { old_price, new_price, price_change_pct, matched_criteria, ... }';

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        NOW(),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid duplicates
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profiles_updated ON profiles;

CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES: profiles
-- =============================================================================

-- Users can read their own profile
CREATE POLICY profiles_select_own ON profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY profiles_update_own ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY profiles_select_admin ON profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================================================
-- RLS POLICIES: user_favorites
-- =============================================================================

-- Users can read their own favorites
CREATE POLICY user_favorites_select_own ON user_favorites
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY user_favorites_insert_own ON user_favorites
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY user_favorites_delete_own ON user_favorites
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admins can read all favorites
CREATE POLICY user_favorites_select_admin ON user_favorites
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================================================
-- RLS POLICIES: user_alerts
-- =============================================================================

-- Users can read their own alerts
CREATE POLICY user_alerts_select_own ON user_alerts
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own alerts
CREATE POLICY user_alerts_insert_own ON user_alerts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own alerts
CREATE POLICY user_alerts_update_own ON user_alerts
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own alerts
CREATE POLICY user_alerts_delete_own ON user_alerts
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admins can read all alerts
CREATE POLICY user_alerts_select_admin ON user_alerts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================================================
-- RLS POLICIES: user_activity
-- =============================================================================

-- Users can read their own activity
CREATE POLICY user_activity_select_own ON user_activity
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own activity
CREATE POLICY user_activity_insert_own ON user_activity
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can read all activity
CREATE POLICY user_activity_select_admin ON user_activity
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================================================
-- RLS POLICIES: user_sessions
-- =============================================================================

-- Users can read their own sessions
CREATE POLICY user_sessions_select_own ON user_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY user_sessions_insert_own ON user_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY user_sessions_update_own ON user_sessions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins can read all sessions
CREATE POLICY user_sessions_select_admin ON user_sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================================================
-- RLS POLICIES: alert_history
-- =============================================================================

-- Users can read history for their own alerts
CREATE POLICY alert_history_select_own ON alert_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_alerts
            WHERE user_alerts.id = alert_history.alert_id
            AND user_alerts.user_id = auth.uid()
        )
    );

-- Admins can read all alert history
CREATE POLICY alert_history_select_admin ON alert_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Service role can insert alert history (for background jobs)
CREATE POLICY alert_history_insert_service ON alert_history
    FOR INSERT
    WITH CHECK (TRUE);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's active alert count
CREATE OR REPLACE FUNCTION get_user_alert_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM user_alerts
        WHERE user_id = p_user_id AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's favorite count
CREATE OR REPLACE FUNCTION get_user_favorite_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM user_favorites
        WHERE user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
