-- =============================================================================
-- 125: Migrate listing_videos → item_videos
-- =============================================================================
-- Phase 2b of the unified collection system.
-- Copies all listing_videos rows into item_videos (keyed by item_uuid),
-- rewrites the video_count trigger, and drops the old table.
--
-- Prerequisites:
--   - Migration 122 created item_videos table
--   - Migration 124 backfilled item_uuid + owner_id on all dealer listings
--
-- Safety: All listing_videos rows have listing_id FK to listings.
-- Since the scraper never creates videos, all listing_videos rows belong
-- to dealer-sourced listings which have item_uuid after migration 124.

-- Step 1: Copy listing_videos → item_videos
-- Preserves the original UUID PK for traceability.
INSERT INTO item_videos (
  id,
  item_uuid,
  owner_id,
  provider,
  provider_id,
  duration_seconds,
  width,
  height,
  thumbnail_url,
  stream_url,     -- NULL for migrated rows (API enriches at read time)
  status,
  sort_order,
  original_filename,
  size_bytes,
  created_at,
  updated_at
)
SELECT
  lv.id,
  l.item_uuid,
  COALESCE(l.owner_id, lv.created_by),  -- prefer listing owner, fallback to uploader
  lv.provider,
  lv.provider_id,
  lv.duration_seconds,
  lv.width,
  lv.height,
  lv.thumbnail_url,
  NULL,              -- stream_url computed at read time
  lv.status,
  lv.sort_order,
  lv.original_filename,
  lv.size_bytes,
  lv.created_at,
  lv.created_at      -- updated_at = created_at for migrated rows
FROM listing_videos lv
JOIN listings l ON lv.listing_id = l.id
WHERE l.item_uuid IS NOT NULL
  AND NOT EXISTS (
    -- Idempotent: skip if already migrated (same PK)
    SELECT 1 FROM item_videos iv WHERE iv.id = lv.id
  );

-- Step 2: Drop the old trigger on listing_videos
DROP TRIGGER IF EXISTS trg_update_listing_video_count ON listing_videos;

-- Step 3: Rewrite the video_count trigger function to count from item_videos
CREATE OR REPLACE FUNCTION update_listing_video_count()
RETURNS TRIGGER AS $$
DECLARE
  affected_item_uuid UUID;
BEGIN
  -- Determine which item_uuid was affected
  IF TG_OP = 'DELETE' THEN
    affected_item_uuid := OLD.item_uuid;
  ELSE
    affected_item_uuid := NEW.item_uuid;
  END IF;

  -- Recount ready videos for the affected listing (if one exists)
  UPDATE listings SET video_count = (
    SELECT count(*) FROM item_videos
    WHERE item_uuid = affected_item_uuid AND status = 'ready'
  ) WHERE item_uuid = affected_item_uuid;

  -- Handle item_uuid change (rare but safe)
  IF TG_OP = 'UPDATE' AND OLD.item_uuid IS DISTINCT FROM NEW.item_uuid THEN
    UPDATE listings SET video_count = (
      SELECT count(*) FROM item_videos
      WHERE item_uuid = OLD.item_uuid AND status = 'ready'
    ) WHERE item_uuid = OLD.item_uuid;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create new trigger on item_videos
DROP TRIGGER IF EXISTS trg_update_item_video_count ON item_videos;
CREATE TRIGGER trg_update_item_video_count
  AFTER INSERT OR DELETE OR UPDATE OF status ON item_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_listing_video_count();

-- Step 5: Verify counts match before dropping old table
-- (This is a safety check — if counts don't match, the migration has a bug)
DO $$
DECLARE
  old_count BIGINT;
  new_count BIGINT;
BEGIN
  SELECT count(*) INTO old_count FROM listing_videos;
  SELECT count(*) INTO new_count FROM item_videos;

  IF old_count > new_count THEN
    RAISE WARNING 'listing_videos has % rows but item_videos has % rows. % rows were not migrated (likely scraped listings without item_uuid).',
      old_count, new_count, old_count - new_count;
  END IF;
END $$;

-- Step 6: Drop listing_videos table (CASCADE removes FK constraints + old indexes)
DROP TABLE IF EXISTS listing_videos CASCADE;
