-- Migration: Add "No Papers" (none) option to certification filter
-- Allows users to browse items without any certification/designation
-- Feature request from collector Jan Lapacek

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
  v_category_types text[];
  v_cert_all_variants text[];
  v_cert_includes_none boolean := false;
  v_period_order text[] := ARRAY[
    'Heian', 'Kamakura', 'Nanbokucho', 'Muromachi', 'Momoyama',
    'Edo', 'Meiji', 'Taisho', 'Showa', 'Heisei', 'Reiwa'
  ];
BEGIN
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
        WHEN 'none' THEN
          v_cert_includes_none := true;
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
    -- If only 'none' was selected, set variants to NULL so cross-filter uses v_cert_includes_none alone
    IF array_length(v_cert_all_variants, 1) IS NULL OR array_length(v_cert_all_variants, 1) = 0 THEN
      v_cert_all_variants := NULL;
    END IF;
  END IF;

  WITH
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
      CASE p_tab
        WHEN 'available' THEN (status = 'available' OR is_available = true)
        WHEN 'sold' THEN (status = 'sold' OR status = 'presumed_sold' OR is_sold = true)
        ELSE true
      END
      AND (p_admin_hidden OR admin_hidden = false)
      AND lower(item_type) NOT IN (SELECT unnest(v_excluded_types))
      AND (
        p_min_price_jpy = 0
        OR price_value IS NULL
        OR price_jpy >= p_min_price_jpy
      )
      AND (p_delay_cutoff IS NULL OR first_seen_at <= p_delay_cutoff)
      AND (NOT p_ask_only OR price_value IS NULL)
  ),

  -- ITEM TYPE facets: filtered by certs, dealers, periods, sigs
  item_type_filtered AS (
    SELECT item_type_norm
    FROM base
    WHERE
      -- Cert cross-filter: handles variants + none (NULL)
      (
        p_certifications IS NULL
        OR (v_cert_all_variants IS NOT NULL AND v_cert_includes_none AND (cert_type = ANY(v_cert_all_variants) OR cert_type IS NULL))
        OR (v_cert_all_variants IS NOT NULL AND NOT v_cert_includes_none AND cert_type = ANY(v_cert_all_variants))
        OR (v_cert_all_variants IS NULL AND v_cert_includes_none AND cert_type IS NULL)
      )
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

  -- CERTIFICATION facets: filtered by category/itemTypes, dealers, periods, sigs
  -- (NOT filtered by certifications — that's the dimension we're counting)
  cert_filtered AS (
    SELECT cert_type
    FROM base
    WHERE
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
  -- Named cert counts (non-NULL cert_type)
  cert_counts_named AS (
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
  -- "No papers" count (NULL cert_type)
  cert_counts_none AS (
    SELECT 'none'::text AS value, count(*)::int AS count
    FROM cert_filtered
    WHERE cert_type IS NULL
  ),
  -- Combined cert counts
  cert_counts AS (
    SELECT value, count FROM cert_counts_named
    UNION ALL
    SELECT value, count FROM cert_counts_none WHERE count > 0
  ),

  -- DEALER facets: filtered by category/itemTypes, certs, periods, sigs
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
      -- Cert cross-filter: handles variants + none (NULL)
      AND (
        p_certifications IS NULL
        OR (v_cert_all_variants IS NOT NULL AND v_cert_includes_none AND (cert_type = ANY(v_cert_all_variants) OR cert_type IS NULL))
        OR (v_cert_all_variants IS NOT NULL AND NOT v_cert_includes_none AND cert_type = ANY(v_cert_all_variants))
        OR (v_cert_all_variants IS NULL AND v_cert_includes_none AND cert_type IS NULL)
      )
      AND (p_historical_periods IS NULL OR historical_period = ANY(p_historical_periods))
      AND (p_signature_statuses IS NULL OR signature_status = ANY(p_signature_statuses))
  ),
  dealer_counts AS (
    SELECT
      df.dealer_id AS id,
      d.name,
      d.name_ja,
      count(*)::int AS count
    FROM dealer_filtered df
    JOIN dealers d ON d.id = df.dealer_id
    GROUP BY df.dealer_id, d.name, d.name_ja
    ORDER BY count DESC
  ),

  -- HISTORICAL PERIOD facets: filtered by category/itemTypes, certs, dealers, sigs
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
      -- Cert cross-filter: handles variants + none (NULL)
      AND (
        p_certifications IS NULL
        OR (v_cert_all_variants IS NOT NULL AND v_cert_includes_none AND (cert_type = ANY(v_cert_all_variants) OR cert_type IS NULL))
        OR (v_cert_all_variants IS NOT NULL AND NOT v_cert_includes_none AND cert_type = ANY(v_cert_all_variants))
        OR (v_cert_all_variants IS NULL AND v_cert_includes_none AND cert_type IS NULL)
      )
      AND (p_dealers IS NULL OR dealer_id = ANY(p_dealers))
      AND (p_signature_statuses IS NULL OR signature_status = ANY(p_signature_statuses))
  ),
  period_counts AS (
    SELECT historical_period AS value, count(*)::int AS count
    FROM period_filtered
    WHERE historical_period IS NOT NULL AND historical_period != 'null'
    GROUP BY historical_period
  ),

  -- SIGNATURE STATUS facets: filtered by category/itemTypes, certs, dealers, periods
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
      -- Cert cross-filter: handles variants + none (NULL)
      AND (
        p_certifications IS NULL
        OR (v_cert_all_variants IS NOT NULL AND v_cert_includes_none AND (cert_type = ANY(v_cert_all_variants) OR cert_type IS NULL))
        OR (v_cert_all_variants IS NOT NULL AND NOT v_cert_includes_none AND cert_type = ANY(v_cert_all_variants))
        OR (v_cert_all_variants IS NULL AND v_cert_includes_none AND cert_type IS NULL)
      )
      AND (p_dealers IS NULL OR dealer_id = ANY(p_dealers))
      AND (p_historical_periods IS NULL OR historical_period = ANY(p_historical_periods))
  ),
  sig_counts AS (
    SELECT signature_status AS value, count(*)::int AS count
    FROM sig_filtered
    WHERE signature_status IS NOT NULL AND signature_status != 'null'
    GROUP BY signature_status
  )

  SELECT jsonb_build_object(
    'itemTypes', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count)) FROM item_type_counts), '[]'::jsonb),
    'certifications', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count)) FROM cert_counts), '[]'::jsonb),
    'dealers', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'name_ja', name_ja, 'count', count)) FROM dealer_counts), '[]'::jsonb),
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
