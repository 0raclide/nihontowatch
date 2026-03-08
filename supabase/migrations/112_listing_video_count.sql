-- Migration 112: Denormalize video_count on listings table
-- Eliminates per-row sub-query on listing_videos in the browse API.

-- Add the column
ALTER TABLE listings ADD COLUMN IF NOT EXISTS video_count INTEGER NOT NULL DEFAULT 0;

-- Backfill existing counts
UPDATE listings SET video_count = (
  SELECT count(*)
  FROM listing_videos
  WHERE listing_videos.listing_id = listings.id
    AND listing_videos.status = 'ready'
);

-- Trigger function: recount ready videos for the affected listing
CREATE OR REPLACE FUNCTION update_listing_video_count()
RETURNS TRIGGER AS $$
DECLARE
  affected_listing_id INTEGER;
BEGIN
  -- Determine which listing_id was affected
  IF TG_OP = 'DELETE' THEN
    affected_listing_id := OLD.listing_id;
  ELSIF TG_OP = 'INSERT' THEN
    affected_listing_id := NEW.listing_id;
  ELSE
    -- UPDATE: if listing_id changed, update both old and new
    IF OLD.listing_id IS DISTINCT FROM NEW.listing_id THEN
      UPDATE listings SET video_count = (
        SELECT count(*) FROM listing_videos
        WHERE listing_id = OLD.listing_id AND status = 'ready'
      ) WHERE id = OLD.listing_id;
      affected_listing_id := NEW.listing_id;
    ELSE
      affected_listing_id := NEW.listing_id;
    END IF;
  END IF;

  -- Recount for the affected listing
  UPDATE listings SET video_count = (
    SELECT count(*) FROM listing_videos
    WHERE listing_id = affected_listing_id AND status = 'ready'
  ) WHERE id = affected_listing_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on listing_videos for INSERT, DELETE, and status UPDATE
DROP TRIGGER IF EXISTS trg_update_listing_video_count ON listing_videos;
CREATE TRIGGER trg_update_listing_video_count
  AFTER INSERT OR DELETE OR UPDATE OF status ON listing_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_listing_video_count();
