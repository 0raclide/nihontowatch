-- Migration: 076_fix_dealer_dwell_and_views_v2.sql
-- Fix: Dwell stats RPC was querying non-existent dealerId field (viewport_dwell has listingId only).
-- Fix: Used wrong JSONB key (dwellTime vs dwellMs).
-- New: Add listing detail views per dealer from listing_views table.

-- Must DROP first because return type is changing (adding dwell_event_count column)
DROP FUNCTION IF EXISTS get_dealer_dwell_stats(TIMESTAMPTZ, TIMESTAMPTZ);

-- Fix dwell stats: JOIN through listings to get dealer_id, use correct field 'dwellMs'
CREATE OR REPLACE FUNCTION get_dealer_dwell_stats(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE(dealer_id BIGINT, total_dwell_seconds NUMERIC, dwell_event_count BIGINT) AS $$
  SELECT
    l.dealer_id,
    SUM((ae.event_data->>'dwellMs')::NUMERIC / 1000.0) AS total_dwell_seconds,
    COUNT(*) AS dwell_event_count
  FROM activity_events ae
  JOIN listings l ON (ae.event_data->>'listingId')::BIGINT = l.id
  WHERE ae.event_type = 'viewport_dwell'
    AND ae.created_at BETWEEN p_start AND p_end
  GROUP BY l.dealer_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- New: Listing detail page views per dealer (from listing_views table)
CREATE OR REPLACE FUNCTION get_dealer_listing_views(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE(dealer_id BIGINT, view_count BIGINT, unique_viewers BIGINT) AS $$
  SELECT
    l.dealer_id,
    COUNT(*) AS view_count,
    COUNT(DISTINCT lv.session_id) AS unique_viewers
  FROM listing_views lv
  JOIN listings l ON lv.listing_id = l.id
  WHERE lv.viewed_at BETWEEN p_start AND p_end
  GROUP BY l.dealer_id;
$$ LANGUAGE sql SECURITY DEFINER;
