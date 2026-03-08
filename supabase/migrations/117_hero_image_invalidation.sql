-- Extend focal point invalidation trigger to also clear hero_image_index
-- when images change. Follows the same proven pattern as focal_x/focal_y:
-- if images change, stale index pointers get cleared automatically.

CREATE OR REPLACE FUNCTION invalidate_focal_point()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.images IS DISTINCT FROM NEW.images
     OR OLD.stored_images IS DISTINCT FROM NEW.stored_images THEN
    NEW.focal_x := NULL;
    NEW.focal_y := NULL;
    NEW.hero_image_index := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
