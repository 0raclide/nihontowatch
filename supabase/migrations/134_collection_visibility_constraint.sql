-- Phase 6a: Add CHECK constraint for collection item visibility
-- Restricts visibility to exactly three valid values.
-- Also adds composite index for community browse queries.

ALTER TABLE collection_items
  ADD CONSTRAINT ci_visibility_check
  CHECK (visibility IN ('private', 'collectors', 'dealers'));

-- Composite index for community browse queries (excludes private items)
CREATE INDEX idx_ci_visibility_type ON collection_items(visibility, item_type)
  WHERE visibility != 'private';
