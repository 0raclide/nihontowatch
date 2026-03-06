-- Add sayagaki (expert calligraphic inscriptions on shirasaya) JSONB column to listings.
-- Schema: array of { id, author, author_custom, content, images }
-- NULL default — vast majority of listings have no sayagaki.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sayagaki JSONB DEFAULT NULL;

COMMENT ON COLUMN listings.sayagaki IS 'Array of sayagaki entries: [{id, author, author_custom, content, images}]';
