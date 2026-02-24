-- Invalidate focal points when listing images change
-- NULLing focal_x/focal_y causes the compute-focal-points cron to recompute
-- on the next 4-hour run.

CREATE OR REPLACE FUNCTION invalidate_focal_point()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.images IS DISTINCT FROM NEW.images
     OR OLD.stored_images IS DISTINCT FROM NEW.stored_images THEN
    NEW.focal_x := NULL;
    NEW.focal_y := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_invalidate_focal_point ON listings;
CREATE TRIGGER trigger_invalidate_focal_point
  BEFORE UPDATE ON listings
  FOR EACH ROW
  WHEN (
    OLD.images IS DISTINCT FROM NEW.images OR
    OLD.stored_images IS DISTINCT FROM NEW.stored_images
  )
  EXECUTE FUNCTION invalidate_focal_point();
