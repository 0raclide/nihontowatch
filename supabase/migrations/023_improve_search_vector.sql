-- Migration 023: Improve Search Vector
-- Reduces raw_page_text pollution and adds description_en to search
--
-- Changes:
-- 1. Reduce raw_page_text from 5000 to 2000 chars (less dealer page noise)
-- 2. Strip common navigation/noise patterns from raw_page_text
-- 3. Add description_en (English translation) to search vector with weight C
-- 4. Add description (original) to search vector with weight C
--
-- This improves search relevance by:
-- - Reducing false positives from dealer page sidebars/navigation
-- - Including translated descriptions for better English search

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
AS $$
DECLARE
  v_clean_text TEXT;
BEGIN
  -- Clean raw_page_text: reduce to 2000 chars and remove common navigation noise
  -- This prevents unrelated items from dealer page sidebars from polluting search
  v_clean_text := regexp_replace(
    COALESCE(LEFT(p_raw_page_text, 2000), ''),
    '(related items|other listings|navigation|menu|cart|wishlist|login|sign in|previous|next|page \d+|copyright|all rights reserved)',
    '',
    'gi'
  );

  RETURN (
    -- Weight A (highest): Primary identifiers - title and artisan names
    -- These are the most important for search relevance
    setweight(to_tsvector('simple', COALESCE(p_title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(p_smith, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(p_tosogu_maker, '')), 'A') ||

    -- Weight B: Schools/lineage - important for attribution searches
    setweight(to_tsvector('simple', COALESCE(p_school, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(p_tosogu_school, '')), 'B') ||

    -- Weight C: Context - location, time period, descriptions
    setweight(to_tsvector('simple', COALESCE(p_province, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(p_era, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(LEFT(p_description, 3000), '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(LEFT(p_description_en, 3000), '')), 'C') ||

    -- Weight D (lowest): Cleaned page text - fallback only
    setweight(to_tsvector('simple', v_clean_text), 'D')
  );
END;
$$;

-- ============================================================================
-- STEP 2: Update the trigger function to use new parameters
-- ============================================================================
CREATE OR REPLACE FUNCTION update_listing_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := build_listing_search_vector(
    NEW.title,
    NEW.smith,
    NEW.tosogu_maker,
    NEW.school,
    NEW.tosogu_school,
    NEW.province,
    NEW.era,
    NEW.raw_page_text,
    NEW.description,
    NEW.description_en
  );
  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 3: Update the trigger to fire on description changes too
-- ============================================================================
DROP TRIGGER IF EXISTS update_search_vector_trigger ON listings;
CREATE TRIGGER update_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, smith, tosogu_maker, school, tosogu_school, province, era, raw_page_text, description, description_en
  ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_listing_search_vector();

-- ============================================================================
-- STEP 4: Backfill existing records with improved search vectors
-- Run in batches to avoid locking issues on large tables
-- ============================================================================
DO $$
DECLARE
  batch_size INT := 1000;
  offset_val INT := 0;
  rows_updated INT;
BEGIN
  LOOP
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
    )
    WHERE id IN (
      SELECT id FROM listings
      ORDER BY id
      LIMIT batch_size
      OFFSET offset_val
    );

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;

    offset_val := offset_val + batch_size;
    COMMIT;
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION
-- Check that search vectors are populated correctly
-- ============================================================================
-- SELECT id, title, search_vector IS NOT NULL as has_vector
-- FROM listings
-- ORDER BY id DESC
-- LIMIT 10;

COMMENT ON FUNCTION build_listing_search_vector IS
  'Builds weighted tsvector for full-text search. Weight A: title/artisan, B: school, C: province/era/description, D: cleaned page text';
