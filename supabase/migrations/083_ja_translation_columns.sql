-- Add Japanese translation columns (symmetric to title_en / description_en)
-- Used for EN→JP translation of international dealer listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS title_ja TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description_ja TEXT;
