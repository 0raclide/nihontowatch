-- Migration: Update price histogram RPC to 30 finer-grained log-spaced bins
-- Matches updated PRICE_HISTOGRAM.BOUNDARIES in constants.ts
-- Previous version (062) used 20 bins; this provides more visual granularity

CREATE OR REPLACE FUNCTION get_price_histogram(
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
  -- 30 log-spaced boundaries (JPY) — finer granularity for smooth histogram
  v_boundaries int[] := ARRAY[
    100000, 150000, 200000, 250000, 300000, 350000, 400000, 500000, 600000, 700000, 850000,
    1000000, 1200000, 1500000, 1800000, 2000000, 2500000, 3000000, 3500000, 4000000,
    5000000, 6000000, 7000000, 8500000, 10000000, 13000000, 16000000, 20000000, 30000000, 60000000
  ];
  -- Category type arrays (same as get_browse_facets)
  v_nihonto_types text[] := ARRAY[
    'katana', 'wakizashi', 'tanto', 'tachi', 'kodachi',
    'naginata', 'naginata naoshi', 'naginata-naoshi',
    'yari', 'ken', 'daisho'
  ];
  v_tosogu_types text[] := ARRAY[
    'tsuba', 'fuchi-kashira', 'fuchi_kashira', 'fuchi', 'kashira',
    'kozuka', 'kogatana', 'kogai', 'menuki', 'futatokoro',
    'mitokoromono', 'koshirae', 'tosogu'
  ];
  v_armor_types text[] := ARRAY[
    'armor', 'yoroi', 'gusoku', 'helmet', 'kabuto',
    'menpo', 'mengu', 'kote', 'suneate', 'do',
    'tanegashima', 'hinawaju'
  ];
  v_excluded_types text[] := ARRAY['stand', 'book', 'other'];
  v_category_types text[];
  v_cert_all_variants text[];
BEGIN
  -- Expand category to item types
  IF p_category = 'nihonto' THEN
    v_category_types := v_nihonto_types;
  ELSIF p_category = 'tosogu' THEN
    v_category_types := v_tosogu_types;
  ELSIF p_category = 'armor' THEN
    v_category_types := v_armor_types;
  ELSE
    v_category_types := NULL;
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
  -- Base CTE: universal filters + only priced items
  base AS (
    SELECT
      price_jpy,
      lower(item_type) AS item_type_lower,
      cert_type,
      dealer_id,
      historical_period,
      signature_status
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
      -- Minimum price filter
      AND (p_min_price_jpy = 0 OR price_jpy >= p_min_price_jpy)
      -- Data delay cutoff
      AND (p_delay_cutoff IS NULL OR first_seen_at <= p_delay_cutoff)
      -- Ask only (if true, no priced items shown — histogram empty)
      AND (NOT p_ask_only)
      -- Only priced items for histogram (ASK items excluded)
      AND price_jpy IS NOT NULL
  ),

  -- Apply all cross-filters EXCEPT price (histogram shows full distribution)
  filtered AS (
    SELECT price_jpy
    FROM base
    WHERE
      -- Category / item type filter
      (
        p_item_types IS NOT NULL AND item_type_lower = ANY(
          SELECT lower(unnest) FROM unnest(p_item_types)
        )
        OR (p_item_types IS NULL AND v_category_types IS NOT NULL AND item_type_lower = ANY(v_category_types))
        OR (p_item_types IS NULL AND v_category_types IS NULL)
      )
      -- Certification filter
      AND (v_cert_all_variants IS NULL OR cert_type = ANY(v_cert_all_variants))
      -- Dealer filter
      AND (p_dealers IS NULL OR dealer_id = ANY(p_dealers))
      -- Historical period filter
      AND (p_historical_periods IS NULL OR historical_period = ANY(p_historical_periods))
      -- Signature status filter
      AND (p_signature_statuses IS NULL OR signature_status = ANY(p_signature_statuses))
  ),

  -- Assign each priced item to a bucket index (0-29)
  -- width_bucket(value, array) returns 1..N+1, so subtract 1 for 0-based
  -- and clamp to [0, 29] range
  bucketed AS (
    SELECT LEAST(GREATEST(width_bucket(price_jpy, v_boundaries) - 1, 0), 29) AS bucket_idx
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
      count(*)::int AS total_priced,
      COALESCE(max(price_jpy), 0)::bigint AS max_price
    FROM filtered
  )

  SELECT jsonb_build_object(
    'buckets', COALESCE((SELECT jsonb_agg(jsonb_build_object('idx', idx, 'count', count)) FROM bucket_counts), '[]'::jsonb),
    'boundaries', to_jsonb(v_boundaries),
    'totalPriced', (SELECT total_priced FROM stats),
    'maxPrice', (SELECT max_price FROM stats)
  ) INTO result;

  RETURN result;
END;
$$;
