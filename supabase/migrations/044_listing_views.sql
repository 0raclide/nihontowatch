-- =============================================================================
-- Migration 044: Listing Views Tracking
-- =============================================================================
-- Description: Creates listing_views table for tracking individual listing views
-- Purpose: User engagement analytics - tracks when users view listings
-- =============================================================================

-- =============================================================================
-- LISTING VIEWS TABLE
-- =============================================================================
-- Tracks individual listing views with deduplication per session per day

CREATE TABLE IF NOT EXISTS listing_views (
    id BIGSERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id TEXT NOT NULL,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- view_date is used for deduplication (one view per listing/session/day)
    view_date DATE NOT NULL DEFAULT CURRENT_DATE,
    referrer TEXT CHECK (referrer IN ('browse', 'search', 'direct', 'external', 'alert'))
);

-- Deduplication: Only one view per listing per session per day
-- This prevents counting the same user viewing the same listing multiple times in a day
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_views_dedup
    ON listing_views (listing_id, session_id, view_date);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Query by listing (most common for analytics)
CREATE INDEX IF NOT EXISTS idx_listing_views_listing_id
    ON listing_views(listing_id);

-- Query by user (for user activity history)
CREATE INDEX IF NOT EXISTS idx_listing_views_user_id
    ON listing_views(user_id)
    WHERE user_id IS NOT NULL;

-- Query by session (for session analytics)
CREATE INDEX IF NOT EXISTS idx_listing_views_session_id
    ON listing_views(session_id);

-- Time-based queries (for date range analytics)
CREATE INDEX IF NOT EXISTS idx_listing_views_viewed_at
    ON listing_views(viewed_at DESC);

-- Composite index for common analytics queries
CREATE INDEX IF NOT EXISTS idx_listing_views_listing_date
    ON listing_views(listing_id, viewed_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE listing_views ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for API routes with service client)
CREATE POLICY "Service role has full access to listing_views"
    ON listing_views FOR ALL
    USING (auth.role() = 'service_role');

-- Anyone can insert views (for tracking, similar to activity_events)
CREATE POLICY "Anyone can insert listing views"
    ON listing_views FOR INSERT
    WITH CHECK (true);

-- Users can view their own view history
CREATE POLICY "Users can view own listing views"
    ON listing_views FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all listing views
CREATE POLICY "Admins can view all listing views"
    ON listing_views FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE listing_views IS 'Tracks individual listing views for user engagement analytics';
COMMENT ON COLUMN listing_views.listing_id IS 'The listing that was viewed';
COMMENT ON COLUMN listing_views.user_id IS 'The authenticated user who viewed (null for anonymous)';
COMMENT ON COLUMN listing_views.session_id IS 'Browser session identifier';
COMMENT ON COLUMN listing_views.viewed_at IS 'When the view occurred';
COMMENT ON COLUMN listing_views.referrer IS 'How the user arrived at this listing';
