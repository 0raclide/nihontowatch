-- Migration: 073_engagement_analytics_rpc.sql
-- Purpose: RPC functions for engagement analytics aggregation.
-- Replaces fetch+JS aggregation pattern that truncates at .limit() boundaries.

-- Top searches with aggregation done in SQL (replaces searches/route.ts JS counting)
CREATE OR REPLACE FUNCTION get_top_searches(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_admin_ids UUID[],
  p_limit INT DEFAULT 20
)
RETURNS TABLE(
  query_normalized TEXT,
  search_count BIGINT,
  unique_users BIGINT,
  avg_results NUMERIC,
  has_click BIGINT
) AS $$
  SELECT
    us.query_normalized,
    COUNT(*) AS search_count,
    COUNT(DISTINCT COALESCE(us.user_id::text, us.session_id)) AS unique_users,
    AVG(us.result_count) AS avg_results,
    COUNT(us.clicked_listing_id) AS has_click
  FROM user_searches us
  WHERE us.searched_at BETWEEN p_start AND p_end
    AND (us.user_id IS NULL OR us.user_id != ALL(p_admin_ids))
  GROUP BY us.query_normalized
  ORDER BY search_count DESC
  LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;

-- Search totals (total searches and unique searchers, excluding admins)
CREATE OR REPLACE FUNCTION get_search_totals(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_admin_ids UUID[]
)
RETURNS TABLE(
  total_searches BIGINT,
  unique_searchers BIGINT,
  total_clicks BIGINT
) AS $$
  SELECT
    COUNT(*) AS total_searches,
    COUNT(DISTINCT COALESCE(us.user_id::text, us.session_id)) AS unique_searchers,
    COUNT(us.clicked_listing_id) AS total_clicks
  FROM user_searches us
  WHERE us.searched_at BETWEEN p_start AND p_end
    AND (us.user_id IS NULL OR us.user_id != ALL(p_admin_ids));
$$ LANGUAGE sql SECURITY DEFINER;

-- Top listings by views with unique viewer counts (replaces top-listings/route.ts JS counting)
CREATE OR REPLACE FUNCTION get_top_listings(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_admin_ids UUID[],
  p_limit INT DEFAULT 20
)
RETURNS TABLE(
  listing_id BIGINT,
  view_count BIGINT,
  unique_viewers BIGINT,
  favorite_count BIGINT
) AS $$
  SELECT
    lv.listing_id,
    COUNT(*) AS view_count,
    COUNT(DISTINCT lv.session_id) AS unique_viewers,
    COALESCE(f.cnt, 0) AS favorite_count
  FROM listing_views lv
  LEFT JOIN (
    SELECT uf.listing_id, COUNT(*) AS cnt
    FROM user_favorites uf
    WHERE uf.created_at BETWEEN p_start AND p_end
    GROUP BY uf.listing_id
  ) f ON f.listing_id = lv.listing_id
  WHERE lv.viewed_at BETWEEN p_start AND p_end
    AND (lv.user_id IS NULL OR lv.user_id != ALL(p_admin_ids))
  GROUP BY lv.listing_id, f.cnt
  ORDER BY view_count DESC
  LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;

-- Engagement overview counts (replaces overview/route.ts multiple queries)
-- Returns session counts, view counts, and search counts for a period, excluding admins
CREATE OR REPLACE FUNCTION get_engagement_counts(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_admin_ids UUID[]
)
RETURNS TABLE(
  session_count BIGINT,
  view_count BIGINT,
  search_count BIGINT,
  unique_searchers BIGINT
) AS $$
  SELECT
    (SELECT COUNT(*) FROM user_sessions us
     WHERE us.started_at BETWEEN p_start AND p_end
     AND (us.user_id IS NULL OR us.user_id != ALL(p_admin_ids))) AS session_count,
    (SELECT COUNT(*) FROM listing_views lv
     WHERE lv.viewed_at BETWEEN p_start AND p_end
     AND (lv.user_id IS NULL OR lv.user_id != ALL(p_admin_ids))) AS view_count,
    (SELECT COUNT(*) FROM user_searches us2
     WHERE us2.searched_at BETWEEN p_start AND p_end
     AND (us2.user_id IS NULL OR us2.user_id != ALL(p_admin_ids))) AS search_count,
    (SELECT COUNT(DISTINCT COALESCE(us3.user_id::text, us3.session_id))
     FROM user_searches us3
     WHERE us3.searched_at BETWEEN p_start AND p_end
     AND (us3.user_id IS NULL OR us3.user_id != ALL(p_admin_ids))) AS unique_searchers;
$$ LANGUAGE sql SECURITY DEFINER;

-- Funnel stage counts (replaces funnel/route.ts multiple queries)
CREATE OR REPLACE FUNCTION get_funnel_counts(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_admin_ids UUID[]
)
RETURNS TABLE(
  visitors BIGINT,
  searchers BIGINT,
  viewers BIGINT,
  signed_up BIGINT,
  engagers BIGINT,
  high_intent BIGINT,
  dealer_clickers BIGINT,
  drafters BIGINT
) AS $$
  SELECT
    (SELECT COUNT(*) FROM user_sessions s
     WHERE s.started_at BETWEEN p_start AND p_end
     AND (s.user_id IS NULL OR s.user_id != ALL(p_admin_ids))) AS visitors,
    (SELECT COUNT(DISTINCT s2.session_id) FROM user_searches s2
     WHERE s2.searched_at BETWEEN p_start AND p_end
     AND (s2.user_id IS NULL OR s2.user_id != ALL(p_admin_ids))) AS searchers,
    (SELECT COUNT(DISTINCT lv.session_id) FROM listing_views lv
     WHERE lv.viewed_at BETWEEN p_start AND p_end
     AND (lv.user_id IS NULL OR lv.user_id != ALL(p_admin_ids))) AS viewers,
    (SELECT COUNT(*) FROM profiles p
     WHERE p.created_at BETWEEN p_start AND p_end) AS signed_up,
    (SELECT COUNT(DISTINCT uf.user_id) FROM user_favorites uf
     WHERE uf.created_at BETWEEN p_start AND p_end
     AND uf.user_id != ALL(p_admin_ids)) AS engagers,
    (SELECT COUNT(DISTINCT ss.user_id) FROM saved_searches ss
     WHERE ss.created_at BETWEEN p_start AND p_end
     AND ss.user_id != ALL(p_admin_ids)) AS high_intent,
    (SELECT COUNT(DISTINCT COALESCE(dc.visitor_id, dc.session_id)) FROM dealer_clicks dc
     WHERE dc.created_at BETWEEN p_start AND p_end) AS dealer_clickers,
    (SELECT COUNT(DISTINCT ih.user_id) FROM inquiry_history ih
     WHERE ih.created_at BETWEEN p_start AND p_end
     AND ih.user_id != ALL(p_admin_ids)) AS drafters;
$$ LANGUAGE sql SECURITY DEFINER;
