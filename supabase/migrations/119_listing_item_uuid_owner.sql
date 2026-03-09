-- =============================================================================
-- 119: Add item_uuid and owner_id to listings
-- =============================================================================
-- Foundation for unified collection: every item gets a UUID identity.
-- owner_id links dealer-created listings to their auth.users account.
-- Both nullable — scraped listings have neither.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS item_uuid UUID UNIQUE;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Partial indexes: only dealer listings will have these set
CREATE INDEX IF NOT EXISTS idx_listings_item_uuid ON listings(item_uuid) WHERE item_uuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_owner_id ON listings(owner_id) WHERE owner_id IS NOT NULL;
