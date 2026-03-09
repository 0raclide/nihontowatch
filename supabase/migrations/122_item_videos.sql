-- =============================================================================
-- 122: Create item_videos table
-- =============================================================================
-- Video storage keyed by item_uuid (no FK — item may be in either table).
-- Schema mirrors listing_videos but replaces listing_id with item_uuid + owner_id.
-- Created now, populated in Phase 2b when video upload is unified.

CREATE TABLE item_videos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_uuid         UUID NOT NULL,
  owner_id          UUID NOT NULL REFERENCES auth.users(id),
  provider          TEXT NOT NULL DEFAULT 'bunny',
  provider_id       TEXT NOT NULL,
  duration_seconds  INTEGER,
  width             INTEGER,
  height            INTEGER,
  thumbnail_url     TEXT,
  stream_url        TEXT,
  status            TEXT NOT NULL DEFAULT 'processing',  -- processing | ready | failed
  sort_order        INTEGER NOT NULL DEFAULT 0,
  original_filename TEXT,
  size_bytes        BIGINT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_iv_item_uuid  ON item_videos(item_uuid);
CREATE INDEX idx_iv_owner      ON item_videos(owner_id);
CREATE INDEX idx_iv_provider   ON item_videos(provider_id);

-- Updated_at trigger
CREATE TRIGGER trg_iv_updated
  BEFORE UPDATE ON item_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_collection_updated_at();
