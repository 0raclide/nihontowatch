-- Migration 114: Add mei_text and mei_guaranteed columns
--
-- mei_text: The actual inscription characters (kanji) on the tang, e.g., "備前国長船住景光"
-- mei_guaranteed: Whether the signature is guaranteed authentic.
--   TRUE  = guaranteed (NBTHK papers authenticate it)
--   FALSE = not guaranteed (no papers, could be gimei)
--   NULL  = not set / legacy listing

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS mei_text TEXT,
  ADD COLUMN IF NOT EXISTS mei_guaranteed BOOLEAN;
