-- Generated column for cover image aspect ratio
-- Enables DB-side filtering for panoramic listings that need composite thumbnails
-- (eliminates JS-side filtering that caused queue starvation)

ALTER TABLE listings ADD COLUMN cover_aspect_ratio REAL
  GENERATED ALWAYS AS (
    CASE WHEN image_height > 0 THEN image_width::real / image_height ELSE NULL END
  ) STORED;

-- Partial index: only panoramic listings needing composites
CREATE INDEX IF NOT EXISTS idx_listings_needs_composite
  ON listings (cover_aspect_ratio DESC)
  WHERE thumbnail_url IS NULL AND cover_aspect_ratio > 4.0;
