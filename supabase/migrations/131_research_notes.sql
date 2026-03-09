-- Add research_notes column to both listings and collection_items.
-- Free-text field for collector/dealer notes that inform AI curator note generation.
-- Not displayed publicly — used only as context for the AI generation pipeline.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS research_notes TEXT;
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS research_notes TEXT;
