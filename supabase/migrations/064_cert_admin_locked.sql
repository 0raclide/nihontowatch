-- Migration 064: Add cert_admin_locked and cert_corrections audit table
--
-- Mirrors the artisan_admin_locked / artisan_corrections pattern:
-- When an admin manually corrects a listing's cert_type, the field is
-- locked against scraper overwrites and an audit trail is kept.

-- 1. Add cert_admin_locked flag to listings
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS cert_admin_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index for fast lookup of locked rows (same pattern as artisan_admin_locked)
CREATE INDEX IF NOT EXISTS idx_listings_cert_admin_locked
  ON listings (id) WHERE cert_admin_locked = TRUE;

-- 2. Audit table for cert corrections
CREATE TABLE IF NOT EXISTS cert_corrections (
  id            BIGSERIAL PRIMARY KEY,
  listing_id    BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  original_cert TEXT,
  corrected_cert TEXT,
  corrected_by  UUID NOT NULL,
  corrected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes         TEXT,
  UNIQUE (listing_id)
);

-- Index for lookup by admin user
CREATE INDEX IF NOT EXISTS idx_cert_corrections_by_user
  ON cert_corrections (corrected_by);
