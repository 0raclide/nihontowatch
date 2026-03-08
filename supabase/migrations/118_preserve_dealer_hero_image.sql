-- Fix: Preserve hero_image_index for dealer listings when images change.
--
-- The invalidate_focal_point() trigger (migration 117) NULLs hero_image_index
-- whenever images/stored_images change. This makes sense for SCRAPED listings
-- (scraper changes images → old index pointers become stale), but is wrong for
-- DEALER listings where the dealer explicitly selects a cover image.
--
-- getHeroImageIndex() already falls back to index 0 if the stored index is
-- out of bounds, so preserving a stale index for dealer listings is safe.

CREATE OR REPLACE FUNCTION invalidate_focal_point()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.images IS DISTINCT FROM NEW.images
     OR OLD.stored_images IS DISTINCT FROM NEW.stored_images THEN
    -- Always recompute focal points (smart crop) when images change
    NEW.focal_x := NULL;
    NEW.focal_y := NULL;

    -- Only invalidate hero_image_index for scraped listings.
    -- Dealer listings have user-set cover images that must be preserved.
    IF NEW.source IS DISTINCT FROM 'dealer' THEN
      NEW.hero_image_index := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
