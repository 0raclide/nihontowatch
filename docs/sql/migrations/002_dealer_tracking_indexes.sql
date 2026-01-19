-- Migration 002: Dealer Tracking Indexes
-- Run after tables are created

-- Indexes for dealer_daily_stats
CREATE INDEX IF NOT EXISTS idx_dealer_daily_stats_date
    ON dealer_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_dealer_daily_stats_dealer_date
    ON dealer_daily_stats(dealer_id, date DESC);

-- Indexes for listing_impressions
CREATE INDEX IF NOT EXISTS idx_listing_impressions_listing
    ON listing_impressions(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_impressions_dealer
    ON listing_impressions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_listing_impressions_created
    ON listing_impressions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_impressions_dealer_date
    ON listing_impressions(dealer_id, created_at DESC);

-- Indexes for dealer_clicks
CREATE INDEX IF NOT EXISTS idx_dealer_clicks_dealer
    ON dealer_clicks(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_clicks_listing
    ON dealer_clicks(listing_id);
CREATE INDEX IF NOT EXISTS idx_dealer_clicks_created
    ON dealer_clicks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dealer_clicks_dealer_date
    ON dealer_clicks(dealer_id, created_at DESC);

-- Indexes for click_conversions
CREATE INDEX IF NOT EXISTS idx_click_conversions_dealer
    ON click_conversions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_click_conversions_listing
    ON click_conversions(listing_id);

-- Indexes for dealer_rankings
CREATE INDEX IF NOT EXISTS idx_dealer_rankings_period
    ON dealer_rankings(period, clicks_rank);

-- Success message
SELECT 'Dealer tracking indexes created successfully' as status;
