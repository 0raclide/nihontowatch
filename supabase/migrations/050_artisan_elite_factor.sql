-- Migration: Add artisan elite factor column to listings table
-- This enables sorting listings by their maker's bayesian elite factor
-- (a statistical measure of artisan prestige based on Kokuho/Tokuju/JuBun counts)
--
-- The elite_factor is denormalized from the Yuhinkai database (smith_entities
-- and tosogu_makers tables) since cross-database joins are not possible.

-- Add elite factor column
ALTER TABLE listings ADD COLUMN IF NOT EXISTS artisan_elite_factor NUMERIC(5,4);

-- Add comment for documentation
COMMENT ON COLUMN listings.artisan_elite_factor IS 'Bayesian elite factor from Yuhinkai: (elite_count + 1) / (total_items + 10). Denormalized for sorting.';

-- Create descending index for efficient sorting (higher elite factor = more prestigious)
-- NULLS LAST ensures listings without artisan matches appear at the end
CREATE INDEX IF NOT EXISTS idx_listings_artisan_elite_factor
  ON listings(artisan_elite_factor DESC NULLS LAST);
