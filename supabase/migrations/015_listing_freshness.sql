-- Listing Freshness Feature
-- Track accurate listing age with confidence levels
--
-- Problem: first_seen_at shows when WE scraped it, not when the dealer listed it
-- Solution: Track actual publish dates from dealer metadata or Wayback Machine

-- =============================================================================
-- DEALERS: Add baseline tracking
-- =============================================================================

-- When we completed first full catalog scrape for this dealer
-- Listings after this date are "truly new" (we didn't miss them, they weren't there before)
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS catalog_baseline_at TIMESTAMPTZ;

COMMENT ON COLUMN dealers.catalog_baseline_at IS
  'When we completed first full catalog scrape. Listings after this are truly new.';

-- =============================================================================
-- LISTINGS: Add freshness tracking
-- =============================================================================

-- Best estimate of actual publish date (from dealer page or Wayback)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS listing_published_at TIMESTAMPTZ;

COMMENT ON COLUMN listings.listing_published_at IS
  'Best estimate of actual publish date (from dealer meta or Wayback)';

-- Source of the publish date estimate
-- Values: 'dealer_meta', 'wayback', 'inferred', 'unknown'
ALTER TABLE listings ADD COLUMN IF NOT EXISTS freshness_source TEXT DEFAULT 'unknown';

COMMENT ON COLUMN listings.freshness_source IS
  'Source of listing_published_at: dealer_meta, wayback, inferred, unknown';

-- Confidence level in the publish date
-- Values: 'high', 'medium', 'low', 'unknown'
ALTER TABLE listings ADD COLUMN IF NOT EXISTS freshness_confidence TEXT DEFAULT 'unknown';

COMMENT ON COLUMN listings.freshness_confidence IS
  'Confidence in listing_published_at: high, medium, low, unknown';

-- =============================================================================
-- LISTINGS: Wayback Machine cache
-- =============================================================================

-- When the URL was first archived by Wayback Machine
ALTER TABLE listings ADD COLUMN IF NOT EXISTS wayback_first_archive_at TIMESTAMPTZ;

COMMENT ON COLUMN listings.wayback_first_archive_at IS
  'When URL was first archived by Wayback Machine (proxy for publish date)';

-- When we last checked Wayback for this listing
ALTER TABLE listings ADD COLUMN IF NOT EXISTS wayback_checked_at TIMESTAMPTZ;

COMMENT ON COLUMN listings.wayback_checked_at IS
  'When we last checked Wayback Machine for this listing';

-- =============================================================================
-- INDEXES: For background freshness checking job
-- =============================================================================

-- Index for finding listings that need freshness checking (unknown or low confidence)
CREATE INDEX IF NOT EXISTS idx_listings_freshness_check
ON listings(freshness_confidence)
WHERE freshness_confidence IN ('unknown', 'low');

-- Index for finding listings to wayback-check (oldest unchecked first)
CREATE INDEX IF NOT EXISTS idx_listings_wayback_unchecked
ON listings(first_seen_at)
WHERE wayback_checked_at IS NULL;

-- =============================================================================
-- CONSTRAINT: Validate freshness_source values
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_freshness_source'
  ) THEN
    ALTER TABLE listings ADD CONSTRAINT chk_freshness_source
      CHECK (freshness_source IN ('dealer_meta', 'wayback', 'inferred', 'unknown'));
  END IF;
END $$;

-- =============================================================================
-- CONSTRAINT: Validate freshness_confidence values
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_freshness_confidence'
  ) THEN
    ALTER TABLE listings ADD CONSTRAINT chk_freshness_confidence
      CHECK (freshness_confidence IN ('high', 'medium', 'low', 'unknown'));
  END IF;
END $$;
