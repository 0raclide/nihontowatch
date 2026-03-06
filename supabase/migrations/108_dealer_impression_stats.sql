-- Migration 108: Dealer Impression Stats RPC
-- Purpose: Aggregate listing_impressions by dealer for the analytics dashboard.
-- listing_impressions already has dealer_id — no JOIN needed.

CREATE OR REPLACE FUNCTION get_dealer_impression_stats(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE(dealer_id BIGINT, total_impressions BIGINT, unique_sessions BIGINT) AS $$
  SELECT
    li.dealer_id,
    COUNT(*) AS total_impressions,
    COUNT(DISTINCT li.session_id) AS unique_sessions
  FROM listing_impressions li
  WHERE li.created_at BETWEEN p_start AND p_end
  GROUP BY li.dealer_id;
$$ LANGUAGE sql SECURITY DEFINER;
