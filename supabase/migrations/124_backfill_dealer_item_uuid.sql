-- =============================================================================
-- 124: Backfill owner_id and item_uuid for dealer listings
-- =============================================================================
-- Order matters: owner_id first (profile lookup), then item_uuid (unconditional).
-- Safe: none of the existing triggers react to owner_id/item_uuid changes.

-- Step 1: Set owner_id from profiles.dealer_id → profiles.id (user UUID)
UPDATE listings l
SET owner_id = p.id
FROM profiles p
WHERE p.dealer_id = l.dealer_id
  AND l.source = 'dealer'
  AND l.owner_id IS NULL;

-- Step 2: Set item_uuid for all dealer listings that don't have one yet
UPDATE listings
SET item_uuid = gen_random_uuid()
WHERE source = 'dealer'
  AND item_uuid IS NULL;
