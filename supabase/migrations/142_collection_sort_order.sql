-- Add sort_order column to collection_items for custom user ordering
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Index for efficient ordering per user
CREATE INDEX IF NOT EXISTS idx_collection_items_owner_sort
  ON collection_items (owner_id, sort_order);

-- Backfill existing items: assign sequential sort_order per user based on created_at DESC
-- (preserves current visual order — newest first)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at DESC) AS rn
  FROM collection_items
)
UPDATE collection_items
SET sort_order = ranked.rn
FROM ranked
WHERE collection_items.id = ranked.id;
