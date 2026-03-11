-- Add financial/management columns to collection_items
-- These are collection-only columns (NOT shared with listings via ItemDataFields)

ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS purchase_price    NUMERIC;
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS purchase_currency  TEXT;
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS purchase_date      DATE;
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS purchase_source    TEXT;
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS current_value      NUMERIC;
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS current_currency   TEXT;
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS location           TEXT;
