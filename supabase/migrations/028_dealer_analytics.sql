-- Migration 028: Dealer Analytics & Lead Tracking
-- Purpose: Track traffic, clicks, and engagement per dealer to prove ROI

-- =============================================================================
-- 1. CORE TABLES
-- =============================================================================

-- Daily aggregated dealer stats (pre-computed for performance)
CREATE TABLE IF NOT EXISTS dealer_daily_stats (
    id BIGSERIAL PRIMARY KEY,
    dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Traffic metrics
    impressions INTEGER DEFAULT 0,
    listing_views INTEGER DEFAULT 0,
    click_throughs INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,

    -- Engagement metrics
    favorites_added INTEGER DEFAULT 0,
    alerts_created INTEGER DEFAULT 0,
    total_dwell_ms BIGINT DEFAULT 0,
    avg_dwell_ms INTEGER DEFAULT 0,

    -- Inventory snapshot
    active_listings INTEGER DEFAULT 0,
    total_value_jpy BIGINT DEFAULT 0,

    -- Conversion indicators
    listings_sold INTEGER DEFAULT 0,
    clicked_then_sold INTEGER DEFAULT 0,

    -- Computed
    ctr DECIMAL(5,4) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(dealer_id, date)
);

-- Listing impressions (when listings appear in search results)
CREATE TABLE IF NOT EXISTS listing_impressions (
    id BIGSERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    visitor_id TEXT,
    session_id TEXT,
    search_query TEXT,
    filters JSONB,
    position INTEGER,
    page INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced click tracking with context
CREATE TABLE IF NOT EXISTS dealer_clicks (
    id BIGSERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    visitor_id TEXT,
    session_id TEXT,
    url TEXT NOT NULL,
    source TEXT DEFAULT 'listing',
    price_at_click DECIMAL(12,2),
    currency_at_click TEXT,
    search_query TEXT,
    referrer_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversion tracking (clicked items that later sold)
CREATE TABLE IF NOT EXISTS click_conversions (
    id BIGSERIAL PRIMARY KEY,
    click_id BIGINT NOT NULL REFERENCES dealer_clicks(id) ON DELETE CASCADE,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ NOT NULL,
    sold_at TIMESTAMPTZ NOT NULL,
    days_to_conversion INTEGER,
    click_price DECIMAL(12,2),
    sold_price DECIMAL(12,2),
    currency TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dealer rankings (computed periodically)
CREATE TABLE IF NOT EXISTS dealer_rankings (
    id BIGSERIAL PRIMARY KEY,
    dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    total_clicks INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    total_favorites INTEGER DEFAULT 0,
    clicks_rank INTEGER,
    impressions_rank INTEGER,
    ctr_rank INTEGER,
    engagement_rank INTEGER,
    clicks_percentile INTEGER,
    clicks_change_pct DECIMAL(5,2),
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dealer_id, period)
);

-- =============================================================================
-- 2. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_dealer_daily_stats_date ON dealer_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_dealer_daily_stats_dealer_date ON dealer_daily_stats(dealer_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_listing_impressions_listing ON listing_impressions(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_impressions_dealer ON listing_impressions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_listing_impressions_created ON listing_impressions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_impressions_dealer_date ON listing_impressions(dealer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dealer_clicks_dealer ON dealer_clicks(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_clicks_listing ON dealer_clicks(listing_id);
CREATE INDEX IF NOT EXISTS idx_dealer_clicks_created ON dealer_clicks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dealer_clicks_dealer_date ON dealer_clicks(dealer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_click_conversions_dealer ON click_conversions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_click_conversions_listing ON click_conversions(listing_id);

CREATE INDEX IF NOT EXISTS idx_dealer_rankings_period ON dealer_rankings(period, clicks_rank);

-- =============================================================================
-- 3. VIEWS
-- =============================================================================

-- Dealer summary view (last 30 days)
CREATE OR REPLACE VIEW v_dealer_summary AS
SELECT
    d.id AS dealer_id,
    d.name AS dealer_name,
    d.domain,
    COALESCE(SUM(s.impressions), 0)::INTEGER AS total_impressions_30d,
    COALESCE(SUM(s.click_throughs), 0)::INTEGER AS total_clicks_30d,
    COALESCE(SUM(s.listing_views), 0)::INTEGER AS total_views_30d,
    COALESCE(SUM(s.favorites_added), 0)::INTEGER AS total_favorites_30d,
    CASE
        WHEN SUM(s.impressions) > 0
        THEN ROUND(SUM(s.click_throughs)::DECIMAL / SUM(s.impressions) * 100, 2)
        ELSE 0
    END AS ctr_30d,
    MAX(s.active_listings) AS current_listings,
    MAX(s.total_value_jpy) AS current_inventory_value
FROM dealers d
LEFT JOIN dealer_daily_stats s ON d.id = s.dealer_id
    AND s.date >= CURRENT_DATE - INTERVAL '30 days'
WHERE d.is_active = true
GROUP BY d.id, d.name, d.domain
ORDER BY total_clicks_30d DESC;

-- Top performing listings by clicks
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
    COUNT(dc.id)::INTEGER AS click_count,
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

-- =============================================================================
-- 4. RLS POLICIES (for security)
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE dealer_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_rankings ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for API routes)
CREATE POLICY "Service role has full access to dealer_daily_stats"
    ON dealer_daily_stats FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to listing_impressions"
    ON listing_impressions FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to dealer_clicks"
    ON dealer_clicks FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to click_conversions"
    ON click_conversions FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to dealer_rankings"
    ON dealer_rankings FOR ALL
    USING (auth.role() = 'service_role');

-- Allow anon to insert impressions and clicks (for tracking)
CREATE POLICY "Anon can insert listing_impressions"
    ON listing_impressions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anon can insert dealer_clicks"
    ON dealer_clicks FOR INSERT
    WITH CHECK (true);
