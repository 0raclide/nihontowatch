-- Add title_en column for cached English translations of listing titles
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

ALTER TABLE listings ADD COLUMN IF NOT EXISTS title_en TEXT;

-- Add index for faster lookups of untranslated titles
CREATE INDEX IF NOT EXISTS idx_listings_title_needs_translation
ON listings (id)
WHERE title IS NOT NULL AND title_en IS NULL;

COMMENT ON COLUMN listings.title_en IS 'Cached English translation of the original title (via OpenRouter)';
