-- Migration: Cleanup price_history data quality issues
-- Date: 2026-01-21
-- Reference: docs/POSTMORTEM_PRICE_HISTORY_DATA_QUALITY.md
--
-- This migration removes bad data from price_history caused by:
-- 1. E-sword extraction bug (¥4,000,000 phantom values)
-- 2. False sold transitions (items marked sold that are still available)
-- 3. Choshuya extraction bugs (phantom price increases)
--
-- BEFORE: 440 records
-- AFTER:  ~262 records (178 deleted)
--
-- Records being kept:
-- - 248 valid sold transitions
-- - 10 presumed_sold transitions
-- - 4 valid price decreases (Sanmei, Nihonto x2, Choshuya)

-- ============================================================
-- STEP 1: Create backup table (for rollback if needed)
-- ============================================================
CREATE TABLE IF NOT EXISTS price_history_backup_20260121 AS
SELECT * FROM price_history;

-- ============================================================
-- STEP 2: Delete E-sword ¥4,000,000 bug records
-- These are records where old_price OR new_price = 4000000
-- from E-sword dealer (82 records)
-- ============================================================
DELETE FROM price_history
WHERE id IN (
  SELECT ph.id
  FROM price_history ph
  JOIN listings l ON ph.listing_id = l.id
  JOIN dealers d ON l.dealer_id = d.id
  WHERE d.name = 'E-sword'
  AND (ph.old_price = 4000000 OR ph.new_price = 4000000)
);

-- ============================================================
-- STEP 3: Delete false sold transitions
-- These are sold/presumed_sold records where the listing
-- is currently available (is_sold = false)
-- (94 records)
-- ============================================================
DELETE FROM price_history
WHERE change_type IN ('sold', 'presumed_sold')
AND listing_id IN (
  SELECT id FROM listings WHERE is_sold = false
);

-- ============================================================
-- STEP 4: Delete ALL remaining price increases
-- Manual verification showed all increases are extraction bugs:
-- - Choshuya: 3 records with phantom high prices
-- - Any others that slipped through
-- ============================================================
DELETE FROM price_history
WHERE change_type = 'increase';

-- ============================================================
-- VERIFICATION QUERIES (run these after migration)
-- ============================================================

-- Check remaining record count (should be ~262)
-- SELECT COUNT(*) as total FROM price_history;

-- Check breakdown by change_type
-- SELECT change_type, COUNT(*) as count
-- FROM price_history
-- GROUP BY change_type;

-- Verify no E-sword 4M records remain
-- SELECT COUNT(*) as esword_4m_remaining
-- FROM price_history ph
-- JOIN listings l ON ph.listing_id = l.id
-- JOIN dealers d ON l.dealer_id = d.id
-- WHERE d.name = 'E-sword'
-- AND (ph.old_price = 4000000 OR ph.new_price = 4000000);

-- Verify no false sold transitions remain
-- SELECT COUNT(*) as false_sold_remaining
-- FROM price_history ph
-- WHERE ph.change_type IN ('sold', 'presumed_sold')
-- AND ph.listing_id IN (SELECT id FROM listings WHERE is_sold = false);

-- Verify no increases remain
-- SELECT COUNT(*) as increases_remaining
-- FROM price_history WHERE change_type = 'increase';

-- Sample remaining valid data
-- SELECT
--   ph.change_type,
--   l.title,
--   d.name as dealer,
--   ph.old_price,
--   ph.new_price,
--   ph.detected_at
-- FROM price_history ph
-- JOIN listings l ON ph.listing_id = l.id
-- JOIN dealers d ON l.dealer_id = d.id
-- ORDER BY ph.detected_at DESC
-- LIMIT 20;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- DROP TABLE price_history;
-- ALTER TABLE price_history_backup_20260121 RENAME TO price_history;
