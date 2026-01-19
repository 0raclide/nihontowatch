-- Migration 001: Dealer Tracking Tables
-- Run this first to create the core tables

-- 1. Daily aggregated dealer stats
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

    -- Inventory metrics
    active_listings INTEGER DEFAULT 0,
    total_value_jpy BIGINT DEFAULT 0,

    -- Conversion indicators
    listings_sold INTEGER DEFAULT 0,
    clicked_then_sold INTEGER DEFAULT 0,

    -- Computed metrics
    ctr DECIMAL(5,4) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(dealer_id, date)
);

-- 2. Listing impressions (when listings appear in search results)
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

-- 3. Enhanced click tracking
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

-- 4. Conversion tracking (clicked items that later sold)
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

-- 5. Dealer rankings (computed periodically)
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

-- Success message
SELECT 'Dealer tracking tables created successfully' as status;
