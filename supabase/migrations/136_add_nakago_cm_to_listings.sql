-- =============================================================================
-- 136: Add nakago_cm to listings table
-- =============================================================================
-- nakago_cm (tang length) already exists on collection_items but was missing
-- from listings. Both promote_to_listing (128) and delist_to_collection (129)
-- RPCs reference this column — delist crashes with "record has no field nakago_cm".

ALTER TABLE listings ADD COLUMN IF NOT EXISTS nakago_cm REAL;

-- Recreate delist_to_collection to work now that the column exists
-- (no logic changes — just needs the schema to be consistent)
