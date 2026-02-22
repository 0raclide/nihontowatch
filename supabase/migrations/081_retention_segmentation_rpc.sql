-- =============================================================================
-- Retention & Segmentation RPC Functions
-- =============================================================================
-- Migration: 081_retention_segmentation_rpc.sql
-- Description: 3 SQL RPC functions for cohort retention heatmap and
--              behavioral visitor segmentation on the admin dashboard.
--
-- Performance notes:
--   - Cohort queries pre-aggregate activity into visitor-week buckets in a
--     single scan of activity_events, then join against cohorts. No correlated
--     EXISTS subqueries.
--   - Segments + device breakdown merged into one RPC to avoid duplicating the
--     classification logic and scanning activity_events twice.
--   - Device type resolved via ARRAY_AGG(session_id) in the initial scan, then
--     a single user_sessions lookup — avoids re-scanning activity_events.
--   - All functions use LANGUAGE sql (not plpgsql) to avoid procedural overhead.
-- =============================================================================

-- =============================================================================
-- 1. get_user_retention_cohorts
--    Buckets registered users by ISO week of profiles.created_at.
--    Pre-aggregates activity_events into user-week pairs, then counts.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_user_retention_cohorts(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_admin_ids TEXT[] DEFAULT '{}',
  p_max_weeks INTEGER DEFAULT 8
)
RETURNS TABLE (
  cohort_week TEXT,
  cohort_size INTEGER,
  week_offset INTEGER,
  active_users INTEGER,
  retention_pct NUMERIC
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH cohorts AS (
    SELECT
      p.id AS user_id,
      DATE_TRUNC('week', p.created_at)::DATE AS cohort_start
    FROM profiles p
    WHERE p.created_at >= p_start
      AND p.created_at < p_end
      AND p.role = 'user'
      AND p.id::TEXT != ALL(p_admin_ids)
  ),
  -- Single scan: pre-aggregate all user activity into (user_id, active_week) pairs
  user_active_weeks AS (
    SELECT DISTINCT
      ae.user_id,
      DATE_TRUNC('week', ae.created_at)::DATE AS active_week
    FROM activity_events ae
    WHERE ae.user_id IS NOT NULL
      AND ae.created_at >= p_start
      AND ae.created_at < p_end
  ),
  cohort_sizes AS (
    SELECT cohort_start, COUNT(*)::INTEGER AS csize
    FROM cohorts
    GROUP BY cohort_start
  ),
  weeks AS (
    SELECT generate_series(0, p_max_weeks) AS wk
  ),
  -- Join cohort members to their active weeks, compute week offset
  cohort_activity AS (
    SELECT
      c.cohort_start,
      w.wk AS week_offset,
      COUNT(DISTINCT c.user_id) FILTER (
        WHERE uaw.user_id IS NOT NULL
      )::INTEGER AS active_count
    FROM cohorts c
    CROSS JOIN weeks w
    LEFT JOIN user_active_weeks uaw
      ON uaw.user_id = c.user_id
      AND uaw.active_week = c.cohort_start + (w.wk * 7)
    WHERE c.cohort_start + (w.wk * INTERVAL '7 days') <= p_end
    GROUP BY c.cohort_start, w.wk
  )
  SELECT
    TO_CHAR(ca.cohort_start, 'Mon DD') AS cohort_week,
    cs.csize AS cohort_size,
    ca.week_offset::INTEGER,
    ca.active_count AS active_users,
    CASE WHEN cs.csize > 0
      THEN ROUND((ca.active_count::NUMERIC / cs.csize) * 100, 1)
      ELSE 0
    END AS retention_pct
  FROM cohort_activity ca
  JOIN cohort_sizes cs ON cs.cohort_start = ca.cohort_start
  ORDER BY ca.cohort_start, ca.week_offset;
$$;

-- =============================================================================
-- 2. get_visitor_retention_cohorts
--    Same shape as above but for all visitors, keyed on visitor_id,
--    cohorted by the week of their first event.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_visitor_retention_cohorts(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_max_weeks INTEGER DEFAULT 8
)
RETURNS TABLE (
  cohort_week TEXT,
  cohort_size INTEGER,
  week_offset INTEGER,
  active_users INTEGER,
  retention_pct NUMERIC
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH -- Single scan: pre-aggregate all visitor activity into (visitor_id, active_week) pairs
  visitor_active_weeks AS (
    SELECT DISTINCT
      ae.visitor_id,
      DATE_TRUNC('week', ae.created_at)::DATE AS active_week
    FROM activity_events ae
    WHERE ae.visitor_id IS NOT NULL
      AND ae.created_at >= p_start
      AND ae.created_at < p_end
  ),
  -- Derive cohort from earliest active week per visitor
  first_seen AS (
    SELECT
      visitor_id,
      MIN(active_week) AS cohort_start
    FROM visitor_active_weeks
    GROUP BY visitor_id
  ),
  cohort_sizes AS (
    SELECT cohort_start, COUNT(*)::INTEGER AS csize
    FROM first_seen
    GROUP BY cohort_start
  ),
  weeks AS (
    SELECT generate_series(0, p_max_weeks) AS wk
  ),
  cohort_activity AS (
    SELECT
      fs.cohort_start,
      w.wk AS week_offset,
      COUNT(DISTINCT fs.visitor_id) FILTER (
        WHERE vaw.visitor_id IS NOT NULL
      )::INTEGER AS active_count
    FROM first_seen fs
    CROSS JOIN weeks w
    LEFT JOIN visitor_active_weeks vaw
      ON vaw.visitor_id = fs.visitor_id
      AND vaw.active_week = fs.cohort_start + (w.wk * 7)
    WHERE fs.cohort_start + (w.wk * INTERVAL '7 days') <= p_end
    GROUP BY fs.cohort_start, w.wk
  )
  SELECT
    TO_CHAR(ca.cohort_start, 'Mon DD') AS cohort_week,
    cs.csize AS cohort_size,
    ca.week_offset::INTEGER,
    ca.active_count AS active_users,
    CASE WHEN cs.csize > 0
      THEN ROUND((ca.active_count::NUMERIC / cs.csize) * 100, 1)
      ELSE 0
    END AS retention_pct
  FROM cohort_activity ca
  JOIN cohort_sizes cs ON cs.cohort_start = ca.cohort_start
  ORDER BY ca.cohort_start, ca.week_offset;
$$;

-- =============================================================================
-- 3. get_visitor_segments_with_devices
--    Single RPC that classifies visitors AND resolves device type.
--    Eliminates the duplicated classification scan from the old two-RPC design.
--    Returns one row per (segment, device_type) with aggregate stats.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_visitor_segments_with_devices(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_admin_ids TEXT[] DEFAULT '{}'
)
RETURNS TABLE (
  segment TEXT,
  device_type TEXT,
  visitor_count INTEGER,
  avg_events NUMERIC,
  avg_sessions NUMERIC,
  top_event_type TEXT
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH visitor_stats AS (
    SELECT
      ae.visitor_id,
      COUNT(*)::INTEGER AS event_count,
      COUNT(DISTINCT ae.session_id)::INTEGER AS session_count,
      BOOL_OR(ae.event_type IN ('dealer_click', 'external_link_click')) AS has_dealer_click,
      BOOL_OR(ae.event_type IN ('favorite_add', 'alert_create')) AS has_engagement,
      MODE() WITHIN GROUP (ORDER BY ae.event_type) AS most_common_event,
      -- Capture latest session_id in the same scan (avoids second activity_events scan)
      (ARRAY_AGG(ae.session_id ORDER BY ae.created_at DESC) FILTER (WHERE ae.session_id IS NOT NULL))[1] AS latest_session_id
    FROM activity_events ae
    WHERE ae.visitor_id IS NOT NULL
      AND ae.created_at >= p_start
      AND ae.created_at < p_end
      AND (ae.user_id IS NULL OR ae.user_id::TEXT != ALL(p_admin_ids))
    GROUP BY ae.visitor_id
  ),
  classified AS (
    SELECT
      vs.*,
      CASE
        WHEN vs.has_dealer_click THEN 'converter'
        WHEN vs.has_engagement THEN 'engaged'
        WHEN vs.session_count >= 2 OR vs.event_count >= 5 THEN 'browser'
        ELSE 'bouncer'
      END AS segment
    FROM visitor_stats vs
  ),
  -- Resolve device from latest session — single lookup against user_sessions, no second activity_events scan
  enriched AS (
    SELECT
      c.visitor_id,
      c.segment,
      c.event_count,
      c.session_count,
      c.most_common_event,
      CASE
        WHEN us.screen_width IS NOT NULL AND us.screen_width < 768 THEN 'mobile'
        WHEN us.screen_width IS NOT NULL THEN 'desktop'
        ELSE 'unknown'
      END AS device_type
    FROM classified c
    LEFT JOIN user_sessions us ON us.session_id = c.latest_session_id
  )
  SELECT
    e.segment,
    e.device_type,
    COUNT(*)::INTEGER AS visitor_count,
    ROUND(AVG(e.event_count), 1) AS avg_events,
    ROUND(AVG(e.session_count), 1) AS avg_sessions,
    MODE() WITHIN GROUP (ORDER BY e.most_common_event) AS top_event_type
  FROM enriched e
  GROUP BY e.segment, e.device_type
  ORDER BY
    CASE e.segment
      WHEN 'converter' THEN 1
      WHEN 'engaged' THEN 2
      WHEN 'browser' THEN 3
      WHEN 'bouncer' THEN 4
    END,
    e.device_type;
$$;

-- Drop the old separate functions if they exist (replaced by merged version)
DROP FUNCTION IF EXISTS get_visitor_segments(TIMESTAMPTZ, TIMESTAMPTZ, TEXT[]);
DROP FUNCTION IF EXISTS get_segment_device_breakdown(TIMESTAMPTZ, TIMESTAMPTZ, TEXT[]);

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON FUNCTION get_user_retention_cohorts IS 'Weekly cohort retention for registered users, excluding admins. Pre-aggregated single-scan.';
COMMENT ON FUNCTION get_visitor_retention_cohorts IS 'Weekly cohort retention for all visitors by visitor_id. Pre-aggregated single-scan.';
COMMENT ON FUNCTION get_visitor_segments_with_devices IS 'Classify visitors into converter/engaged/browser/bouncer segments with device breakdown. Single scan, single RPC.';
