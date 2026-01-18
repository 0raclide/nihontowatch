-- Remove Wayback Machine Freshness Tracking
--
-- The wayback machine dates were found to be unreliable for determining listing freshness
-- because dealers re-use URLs for new inventory. Archive dates reflect URL history,
-- not item publication dates.
--
-- This migration removes all wayback/freshness related columns and indexes.

-- =============================================================================
-- DROP INDEXES FIRST (depends on columns)
-- =============================================================================

DROP INDEX IF EXISTS idx_listings_freshness_check;
DROP INDEX IF EXISTS idx_listings_wayback_unchecked;

-- =============================================================================
-- DROP CONSTRAINTS
-- =============================================================================

ALTER TABLE listings DROP CONSTRAINT IF EXISTS chk_freshness_source;
ALTER TABLE listings DROP CONSTRAINT IF EXISTS chk_freshness_confidence;

-- =============================================================================
-- LISTINGS: Remove freshness tracking columns
-- =============================================================================

ALTER TABLE listings DROP COLUMN IF EXISTS listing_published_at;
ALTER TABLE listings DROP COLUMN IF EXISTS freshness_source;
ALTER TABLE listings DROP COLUMN IF EXISTS freshness_confidence;
ALTER TABLE listings DROP COLUMN IF EXISTS wayback_first_archive_at;
ALTER TABLE listings DROP COLUMN IF EXISTS wayback_checked_at;

-- =============================================================================
-- DEALERS: Remove baseline tracking column
-- =============================================================================

ALTER TABLE dealers DROP COLUMN IF EXISTS catalog_baseline_at;
