-- Migration: 071_featured_score_rpc.sql
-- Purpose: RPC function to aggregate listing engagement counts for featured score computation.
-- Replaces 5 separate unbounded queries that hit Supabase's default 1000-row limit.

CREATE OR REPLACE FUNCTION get_listing_engagement_counts(p_since TIMESTAMPTZ)
RETURNS TABLE(
  listing_id BIGINT,
  favorites BIGINT,
  dealer_clicks BIGINT,
  views BIGINT,
  quickview_opens BIGINT,
  pinch_zooms BIGINT
) AS $$
  SELECT
    COALESCE(f.listing_id, c.listing_id, v.listing_id, q.listing_id, p.listing_id) AS listing_id,
    COALESCE(f.cnt, 0) AS favorites,
    COALESCE(c.cnt, 0) AS dealer_clicks,
    COALESCE(v.cnt, 0) AS views,
    COALESCE(q.cnt, 0) AS quickview_opens,
    COALESCE(p.cnt, 0) AS pinch_zooms
  FROM
    (SELECT uf.listing_id, COUNT(*) AS cnt FROM user_favorites uf WHERE uf.created_at >= p_since GROUP BY uf.listing_id) f
  FULL OUTER JOIN
    (SELECT dc.listing_id, COUNT(*) AS cnt FROM dealer_clicks dc WHERE dc.created_at >= p_since AND dc.listing_id IS NOT NULL GROUP BY dc.listing_id) c USING (listing_id)
  FULL OUTER JOIN
    (SELECT lv.listing_id, COUNT(*) AS cnt FROM listing_views lv WHERE lv.viewed_at >= p_since GROUP BY lv.listing_id) v USING (listing_id)
  FULL OUTER JOIN
    (SELECT (ae.event_data->>'listingId')::BIGINT AS listing_id, COUNT(*) AS cnt
     FROM activity_events ae WHERE ae.event_type = 'quickview_open' AND ae.created_at >= p_since
     GROUP BY (ae.event_data->>'listingId')::BIGINT) q USING (listing_id)
  FULL OUTER JOIN
    (SELECT (ae2.event_data->>'listingId')::BIGINT AS listing_id, COUNT(*) AS cnt
     FROM activity_events ae2 WHERE ae2.event_type = 'image_pinch_zoom' AND ae2.created_at >= p_since
     GROUP BY (ae2.event_data->>'listingId')::BIGINT) p USING (listing_id);
$$ LANGUAGE sql SECURITY DEFINER;
