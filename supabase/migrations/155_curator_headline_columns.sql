-- Migration 155: Add curator headline columns
-- Stores the AI-generated headline (1-2 sentence summary) alongside the full curator note.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_curator_headline_en TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_curator_headline_ja TEXT;

ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS ai_curator_headline_en TEXT;
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS ai_curator_headline_ja TEXT;
