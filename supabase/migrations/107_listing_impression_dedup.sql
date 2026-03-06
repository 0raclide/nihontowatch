-- Migration 107: Add dedup constraint for listing impressions
--
-- The listing_impressions table (migration 028) has zero rows — impression
-- tracking was designed but never connected. This migration adds an
-- impression_date column (matching listing_views.view_date pattern) and a
-- unique constraint for dedup: one impression per listing per session per day.

ALTER TABLE listing_impressions
  ADD COLUMN IF NOT EXISTS impression_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Dedup: one impression per listing per session per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_impressions_dedup
  ON listing_impressions (listing_id, session_id, impression_date);
