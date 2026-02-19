-- Migration: Add admin status override support
-- Allows admins to manually mark listings as sold/available with scraper protection
--
-- Pattern: Follows admin_hidden (migration 050) and artisan_admin_locked (migration 054)

-- 1. Add status_admin_locked column to listings
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS status_admin_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index for quick lookup of locked listings (same pattern as artisan_admin_locked)
CREATE INDEX IF NOT EXISTS idx_listings_status_admin_locked
  ON listings (id) WHERE status_admin_locked = TRUE;

-- 2. Audit table for status corrections
CREATE TABLE IF NOT EXISTS status_corrections (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  -- Original values at time of correction
  original_status TEXT,
  original_is_available BOOLEAN,
  original_is_sold BOOLEAN,
  -- Corrected values
  corrected_status TEXT NOT NULL,
  corrected_is_available BOOLEAN NOT NULL,
  corrected_is_sold BOOLEAN NOT NULL,
  -- Who and when
  corrected_by UUID NOT NULL,
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  -- Latest correction per listing wins
  UNIQUE (listing_id)
);

CREATE INDEX IF NOT EXISTS idx_status_corrections_listing
  ON status_corrections (listing_id);
