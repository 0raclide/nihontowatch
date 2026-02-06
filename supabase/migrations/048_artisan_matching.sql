-- Migration: Add artisan matching columns to listings table
-- This enables storing Yuhinkai artisan matches for each listing

-- Add artisan matching columns
ALTER TABLE listings ADD COLUMN IF NOT EXISTS artisan_id TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS artisan_confidence TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS artisan_method TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS artisan_candidates JSONB;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS artisan_matched_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN listings.artisan_id IS 'Yuhinkai artisan ID (e.g., KUN1925 for smith, NS-Akasaka for school)';
COMMENT ON COLUMN listings.artisan_confidence IS 'Match confidence: HIGH, MEDIUM, LOW, or NONE';
COMMENT ON COLUMN listings.artisan_method IS 'How the match was made: exact_kanji, consensus_unanimous, school_as_smith, etc.';
COMMENT ON COLUMN listings.artisan_candidates IS 'Top 3 candidate matches with scores (JSONB array)';
COMMENT ON COLUMN listings.artisan_matched_at IS 'When the artisan matching was last run';

-- Create index for querying by artisan
CREATE INDEX IF NOT EXISTS idx_listings_artisan_id ON listings(artisan_id);

-- Create index for finding unmatched listings
CREATE INDEX IF NOT EXISTS idx_listings_artisan_matched_at ON listings(artisan_matched_at)
WHERE artisan_matched_at IS NULL;

-- Create index for confidence-based queries
CREATE INDEX IF NOT EXISTS idx_listings_artisan_confidence ON listings(artisan_confidence);
