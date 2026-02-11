-- Admin hidden column: allows admins to hide problematic listings from public views
-- Hidden listings are preserved in the database but excluded from all non-admin queries

ALTER TABLE listings ADD COLUMN IF NOT EXISTS admin_hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: only indexes hidden rows (rare), zero cost on normal queries
CREATE INDEX IF NOT EXISTS idx_listings_admin_hidden ON listings(admin_hidden) WHERE admin_hidden = TRUE;
