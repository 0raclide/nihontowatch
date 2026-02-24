-- Image dimensions and composite thumbnail for listing cover images
-- image_width/image_height are populated by the focal point cron/backfill
-- thumbnail_url stores a composite thumbnail for extreme aspect ratio images (panoramic blade strips)

ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_width INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_height INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

COMMENT ON COLUMN listings.image_width IS 'Cover image width in pixels. NULL = not computed.';
COMMENT ON COLUMN listings.image_height IS 'Cover image height in pixels. NULL = not computed.';
COMMENT ON COLUMN listings.thumbnail_url IS 'Composite thumbnail URL for extreme aspect ratio images. NULL = no composite needed or not yet generated.';

-- Index for composite cron: find listings with extreme aspect ratios that need composites
CREATE INDEX IF NOT EXISTS idx_listings_needs_composite
  ON listings (id)
  WHERE image_width IS NOT NULL
    AND image_height IS NOT NULL
    AND thumbnail_url IS NULL
    AND images IS NOT NULL;
