-- Dealer Intelligence RPCs
-- Batch engagement counts and saved search matching for dealer per-listing intelligence

-- 1. Batch listing engagement counts (30-day window)
-- Returns per-listing views, favorites, clicks, quickview opens, pinch zooms
-- Uses viewed_at for listing_views (rule #11), event_data->>'listingId' for activity_events (rule #13)
CREATE OR REPLACE FUNCTION get_batch_listing_engagement(
  p_listing_ids INT[],
  p_since TIMESTAMPTZ
)
RETURNS TABLE (
  listing_id INT,
  views BIGINT,
  favorites BIGINT,
  clicks BIGINT,
  quickviews BIGINT,
  pinch_zooms BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH ids AS (
    SELECT unnest(p_listing_ids) AS lid
  ),
  view_counts AS (
    SELECT lv.listing_id AS lid, COUNT(*) AS cnt
    FROM listing_views lv
    WHERE lv.listing_id = ANY(p_listing_ids)
      AND lv.viewed_at >= p_since
    GROUP BY lv.listing_id
  ),
  fav_counts AS (
    SELECT uf.listing_id AS lid, COUNT(*) AS cnt
    FROM user_favorites uf
    WHERE uf.listing_id = ANY(p_listing_ids)
      AND uf.created_at >= p_since
    GROUP BY uf.listing_id
  ),
  click_counts AS (
    SELECT dc.listing_id AS lid, COUNT(*) AS cnt
    FROM dealer_clicks dc
    WHERE dc.listing_id = ANY(p_listing_ids)
      AND dc.created_at >= p_since
    GROUP BY dc.listing_id
  ),
  qv_counts AS (
    SELECT (ae.event_data->>'listingId')::INT AS lid, COUNT(*) AS cnt
    FROM activity_events ae
    WHERE ae.event_type = 'quickview_open'
      AND ae.created_at >= p_since
      AND (ae.event_data->>'listingId')::INT = ANY(p_listing_ids)
    GROUP BY (ae.event_data->>'listingId')::INT
  ),
  pz_counts AS (
    SELECT (ae.event_data->>'listingId')::INT AS lid, COUNT(*) AS cnt
    FROM activity_events ae
    WHERE ae.event_type = 'image_pinch_zoom'
      AND ae.created_at >= p_since
      AND (ae.event_data->>'listingId')::INT = ANY(p_listing_ids)
    GROUP BY (ae.event_data->>'listingId')::INT
  )
  SELECT
    ids.lid AS listing_id,
    COALESCE(vc.cnt, 0) AS views,
    COALESCE(fc.cnt, 0) AS favorites,
    COALESCE(cc.cnt, 0) AS clicks,
    COALESCE(qc.cnt, 0) AS quickviews,
    COALESCE(pc.cnt, 0) AS pinch_zooms
  FROM ids
  LEFT JOIN view_counts vc ON vc.lid = ids.lid
  LEFT JOIN fav_counts fc ON fc.lid = ids.lid
  LEFT JOIN click_counts cc ON cc.lid = ids.lid
  LEFT JOIN qv_counts qc ON qc.lid = ids.lid
  LEFT JOIN pz_counts pc ON pc.lid = ids.lid;
$$;

-- 2. Count matching saved searches per listing
-- Matches active searches (with notifications enabled) against listing attributes
-- Skips text query matching (too complex for SQL, small fraction of searches)
CREATE OR REPLACE FUNCTION count_matching_saved_searches(
  p_listing_ids INT[]
)
RETURNS TABLE (
  listing_id INT,
  match_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH listings_data AS (
    SELECT
      l.id,
      l.item_type,
      l.cert_type,
      l.price_value,
      l.item_category
    FROM listings l
    WHERE l.id = ANY(p_listing_ids)
  ),
  active_searches AS (
    SELECT
      ss.id AS search_id,
      ss.search_criteria
    FROM saved_searches ss
    WHERE ss.is_active = TRUE
      AND ss.notification_frequency != 'none'
  ),
  matches AS (
    SELECT
      ld.id AS lid,
      COUNT(DISTINCT asrch.search_id) AS cnt
    FROM listings_data ld
    CROSS JOIN active_searches asrch
    WHERE
      -- item_type match (if specified)
      (
        asrch.search_criteria->'itemTypes' IS NULL
        OR jsonb_array_length(asrch.search_criteria->'itemTypes') = 0
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(asrch.search_criteria->'itemTypes') AS it
          WHERE LOWER(it) = LOWER(ld.item_type)
        )
      )
      -- certification match (if specified)
      AND (
        asrch.search_criteria->'certifications' IS NULL
        OR jsonb_array_length(asrch.search_criteria->'certifications') = 0
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(asrch.search_criteria->'certifications') AS c
          WHERE LOWER(c) = LOWER(ld.cert_type)
             OR (LOWER(c) = 'juyo' AND LOWER(ld.cert_type) IN ('juyo', 'juyo tosogu'))
             OR (LOWER(c) = 'hozon' AND LOWER(ld.cert_type) IN ('hozon', 'hozon tosogu'))
             OR (LOWER(c) = 'tokubetsu hozon' AND LOWER(ld.cert_type) IN ('tokubetsu hozon', 'tokubetsu hozon tosogu', 'tokuhozon'))
             OR (LOWER(c) = 'tokubetsu juyo' AND LOWER(ld.cert_type) IN ('tokubetsu juyo', 'tokuju'))
        )
      )
      -- category match (if specified)
      AND (
        asrch.search_criteria->>'category' IS NULL
        OR asrch.search_criteria->>'category' = ''
        OR LOWER(asrch.search_criteria->>'category') = LOWER(ld.item_category)
      )
      -- price range match (if specified)
      AND (
        (asrch.search_criteria->>'minPrice' IS NULL OR ld.price_value >= (asrch.search_criteria->>'minPrice')::NUMERIC)
      )
      AND (
        (asrch.search_criteria->>'maxPrice' IS NULL OR ld.price_value <= (asrch.search_criteria->>'maxPrice')::NUMERIC)
      )
    GROUP BY ld.id
  )
  SELECT
    u.lid AS listing_id,
    COALESCE(m.cnt, 0) AS match_count
  FROM unnest(p_listing_ids) AS u(lid)
  LEFT JOIN matches m ON m.lid = u.lid;
$$;
