-- =============================================================================
-- SAVED SEARCHES SYSTEM
-- Migration: 018_saved_searches.sql
-- Description: Creates saved_searches and saved_search_notifications tables
--              for the new saved search alert system.
-- =============================================================================

-- =============================================================================
-- 1. SAVED SEARCHES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Display
    name TEXT,                          -- Optional user-provided name

    -- Full search criteria (mirrors browse page state)
    search_criteria JSONB NOT NULL DEFAULT '{}',
    -- Schema: {
    --   tab: 'available' | 'sold',
    --   category: 'all' | 'nihonto' | 'tosogu',
    --   itemTypes: string[],
    --   certifications: string[],
    --   dealers: number[],
    --   schools: string[],
    --   askOnly: boolean,
    --   query: string,                  -- includes text + numeric filters
    --   sort: string,
    --   minPrice: number,
    --   maxPrice: number
    -- }

    -- Notification settings
    notification_frequency TEXT NOT NULL DEFAULT 'none'
        CHECK (notification_frequency IN ('instant', 'daily', 'none')),

    -- State tracking
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_notified_at TIMESTAMPTZ,
    last_match_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user's saved searches
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);

-- Index for active searches
CREATE INDEX IF NOT EXISTS idx_saved_searches_active ON saved_searches(is_active) WHERE is_active = TRUE;

-- Index for notification processing - only active searches with notifications enabled
CREATE INDEX IF NOT EXISTS idx_saved_searches_notification ON saved_searches(notification_frequency)
    WHERE notification_frequency != 'none' AND is_active = TRUE;

-- GIN index for JSONB search criteria (enables fast filtering)
CREATE INDEX IF NOT EXISTS idx_saved_searches_criteria ON saved_searches USING GIN (search_criteria);

COMMENT ON TABLE saved_searches IS 'User saved searches with notification preferences';
COMMENT ON COLUMN saved_searches.search_criteria IS 'Full browse filter state: { tab, category, itemTypes[], certifications[], dealers[], schools[], askOnly, query, sort, minPrice, maxPrice }';
COMMENT ON COLUMN saved_searches.notification_frequency IS 'instant = every 15 min, daily = 8am UTC digest, none = save only';

-- =============================================================================
-- 2. SAVED SEARCH NOTIFICATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS saved_search_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saved_search_id UUID NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,

    -- Matched listings for this notification batch
    matched_listing_ids INTEGER[] NOT NULL DEFAULT '{}',

    -- Delivery status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

-- Index for saved search notifications
CREATE INDEX IF NOT EXISTS idx_ssn_saved_search_id ON saved_search_notifications(saved_search_id);

-- Index for pending notifications to process
CREATE INDEX IF NOT EXISTS idx_ssn_status_pending ON saved_search_notifications(status) WHERE status = 'pending';

COMMENT ON TABLE saved_search_notifications IS 'Queue and history of saved search notifications';
COMMENT ON COLUMN saved_search_notifications.matched_listing_ids IS 'Array of listing IDs that matched this search';

-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_search_notifications ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES: saved_searches
-- =============================================================================

-- Users can read their own saved searches
CREATE POLICY saved_searches_select_own ON saved_searches
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own saved searches
CREATE POLICY saved_searches_insert_own ON saved_searches
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own saved searches
CREATE POLICY saved_searches_update_own ON saved_searches
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own saved searches
CREATE POLICY saved_searches_delete_own ON saved_searches
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admins can read all saved searches
CREATE POLICY saved_searches_select_admin ON saved_searches
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Service role bypass for cron jobs (uses service_role key)
CREATE POLICY saved_searches_service_select ON saved_searches
    FOR SELECT
    USING (auth.role() = 'service_role');

CREATE POLICY saved_searches_service_update ON saved_searches
    FOR UPDATE
    USING (auth.role() = 'service_role');

-- =============================================================================
-- RLS POLICIES: saved_search_notifications
-- =============================================================================

-- Users can read notifications for their own saved searches
CREATE POLICY ssn_select_own ON saved_search_notifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM saved_searches
            WHERE saved_searches.id = saved_search_notifications.saved_search_id
            AND saved_searches.user_id = auth.uid()
        )
    );

-- Admins can read all notifications
CREATE POLICY ssn_select_admin ON saved_search_notifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Service role can insert/update notifications (for cron jobs)
CREATE POLICY ssn_service_insert ON saved_search_notifications
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ssn_service_update ON saved_search_notifications
    FOR UPDATE
    USING (auth.role() = 'service_role');

CREATE POLICY ssn_service_select ON saved_search_notifications
    FOR SELECT
    USING (auth.role() = 'service_role');

-- =============================================================================
-- 4. TRIGGERS
-- =============================================================================

-- Auto-update updated_at on saved_searches
DROP TRIGGER IF EXISTS on_saved_searches_updated ON saved_searches;

CREATE TRIGGER on_saved_searches_updated
    BEFORE UPDATE ON saved_searches
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================================
-- 5. HELPER FUNCTIONS
-- =============================================================================

-- Function to get user's saved search count
CREATE OR REPLACE FUNCTION get_user_saved_search_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM saved_searches
        WHERE user_id = p_user_id AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. MIGRATE EXISTING new_listing ALERTS (if any exist)
-- =============================================================================

-- Convert existing new_listing alerts to saved searches
-- Note: This is a one-time migration. Existing alerts will be converted to daily frequency.
INSERT INTO saved_searches (
    user_id,
    name,
    search_criteria,
    notification_frequency,
    is_active,
    created_at
)
SELECT
    user_id,
    'Migrated from alerts',
    jsonb_build_object(
        'tab', 'available',
        'category', 'all',
        'itemTypes', CASE
            WHEN search_criteria->>'item_type' IS NOT NULL
            THEN jsonb_build_array(search_criteria->>'item_type')
            ELSE '[]'::jsonb
        END,
        'certifications', CASE
            WHEN search_criteria->>'cert_type' IS NOT NULL
            THEN jsonb_build_array(search_criteria->>'cert_type')
            ELSE '[]'::jsonb
        END,
        'dealers', CASE
            WHEN search_criteria->>'dealer_id' IS NOT NULL
            THEN jsonb_build_array((search_criteria->>'dealer_id')::integer)
            ELSE '[]'::jsonb
        END,
        'minPrice', (search_criteria->>'min_price')::numeric,
        'maxPrice', (search_criteria->>'max_price')::numeric
    ),
    'daily',
    is_active,
    created_at
FROM user_alerts
WHERE alert_type = 'new_listing'
ON CONFLICT DO NOTHING;
