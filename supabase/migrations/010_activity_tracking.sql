-- =============================================================================
-- Activity Tracking Tables
-- =============================================================================
-- Migration: 010_activity_tracking.sql
-- Description: Creates tables for comprehensive user activity tracking
--
-- Tables:
-- - user_sessions: Track individual browsing sessions
-- - activity_events: Track detailed user interactions
-- =============================================================================

-- =============================================================================
-- User Sessions Table
-- =============================================================================
-- Tracks browsing sessions for both anonymous and authenticated users

CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(100) PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    total_duration_ms INTEGER,
    page_views INTEGER NOT NULL DEFAULT 0,
    user_agent TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    timezone VARCHAR(100),
    language VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying sessions by user
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

-- Index for querying active sessions (no ended_at)
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(ended_at) WHERE ended_at IS NULL;

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON user_sessions(started_at DESC);

-- =============================================================================
-- Activity Events Table
-- =============================================================================
-- Tracks individual user interactions with the site

CREATE TABLE IF NOT EXISTS activity_events (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint to ensure valid event types
ALTER TABLE activity_events
ADD CONSTRAINT check_event_type
CHECK (event_type IN (
    'page_view',
    'listing_view',
    'search',
    'filter_change',
    'favorite_add',
    'favorite_remove',
    'alert_create',
    'alert_delete',
    'external_link_click'
));

-- Index for querying events by session
CREATE INDEX IF NOT EXISTS idx_activity_events_session_id ON activity_events(session_id);

-- Index for querying events by user
CREATE INDEX IF NOT EXISTS idx_activity_events_user_id ON activity_events(user_id);

-- Index for querying events by type
CREATE INDEX IF NOT EXISTS idx_activity_events_type ON activity_events(event_type);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events(created_at DESC);

-- GIN index for JSONB queries on event_data
CREATE INDEX IF NOT EXISTS idx_activity_events_data ON activity_events USING GIN (event_data);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

-- Enable RLS on both tables
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

-- User sessions: Users can view their own sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- User sessions: Service role can do anything (for API routes)
CREATE POLICY "Service role has full access to sessions" ON user_sessions
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- User sessions: Anonymous users can insert sessions (no auth required for tracking)
CREATE POLICY "Anyone can insert sessions" ON user_sessions
    FOR INSERT
    WITH CHECK (true);

-- User sessions: Anyone can update sessions (for ending sessions via sendBeacon)
CREATE POLICY "Anyone can update sessions" ON user_sessions
    FOR UPDATE
    USING (true);

-- Activity events: Users can view their own events
CREATE POLICY "Users can view own events" ON activity_events
    FOR SELECT
    USING (auth.uid() = user_id);

-- Activity events: Service role can do anything
CREATE POLICY "Service role has full access to events" ON activity_events
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Activity events: Anyone can insert events (for tracking)
CREATE POLICY "Anyone can insert events" ON activity_events
    FOR INSERT
    WITH CHECK (true);

-- =============================================================================
-- Utility Functions
-- =============================================================================

-- Function to get session statistics for a user
CREATE OR REPLACE FUNCTION get_user_session_stats(p_user_id UUID)
RETURNS TABLE (
    total_sessions BIGINT,
    total_duration_hours NUMERIC,
    total_page_views BIGINT,
    avg_session_duration_minutes NUMERIC,
    last_session_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_sessions,
        COALESCE(SUM(total_duration_ms) / 3600000.0, 0)::NUMERIC as total_duration_hours,
        COALESCE(SUM(page_views), 0)::BIGINT as total_page_views,
        COALESCE(AVG(total_duration_ms) / 60000.0, 0)::NUMERIC as avg_session_duration_minutes,
        MAX(started_at) as last_session_at
    FROM user_sessions
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get popular event types over a time period
CREATE OR REPLACE FUNCTION get_event_type_counts(
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    event_type VARCHAR(50),
    event_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ae.event_type,
        COUNT(*)::BIGINT as event_count
    FROM activity_events ae
    WHERE ae.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY ae.event_type
    ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top searched queries
CREATE OR REPLACE FUNCTION get_top_searches(
    p_limit INTEGER DEFAULT 20,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days'
)
RETURNS TABLE (
    search_query TEXT,
    search_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        event_data->>'query' as search_query,
        COUNT(*)::BIGINT as search_count
    FROM activity_events
    WHERE event_type = 'search'
    AND created_at >= p_start_date
    AND event_data->>'query' IS NOT NULL
    AND event_data->>'query' != ''
    GROUP BY event_data->>'query'
    ORDER BY search_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top clicked external links
CREATE OR REPLACE FUNCTION get_top_external_clicks(
    p_limit INTEGER DEFAULT 20,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days'
)
RETURNS TABLE (
    listing_id BIGINT,
    dealer_name TEXT,
    click_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (event_data->>'listingId')::BIGINT as listing_id,
        event_data->>'dealerName' as dealer_name,
        COUNT(*)::BIGINT as click_count
    FROM activity_events
    WHERE event_type = 'external_link_click'
    AND created_at >= p_start_date
    AND event_data->>'listingId' IS NOT NULL
    GROUP BY event_data->>'listingId', event_data->>'dealerName'
    ORDER BY click_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Cleanup Function (for data retention)
-- =============================================================================

-- Function to clean up old anonymous session data (default: 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_activity_data(p_days_to_keep INTEGER DEFAULT 90)
RETURNS TABLE (
    sessions_deleted BIGINT,
    events_deleted BIGINT
) AS $$
DECLARE
    v_sessions_deleted BIGINT;
    v_events_deleted BIGINT;
    v_cutoff_date TIMESTAMPTZ;
BEGIN
    v_cutoff_date := NOW() - (p_days_to_keep || ' days')::INTERVAL;

    -- Delete old events first (they reference sessions)
    WITH deleted_events AS (
        DELETE FROM activity_events
        WHERE created_at < v_cutoff_date
        AND user_id IS NULL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_events_deleted FROM deleted_events;

    -- Delete old anonymous sessions
    WITH deleted_sessions AS (
        DELETE FROM user_sessions
        WHERE started_at < v_cutoff_date
        AND user_id IS NULL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_sessions_deleted FROM deleted_sessions;

    RETURN QUERY SELECT v_sessions_deleted, v_events_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE user_sessions IS 'Tracks browsing sessions for both anonymous and authenticated users';
COMMENT ON TABLE activity_events IS 'Tracks individual user interactions and events';
COMMENT ON FUNCTION get_user_session_stats IS 'Get session statistics for a specific user';
COMMENT ON FUNCTION get_event_type_counts IS 'Get counts of each event type over a time period';
COMMENT ON FUNCTION get_top_searches IS 'Get the most popular search queries';
COMMENT ON FUNCTION get_top_external_clicks IS 'Get the most clicked listings/dealers';
COMMENT ON FUNCTION cleanup_old_activity_data IS 'Remove old anonymous activity data for data retention compliance';
