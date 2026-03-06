-- Fix alert count deduplication: count unique USERS, not unique SEARCHES
-- Also fixes:
--   1. category='all' treated as non-matching (should mean "no restriction")
--   2. dealer filter not checked (search for dealer=[52] matched all dealers)
--   3. query text not checked (search for "Masamune" matched any katana)
--      → Handled by excluding searches that have a text query (conservative:
--        we'd rather undercount than overcount)

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
      l.item_category,
      l.dealer_id
    FROM listings l
    WHERE l.id = ANY(p_listing_ids)
  ),
  active_searches AS (
    SELECT
      ss.id AS search_id,
      ss.user_id,
      ss.search_criteria
    FROM saved_searches ss
    WHERE ss.is_active = TRUE
      AND ss.notification_frequency != 'none'
      -- Exclude searches with text queries (can't match accurately in SQL)
      AND (
        ss.search_criteria->>'query' IS NULL
        OR ss.search_criteria->>'query' = ''
      )
  ),
  matches AS (
    SELECT
      ld.id AS lid,
      COUNT(DISTINCT asrch.user_id) AS cnt
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
      -- category match (if specified; 'all' = no restriction)
      AND (
        asrch.search_criteria->>'category' IS NULL
        OR asrch.search_criteria->>'category' = ''
        OR asrch.search_criteria->>'category' = 'all'
        OR LOWER(asrch.search_criteria->>'category') = LOWER(ld.item_category)
      )
      -- price range match (if specified)
      AND (
        (asrch.search_criteria->>'minPrice' IS NULL OR ld.price_value >= (asrch.search_criteria->>'minPrice')::NUMERIC)
      )
      AND (
        (asrch.search_criteria->>'maxPrice' IS NULL OR ld.price_value <= (asrch.search_criteria->>'maxPrice')::NUMERIC)
      )
      -- dealer filter match (if specified; empty/null = no restriction)
      AND (
        asrch.search_criteria->'dealers' IS NULL
        OR jsonb_array_length(asrch.search_criteria->'dealers') = 0
        OR ld.dealer_id::TEXT IN (
          SELECT jsonb_array_elements_text(asrch.search_criteria->'dealers')
        )
      )
    GROUP BY ld.id
  )
  SELECT
    u.lid AS listing_id,
    COALESCE(m.cnt, 0) AS match_count
  FROM unnest(p_listing_ids) AS u(lid)
  LEFT JOIN matches m ON m.lid = u.lid;
$$;
