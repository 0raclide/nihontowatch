-- Migration: Add Japanese names for dealers (i18n)
-- All names verified from official dealer websites (title tags, headers, footers, 特定商取引法 pages)

-- Add the column
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS name_ja TEXT;

-- Japanese dealers (36 total)
UPDATE dealers SET name_ja = '葵美術' WHERE domain = 'aoijapan.com';
UPDATE dealers SET name_ja = 'あさひ刀剣' WHERE domain = 'asahitoken.jp';
UPDATE dealers SET name_ja = 'あやかし堂' WHERE domain = 'ayakashi.co.jp';
UPDATE dealers SET name_ja = '銀座長州屋' WHERE domain = 'choshuya.co.jp';
UPDATE dealers SET name_ja = 'イーソード' WHERE domain = 'e-sword.jp';
UPDATE dealers SET name_ja = '永楽堂' WHERE domain = 'eirakudo.shop';
UPDATE dealers SET name_ja = 'ギャラリー陽々' WHERE domain = 'galleryyouyou.com';
UPDATE dealers SET name_ja = '儀平屋' WHERE domain = 'giheiya.com';
UPDATE dealers SET name_ja = '銀座盛光堂' WHERE domain = 'ginzaseikodo.com';
UPDATE dealers SET name_ja = '江州屋刀剣店' WHERE domain = 'goushuya-nihontou.com';
UPDATE dealers SET name_ja = '兵左衛門百観音堂' WHERE domain = 'hyozaemon.jp';
UPDATE dealers SET name_ja = '飯田高遠堂' WHERE domain = 'iidakoendo.com';
UPDATE dealers SET name_ja = '干将庵' WHERE domain = 'kanshoan.com';
UPDATE dealers SET name_ja = '安東貿易' WHERE domain = 'katana-ando.co.jp';
UPDATE dealers SET name_ja = '丸英刀剣' WHERE domain = 'katanahanbai.com';
UPDATE dealers SET name_ja = '草薙の舎' WHERE domain = 'kusanaginosya.com';
UPDATE dealers SET name_ja = '明倫産業' WHERE domain = 'nipponto.co.jp';
UPDATE dealers SET name_ja = '刀剣高吉' WHERE domain = 'premi.co.jp';
UPDATE dealers SET name_ja = 'コレクション情報' WHERE domain = 'samurai-nippon.net';
UPDATE dealers SET name_ja = 'サムライ商会' WHERE domain = 'samuraishokai.jp';
UPDATE dealers SET name_ja = '刀剣徳川' WHERE domain = 'sanmei.com';
UPDATE dealers SET name_ja = '勝武堂' WHERE domain = 'shoubudou.co.jp';
UPDATE dealers SET name_ja = '杉江美術店' WHERE domain = 'sugieart.com';
UPDATE dealers SET name_ja = 'タイセイ堂' WHERE domain = 'taiseido.biz';
UPDATE dealers SET name_ja = '刀剣杉田' WHERE domain = 'token-net.com';
UPDATE dealers SET name_ja = '十拳' WHERE domain = 'tokka.biz';
UPDATE dealers SET name_ja = '刀剣小町' WHERE domain = 'toukenkomachi.com';
UPDATE dealers SET name_ja = '美術刀剣松本' WHERE domain = 'touken-matsumoto.jp';
UPDATE dealers SET name_ja = '刀剣坂田' WHERE domain = 'touken-sakata.com';
UPDATE dealers SET name_ja = '宝刀堂' WHERE domain = 'toukentakarado.com';
-- tsuba.info: Foreign-owned, English-only branding (no Japanese name used on site) — name_ja stays NULL
UPDATE dealers SET name_ja = 'つるぎの屋' WHERE domain = 'tsuruginoya.com';
UPDATE dealers SET name_ja = '和敬堂' WHERE domain = 'wakeidou.com';
UPDATE dealers SET name_ja = '銀座誠友堂' WHERE domain = 'world-seiyudo.com';
UPDATE dealers SET name_ja = '山城屋' WHERE domain = 'yamasiroya.com';
UPDATE dealers SET name_ja = '勇進堂' WHERE domain = 'yushindou.com';

-- International dealers: name_ja stays NULL (English name used in both locales)

-- Update the get_browse_facets RPC to include name_ja in dealer facets
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
      d.name_ja,
      count(*)::int AS count
    FROM dealer_filtered df
    JOIN dealers d ON d.id = df.dealer_id
    GROUP BY df.dealer_id, d.name, d.name_ja
    ORDER BY count DESC
  ),

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
