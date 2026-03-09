-- =============================================================================
-- 127: Add thickness_mm to listings
-- =============================================================================
-- Schema gap fix: thickness_mm exists in collection_items (migration 120)
-- and SHARED_COLUMNS but was never added to listings. Required for
-- promote_to_listing RPC (Phase 3 transit).

ALTER TABLE listings ADD COLUMN IF NOT EXISTS thickness_mm NUMERIC;
