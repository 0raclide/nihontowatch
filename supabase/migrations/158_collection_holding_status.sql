-- Migration 158: Add holding_status and sold fields to collection_items
--
-- Enables collectors to track items they've sold (ex-collection) alongside
-- items they still own. holding_status is orthogonal to the existing
-- status/is_sold/is_available listing lifecycle columns.

ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS holding_status TEXT NOT NULL DEFAULT 'owned';

ALTER TABLE collection_items
  ADD CONSTRAINT chk_holding_status
  CHECK (holding_status IN ('owned', 'sold', 'consigned', 'gifted', 'lost'));

ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS sold_price    NUMERIC,
  ADD COLUMN IF NOT EXISTS sold_currency TEXT,
  ADD COLUMN IF NOT EXISTS sold_date     DATE,
  ADD COLUMN IF NOT EXISTS sold_to       TEXT,
  ADD COLUMN IF NOT EXISTS sold_venue    TEXT;

CREATE INDEX IF NOT EXISTS idx_ci_holding_status
  ON collection_items(holding_status);
