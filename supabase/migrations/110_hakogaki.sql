-- Add hakogaki (箱書 — box inscriptions) JSONB column for tosogu listings
-- Parallel to sayagaki column but for tosogu items (fittings use storage boxes, not scabbards)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS hakogaki JSONB DEFAULT NULL;
