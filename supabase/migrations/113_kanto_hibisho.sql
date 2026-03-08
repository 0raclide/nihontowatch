-- Add kanto_hibisho JSONB column for Kanto Hibisho (関東日々抄) scholarly references.
-- Single entry per listing: { volume, entry_number, text, images[] }
ALTER TABLE listings ADD COLUMN IF NOT EXISTS kanto_hibisho JSONB DEFAULT NULL;
