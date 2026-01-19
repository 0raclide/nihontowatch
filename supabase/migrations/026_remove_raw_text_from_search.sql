-- Migration 026: Remove raw_page_text from Search Vector
--
-- Problem: raw_page_text contains Related Items/navigation both BEFORE and AFTER
-- the main content, causing false positives that cannot be reliably cleaned.
--
-- Solution: Don't use raw_page_text in search vector at all.
-- We have sufficient structured fields:
-- - title (weight A)
-- - smith/tosogu_maker (weight A)
-- - school/tosogu_school (weight B)
-- - province/era (weight C)
-- - description/description_en (weight C)

CREATE OR REPLACE FUNCTION build_listing_search_vector(
  p_title TEXT,
  p_smith TEXT,
  p_tosogu_maker TEXT,
  p_school TEXT,
  p_tosogu_school TEXT,
  p_province TEXT,
  p_era TEXT,
  p_raw_page_text TEXT,
  p_description TEXT DEFAULT NULL,
  p_description_en TEXT DEFAULT NULL
)
RETURNS tsvector
LANGUAGE plpgsql
IMMUTABLE
AS $func$
BEGIN
  -- No longer using raw_page_text - it contains too much noise
  -- (Related Items, navigation, cart sections, etc.)

  RETURN (
    -- Weight A (highest): Primary identifiers - title and artisan names
    setweight(to_tsvector('simple', COALESCE(p_title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(p_smith, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(p_tosogu_maker, '')), 'A') ||

    -- Weight B: Schools/lineage
    setweight(to_tsvector('simple', COALESCE(p_school, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(p_tosogu_school, '')), 'B') ||

    -- Weight C: Context - location, time period, descriptions
    setweight(to_tsvector('simple', COALESCE(p_province, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(p_era, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(LEFT(p_description, 3000), '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(LEFT(p_description_en, 3000), '')), 'C')
  );
END;
$func$;

-- Backfill all records
UPDATE listings
SET search_vector = build_listing_search_vector(
  title,
  smith,
  tosogu_maker,
  school,
  tosogu_school,
  province,
  era,
  raw_page_text,
  description,
  description_en
);

-- Verification queries:
-- SELECT id, title, smith, school
-- FROM listings
-- WHERE search_vector @@ to_tsquery('simple', 'rai & kunimitsu')
-- AND id IN (7701, 31270, 187, 6304);
-- Should return only ID 7701 (which has "rai kunimitsu" in description field)
