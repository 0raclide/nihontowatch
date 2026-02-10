-- Migration 054: Add artisan_admin_locked column
--
-- This column is the SINGLE SOURCE OF TRUTH for protecting admin artisan assignments.
-- When TRUE, no automated process (scraper, batch matcher, rerun scripts) may overwrite
-- the artisan_id, artisan_confidence, artisan_method, or artisan_candidates fields.
--
-- Only the admin UI (fix-artisan and verify-artisan APIs) can set this flag.
-- The scraper NEVER writes to this column.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS artisan_admin_locked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN listings.artisan_admin_locked IS
  'When TRUE, artisan fields are locked by admin and must never be overwritten by automated matching. '
  'Set by fix-artisan API (admin correction) or verify-artisan API (admin confirms correct match). '
  'The scraper and all batch scripts must check this flag before writing artisan fields.';

-- Partial index for efficient filtering: only index the locked rows (small subset)
CREATE INDEX IF NOT EXISTS idx_listings_artisan_admin_locked
  ON listings (id)
  WHERE artisan_admin_locked = TRUE;

-- Backfill: lock all listings that already have admin corrections or verifications
UPDATE listings
SET artisan_admin_locked = TRUE
WHERE artisan_method = 'ADMIN_CORRECTION'
   OR artisan_verified IS NOT NULL;
