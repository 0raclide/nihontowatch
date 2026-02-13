-- Migration: Replace JS-side facet counting with a single SQL RPC function
-- Reduces browse API from 50-100+ Supabase round-trips to 1 for facets
--
-- The function implements standard cross-filter faceted search:
-- Each facet dimension is filtered by all OTHER active filters (but not its own)

-- Indexes to support facet GROUP BY queries
CREATE INDEX IF NOT EXISTS idx_listings_historical_period
  ON listings (historical_period)
  WHERE historical_period IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_signature_status
  ON listings (signature_status)
  WHERE signature_status IS NOT NULL;

-- Main facet RPC function
CREATE OR REPLACE FUNCTION get_browse_facets(
  p_tab text DEFAULT 'available',
  p_admin_hidden boolean DEFAULT false,
  p_delay_cutoff timestamptz DEFAULT NULL,
  p_min_price_jpy int DEFAULT 100000,
  p_item_types text[] DEFAULT NULL,
  p_category text DEFAULT 'all',
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
  -- Effective item types for category expansion
  v_category_types text[];
  -- Cert variant expansion arrays
  v_cert_all_variants text[];
  -- Period sort order
  v_period_order text[] := ARRAY[
    'Heian', 'Kamakura', 'Nanbokucho', 'Muromachi', 'Momoyama',
    'Edo', 'Meiji', 'Taisho', 'Showa', 'Heisei', 'Reiwa'
  ];
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
  -- Base CTE: shared filters that apply to ALL facets
  base AS (
    SELECT
      id,
      lower(item_type) AS item_type_lower,
      CASE
        WHEN lower(item_type) = 'fuchi_kashira' THEN 'fuchi-kashira'
        ELSE lower(item_type)
      END AS item_type_norm,
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
        ELSE true  -- 'all'
      END
      -- Admin hidden filter
      AND (p_admin_hidden OR admin_hidden = false)
      -- Excluded types
      AND lower(item_type) NOT IN (SELECT unnest(v_excluded_types))
      -- Minimum price filter (allow ASK listings through)
      AND (
        p_min_price_jpy = 0
        OR price_value IS NULL
        OR price_jpy >= p_min_price_jpy
      )
      -- Data delay cutoff
      AND (p_delay_cutoff IS NULL OR first_seen_at <= p_delay_cutoff)
      -- Ask only
      AND (NOT p_ask_only OR price_value IS NULL)
  ),

  -- ============================================================
  -- ITEM TYPE facets: filtered by certs, dealers, periods, sigs
  -- (NOT filtered by category/itemTypes — that's the dimension we're counting)
  -- ============================================================
  item_type_filtered AS (
    SELECT item_type_norm
    FROM base
    WHERE
      (v_cert_all_variants IS NULL OR cert_type = ANY(v_cert_all_variants))
      AND (p_dealers IS NULL OR dealer_id = ANY(p_dealers))
      AND (p_historical_periods IS NULL OR historical_period = ANY(p_historical_periods))
      AND (p_signature_statuses IS NULL OR signature_status = ANY(p_signature_statuses))
  ),
  item_type_counts AS (
    SELECT item_type_norm AS value, count(*)::int AS count
    FROM item_type_filtered
    WHERE item_type_norm IS NOT NULL
    GROUP BY item_type_norm
    ORDER BY count DESC
  ),

  -- ============================================================
  -- CERTIFICATION facets: filtered by category/itemTypes, dealers, periods, sigs
  -- (NOT filtered by certifications — that's the dimension we're counting)
  -- ============================================================
  cert_filtered AS (
    SELECT cert_type
    FROM base
    WHERE
      -- Apply category/item type filter
      (
        p_item_types IS NOT NULL AND item_type_lower = ANY(
          SELECT lower(unnest) FROM unnest(p_item_types)
        )
        OR (p_item_types IS NULL AND v_category_types IS NOT NULL AND item_type_lower = ANY(v_category_types))
        OR (p_item_types IS NULL AND v_category_types IS NULL)
      )
      AND (p_dealers IS NULL OR dealer_id = ANY(p_dealers))
      AND (p_historical_periods IS NULL OR historical_period = ANY(p_historical_periods))
      AND (p_signature_statuses IS NULL OR signature_status = ANY(p_signature_statuses))
  ),
  cert_counts AS (
    SELECT
      CASE lower(cert_type)
        WHEN 'juyo bijutsuhin' THEN 'Juyo Bijutsuhin'
        WHEN 'jubi' THEN 'Juyo Bijutsuhin'
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
      END AS value,
      count(*)::int AS count
    FROM cert_filtered
    WHERE cert_type IS NOT NULL AND cert_type != 'null'
    GROUP BY value
    ORDER BY count DESC
  ),

  -- ============================================================
  -- DEALER facets: filtered by category/itemTypes, certs, periods, sigs
  -- (NOT filtered by dealers — that's the dimension we're counting)
  -- ============================================================
  dealer_filtered AS (
    SELECT dealer_id
    FROM base
    WHERE
      (
        p_item_types IS NOT NULL AND item_type_lower = ANY(
          SELECT lower(unnest) FROM unnest(p_item_types)
        )
        OR (p_item_types IS NULL AND v_category_types IS NOT NULL AND item_type_lower = ANY(v_category_types))
        OR (p_item_types IS NULL AND v_category_types IS NULL)
      )
      AND (v_cert_all_variants IS NULL OR cert_type = ANY(v_cert_all_variants))
      AND (p_historical_periods IS NULL OR historical_period = ANY(p_historical_periods))
      AND (p_signature_statuses IS NULL OR signature_status = ANY(p_signature_statuses))
  ),
  dealer_counts AS (
    SELECT
      df.dealer_id AS id,
      d.name,
      count(*)::int AS count
    FROM dealer_filtered df
    JOIN dealers d ON d.id = df.dealer_id
    GROUP BY df.dealer_id, d.name
    ORDER BY count DESC
  ),

  -- ============================================================
  -- HISTORICAL PERIOD facets: filtered by category/itemTypes, certs, dealers, sigs
  -- (NOT filtered by periods — that's the dimension we're counting)
  -- ============================================================
  period_filtered AS (
    SELECT historical_period
    FROM base
    WHERE
      (
        p_item_types IS NOT NULL AND item_type_lower = ANY(
          SELECT lower(unnest) FROM unnest(p_item_types)
        )
        OR (p_item_types IS NULL AND v_category_types IS NOT NULL AND item_type_lower = ANY(v_category_types))
        OR (p_item_types IS NULL AND v_category_types IS NULL)
      )
      AND (v_cert_all_variants IS NULL OR cert_type = ANY(v_cert_all_variants))
      AND (p_dealers IS NULL OR dealer_id = ANY(p_dealers))
      AND (p_signature_statuses IS NULL OR signature_status = ANY(p_signature_statuses))
  ),
  period_counts AS (
    SELECT historical_period AS value, count(*)::int AS count
    FROM period_filtered
    WHERE historical_period IS NOT NULL AND historical_period != 'null'
    GROUP BY historical_period
  ),

  -- ============================================================
  -- SIGNATURE STATUS facets: filtered by category/itemTypes, certs, dealers, periods
  -- (NOT filtered by signatureStatuses — that's the dimension we're counting)
  -- ============================================================
  sig_filtered AS (
    SELECT signature_status
    FROM base
    WHERE
      (
        p_item_types IS NOT NULL AND item_type_lower = ANY(
          SELECT lower(unnest) FROM unnest(p_item_types)
        )
        OR (p_item_types IS NULL AND v_category_types IS NOT NULL AND item_type_lower = ANY(v_category_types))
        OR (p_item_types IS NULL AND v_category_types IS NULL)
      )
      AND (v_cert_all_variants IS NULL OR cert_type = ANY(v_cert_all_variants))
      AND (p_dealers IS NULL OR dealer_id = ANY(p_dealers))
      AND (p_historical_periods IS NULL OR historical_period = ANY(p_historical_periods))
  ),
  sig_counts AS (
    SELECT signature_status AS value, count(*)::int AS count
    FROM sig_filtered
    WHERE signature_status IS NOT NULL AND signature_status != 'null'
    GROUP BY signature_status
  )

  -- Assemble final JSONB result
  SELECT jsonb_build_object(
    'itemTypes', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count)) FROM item_type_counts), '[]'::jsonb),
    'certifications', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count)) FROM cert_counts), '[]'::jsonb),
    'dealers', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'count', count)) FROM dealer_counts), '[]'::jsonb),
    'historicalPeriods', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count) ORDER BY
        CASE value
          WHEN 'Heian' THEN 1
          WHEN 'Kamakura' THEN 2
          WHEN 'Nanbokucho' THEN 3
          WHEN 'Muromachi' THEN 4
          WHEN 'Momoyama' THEN 5
          WHEN 'Edo' THEN 6
          WHEN 'Meiji' THEN 7
          WHEN 'Taisho' THEN 8
          WHEN 'Showa' THEN 9
          WHEN 'Heisei' THEN 10
          WHEN 'Reiwa' THEN 11
          ELSE 999
        END
      ) FROM period_counts),
      '[]'::jsonb
    ),
    'signatureStatuses', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count) ORDER BY
        CASE value WHEN 'signed' THEN 0 ELSE 1 END, value
      ) FROM sig_counts),
      '[]'::jsonb
    )
  ) INTO result;

  RETURN result;
END;
$$;
