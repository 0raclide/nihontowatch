-- Migration: Add artisan verification columns for admin QA
-- Allows admins to flag artisan matches as correct or incorrect

-- Add verification columns
ALTER TABLE listings ADD COLUMN IF NOT EXISTS artisan_verified TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS artisan_verified_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS artisan_verified_by TEXT;

-- Add comments for documentation
COMMENT ON COLUMN listings.artisan_verified IS 'Admin verification status: correct, incorrect, or NULL (unverified)';
COMMENT ON COLUMN listings.artisan_verified_at IS 'When the artisan match was verified';
COMMENT ON COLUMN listings.artisan_verified_by IS 'User ID of admin who verified the match';

-- Create partial index for verified listings (only index non-null values)
CREATE INDEX IF NOT EXISTS idx_listings_artisan_verified ON listings(artisan_verified)
WHERE artisan_verified IS NOT NULL;

-- Create index for finding listings verified by a specific admin
CREATE INDEX IF NOT EXISTS idx_listings_artisan_verified_by ON listings(artisan_verified_by)
WHERE artisan_verified_by IS NOT NULL;
