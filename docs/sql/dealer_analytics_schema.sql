-- =============================================================================
-- DEALER ANALYTICS SCHEMA
-- =============================================================================
-- Purpose: Track and aggregate dealer performance metrics to prove ROI
--
-- Key metrics:
-- 1. Click-throughs (traffic sent to dealer)
-- 2. Impressions (listings shown in search results)
-- 3. Listing views (detail/quickview opens)
-- 4. Engagement (favorites, alerts, dwell time)
-- 5. Conversion correlation (clicks → sold)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DAILY DEALER STATS (aggregated for performance)
-- -----------------------------------------------------------------------------
-- Pre-computed daily stats per dealer to avoid expensive real-time queries

CREATE TABLE IF NOT EXISTS dealer_daily_stats (
    id BIGSERIAL PRIMARY KEY,
    dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Traffic metrics
    impressions INTEGER DEFAULT 0,           -- Times listings appeared in results
    listing_views INTEGER DEFAULT 0,         -- Detail/quickview opens
    click_throughs INTEGER DEFAULT 0,        -- Clicks to dealer site
    unique_visitors INTEGER DEFAULT 0,       -- Unique visitor_ids

    -- Engagement metrics
    favorites_added INTEGER DEFAULT 0,       -- Favorites added to their listings
    alerts_created INTEGER DEFAULT 0,        -- Alerts set on their listings
    total_dwell_ms BIGINT DEFAULT 0,         -- Total viewport dwell time
    avg_dwell_ms INTEGER DEFAULT 0,          -- Average dwell per view

    -- Inventory metrics (snapshot at end of day)
    active_listings INTEGER DEFAULT 0,       -- Available listings count
    total_value_jpy BIGINT DEFAULT 0,        -- Total inventory value

    -- Conversion indicators
    listings_sold INTEGER DEFAULT 0,         -- Listings that went sold this day
    clicked_then_sold INTEGER DEFAULT 0,     -- Listings clicked in past 7 days that sold

    -- Computed metrics
    ctr DECIMAL(5,4) DEFAULT 0,              -- click_throughs / impressions

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(dealer_id, date)
);

-- Index for fast date range queries
CREATE INDEX IF NOT EXISTS idx_dealer_daily_stats_date
    ON dealer_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_dealer_daily_stats_dealer_date
    ON dealer_daily_stats(dealer_id, date DESC);

-- -----------------------------------------------------------------------------
-- 2. LISTING IMPRESSIONS TABLE
-- -----------------------------------------------------------------------------
-- Track when listings appear in search results (for CTR calculation)

CREATE TABLE IF NOT EXISTS listing_impressions (
    id BIGSERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    visitor_id TEXT,                         -- Anonymous visitor ID
    session_id TEXT,                         -- Session ID

    -- Context
    search_query TEXT,                       -- What they searched for
    filters JSONB,                           -- Active filters
    position INTEGER,                        -- Position in results (1-indexed)
    page INTEGER DEFAULT 1,                  -- Which page of results

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for aggregation
CREATE INDEX IF NOT EXISTS idx_listing_impressions_listing
    ON listing_impressions(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_impressions_dealer
    ON listing_impressions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_listing_impressions_created
    ON listing_impressions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_impressions_dealer_date
    ON listing_impressions(dealer_id, created_at DESC);

-- Partition by month for performance (optional, for high volume)
-- CREATE TABLE listing_impressions_2025_01 PARTITION OF listing_impressions
--     FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- -----------------------------------------------------------------------------
-- 3. CLICK TRACKING ENHANCEMENT
-- -----------------------------------------------------------------------------
-- Add more context to external_link_click events
-- (This enhances the existing activity_events table)

-- Create a dedicated click tracking table for better analytics
CREATE TABLE IF NOT EXISTS dealer_clicks (
    id BIGSERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    visitor_id TEXT,
    session_id TEXT,

    -- Click context
    url TEXT NOT NULL,                       -- Destination URL
    source TEXT DEFAULT 'listing',           -- 'listing', 'quickview', 'dealer_page'

    -- Listing snapshot at click time (for conversion tracking)
    price_at_click DECIMAL(12,2),
    currency_at_click TEXT,
    was_available BOOLEAN DEFAULT TRUE,

    -- Attribution
    search_query TEXT,                       -- What search led here
    referrer_path TEXT,                      -- Internal page they came from

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dealer_clicks_dealer
    ON dealer_clicks(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_clicks_listing
    ON dealer_clicks(listing_id);
CREATE INDEX IF NOT EXISTS idx_dealer_clicks_created
    ON dealer_clicks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dealer_clicks_dealer_date
    ON dealer_clicks(dealer_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. CONVERSION TRACKING
-- -----------------------------------------------------------------------------
-- Track when clicked items later sell (correlation, not causation)

CREATE TABLE IF NOT EXISTS click_conversions (
    id BIGSERIAL PRIMARY KEY,
    click_id BIGINT NOT NULL REFERENCES dealer_clicks(id) ON DELETE CASCADE,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,

    -- Timing
    clicked_at TIMESTAMPTZ NOT NULL,
    sold_at TIMESTAMPTZ NOT NULL,
    days_to_conversion INTEGER,              -- Days between click and sale

    -- Value
    click_price DECIMAL(12,2),
    sold_price DECIMAL(12,2),
    currency TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_click_conversions_dealer
    ON click_conversions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_click_conversions_listing
    ON click_conversions(listing_id);

-- -----------------------------------------------------------------------------
-- 5. DEALER RANKINGS (computed periodically)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dealer_rankings (
    id BIGSERIAL PRIMARY KEY,
    dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    period TEXT NOT NULL,                    -- '7d', '30d', '90d', 'all'

    -- Absolute metrics
    total_clicks INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    total_favorites INTEGER DEFAULT 0,

    -- Rankings (1 = best)
    clicks_rank INTEGER,
    impressions_rank INTEGER,
    ctr_rank INTEGER,
    engagement_rank INTEGER,                 -- Composite score

    -- Percentiles
    clicks_percentile INTEGER,               -- Top X%

    -- Period comparison
    clicks_change_pct DECIMAL(5,2),          -- vs previous period

    computed_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(dealer_id, period)
);

CREATE INDEX IF NOT EXISTS idx_dealer_rankings_period
    ON dealer_rankings(period, clicks_rank);

-- -----------------------------------------------------------------------------
-- 6. AGGREGATION FUNCTIONS
-- -----------------------------------------------------------------------------

-- Function to aggregate daily stats for a dealer
CREATE OR REPLACE FUNCTION aggregate_dealer_daily_stats(
    p_dealer_id INTEGER,
    p_date DATE
) RETURNS void AS $$
DECLARE
    v_impressions INTEGER;
    v_views INTEGER;
    v_clicks INTEGER;
    v_unique_visitors INTEGER;
    v_favorites INTEGER;
    v_alerts INTEGER;
    v_total_dwell BIGINT;
    v_active_listings INTEGER;
    v_total_value BIGINT;
    v_listings_sold INTEGER;
BEGIN
    -- Count impressions for the day
    SELECT COUNT(*) INTO v_impressions
    FROM listing_impressions
    WHERE dealer_id = p_dealer_id
      AND created_at::date = p_date;

    -- Count listing views from activity_events
    SELECT COUNT(*) INTO v_views
    FROM activity_events
    WHERE event_type = 'listing_view'
      AND (event_data->>'dealerId')::integer = p_dealer_id
      AND created_at::date = p_date;

    -- Count click-throughs
    SELECT COUNT(*), COUNT(DISTINCT visitor_id)
    INTO v_clicks, v_unique_visitors
    FROM dealer_clicks
    WHERE dealer_id = p_dealer_id
      AND created_at::date = p_date;

    -- Count favorites added
    SELECT COUNT(*) INTO v_favorites
    FROM activity_events ae
    JOIN listings l ON (ae.event_data->>'listingId')::integer = l.id
    WHERE ae.event_type = 'favorite_add'
      AND l.dealer_id = p_dealer_id
      AND ae.created_at::date = p_date;

    -- Count alerts created
    SELECT COUNT(*) INTO v_alerts
    FROM activity_events ae
    JOIN listings l ON (ae.event_data->>'listingId')::integer = l.id
    WHERE ae.event_type = 'alert_create'
      AND l.dealer_id = p_dealer_id
      AND ae.created_at::date = p_date;

    -- Total dwell time
    SELECT COALESCE(SUM((event_data->>'dwellMs')::bigint), 0) INTO v_total_dwell
    FROM activity_events ae
    JOIN listings l ON (ae.event_data->>'listingId')::integer = l.id
    WHERE ae.event_type = 'viewport_dwell'
      AND l.dealer_id = p_dealer_id
      AND ae.created_at::date = p_date;

    -- Active listings count
    SELECT COUNT(*) INTO v_active_listings
    FROM listings
    WHERE dealer_id = p_dealer_id
      AND is_available = true;

    -- Total inventory value
    SELECT COALESCE(SUM(price_jpy), 0) INTO v_total_value
    FROM listings
    WHERE dealer_id = p_dealer_id
      AND is_available = true
      AND price_jpy IS NOT NULL;

    -- Listings sold today
    SELECT COUNT(*) INTO v_listings_sold
    FROM price_history ph
    JOIN listings l ON ph.listing_id = l.id
    WHERE l.dealer_id = p_dealer_id
      AND ph.change_type = 'sold'
      AND ph.detected_at::date = p_date;

    -- Upsert the daily stats
    INSERT INTO dealer_daily_stats (
        dealer_id, date, impressions, listing_views, click_throughs,
        unique_visitors, favorites_added, alerts_created, total_dwell_ms,
        avg_dwell_ms, active_listings, total_value_jpy, listings_sold,
        ctr, updated_at
    ) VALUES (
        p_dealer_id, p_date, v_impressions, v_views, v_clicks,
        v_unique_visitors, v_favorites, v_alerts, v_total_dwell,
        CASE WHEN v_views > 0 THEN v_total_dwell / v_views ELSE 0 END,
        v_active_listings, v_total_value, v_listings_sold,
        CASE WHEN v_impressions > 0 THEN v_clicks::decimal / v_impressions ELSE 0 END,
        NOW()
    )
    ON CONFLICT (dealer_id, date) DO UPDATE SET
        impressions = EXCLUDED.impressions,
        listing_views = EXCLUDED.listing_views,
        click_throughs = EXCLUDED.click_throughs,
        unique_visitors = EXCLUDED.unique_visitors,
        favorites_added = EXCLUDED.favorites_added,
        alerts_created = EXCLUDED.alerts_created,
        total_dwell_ms = EXCLUDED.total_dwell_ms,
        avg_dwell_ms = EXCLUDED.avg_dwell_ms,
        active_listings = EXCLUDED.active_listings,
        total_value_jpy = EXCLUDED.total_value_jpy,
        listings_sold = EXCLUDED.listings_sold,
        ctr = EXCLUDED.ctr,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate stats for all dealers for a date
CREATE OR REPLACE FUNCTION aggregate_all_dealer_stats(p_date DATE)
RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM dealers WHERE is_active = true
    LOOP
        PERFORM aggregate_dealer_daily_stats(r.id, p_date);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 7. VIEWS FOR EASY QUERYING
-- -----------------------------------------------------------------------------

-- Dealer summary view (last 30 days)
CREATE OR REPLACE VIEW v_dealer_summary AS
SELECT
    d.id AS dealer_id,
    d.name AS dealer_name,
    d.domain,
    d.country,
    COALESCE(SUM(s.impressions), 0) AS total_impressions_30d,
    COALESCE(SUM(s.click_throughs), 0) AS total_clicks_30d,
    COALESCE(SUM(s.listing_views), 0) AS total_views_30d,
    COALESCE(SUM(s.favorites_added), 0) AS total_favorites_30d,
    CASE
        WHEN SUM(s.impressions) > 0
        THEN ROUND(SUM(s.click_throughs)::decimal / SUM(s.impressions) * 100, 2)
        ELSE 0
    END AS ctr_30d,
    MAX(s.active_listings) AS current_listings,
    MAX(s.total_value_jpy) AS current_inventory_value
FROM dealers d
LEFT JOIN dealer_daily_stats s ON d.id = s.dealer_id
    AND s.date >= CURRENT_DATE - INTERVAL '30 days'
WHERE d.is_active = true
GROUP BY d.id, d.name, d.domain, d.country
ORDER BY total_clicks_30d DESC;

-- Top performing listings view
CREATE OR REPLACE VIEW v_top_listings_by_clicks AS
SELECT
    l.id AS listing_id,
    l.title,
    l.url,
    d.name AS dealer_name,
    l.price_value,
    l.price_currency,
    l.item_type,
    l.cert_type,
    COUNT(dc.id) AS click_count,
    l.is_available
FROM listings l
JOIN dealers d ON l.dealer_id = d.id
LEFT JOIN dealer_clicks dc ON l.id = dc.listing_id
    AND dc.created_at >= CURRENT_DATE - INTERVAL '30 days'
WHERE l.is_available = true
GROUP BY l.id, l.title, l.url, d.name, l.price_value, l.price_currency,
         l.item_type, l.cert_type, l.is_available
HAVING COUNT(dc.id) > 0
ORDER BY click_count DESC
LIMIT 100;

-- -----------------------------------------------------------------------------
-- 8. TRIGGERS FOR REAL-TIME UPDATES
-- -----------------------------------------------------------------------------

-- Trigger to detect sold items and create conversion records
CREATE OR REPLACE FUNCTION check_click_conversions()
RETURNS TRIGGER AS $$
BEGIN
    -- When a listing is marked as sold, check for recent clicks
    IF NEW.change_type = 'sold' THEN
        INSERT INTO click_conversions (
            click_id, listing_id, dealer_id, clicked_at, sold_at,
            days_to_conversion, click_price, sold_price, currency
        )
        SELECT
            dc.id,
            dc.listing_id,
            dc.dealer_id,
            dc.created_at,
            NEW.detected_at,
            EXTRACT(DAY FROM NEW.detected_at - dc.created_at)::integer,
            dc.price_at_click,
            NEW.new_price,
            COALESCE(dc.currency_at_click, 'JPY')
        FROM dealer_clicks dc
        WHERE dc.listing_id = NEW.listing_id
          AND dc.created_at >= NEW.detected_at - INTERVAL '30 days'
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_click_conversions
    AFTER INSERT ON price_history
    FOR EACH ROW
    EXECUTE FUNCTION check_click_conversions();

-- -----------------------------------------------------------------------------
-- 9. CRON JOB SUPPORT
-- -----------------------------------------------------------------------------

-- Function to run daily aggregation (call from cron)
CREATE OR REPLACE FUNCTION run_daily_dealer_aggregation()
RETURNS void AS $$
BEGIN
    -- Aggregate yesterday's stats (run after midnight)
    PERFORM aggregate_all_dealer_stats(CURRENT_DATE - INTERVAL '1 day');

    -- Also refresh today's partial stats
    PERFORM aggregate_all_dealer_stats(CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 10. GRANT PERMISSIONS
-- -----------------------------------------------------------------------------

-- Grant permissions to authenticated users (adjust role name as needed)
-- GRANT SELECT ON v_dealer_summary TO authenticated;
-- GRANT SELECT ON v_top_listings_by_clicks TO authenticated;

-- -----------------------------------------------------------------------------
-- SAMPLE QUERIES FOR DEALER REPORTS
-- -----------------------------------------------------------------------------

/*
-- Get dealer summary for report
SELECT * FROM v_dealer_summary WHERE dealer_id = 1;

-- Get daily trend for a dealer
SELECT date, impressions, click_throughs, ctr, unique_visitors
FROM dealer_daily_stats
WHERE dealer_id = 1
  AND date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date;

-- Get top performing listings for a dealer
SELECT l.title, l.price_value, l.price_currency, COUNT(dc.id) as clicks
FROM listings l
LEFT JOIN dealer_clicks dc ON l.id = dc.listing_id
WHERE l.dealer_id = 1
  AND dc.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY l.id
ORDER BY clicks DESC
LIMIT 10;

-- Get conversion rate (clicked items that sold)
SELECT
    COUNT(DISTINCT dc.listing_id) as clicked_listings,
    COUNT(DISTINCT cc.listing_id) as converted_listings,
    ROUND(COUNT(DISTINCT cc.listing_id)::decimal /
          NULLIF(COUNT(DISTINCT dc.listing_id), 0) * 100, 1) as conversion_rate
FROM dealer_clicks dc
LEFT JOIN click_conversions cc ON dc.id = cc.click_id
WHERE dc.dealer_id = 1
  AND dc.created_at >= CURRENT_DATE - INTERVAL '30 days';
*/
