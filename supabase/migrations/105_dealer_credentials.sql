-- Add structured credential booleans to dealers table
-- Replaces freeform memberships TEXT[] for credential tracking

ALTER TABLE dealers
  ADD COLUMN IF NOT EXISTS is_nbthk_member BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_zentosho_member BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_kobutsusho_license BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN dealers.is_nbthk_member IS 'Member of NBTHK (日本美術刀剣保存協会)';
COMMENT ON COLUMN dealers.is_zentosho_member IS 'Member of Zentōshō (全国刀剣商業協同組合)';
COMMENT ON COLUMN dealers.has_kobutsusho_license IS 'Holds Kobutsushō license (古物商許可)';
