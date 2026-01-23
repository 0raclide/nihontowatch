-- Migration: Add is_initial_import to listings table
-- Purpose: Flag listings that were part of a dealer's initial bulk import
-- Used by: "Newest" sort to prioritize genuine new inventory over bulk imports

-- Add column (static - set once at insert, never updated)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_initial_import BOOLEAN DEFAULT TRUE;

-- Backfill existing listings based on whether they were discovered
-- within 24 hours of the dealer's earliest listing (baseline)
UPDATE listings l
SET is_initial_import = (
  l.first_seen_at <= (
    SELECT d.earliest_listing_at + INTERVAL '24 hours'
    FROM dealers d
    WHERE d.id = l.dealer_id
  )
)
WHERE is_initial_import IS NULL OR is_initial_import = TRUE;

-- Function to set is_initial_import on new listings
-- This is a BEFORE trigger so we can modify NEW before insert
CREATE OR REPLACE FUNCTION set_is_initial_import()
RETURNS TRIGGER AS $$
DECLARE
  dealer_baseline TIMESTAMPTZ;
BEGIN
  SELECT earliest_listing_at INTO dealer_baseline
  FROM dealers
  WHERE id = NEW.dealer_id;

  -- If no baseline yet, this IS the initial import
  -- (The dealer trigger will set baseline after this insert)
  IF dealer_baseline IS NULL THEN
    NEW.is_initial_import := TRUE;
  ELSE
    -- Within 24h of baseline = initial import
    NEW.is_initial_import := (NEW.first_seen_at <= dealer_baseline + INTERVAL '24 hours');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_set_is_initial_import ON listings;

-- Create trigger to set is_initial_import on insert
CREATE TRIGGER trigger_set_is_initial_import
  BEFORE INSERT ON listings
  FOR EACH ROW
  EXECUTE FUNCTION set_is_initial_import();

-- Partial index for sorting: efficiently find non-initial-import items
-- This supports the "Newest" sort which prioritizes these items
CREATE INDEX IF NOT EXISTS idx_listings_not_initial_import
ON listings(first_seen_at DESC)
WHERE is_initial_import = FALSE;

-- Composite index for the full sort query
-- Supports: ORDER BY newest_sort_tier, first_seen_at DESC
CREATE INDEX IF NOT EXISTS idx_listings_newest_sort
ON listings(is_initial_import, first_seen_at DESC)
WHERE is_available = TRUE;

-- View with computed sort tier for "Newest" sorting
-- Tier 0: Genuine new inventory (not initial import, within 7 days)
-- Tier 1: Everything else
-- This allows Supabase client to sort by newest_sort_tier, then first_seen_at
CREATE OR REPLACE VIEW listings_with_newest_sort AS
SELECT
  l.*,
  CASE
    WHEN NOT l.is_initial_import
     AND l.first_seen_at > NOW() - INTERVAL '7 days'
    THEN 0
    ELSE 1
  END AS newest_sort_tier
FROM listings l;
