-- Showcase layout support columns
-- showcase_override: NULL=auto (use eligibility logic), TRUE=force showcase, FALSE=suppress showcase
ALTER TABLE listings ADD COLUMN IF NOT EXISTS showcase_override BOOLEAN DEFAULT NULL;

-- Curator's Note columns (schema created now, populated in Phase 2 by AI pipeline)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_curator_note_en TEXT DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_curator_note_ja TEXT DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_curator_note_generated_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_curator_note_input_hash TEXT DEFAULT NULL;
