-- Migration 004: Filtered Facets
-- Facets should reflect current filter selection (like oshi-v2)
-- When you select Tsuba, certification counts should show only certs for Tsuba items

DROP FUNCTION IF EXISTS get_listing_facets(TEXT);

CREATE OR REPLACE FUNCTION get_listing_facets(
  p_tab TEXT DEFAULT 'available',
  p_item_types TEXT[] DEFAULT NULL,
  p_certifications TEXT[] DEFAULT NULL,
  p_dealers INT[] DEFAULT NULL,
  p_query TEXT DEFAULT NULL,
  p_ask_only BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH
  -- Base filter: status + all selected filters
  filtered_listings AS (
    SELECT l.id, l.item_type, l.cert_type, l.dealer_id, l.title, l.smith, l.tosogu_maker, l.price_value
    FROM listings l
    WHERE
      -- Status filter
      CASE p_tab
        WHEN 'available' THEN (l.status = 'available' OR l.is_available = true)
        WHEN 'sold' THEN (l.status = 'sold' OR l.status = 'presumed_sold' OR l.is_sold = true)
        ELSE true
      END
      -- Item type filter (case-insensitive)
      AND (p_item_types IS NULL OR LOWER(l.item_type) = ANY(p_item_types))
      -- Certification filter
      AND (p_certifications IS NULL OR l.cert_type = ANY(p_certifications))
      -- Dealer filter
      AND (p_dealers IS NULL OR l.dealer_id = ANY(p_dealers))
      -- Text search
      AND (p_query IS NULL OR p_query = '' OR
           l.title ILIKE '%' || p_query || '%' OR
           l.smith ILIKE '%' || p_query || '%' OR
           l.tosogu_maker ILIKE '%' || p_query || '%')
      -- Ask only (price on request)
      AND (NOT p_ask_only OR l.price_value IS NULL)
  ),

  -- Aggregate item types FROM FILTERED results
  item_type_facet AS (
    SELECT
      LOWER(REPLACE(item_type, '_', '-')) AS value,
      COUNT(*) AS count
    FROM filtered_listings
    WHERE item_type IS NOT NULL
    GROUP BY LOWER(REPLACE(item_type, '_', '-'))
    ORDER BY count DESC
  ),

  -- Aggregate certifications FROM FILTERED results
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

  cert_aggregated AS (
    SELECT normalized_cert AS value, SUM(count)::int AS count
    FROM cert_facet
    GROUP BY normalized_cert
    ORDER BY count DESC
  ),

  -- Aggregate dealers FROM FILTERED results
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
    'total', (SELECT COUNT(*) FROM filtered_listings),
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
GRANT EXECUTE ON FUNCTION get_listing_facets(TEXT, TEXT[], TEXT[], INT[], TEXT, BOOLEAN) TO authenticated, anon;

COMMENT ON FUNCTION get_listing_facets IS
  'Returns filtered facet counts. Facets reflect current filter selection.';
