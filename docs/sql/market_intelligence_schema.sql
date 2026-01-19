-- =============================================================================
-- Market Intelligence Database Schema
-- =============================================================================
-- Purpose: Provides analytics infrastructure for tracking market trends,
--          price distributions, and daily snapshots of the nihonto marketplace.
--
-- This schema creates:
--   1. market_daily_snapshots - Daily aggregate data for time-series analysis
--   2. Materialized views for fast aggregation by item_type, dealer, certification
--   3. Functions to refresh views and capture daily snapshots
--   4. Helper query functions for API routes
--
-- All SQL is idempotent (uses IF NOT EXISTS, ON CONFLICT)
-- Ready to run in Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- 1. MARKET DAILY SNAPSHOTS TABLE
-- =============================================================================
-- Stores daily market state for time-series analysis of market trends.
-- Captures aggregate statistics, price percentiles, and breakdowns by category.

CREATE TABLE IF NOT EXISTS market_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,

  -- Aggregate counts
  total_listings INTEGER NOT NULL,
  available_listings INTEGER NOT NULL,
  sold_listings INTEGER NOT NULL,
  new_listings_24h INTEGER NOT NULL DEFAULT 0,
  sold_24h INTEGER NOT NULL DEFAULT 0,
  price_changes_24h INTEGER NOT NULL DEFAULT 0,

  -- Market value (in JPY for consistency)
  total_market_value_jpy BIGINT NOT NULL,
  median_price_jpy INTEGER,
  avg_price_jpy INTEGER,

  -- Price percentiles for distribution analysis
  price_p10_jpy INTEGER,  -- 10th percentile (entry-level items)
  price_p25_jpy INTEGER,  -- 25th percentile (lower quartile)
  price_p75_jpy INTEGER,  -- 75th percentile (upper quartile)
  price_p90_jpy INTEGER,  -- 90th percentile (premium items)
  price_min_jpy INTEGER,
  price_max_jpy INTEGER,

  -- Breakdowns stored as JSONB for flexibility
  -- Format: { "KATANA": { "count": 100, "available": 80, "value_jpy": 10000000, "median_jpy": 500000 }, ... }
  category_breakdown JSONB NOT NULL DEFAULT '{}',
  -- Format: { "Aoi Art": { "dealer_id": 1, "count": 50, "available": 40, "value_jpy": 5000000 }, ... }
  dealer_breakdown JSONB NOT NULL DEFAULT '{}',
  -- Format: { "Juyo": { "count": 20, "available": 15, "value_jpy": 8000000 }, ... }
  certification_breakdown JSONB NOT NULL DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast date range queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON market_daily_snapshots(snapshot_date DESC);

-- Comment on table
COMMENT ON TABLE market_daily_snapshots IS 'Daily market state snapshots for time-series analysis of market trends';
COMMENT ON COLUMN market_daily_snapshots.category_breakdown IS 'JSONB breakdown by item_type with count, available, sold, value_jpy, median_jpy';
COMMENT ON COLUMN market_daily_snapshots.dealer_breakdown IS 'JSONB breakdown by dealer with dealer_id, count, available, value_jpy, median_jpy';
COMMENT ON COLUMN market_daily_snapshots.certification_breakdown IS 'JSONB breakdown by cert_type with count, available, value_jpy, median_jpy';


-- =============================================================================
-- 2. MATERIALIZED VIEWS FOR FAST AGGREGATION
-- =============================================================================
-- These views pre-compute expensive aggregations and can be refreshed on demand.
-- Use CONCURRENTLY refresh to avoid blocking reads during refresh.

-- -----------------------------------------------------------------------------
-- 2a. Market Summary by Item Type
-- -----------------------------------------------------------------------------
-- Provides counts, values, and price statistics grouped by item_type
-- (KATANA, WAKIZASHI, TANTO, TSUBA, etc.)

DROP MATERIALIZED VIEW IF EXISTS mv_market_by_item_type;

CREATE MATERIALIZED VIEW mv_market_by_item_type AS
SELECT
  item_type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_available = true) as available_count,
  COUNT(*) FILTER (WHERE is_sold = true) as sold_count,
  COALESCE(SUM(price_jpy) FILTER (WHERE is_available = true), 0) as total_value_jpy,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_jpy)
    FILTER (WHERE is_available = true AND price_jpy IS NOT NULL) as median_price_jpy,
  AVG(price_jpy) FILTER (WHERE is_available = true AND price_jpy IS NOT NULL) as avg_price_jpy,
  MIN(price_jpy) FILTER (WHERE is_available = true AND price_jpy IS NOT NULL) as min_price_jpy,
  MAX(price_jpy) FILTER (WHERE is_available = true AND price_jpy IS NOT NULL) as max_price_jpy
FROM listings
WHERE price_jpy IS NOT NULL
GROUP BY item_type;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_market_by_item_type
  ON mv_market_by_item_type(item_type);

COMMENT ON MATERIALIZED VIEW mv_market_by_item_type IS 'Pre-computed market statistics grouped by item_type';


-- -----------------------------------------------------------------------------
-- 2b. Market Summary by Dealer
-- -----------------------------------------------------------------------------
-- Provides counts and values grouped by dealer for dealer comparison

DROP MATERIALIZED VIEW IF EXISTS mv_market_by_dealer;

CREATE MATERIALIZED VIEW mv_market_by_dealer AS
SELECT
  d.id as dealer_id,
  d.name as dealer_name,
  d.domain as dealer_domain,
  d.country as dealer_country,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE l.is_available = true) as available_count,
  COUNT(*) FILTER (WHERE l.is_sold = true) as sold_count,
  COALESCE(SUM(l.price_jpy) FILTER (WHERE l.is_available = true), 0) as total_value_jpy,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l.price_jpy)
    FILTER (WHERE l.is_available = true AND l.price_jpy IS NOT NULL) as median_price_jpy,
  AVG(l.price_jpy) FILTER (WHERE l.is_available = true AND l.price_jpy IS NOT NULL) as avg_price_jpy
FROM listings l
JOIN dealers d ON l.dealer_id = d.id
WHERE l.price_jpy IS NOT NULL
GROUP BY d.id, d.name, d.domain, d.country;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_market_by_dealer
  ON mv_market_by_dealer(dealer_id);

COMMENT ON MATERIALIZED VIEW mv_market_by_dealer IS 'Pre-computed market statistics grouped by dealer';


-- -----------------------------------------------------------------------------
-- 2c. Market Summary by Certification
-- -----------------------------------------------------------------------------
-- Provides counts and values grouped by certification type (Juyo, Hozon, etc.)

DROP MATERIALIZED VIEW IF EXISTS mv_market_by_certification;

CREATE MATERIALIZED VIEW mv_market_by_certification AS
SELECT
  COALESCE(cert_type, 'Uncertified') as cert_type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_available = true) as available_count,
  COUNT(*) FILTER (WHERE is_sold = true) as sold_count,
  COALESCE(SUM(price_jpy) FILTER (WHERE is_available = true), 0) as total_value_jpy,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_jpy)
    FILTER (WHERE is_available = true AND price_jpy IS NOT NULL) as median_price_jpy,
  AVG(price_jpy) FILTER (WHERE is_available = true AND price_jpy IS NOT NULL) as avg_price_jpy
FROM listings
WHERE price_jpy IS NOT NULL
GROUP BY COALESCE(cert_type, 'Uncertified');

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_market_by_certification
  ON mv_market_by_certification(cert_type);

COMMENT ON MATERIALIZED VIEW mv_market_by_certification IS 'Pre-computed market statistics grouped by certification type';


-- =============================================================================
-- 3. FUNCTION TO REFRESH MATERIALIZED VIEWS
-- =============================================================================
-- Refreshes all market-related materialized views concurrently.
-- CONCURRENTLY allows reads while refreshing (requires unique index).

CREATE OR REPLACE FUNCTION refresh_market_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Refresh all market views concurrently to avoid blocking reads
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_by_item_type;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_by_dealer;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_by_certification;
END;
$$;

COMMENT ON FUNCTION refresh_market_views() IS 'Refreshes all market intelligence materialized views concurrently';


-- =============================================================================
-- 4. FUNCTION TO CAPTURE DAILY SNAPSHOT
-- =============================================================================
-- Captures a complete market snapshot for the current date.
-- Uses UPSERT to handle re-runs on the same day.
-- Returns the snapshot UUID.

CREATE OR REPLACE FUNCTION capture_market_snapshot()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_snapshot_id UUID;
  v_date DATE := CURRENT_DATE;
  v_category_breakdown JSONB;
  v_dealer_breakdown JSONB;
  v_cert_breakdown JSONB;
BEGIN
  -- Refresh views first to ensure fresh data
  PERFORM refresh_market_views();

  -- Build category breakdown from materialized view
  SELECT COALESCE(jsonb_object_agg(
    COALESCE(item_type, 'UNKNOWN'),
    jsonb_build_object(
      'count', total_count,
      'available', available_count,
      'sold', sold_count,
      'value_jpy', total_value_jpy,
      'median_jpy', COALESCE(median_price_jpy::BIGINT, 0),
      'avg_jpy', COALESCE(avg_price_jpy::BIGINT, 0),
      'min_jpy', COALESCE(min_price_jpy, 0),
      'max_jpy', COALESCE(max_price_jpy, 0)
    )
  ), '{}')
  INTO v_category_breakdown
  FROM mv_market_by_item_type;

  -- Build dealer breakdown from materialized view
  SELECT COALESCE(jsonb_object_agg(
    dealer_name,
    jsonb_build_object(
      'dealer_id', dealer_id,
      'domain', dealer_domain,
      'country', dealer_country,
      'count', total_count,
      'available', available_count,
      'sold', sold_count,
      'value_jpy', total_value_jpy,
      'median_jpy', COALESCE(median_price_jpy::BIGINT, 0),
      'avg_jpy', COALESCE(avg_price_jpy::BIGINT, 0)
    )
  ), '{}')
  INTO v_dealer_breakdown
  FROM mv_market_by_dealer;

  -- Build certification breakdown from materialized view
  SELECT COALESCE(jsonb_object_agg(
    cert_type,
    jsonb_build_object(
      'count', total_count,
      'available', available_count,
      'sold', sold_count,
      'value_jpy', total_value_jpy,
      'median_jpy', COALESCE(median_price_jpy::BIGINT, 0),
      'avg_jpy', COALESCE(avg_price_jpy::BIGINT, 0)
    )
  ), '{}')
  INTO v_cert_breakdown
  FROM mv_market_by_certification;

  -- Insert or update snapshot for today
  INSERT INTO market_daily_snapshots (
    snapshot_date,
    total_listings,
    available_listings,
    sold_listings,
    new_listings_24h,
    sold_24h,
    price_changes_24h,
    total_market_value_jpy,
    median_price_jpy,
    avg_price_jpy,
    price_p10_jpy,
    price_p25_jpy,
    price_p75_jpy,
    price_p90_jpy,
    price_min_jpy,
    price_max_jpy,
    category_breakdown,
    dealer_breakdown,
    certification_breakdown
  )
  SELECT
    v_date,
    COUNT(*),
    COUNT(*) FILTER (WHERE is_available = true),
    COUNT(*) FILTER (WHERE is_sold = true),
    COUNT(*) FILTER (WHERE first_seen_at >= NOW() - INTERVAL '24 hours'),
    COUNT(*) FILTER (WHERE is_sold = true AND last_scraped_at >= NOW() - INTERVAL '24 hours'),
    (SELECT COUNT(*) FROM price_history WHERE detected_at >= NOW() - INTERVAL '24 hours'),
    COALESCE(SUM(price_jpy) FILTER (WHERE is_available = true), 0),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_jpy)
      FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    AVG(price_jpy) FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY price_jpy)
      FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_jpy)
      FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price_jpy)
      FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY price_jpy)
      FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    MIN(price_jpy) FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    MAX(price_jpy) FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    v_category_breakdown,
    v_dealer_breakdown,
    v_cert_breakdown
  FROM listings
  WHERE price_jpy IS NOT NULL
  ON CONFLICT (snapshot_date) DO UPDATE SET
    total_listings = EXCLUDED.total_listings,
    available_listings = EXCLUDED.available_listings,
    sold_listings = EXCLUDED.sold_listings,
    new_listings_24h = EXCLUDED.new_listings_24h,
    sold_24h = EXCLUDED.sold_24h,
    price_changes_24h = EXCLUDED.price_changes_24h,
    total_market_value_jpy = EXCLUDED.total_market_value_jpy,
    median_price_jpy = EXCLUDED.median_price_jpy,
    avg_price_jpy = EXCLUDED.avg_price_jpy,
    price_p10_jpy = EXCLUDED.price_p10_jpy,
    price_p25_jpy = EXCLUDED.price_p25_jpy,
    price_p75_jpy = EXCLUDED.price_p75_jpy,
    price_p90_jpy = EXCLUDED.price_p90_jpy,
    price_min_jpy = EXCLUDED.price_min_jpy,
    price_max_jpy = EXCLUDED.price_max_jpy,
    category_breakdown = EXCLUDED.category_breakdown,
    dealer_breakdown = EXCLUDED.dealer_breakdown,
    certification_breakdown = EXCLUDED.certification_breakdown
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$;

COMMENT ON FUNCTION capture_market_snapshot() IS 'Captures a complete market snapshot for the current date. Re-running updates existing snapshot.';


-- =============================================================================
-- 5. HELPER QUERY FUNCTIONS FOR API ROUTES
-- =============================================================================
-- These functions provide clean interfaces for API route consumption.
-- Marked as STABLE since they don't modify data (enables query optimization).


-- -----------------------------------------------------------------------------
-- 5a. Get Market Overview
-- -----------------------------------------------------------------------------
-- Returns current market statistics for /api/admin/analytics/market/overview
-- Single-row result with all key metrics.

CREATE OR REPLACE FUNCTION get_market_overview()
RETURNS TABLE (
  total_listings BIGINT,
  available_listings BIGINT,
  sold_listings BIGINT,
  total_market_value_jpy BIGINT,
  median_price_jpy NUMERIC,
  avg_price_jpy NUMERIC,
  min_price_jpy BIGINT,
  max_price_jpy BIGINT,
  p10_jpy NUMERIC,
  p25_jpy NUMERIC,
  p75_jpy NUMERIC,
  p90_jpy NUMERIC,
  new_listings_24h BIGINT,
  sold_24h BIGINT,
  price_changes_24h BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE is_available = true)::BIGINT,
    COUNT(*) FILTER (WHERE is_sold = true)::BIGINT,
    COALESCE(SUM(price_jpy) FILTER (WHERE is_available = true), 0)::BIGINT,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_jpy)
      FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    AVG(price_jpy) FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    MIN(price_jpy) FILTER (WHERE is_available = true AND price_jpy IS NOT NULL)::BIGINT,
    MAX(price_jpy) FILTER (WHERE is_available = true AND price_jpy IS NOT NULL)::BIGINT,
    PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY price_jpy)
      FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_jpy)
      FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price_jpy)
      FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY price_jpy)
      FILTER (WHERE is_available = true AND price_jpy IS NOT NULL),
    COUNT(*) FILTER (WHERE first_seen_at >= NOW() - INTERVAL '24 hours')::BIGINT,
    COUNT(*) FILTER (WHERE is_sold = true AND last_scraped_at >= NOW() - INTERVAL '24 hours')::BIGINT,
    (SELECT COUNT(*) FROM price_history WHERE detected_at >= NOW() - INTERVAL '24 hours')::BIGINT
  FROM listings
  WHERE price_jpy IS NOT NULL;
$$;

COMMENT ON FUNCTION get_market_overview() IS 'Returns current market overview statistics including counts, values, and percentiles';


-- -----------------------------------------------------------------------------
-- 5b. Get Price Distribution Buckets
-- -----------------------------------------------------------------------------
-- Returns price histogram data for distribution charts.
-- Supports filtering by item_type, cert_type, and dealer_id.

CREATE OR REPLACE FUNCTION get_price_distribution(
  p_bucket_count INTEGER DEFAULT 20,
  p_item_type TEXT DEFAULT NULL,
  p_cert_type TEXT DEFAULT NULL,
  p_dealer_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
  bucket_num INTEGER,
  range_start BIGINT,
  range_end BIGINT,
  count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_min BIGINT;
  v_max BIGINT;
  v_bucket_width BIGINT;
BEGIN
  -- Validate bucket count
  IF p_bucket_count < 1 OR p_bucket_count > 100 THEN
    RAISE EXCEPTION 'bucket_count must be between 1 and 100';
  END IF;

  -- Get min/max for the filtered set
  SELECT MIN(price_jpy)::BIGINT, MAX(price_jpy)::BIGINT
  INTO v_min, v_max
  FROM listings
  WHERE is_available = true
    AND price_jpy IS NOT NULL
    AND (p_item_type IS NULL OR item_type = p_item_type)
    AND (p_cert_type IS NULL OR cert_type = p_cert_type)
    AND (p_dealer_id IS NULL OR dealer_id = p_dealer_id);

  -- Return empty if no data
  IF v_min IS NULL OR v_max IS NULL THEN
    RETURN;
  END IF;

  -- Handle case where all values are the same
  IF v_min = v_max THEN
    RETURN QUERY
    SELECT
      1::INTEGER as bucket_num,
      v_min as range_start,
      v_max as range_end,
      COUNT(*)::BIGINT as count
    FROM listings
    WHERE is_available = true
      AND price_jpy IS NOT NULL
      AND (p_item_type IS NULL OR item_type = p_item_type)
      AND (p_cert_type IS NULL OR cert_type = p_cert_type)
      AND (p_dealer_id IS NULL OR dealer_id = p_dealer_id);
    RETURN;
  END IF;

  -- Calculate bucket width
  v_bucket_width := CEIL((v_max - v_min)::NUMERIC / p_bucket_count);
  IF v_bucket_width = 0 THEN
    v_bucket_width := 1;
  END IF;

  RETURN QUERY
  SELECT
    WIDTH_BUCKET(price_jpy, v_min, v_max + 1, p_bucket_count)::INTEGER as bucket_num,
    (v_min + (WIDTH_BUCKET(price_jpy, v_min, v_max + 1, p_bucket_count) - 1) * v_bucket_width)::BIGINT as range_start,
    (v_min + WIDTH_BUCKET(price_jpy, v_min, v_max + 1, p_bucket_count) * v_bucket_width)::BIGINT as range_end,
    COUNT(*)::BIGINT as count
  FROM listings
  WHERE is_available = true
    AND price_jpy IS NOT NULL
    AND (p_item_type IS NULL OR item_type = p_item_type)
    AND (p_cert_type IS NULL OR cert_type = p_cert_type)
    AND (p_dealer_id IS NULL OR dealer_id = p_dealer_id)
  GROUP BY WIDTH_BUCKET(price_jpy, v_min, v_max + 1, p_bucket_count)
  ORDER BY bucket_num;
END;
$$;

COMMENT ON FUNCTION get_price_distribution IS 'Returns price distribution histogram with configurable buckets and optional filters';


-- -----------------------------------------------------------------------------
-- 5c. Get Market Trend Data
-- -----------------------------------------------------------------------------
-- Returns historical snapshot data for trend charts.
-- Useful for displaying market changes over time.

CREATE OR REPLACE FUNCTION get_market_trend(
  p_days INTEGER DEFAULT 30,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  snapshot_date DATE,
  total_listings INTEGER,
  available_listings INTEGER,
  sold_listings INTEGER,
  total_market_value_jpy BIGINT,
  median_price_jpy INTEGER,
  new_listings_24h INTEGER,
  sold_24h INTEGER,
  price_changes_24h INTEGER
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    mds.snapshot_date,
    mds.total_listings,
    mds.available_listings,
    mds.sold_listings,
    mds.total_market_value_jpy,
    mds.median_price_jpy,
    mds.new_listings_24h,
    mds.sold_24h,
    mds.price_changes_24h
  FROM market_daily_snapshots mds
  WHERE mds.snapshot_date <= p_end_date
    AND mds.snapshot_date > (p_end_date - p_days)
  ORDER BY mds.snapshot_date ASC;
$$;

COMMENT ON FUNCTION get_market_trend IS 'Returns historical market snapshots for trend analysis';


-- -----------------------------------------------------------------------------
-- 5d. Get Category Comparison
-- -----------------------------------------------------------------------------
-- Returns side-by-side statistics for multiple item types.

CREATE OR REPLACE FUNCTION get_category_comparison(
  p_item_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  item_type TEXT,
  total_count BIGINT,
  available_count BIGINT,
  sold_count BIGINT,
  total_value_jpy NUMERIC,
  median_price_jpy DOUBLE PRECISION,
  avg_price_jpy DOUBLE PRECISION,
  min_price_jpy BIGINT,
  max_price_jpy BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    mv.item_type,
    mv.total_count,
    mv.available_count,
    mv.sold_count,
    mv.total_value_jpy,
    mv.median_price_jpy,
    mv.avg_price_jpy,
    mv.min_price_jpy,
    mv.max_price_jpy
  FROM mv_market_by_item_type mv
  WHERE p_item_types IS NULL
    OR mv.item_type = ANY(p_item_types)
  ORDER BY mv.available_count DESC;
$$;

COMMENT ON FUNCTION get_category_comparison IS 'Returns market statistics for comparing item type categories';


-- -----------------------------------------------------------------------------
-- 5e. Get Dealer Rankings
-- -----------------------------------------------------------------------------
-- Returns dealers ranked by various metrics.

CREATE OR REPLACE FUNCTION get_dealer_rankings(
  p_order_by TEXT DEFAULT 'available_count',
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  dealer_id INTEGER,
  dealer_name TEXT,
  dealer_domain TEXT,
  dealer_country TEXT,
  total_count BIGINT,
  available_count BIGINT,
  sold_count BIGINT,
  total_value_jpy NUMERIC,
  median_price_jpy DOUBLE PRECISION,
  avg_price_jpy DOUBLE PRECISION,
  rank INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Validate order_by parameter to prevent SQL injection
  IF p_order_by NOT IN ('available_count', 'total_count', 'sold_count', 'total_value_jpy', 'median_price_jpy', 'avg_price_jpy') THEN
    RAISE EXCEPTION 'Invalid order_by parameter. Must be one of: available_count, total_count, sold_count, total_value_jpy, median_price_jpy, avg_price_jpy';
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT
      mv.dealer_id,
      mv.dealer_name,
      mv.dealer_domain,
      mv.dealer_country,
      mv.total_count,
      mv.available_count,
      mv.sold_count,
      mv.total_value_jpy,
      mv.median_price_jpy,
      mv.avg_price_jpy,
      ROW_NUMBER() OVER (ORDER BY %I DESC)::INTEGER as rank
    FROM mv_market_by_dealer mv
    ORDER BY %I DESC
    LIMIT %L',
    p_order_by, p_order_by, p_limit
  );
END;
$$;

COMMENT ON FUNCTION get_dealer_rankings IS 'Returns dealers ranked by specified metric (available_count, total_value_jpy, etc.)';


-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
-- Enable RLS on the snapshots table and set appropriate policies.
-- Public read access, authenticated write access for snapshot capture.

ALTER TABLE market_daily_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow public read access to snapshots
DROP POLICY IF EXISTS "Public read access to snapshots" ON market_daily_snapshots;
CREATE POLICY "Public read access to snapshots"
  ON market_daily_snapshots
  FOR SELECT
  USING (true);

-- Only allow service role to insert/update (for cron jobs)
DROP POLICY IF EXISTS "Service role can manage snapshots" ON market_daily_snapshots;
CREATE POLICY "Service role can manage snapshots"
  ON market_daily_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- 7. SCHEDULED JOBS (Supabase pg_cron)
-- =============================================================================
-- These commands set up automatic daily snapshot capture.
-- Run these separately in Supabase SQL editor if pg_cron is enabled.

-- Enable pg_cron extension (may already be enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily snapshot at 00:05 UTC
-- SELECT cron.schedule(
--   'capture-market-snapshot',
--   '5 0 * * *',  -- At 00:05 UTC every day
--   $$SELECT capture_market_snapshot()$$
-- );

-- Schedule view refresh every 6 hours
-- SELECT cron.schedule(
--   'refresh-market-views',
--   '0 */6 * * *',  -- Every 6 hours
--   $$SELECT refresh_market_views()$$
-- );


-- =============================================================================
-- 8. INITIAL DATA POPULATION
-- =============================================================================
-- Uncomment and run to capture the first snapshot immediately after setup.

-- SELECT capture_market_snapshot();


-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================
--
-- Get current market overview:
--   SELECT * FROM get_market_overview();
--
-- Get price distribution for katanas:
--   SELECT * FROM get_price_distribution(20, 'KATANA', NULL, NULL);
--
-- Get 30-day market trend:
--   SELECT * FROM get_market_trend(30);
--
-- Get top 10 dealers by inventory value:
--   SELECT * FROM get_dealer_rankings('total_value_jpy', 10);
--
-- Compare sword categories:
--   SELECT * FROM get_category_comparison(ARRAY['KATANA', 'WAKIZASHI', 'TANTO']);
--
-- Manually refresh views:
--   SELECT refresh_market_views();
--
-- Manually capture today's snapshot:
--   SELECT capture_market_snapshot();
--
-- =============================================================================
