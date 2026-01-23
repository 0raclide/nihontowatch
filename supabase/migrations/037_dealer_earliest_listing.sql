-- Migration: Add earliest_listing_at to dealers table
-- Purpose: Track when each dealer's first listing was discovered
-- Used by: is_initial_import calculation for "Newest" sort prioritization

-- Add column to track dealer's first listing date
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS earliest_listing_at TIMESTAMPTZ;

-- Backfill from existing data
UPDATE dealers d
SET earliest_listing_at = (
  SELECT MIN(first_seen_at)
  FROM listings l
  WHERE l.dealer_id = d.id
)
WHERE earliest_listing_at IS NULL;

-- Function to update dealer's earliest listing when new listing is inserted
-- Only updates if the new listing is earlier than the current baseline
CREATE OR REPLACE FUNCTION update_dealer_earliest_listing()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dealers
  SET earliest_listing_at = NEW.first_seen_at
  WHERE id = NEW.dealer_id
  AND (earliest_listing_at IS NULL OR NEW.first_seen_at < earliest_listing_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_update_dealer_earliest_listing ON listings;

-- Create trigger to keep earliest_listing_at in sync
CREATE TRIGGER trigger_update_dealer_earliest_listing
  AFTER INSERT ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_dealer_earliest_listing();

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_dealers_earliest_listing_at ON dealers(earliest_listing_at);
