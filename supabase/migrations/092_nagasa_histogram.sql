-- Migration: Add nagasa (blade length) histogram RPC
-- Modeled on get_price_histogram (migration 089) but uses nagasa_cm column
-- Only returns data for nihonto category (swords have blade length, tosogu/armor don't)

CREATE OR REPLACE FUNCTION get_nagasa_histogram(
  p_tab text DEFAULT 'available',
  p_admin_hidden boolean DEFAULT false,
  p_delay_cutoff timestamptz DEFAULT NULL,
  p_min_price_jpy int DEFAULT 100000,
  p_item_types text[] DEFAULT NULL,
  p_category text DEFAULT 'nihonto',
  p_certifications text[] DEFAULT NULL,
  p_dealers int[] DEFAULT NULL,
  p_historical_periods text[] DEFAULT NULL,
  p_signature_statuses text[] DEFAULT NULL,
  p_ask_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result jsonb;
  -- 23 cm-based boundaries: tanto (~15-30cm) → wakizashi (~30-60cm) → katana (~60-78cm) → nodachi (80cm+)
  v_boundaries int[] := ARRAY[
    15, 20, 25, 28, 30, 33, 36, 40, 45, 50, 55, 60, 63, 66, 69, 72, 75, 78, 82, 87, 95, 105, 120
  ];
  -- Only nihonto types have nagasa
  v_nihonto_types text[] := ARRAY[
    'katana', 'wakizashi', 'tanto', 'tachi', 'kodachi',
    'naginata', 'naginata naoshi', 'naginata-naoshi',
    'yari', 'ken', 'daisho'
  ];
  v_excluded_types text[] := ARRAY['stand', 'book', 'other'];
  v_category_types text[];
  v_cert_all_variants text[];
BEGIN
  -- Only return data for nihonto category
  IF p_category <> 'nihonto' THEN
    RETURN jsonb_build_object(
      'buckets', '[]'::jsonb,
      'boundaries', to_jsonb(v_boundaries),
      'totalWithNagasa', 0,
      'maxNagasa', 0
    );
  END IF;

  -- Use specific item types if provided, otherwise nihonto types
  IF p_item_types IS NOT NULL THEN
    v_category_types := p_item_types;
  ELSE
    v_category_types := v_nihonto_types;
  END IF;

  -- Expand certification filter variants
  IF p_certifications IS NOT NULL THEN
    v_cert_all_variants := ARRAY[]::text[];
    FOR i IN 1..array_length(p_certifications, 1) LOOP
      CASE p_certifications[i]
        WHEN 'Juyo Bijutsuhin' THEN
          v_cert_all_variants := v_cert_all_variants || ARRAY['Juyo Bijutsuhin', 'JuBi', 'jubi'];
        WHEN 'Juyo' THEN
          v_cert_all_variants := v_cert_all_variants || ARRAY['Juyo', 'juyo'];
        WHEN 'Tokuju' THEN
          v_cert_all_variants := v_cert_all_variants || ARRAY['Tokuju', 'tokuju', 'Tokubetsu Juyo', 'tokubetsu_juyo'];
        WHEN 'TokuHozon' THEN
          v_cert_all_variants := v_cert_all_variants || ARRAY['TokuHozon', 'Tokubetsu Hozon', 'tokubetsu_hozon'];
        WHEN 'Hozon' THEN
          v_cert_all_variants := v_cert_all_variants || ARRAY['Hozon', 'hozon'];
        WHEN 'TokuKicho' THEN
          v_cert_all_variants := v_cert_all_variants || ARRAY['TokuKicho', 'Tokubetsu Kicho', 'tokubetsu_kicho'];
        ELSE
          v_cert_all_variants := v_cert_all_variants || ARRAY[p_certifications[i]];
      END CASE;
    END LOOP;
  END IF;

  WITH
  -- Base CTE: universal filters + only items with nagasa
  base AS (
    SELECT
      nagasa_cm,
      lower(item_type) AS item_type_lower,
      cert_type,
      dealer_id,
      historical_period,
      signature_status,
      price_jpy,
      price_value
    FROM listings
    WHERE
      -- Status filter
      CASE p_tab
        WHEN 'available' THEN (status = 'available' OR is_available = true)
        WHEN 'sold' THEN (status = 'sold' OR status = 'presumed_sold' OR is_sold = true)
        ELSE true
      END
      -- Admin hidden
      AND (p_admin_hidden OR admin_hidden = false)
      -- Excluded types
      AND lower(item_type) NOT IN (SELECT unnest(v_excluded_types))
      -- Minimum price filter (same logic as price histogram — allow ASK items through)
      AND (p_min_price_jpy = 0 OR price_jpy >= p_min_price_jpy OR price_value IS NULL)
      -- Data delay cutoff
      AND (p_delay_cutoff IS NULL OR first_seen_at <= p_delay_cutoff)
      -- Only items with nagasa for histogram
      AND nagasa_cm IS NOT NULL
  ),

  -- Apply all cross-filters EXCEPT nagasa (show full nagasa distribution)
  filtered AS (
    SELECT nagasa_cm
    FROM base
    WHERE
      -- Category / item type filter
      (
        p_item_types IS NOT NULL AND item_type_lower = ANY(
          SELECT lower(unnest) FROM unnest(p_item_types)
        )
        OR (p_item_types IS NULL AND item_type_lower = ANY(v_nihonto_types))
      )
      -- Certification filter
      AND (v_cert_all_variants IS NULL OR cert_type = ANY(v_cert_all_variants))
      -- Dealer filter
      AND (p_dealers IS NULL OR dealer_id = ANY(p_dealers))
      -- Historical period filter
      AND (p_historical_periods IS NULL OR historical_period = ANY(p_historical_periods))
      -- Signature status filter
      AND (p_signature_statuses IS NULL OR signature_status = ANY(p_signature_statuses))
      -- Ask only filter
      AND (NOT p_ask_only OR price_value IS NULL)
      -- Price filter (cross-filter — show nagasa distribution for current price range)
      AND (p_min_price_jpy = 0 OR price_jpy >= p_min_price_jpy OR price_value IS NULL)
  ),

  -- Assign each item to a bucket index (0-22)
  bucketed AS (
    SELECT LEAST(GREATEST(width_bucket(nagasa_cm::numeric, ARRAY[15,20,25,28,30,33,36,40,45,50,55,60,63,66,69,72,75,78,82,87,95,105,120]::numeric[]) - 1, 0), 22) AS bucket_idx
    FROM filtered
  ),

  -- Count per bucket
  bucket_counts AS (
    SELECT bucket_idx AS idx, count(*)::int AS count
    FROM bucketed
    GROUP BY bucket_idx
    ORDER BY bucket_idx
  ),

  -- Aggregate stats
  stats AS (
    SELECT
      count(*)::int AS total_with_nagasa,
      COALESCE(max(nagasa_cm), 0)::numeric AS max_nagasa
    FROM filtered
  )

  SELECT jsonb_build_object(
    'buckets', COALESCE((SELECT jsonb_agg(jsonb_build_object('idx', idx, 'count', count)) FROM bucket_counts), '[]'::jsonb),
    'boundaries', to_jsonb(v_boundaries),
    'totalWithNagasa', (SELECT total_with_nagasa FROM stats),
    'maxNagasa', (SELECT max_nagasa FROM stats)
  ) INTO result;

  RETURN result;
END;
$$;
