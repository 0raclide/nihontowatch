-- Smart crop focal point for listing cover images
-- Stores the optimal crop center as percentages (0-100) for object-position CSS
-- NULL = not yet computed, falls back to center center

ALTER TABLE listings ADD COLUMN IF NOT EXISTS focal_x REAL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS focal_y REAL;

COMMENT ON COLUMN listings.focal_x IS 'Smart crop focal X (0-100%). NULL = center.';
COMMENT ON COLUMN listings.focal_y IS 'Smart crop focal Y (0-100%). NULL = center.';

CREATE INDEX IF NOT EXISTS idx_listings_focal_point
  ON listings (id) WHERE focal_x IS NOT NULL;
