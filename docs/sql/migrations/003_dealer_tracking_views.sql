-- Migration 003: Dealer Tracking Views
-- Run after tables and indexes are created

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

-- Success message
SELECT 'Dealer tracking views created successfully' as status;
