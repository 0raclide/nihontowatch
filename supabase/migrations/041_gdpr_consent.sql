-- Migration: 041_gdpr_consent.sql
-- Purpose: Add GDPR consent tracking and data deletion request tables
-- Date: 2026-01-25

-- =============================================================================
-- CONSENT HISTORY TABLE
-- Stores an audit trail of all consent changes for GDPR compliance
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_consent_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- User reference (nullable for pre-registration consent)
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    -- Visitor ID for anonymous users
    visitor_id TEXT,
    -- The consent preferences at this point in time
    preferences JSONB NOT NULL,
    -- Version of the cookie/privacy policy
    version TEXT NOT NULL DEFAULT '1.0',
    -- How consent was given: banner, preferences, api, implicit
    method TEXT NOT NULL CHECK (method IN ('banner', 'preferences', 'api', 'implicit')),
    -- Hashed IP for audit purposes (not raw IP)
    ip_hash TEXT,
    -- User agent hash for device identification
    user_agent_hash TEXT,
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_consent_history_user ON user_consent_history(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_history_visitor ON user_consent_history(visitor_id);
CREATE INDEX IF NOT EXISTS idx_consent_history_created ON user_consent_history(created_at DESC);

-- =============================================================================
-- ADD CONSENT FIELDS TO PROFILES
-- Store current consent state on user profile for quick access
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_preferences JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_updated_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS data_deletion_requested_at TIMESTAMPTZ;

-- =============================================================================
-- DATA DELETION REQUESTS TABLE
-- Track account deletion requests for compliance
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- User who requested deletion
    user_id UUID NOT NULL,
    -- Email at time of request (for confirmation)
    email TEXT NOT NULL,
    -- Reason for deletion
    reason TEXT CHECK (reason IN ('privacy', 'not_using', 'switching_service', 'other', NULL)),
    -- Optional feedback
    feedback TEXT,
    -- Request status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    -- Timestamps
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    processed_at TIMESTAMPTZ,
    -- Who/what processed the request
    processed_by TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user ON data_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON data_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_requested ON data_deletion_requests(requested_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE user_consent_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Consent history: Users can view their own, service role can insert
CREATE POLICY "Users can view own consent history"
    ON user_consent_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own consent"
    ON user_consent_history FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anonymous users can insert consent"
    ON user_consent_history FOR INSERT
    WITH CHECK (user_id IS NULL);

CREATE POLICY "Admins can view all consent history"
    ON user_consent_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Data deletion requests: Users can view/create their own, admins can manage all
CREATE POLICY "Users can view own deletion requests"
    ON data_deletion_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create deletion requests"
    ON data_deletion_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel own pending requests"
    ON data_deletion_requests FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (status = 'cancelled');

CREATE POLICY "Admins can view all deletion requests"
    ON data_deletion_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can update deletion requests"
    ON data_deletion_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to hash IP addresses for audit logging
CREATE OR REPLACE FUNCTION hash_ip_address(ip_address TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF ip_address IS NULL THEN
        RETURN NULL;
    END IF;
    -- Use SHA256 with a salt for privacy
    RETURN encode(sha256(('nihontowatch_salt_' || ip_address)::bytea), 'hex');
END;
$$;

-- Function to get consent analytics (aggregated, for admin dashboard)
CREATE OR REPLACE FUNCTION get_consent_analytics(
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    date DATE,
    total_consents BIGINT,
    analytics_accepted BIGINT,
    functional_accepted BIGINT,
    marketing_accepted BIGINT,
    via_banner BIGINT,
    via_preferences BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE_TRUNC('day', uch.created_at)::DATE AS date,
        COUNT(*)::BIGINT AS total_consents,
        COUNT(*) FILTER (WHERE (uch.preferences->>'analytics')::BOOLEAN = true)::BIGINT AS analytics_accepted,
        COUNT(*) FILTER (WHERE (uch.preferences->>'functional')::BOOLEAN = true)::BIGINT AS functional_accepted,
        COUNT(*) FILTER (WHERE (uch.preferences->>'marketing')::BOOLEAN = true)::BIGINT AS marketing_accepted,
        COUNT(*) FILTER (WHERE uch.method = 'banner')::BIGINT AS via_banner,
        COUNT(*) FILTER (WHERE uch.method = 'preferences')::BIGINT AS via_preferences
    FROM user_consent_history uch
    WHERE DATE_TRUNC('day', uch.created_at)::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY DATE_TRUNC('day', uch.created_at)::DATE
    ORDER BY date DESC;
END;
$$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE user_consent_history IS 'GDPR audit trail of all cookie/tracking consent changes';
COMMENT ON TABLE data_deletion_requests IS 'GDPR right to be forgotten request tracking';
COMMENT ON COLUMN profiles.consent_preferences IS 'Current cookie consent preferences (JSONB)';
COMMENT ON COLUMN profiles.consent_updated_at IS 'When consent was last updated';
COMMENT ON COLUMN profiles.marketing_opt_out IS 'Whether user has opted out of marketing communications';
COMMENT ON COLUMN profiles.data_deletion_requested_at IS 'When user requested account deletion (if pending)';
