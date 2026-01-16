-- Migration 005: Fix certification filter to handle variants
-- The main API uses CERT_VARIANTS mapping, SQL function needs same logic

-- First, normalize any remaining cert_type variants in the data
UPDATE listings SET cert_type = 'Tokuju' WHERE LOWER(cert_type) IN ('tokuju', 'tokubetsu juyo', 'tokubetsu_juyo') AND cert_type NOT IN ('Tokuju');
UPDATE listings SET cert_type = 'TokuHozon' WHERE LOWER(cert_type) IN ('tokuhozon', 'tokubetsu hozon', 'tokubetsu_hozon') AND cert_type NOT IN ('TokuHozon');
UPDATE listings SET cert_type = 'TokuKicho' WHERE LOWER(cert_type) IN ('tokukicho', 'tokubetsu kicho', 'tokubetsu_kicho') AND cert_type NOT IN ('TokuKicho');
UPDATE listings SET cert_type = 'Juyo' WHERE LOWER(cert_type) = 'juyo' AND cert_type != 'Juyo';
UPDATE listings SET cert_type = 'Hozon' WHERE LOWER(cert_type) = 'hozon' AND cert_type != 'Hozon';

-- Now update the function to handle variants in the filter
DROP FUNCTION IF EXISTS get_listing_facets(TEXT, TEXT[], TEXT[], INT[], TEXT, BOOLEAN);

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
  v_cert_variants TEXT[];
BEGIN
  -- Expand certification variants (same logic as API's CERT_VARIANTS)
  IF p_certifications IS NOT NULL THEN
    v_cert_variants := ARRAY[]::TEXT[];
    FOR i IN 1..array_length(p_certifications, 1) LOOP
      CASE p_certifications[i]
        WHEN 'Juyo' THEN v_cert_variants := v_cert_variants || ARRAY['Juyo', 'juyo'];
        WHEN 'Tokuju' THEN v_cert_variants := v_cert_variants || ARRAY['Tokuju', 'tokuju', 'Tokubetsu Juyo', 'tokubetsu_juyo'];
        WHEN 'TokuHozon' THEN v_cert_variants := v_cert_variants || ARRAY['TokuHozon', 'Tokubetsu Hozon', 'tokubetsu_hozon'];
        WHEN 'Hozon' THEN v_cert_variants := v_cert_variants || ARRAY['Hozon', 'hozon'];
        WHEN 'TokuKicho' THEN v_cert_variants := v_cert_variants || ARRAY['TokuKicho', 'Tokubetsu Kicho', 'tokubetsu_kicho'];
        ELSE v_cert_variants := v_cert_variants || ARRAY[p_certifications[i]];
      END CASE;
    END LOOP;
  ELSE
    v_cert_variants := NULL;
  END IF;

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
      -- Certification filter WITH VARIANTS
      AND (v_cert_variants IS NULL OR l.cert_type = ANY(v_cert_variants))
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

  -- Aggregate certifications FROM FILTERED results (with normalization)
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
  'Returns filtered facet counts with certification variant handling.';
