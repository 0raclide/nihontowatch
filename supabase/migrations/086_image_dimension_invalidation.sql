-- Update focal point invalidation trigger to also NULL image dimensions and thumbnail
-- when listing images change. This ensures the focal point cron recomputes dimensions
-- and the composite cron regenerates thumbnails when a dealer re-photographs an item.

CREATE OR REPLACE FUNCTION invalidate_focal_point()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.images IS DISTINCT FROM NEW.images
     OR OLD.stored_images IS DISTINCT FROM NEW.stored_images THEN
    NEW.focal_x := NULL;
    NEW.focal_y := NULL;
    NEW.image_width := NULL;
    NEW.image_height := NULL;
    NEW.thumbnail_url := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger definition unchanged (same WHEN clause, same trigger name)
-- CREATE OR REPLACE FUNCTION above updates the function body in-place
