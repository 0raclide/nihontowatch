-- Fix Nipponto (dealer_id=7) cert false positives
--
-- Root cause: The conservative cert extractor's standalone pattern matched
-- "重要刀剣" from Nipponto's site-wide navigation menu. Nipponto uses
-- non-semantic <div id="headerblock03"> instead of <nav>/<header> tags,
-- so base _extract_clean_text() didn't strip them.
--
-- Secondary bug: items with 特別貴重刀剣鑑定書 fell through to the nav
-- false positive because the [cert]鑑定書 regex was missing 貴重 patterns.
--
-- Scraper fix: Override _extract_clean_text() in nipponto.py to strip nav divs
-- + add 貴重 patterns to llm_extractor.py. This migration fixes existing data.

BEGIN;

-- Category 1: Items with actual Kicho/TokuKicho certs (confirmed from live pages)
-- These had the correct Japanese cert name (e.g., 特別貴重刀剣鑑定書) on the page
-- but the extractor missed it and fell through to matching nav "重要刀剣" instead.

-- Tokubetsu Kicho (have 特別貴重刀剣鑑定書 on page)
UPDATE listings
SET cert_type = 'Tokubetsu Kicho',
    cert_admin_locked = true
WHERE id IN (69068, 69269, 69271)
  AND dealer_id = 7;

-- Koshu Tokubetsu Kicho (have 甲種特別貴重刀剣鑑定書 on page)
UPDATE listings
SET cert_type = 'Koshu Tokubetsu Kicho',
    cert_admin_locked = true
WHERE id IN (69079, 69219, 69279)
  AND dealer_id = 7;

-- Kicho (have 貴重刀剣鑑定書 on page)
UPDATE listings
SET cert_type = 'Kicho',
    cert_admin_locked = true
WHERE id IN (69083)
  AND dealer_id = 7;

-- Hozon (have 保存刀剣鑑定 on page, truncated but confirmed Hozon)
UPDATE listings
SET cert_type = 'Hozon',
    cert_admin_locked = true
WHERE id IN (69218)
  AND dealer_id = 7;

-- Category 2: Items with no cert (Paper: − on page, or no cert section)
-- These were falsely classified as Juyo from nav menu "重要刀剣"
UPDATE listings
SET cert_type = NULL,
    cert_admin_locked = true
WHERE id IN (
    -- Paper field shows dash (no certification)
    68839, 68841, 68842, 68851, 68873, 68876, 68877, 68878,
    68883, 68885, 68895, 68896, 68984, 69062, 69087, 69216,
    69226, 69232, 69280,
    -- No cert section on page (tosogu/accessories)
    68948, 68960, 68961, 69161, 69162,
    -- Non-NBTHK cert (刀苑社最上作認定書 — not an NBTHK certification)
    69102,
    -- Decode error (cannot confirm — safer to NULL than leave as false Juyo)
    69080
)
  AND dealer_id = 7;

-- Category 3: Bulk fix for remaining Nipponto Juyo/Tokuju that are NOT
-- title-confirmed. These are the sold/unavailable items that were not
-- individually cross-checked but share the same root cause (nav menu match).
--
-- Logic: If the title contains 重要刀剣 or 特別重要, the Juyo/Tokuju is
-- title-confirmed and correct. Everything else is a nav false positive.
-- We NULL these and lock to prevent the scraper from re-introducing the error.
UPDATE listings
SET cert_type = NULL,
    cert_admin_locked = true
WHERE dealer_id = 7
  AND cert_type IN ('Juyo', 'Tokubetsu Juyo')
  AND cert_admin_locked IS NOT TRUE
  AND title NOT LIKE '%重要刀剣%'
  AND title NOT LIKE '%重要刀装具%'
  AND title NOT LIKE '%特別重要%'
  AND title NOT LIKE '%Juyo%'
  AND title NOT LIKE '%Tokubetsu Juyo%';

COMMIT;
