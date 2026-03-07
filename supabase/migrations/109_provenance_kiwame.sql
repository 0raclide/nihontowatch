-- Add provenance (ownership history) and kiwame (expert appraisals) JSONB columns
-- Both are arrays of entries, stored as JSONB

ALTER TABLE listings ADD COLUMN IF NOT EXISTS provenance JSONB DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS kiwame JSONB DEFAULT NULL;

COMMENT ON COLUMN listings.provenance IS 'Array of provenance (ownership history) entries: [{id, owner_name, owner_name_ja, notes, images}]';
COMMENT ON COLUMN listings.kiwame IS 'Array of kiwame (expert appraisal) entries: [{id, judge_name, judge_name_ja, kiwame_type, notes}]';
