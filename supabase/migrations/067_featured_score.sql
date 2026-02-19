-- Featured score system
-- Adds columns for algorithmic "Featured" sort on browse page

-- Denormalized elite_count from Yuhinkai artisan_makers (synced via sync-elite-factor)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS artisan_elite_count INTEGER;

-- Precomputed featured score (updated by cron every 4 hours)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS featured_score NUMERIC(8,2);

-- Generated column: TRUE when listing has at least one image
-- Used for efficient filtering (no-image items get featured_score = 0)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_images BOOLEAN
  GENERATED ALWAYS AS (images IS NOT NULL AND jsonb_array_length(images) > 0) STORED;

-- Index for featured sort (DESC, NULLs last)
CREATE INDEX IF NOT EXISTS idx_listings_featured_score
  ON listings(featured_score DESC NULLS LAST);

-- Partial index for has_images = true (filters efficiently)
CREATE INDEX IF NOT EXISTS idx_listings_has_images
  ON listings(has_images) WHERE has_images = true;
