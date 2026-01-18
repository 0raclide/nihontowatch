-- Add description_en column for cached English translations
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

ALTER TABLE listings ADD COLUMN IF NOT EXISTS description_en TEXT;

-- Add index for faster lookups of untranslated descriptions
CREATE INDEX IF NOT EXISTS idx_listings_description_needs_translation
ON listings (id)
WHERE description IS NOT NULL AND description_en IS NULL;

COMMENT ON COLUMN listings.description_en IS 'Cached English translation of the original description (via OpenRouter)';
