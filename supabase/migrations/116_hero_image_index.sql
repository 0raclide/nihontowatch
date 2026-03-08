-- Hero image selection: explicit cover image index into images[]
-- NULL = use images[0] (current behavior, fully backwards compatible)
-- Set by dealer form or admin override. Scraper never touches this column.

ALTER TABLE listings ADD COLUMN hero_image_index INTEGER DEFAULT NULL;
COMMENT ON COLUMN listings.hero_image_index IS
  'Explicit cover image index into images[]. NULL = use index 0. Invalidated by trigger when images change.';
