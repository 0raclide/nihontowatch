-- =============================================================================
-- RPC functions for admin visitor stats
-- =============================================================================
-- Migration: 070_visitor_stats_rpc.sql
-- Description: Server-side aggregation for visitor analytics.
--              Replaces the broken pattern of LIMIT 10000 + JS counting,
--              which only captured recent hours instead of the full period.
-- =============================================================================

-- Top-line aggregate metrics (counts over full time range, no row limit)
CREATE OR REPLACE FUNCTION get_visitor_aggregate_stats(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS JSON AS $$
SELECT json_build_object(
  'tracked_visitors', COUNT(DISTINCT visitor_id),
  'total_sessions', COUNT(DISTINCT session_id),
  'unique_ip_count', COUNT(DISTINCT ip_address),
  'total_events', COUNT(*),
  'events_with_tracking', COUNT(visitor_id),
  'events_without_tracking', COUNT(*) - COUNT(visitor_id),
  'active_now', (
    SELECT COUNT(DISTINCT visitor_id)
    FROM activity_events
    WHERE created_at >= NOW() - INTERVAL '5 minutes'
      AND visitor_id IS NOT NULL
  )
)
FROM activity_events
WHERE created_at BETWEEN p_start AND p_end;
$$ LANGUAGE sql SECURITY DEFINER;

-- Time series: visitors/sessions/events per day
CREATE OR REPLACE FUNCTION get_visitor_timeseries(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS TABLE(day DATE, visitors BIGINT, sessions BIGINT, events BIGINT) AS $$
SELECT
  (created_at AT TIME ZONE 'UTC')::DATE AS day,
  COUNT(DISTINCT visitor_id) AS visitors,
  COUNT(DISTINCT session_id) AS sessions,
  COUNT(*) AS events
FROM activity_events
WHERE created_at BETWEEN p_start AND p_end
GROUP BY (created_at AT TIME ZONE 'UTC')::DATE
ORDER BY day;
$$ LANGUAGE sql SECURITY DEFINER;

-- Top visitors by event count
CREATE OR REPLACE FUNCTION get_top_visitors(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_limit INT DEFAULT 50
)
RETURNS TABLE(
  visitor_id TEXT,
  ip TEXT,
  events BIGINT,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  top_event TEXT
) AS $$
SELECT
  ae.visitor_id,
  MIN(ae.ip_address) FILTER (WHERE ae.ip_address IS NOT NULL) AS ip,
  COUNT(*) AS events,
  MIN(ae.created_at) AS first_seen,
  MAX(ae.created_at) AS last_seen,
  MODE() WITHIN GROUP (ORDER BY ae.event_type) AS top_event
FROM activity_events ae
WHERE ae.created_at BETWEEN p_start AND p_end
  AND ae.visitor_id IS NOT NULL
GROUP BY ae.visitor_id
ORDER BY COUNT(*) DESC
LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;

-- Unique IPs for geo lookup (deduplicated)
CREATE OR REPLACE FUNCTION get_unique_ips(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS TABLE(ip TEXT) AS $$
SELECT DISTINCT ip_address AS ip
FROM activity_events
WHERE created_at BETWEEN p_start AND p_end
  AND ip_address IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER;

-- Event type breakdown
CREATE OR REPLACE FUNCTION get_event_type_breakdown(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(event_type TEXT, count BIGINT) AS $$
SELECT
  ae.event_type,
  COUNT(*) AS count
FROM activity_events ae
WHERE ae.created_at BETWEEN p_start AND p_end
GROUP BY ae.event_type
ORDER BY COUNT(*) DESC
LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;
