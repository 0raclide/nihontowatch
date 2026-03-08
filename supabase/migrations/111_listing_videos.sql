-- Video support for dealer listings
-- Videos are stored in Bunny Stream; this table tracks metadata and transcoding status.

CREATE TABLE listing_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'bunny',
  provider_id TEXT NOT NULL,
  duration_seconds INTEGER,
  width INTEGER,
  height INTEGER,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'processing',  -- processing | ready | failed
  sort_order INTEGER NOT NULL DEFAULT 0,
  original_filename TEXT,
  size_bytes BIGINT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_listing_videos_listing ON listing_videos(listing_id);
CREATE INDEX idx_listing_videos_provider ON listing_videos(provider_id);
