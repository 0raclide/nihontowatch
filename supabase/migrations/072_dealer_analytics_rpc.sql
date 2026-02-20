-- Migration: 072_dealer_analytics_rpc.sql
-- Purpose: RPC functions for dealer-level analytics aggregation.
-- Replaces unbounded JS-side counting that hit Supabase's default 1000-row limit.

-- Clicks per dealer (covers both event types: external_link_click and dealer_click)
CREATE OR REPLACE FUNCTION get_dealer_click_stats(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE(dealer_name TEXT, dealer_id BIGINT, clicks BIGINT, unique_visitors BIGINT) AS $$
  SELECT
    ae.event_data->>'dealerName' AS dealer_name,
    (ae.event_data->>'dealerId')::BIGINT AS dealer_id,
    COUNT(*) AS clicks,
    COUNT(DISTINCT ae.visitor_id) AS unique_visitors
  FROM activity_events ae
  WHERE ae.event_type IN ('external_link_click', 'dealer_click')
    AND ae.created_at BETWEEN p_start AND p_end
  GROUP BY ae.event_data->>'dealerName', (ae.event_data->>'dealerId')::BIGINT;
$$ LANGUAGE sql SECURITY DEFINER;

-- Dwell per dealer (SUM seconds, not row counting)
CREATE OR REPLACE FUNCTION get_dealer_dwell_stats(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE(dealer_id BIGINT, total_dwell_seconds NUMERIC) AS $$
  SELECT
    (ae.event_data->>'dealerId')::BIGINT AS dealer_id,
    SUM((ae.event_data->>'dwellTime')::NUMERIC / 1000.0) AS total_dwell_seconds
  FROM activity_events ae
  WHERE ae.event_type = 'viewport_dwell'
    AND ae.created_at BETWEEN p_start AND p_end
    AND ae.event_data->>'dealerId' IS NOT NULL
  GROUP BY (ae.event_data->>'dealerId')::BIGINT;
$$ LANGUAGE sql SECURITY DEFINER;

-- Favorites per dealer (joins activity_events to listings to get dealer_id)
CREATE OR REPLACE FUNCTION get_dealer_favorite_stats(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE(dealer_id BIGINT, favorites BIGINT) AS $$
  SELECT l.dealer_id, COUNT(*) AS favorites
  FROM activity_events ae
  JOIN listings l ON (ae.event_data->>'listingId')::BIGINT = l.id
  WHERE ae.event_type = 'favorite_add'
    AND ae.created_at BETWEEN p_start AND p_end
  GROUP BY l.dealer_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Previous period clicks for trend comparison
CREATE OR REPLACE FUNCTION get_dealer_click_stats_prev(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE(dealer_name TEXT, dealer_id BIGINT, clicks BIGINT) AS $$
  SELECT
    ae.event_data->>'dealerName' AS dealer_name,
    (ae.event_data->>'dealerId')::BIGINT AS dealer_id,
    COUNT(*) AS clicks
  FROM activity_events ae
  WHERE ae.event_type IN ('external_link_click', 'dealer_click')
    AND ae.created_at BETWEEN p_start AND p_end
  GROUP BY ae.event_data->>'dealerName', (ae.event_data->>'dealerId')::BIGINT;
$$ LANGUAGE sql SECURITY DEFINER;

-- Daily click breakdown for trend charts
CREATE OR REPLACE FUNCTION get_dealer_daily_clicks(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE(click_date DATE, dealer_name TEXT, clicks BIGINT) AS $$
  SELECT
    ae.created_at::DATE AS click_date,
    ae.event_data->>'dealerName' AS dealer_name,
    COUNT(*) AS clicks
  FROM activity_events ae
  WHERE ae.event_type IN ('external_link_click', 'dealer_click')
    AND ae.created_at BETWEEN p_start AND p_end
  GROUP BY ae.created_at::DATE, ae.event_data->>'dealerName'
  ORDER BY click_date;
$$ LANGUAGE sql SECURITY DEFINER;
