-- =============================================================================
-- Migration 045: User Searches Tracking
-- =============================================================================
-- Description: Creates user_searches table for tracking search queries
-- Purpose: User engagement analytics - tracks what users search for and CTR
-- =============================================================================

-- =============================================================================
-- USER SEARCHES TABLE
-- =============================================================================
-- Tracks search queries with normalized text for aggregation

CREATE TABLE IF NOT EXISTS user_searches (
    id BIGSERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    query_normalized TEXT NOT NULL,  -- lowercase, trimmed for aggregation
    filters JSONB,  -- itemType, dealer, certification, priceMin, priceMax
    result_count INTEGER NOT NULL DEFAULT 0,
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Click-through tracking
    clicked_listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    clicked_at TIMESTAMPTZ
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Query aggregation (for "top searches" analytics)
CREATE INDEX IF NOT EXISTS idx_user_searches_query_normalized
    ON user_searches(query_normalized);

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_user_searches_searched_at
    ON user_searches(searched_at DESC);

-- Session-based queries
CREATE INDEX IF NOT EXISTS idx_user_searches_session_id
    ON user_searches(session_id);

-- User-based queries
CREATE INDEX IF NOT EXISTS idx_user_searches_user_id
    ON user_searches(user_id)
    WHERE user_id IS NOT NULL;

-- Composite index for CTR analysis
CREATE INDEX IF NOT EXISTS idx_user_searches_ctr
    ON user_searches(searched_at DESC, clicked_listing_id)
    WHERE clicked_listing_id IS NOT NULL;

-- GIN index for JSONB filter queries
CREATE INDEX IF NOT EXISTS idx_user_searches_filters
    ON user_searches USING GIN (filters);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE user_searches ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for API routes with service client)
CREATE POLICY "Service role has full access to user_searches"
    ON user_searches FOR ALL
    USING (auth.role() = 'service_role');

-- Anyone can insert searches (for tracking)
CREATE POLICY "Anyone can insert searches"
    ON user_searches FOR INSERT
    WITH CHECK (true);

-- Admins can view all searches
CREATE POLICY "Admins can view all searches"
    ON user_searches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================================================
-- ANALYTICS FUNCTIONS
-- =============================================================================

-- Function to get top search queries
CREATE OR REPLACE FUNCTION get_top_user_searches(
    p_limit INTEGER DEFAULT 20,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days'
)
RETURNS TABLE (
    query_normalized TEXT,
    search_count BIGINT,
    avg_result_count NUMERIC,
    click_through_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        us.query_normalized,
        COUNT(*)::BIGINT as search_count,
        ROUND(AVG(us.result_count)::NUMERIC, 1) as avg_result_count,
        ROUND(
            COUNT(us.clicked_listing_id)::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0) * 100,
            2
        ) as click_through_rate
    FROM user_searches us
    WHERE us.searched_at >= p_start_date
    AND us.query_normalized != ''
    GROUP BY us.query_normalized
    ORDER BY search_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get zero-result searches (for content gap analysis)
CREATE OR REPLACE FUNCTION get_zero_result_searches(
    p_limit INTEGER DEFAULT 20,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days'
)
RETURNS TABLE (
    query_normalized TEXT,
    search_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        us.query_normalized,
        COUNT(*)::BIGINT as search_count
    FROM user_searches us
    WHERE us.searched_at >= p_start_date
    AND us.result_count = 0
    AND us.query_normalized != ''
    GROUP BY us.query_normalized
    ORDER BY search_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE user_searches IS 'Tracks user search queries for engagement analytics';
COMMENT ON COLUMN user_searches.query IS 'Original search query as entered';
COMMENT ON COLUMN user_searches.query_normalized IS 'Lowercase, trimmed query for aggregation';
COMMENT ON COLUMN user_searches.filters IS 'Active filters during search (itemType, dealer, certification, price range)';
COMMENT ON COLUMN user_searches.result_count IS 'Number of results returned';
COMMENT ON COLUMN user_searches.clicked_listing_id IS 'If user clicked a result, which listing';
COMMENT ON COLUMN user_searches.clicked_at IS 'When the click occurred (for time-to-click analysis)';
COMMENT ON FUNCTION get_top_user_searches IS 'Get most popular search queries with CTR';
COMMENT ON FUNCTION get_zero_result_searches IS 'Get searches that returned no results (content gaps)';
