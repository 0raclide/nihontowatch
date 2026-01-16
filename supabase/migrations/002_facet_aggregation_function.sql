-- Migration 002: Create facet aggregation function
-- Solves Supabase's 1000-row limit by doing aggregation in the database
-- Pattern borrowed from oshi-v2's search_gold_with_facets approach

CREATE OR REPLACE FUNCTION get_listing_facets(
  p_tab TEXT DEFAULT 'available'  -- 'available' or 'sold'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH
  -- Filter listings by availability status
  filtered_listings AS (
    SELECT id, item_type, cert_type, dealer_id
    FROM listings
    WHERE
      CASE p_tab
        WHEN 'available' THEN (status = 'available' OR is_available = true)
        WHEN 'sold' THEN (status = 'sold' OR status = 'presumed_sold' OR is_sold = true)
        ELSE true
      END
  ),

  -- Aggregate item types
  item_type_facet AS (
    SELECT
      LOWER(REPLACE(item_type, '_', '-')) AS value,
      COUNT(*) AS count
    FROM filtered_listings
    WHERE item_type IS NOT NULL
    GROUP BY LOWER(REPLACE(item_type, '_', '-'))
    ORDER BY count DESC
  ),

  -- Aggregate certifications with normalization
  cert_facet AS (
    SELECT
      CASE LOWER(cert_type)
        WHEN 'juyo' THEN 'Juyo'
        WHEN 'tokuju' THEN 'Tokuju'
        WHEN 'tokubetsu juyo' THEN 'Tokuju'
        WHEN 'tokubetsu_juyo' THEN 'Tokuju'
        WHEN 'tokuhozon' THEN 'TokuHozon'
        WHEN 'tokubetsu hozon' THEN 'TokuHozon'
        WHEN 'tokubetsu_hozon' THEN 'TokuHozon'
        WHEN 'hozon' THEN 'Hozon'
        WHEN 'tokukicho' THEN 'TokuKicho'
        WHEN 'tokubetsu kicho' THEN 'TokuKicho'
        WHEN 'tokubetsu_kicho' THEN 'TokuKicho'
        ELSE cert_type
      END AS normalized_cert,
      COUNT(*) AS count
    FROM filtered_listings
    WHERE cert_type IS NOT NULL AND cert_type != 'null'
    GROUP BY normalized_cert
  ),

  -- Aggregate by normalized cert
  cert_aggregated AS (
    SELECT normalized_cert AS value, SUM(count)::int AS count
    FROM cert_facet
    GROUP BY normalized_cert
    ORDER BY count DESC
  ),

  -- Aggregate dealers
  dealer_facet AS (
    SELECT
      fl.dealer_id AS id,
      d.name,
      COUNT(*) AS count
    FROM filtered_listings fl
    JOIN dealers d ON d.id = fl.dealer_id
    GROUP BY fl.dealer_id, d.name
    ORDER BY count DESC
  )

  SELECT jsonb_build_object(
    'itemTypes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count))
      FROM item_type_facet
    ), '[]'::jsonb),
    'certifications', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count))
      FROM cert_aggregated
    ), '[]'::jsonb),
    'dealers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'count', count))
      FROM dealer_facet
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION get_listing_facets(TEXT) TO authenticated, anon;

COMMENT ON FUNCTION get_listing_facets(TEXT) IS
  'Returns aggregated facet counts for listings. Computes in database to avoid row limits.';
