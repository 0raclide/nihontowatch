-- =============================================================================
-- Optimize get_visitor_segments_with_devices
-- =============================================================================
-- Migration: 082_optimize_segments_rpc.sql
-- Description: Eliminates double-scan of activity_events in device resolution.
--              The visitor_device CTE was joining back to activity_events just to
--              get the latest session_id. Now we capture it via ARRAY_AGG in the
--              initial visitor_stats scan and look up user_sessions directly.
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

COMMENT ON FUNCTION get_visitor_segments_with_devices IS 'Classify visitors into converter/engaged/browser/bouncer segments with device breakdown. Single scan, single RPC. v2: eliminated double activity_events scan.';
