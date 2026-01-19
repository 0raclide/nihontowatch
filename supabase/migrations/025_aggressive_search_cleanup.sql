-- Migration 025: Aggressive Search Vector Cleanup
--
-- Problem: raw_page_text contains Related Items/navigation that causes false positives
-- The content "Katana[Mumei Rai Kunimitsu]" appears BETWEEN navigation items
--
-- Solution: Extract only the actual listing content from raw_page_text
-- by finding content AFTER markers like "Stock number", "Paper", "Blade length" etc.
-- If no marker found, don't use raw_page_text at all.

-- ============================================================================
-- STEP 1: Update the search vector building function
-- ============================================================================
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
DECLARE
  v_clean_text TEXT;
  v_content_start INT;
  v_raw_lower TEXT;
BEGIN
  -- Find where actual listing content starts
  -- Look for common content markers that indicate the main listing details
  v_raw_lower := LOWER(COALESCE(p_raw_page_text, ''));

  -- Find first occurrence of content markers
  v_content_start := LEAST(
    COALESCE(NULLIF(POSITION('stock number' IN v_raw_lower), 0), 999999),
    COALESCE(NULLIF(POSITION('paper(certificate)' IN v_raw_lower), 0), 999999),
    COALESCE(NULLIF(POSITION('blade length' IN v_raw_lower), 0), 999999),
    COALESCE(NULLIF(POSITION('nagasa' IN v_raw_lower), 0), 999999),
    COALESCE(NULLIF(POSITION('cutting edge' IN v_raw_lower), 0), 999999),
    COALESCE(NULLIF(POSITION('刃長' IN v_raw_lower), 0), 999999),
    COALESCE(NULLIF(POSITION('鑑定書' IN v_raw_lower), 0), 999999)
  );

  -- If no marker found, don't use raw_page_text (it's probably all navigation/related items)
  IF v_content_start >= 999999 THEN
    v_clean_text := '';
  ELSE
    -- Extract content from marker onwards, limit to 2000 chars
    v_clean_text := SUBSTRING(p_raw_page_text FROM v_content_start FOR 2000);

    -- Remove remaining navigation patterns
    v_clean_text := regexp_replace(
      v_clean_text,
      '(related items|other listings|you may also like|similar items|recently viewed|add to cart|add to wishlist|share this|copyright|all rights reserved)',
      '',
      'gi'
    );
  END IF;

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
    setweight(to_tsvector('simple', COALESCE(LEFT(p_description_en, 3000), '')), 'C') ||

    -- Weight D (lowest): Cleaned page text - actual content only
    setweight(to_tsvector('simple', v_clean_text), 'D')
  );
END;
$func$;

-- ============================================================================
-- STEP 2: Backfill all records with improved search vectors
-- ============================================================================
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

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check that false positives are eliminated:
-- SELECT id, title, smith, school
-- FROM listings
-- WHERE search_vector @@ to_tsquery('simple', 'rai & kunimitsu')
-- AND id IN (7701, 31270, 187, 6304);
-- Should return empty if fix worked.
