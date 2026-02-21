-- Migration: 077_fix_top_listings_rpc.sql
-- Purpose: Fix 3 bugs in get_top_listings RPC:
--   1. Favorites didn't exclude admin users (views did)
--   2. Favorites-only listings (0 views) were invisible due to LEFT JOIN from listing_views
--   3. Favorites were period-scoped, so old favorites showed as 0
-- Changes:
--   - Add p_sort parameter so SQL handles ORDER BY (eliminates JS re-sort hack)
--   - Use FULL OUTER JOIN between views CTE and favorites CTE
--   - Favorites CTE: exclude admin users, count ALL current favorites (no date filter)

DROP FUNCTION IF EXISTS get_top_listings(TIMESTAMPTZ, TIMESTAMPTZ, UUID[], INT);

CREATE OR REPLACE FUNCTION get_top_listings(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_admin_ids UUID[],
  p_limit INT DEFAULT 20,
  p_sort TEXT DEFAULT 'views'
)
RETURNS TABLE(
  listing_id BIGINT,
  view_count BIGINT,
  unique_viewers BIGINT,
  favorite_count BIGINT
) AS $$
  WITH views AS (
    SELECT
      lv.listing_id,
      COUNT(*) AS view_count,
      COUNT(DISTINCT lv.session_id) AS unique_viewers
    FROM listing_views lv
    WHERE lv.viewed_at BETWEEN p_start AND p_end
      AND (lv.user_id IS NULL OR lv.user_id != ALL(p_admin_ids))
    GROUP BY lv.listing_id
  ),
  favs AS (
    SELECT
      uf.listing_id,
      COUNT(*) AS favorite_count
    FROM user_favorites uf
    WHERE uf.user_id != ALL(p_admin_ids)
    GROUP BY uf.listing_id
  )
  SELECT
    COALESCE(v.listing_id, f.listing_id) AS listing_id,
    COALESCE(v.view_count, 0) AS view_count,
    COALESCE(v.unique_viewers, 0) AS unique_viewers,
    COALESCE(f.favorite_count, 0) AS favorite_count
  FROM views v
  FULL OUTER JOIN favs f ON f.listing_id = v.listing_id
  ORDER BY
    CASE WHEN p_sort = 'favorites'
      THEN COALESCE(f.favorite_count, 0) ELSE COALESCE(v.view_count, 0) END DESC,
    CASE WHEN p_sort = 'favorites'
      THEN COALESCE(v.view_count, 0) ELSE COALESCE(f.favorite_count, 0) END DESC
  LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;
