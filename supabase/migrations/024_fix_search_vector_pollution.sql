-- Migration 024: Fix Search Vector Pollution
--
-- Problem: raw_page_text contains Related Items/navigation from dealer pages
-- causing false positives like "Rai Kunimitsu" matching unrelated listings
--
-- Solution: Update search vector function to:
-- 1. Reduce raw_page_text from 5000 to 2000 chars
-- 2. Strip navigation patterns that commonly contain other listings
-- 3. Give raw_page_text lowest weight (D)

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
BEGIN
  -- Clean raw_page_text:
  -- 1. Reduce to 2000 chars (was 5000)
  -- 2. Remove navigation/related items patterns that cause false positives
  v_clean_text := regexp_replace(
    COALESCE(LEFT(p_raw_page_text, 2000), ''),
    '(related items|other listings|you may also like|similar items|recently viewed|navigation|menu|cart|wishlist|login|sign in|previous|next|page \d+|copyright|all rights reserved|online shop|home|koshirae|stock number)',
    '',
    'gi'
  );

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

    -- Weight D (lowest): Cleaned page text - fallback only
    setweight(to_tsvector('simple', v_clean_text), 'D')
  );
END;
$func$;

-- ============================================================================
-- STEP 2: Update trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION update_listing_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
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
$func$;

-- ============================================================================
-- STEP 3: Backfill existing records (run in batches)
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
-- VERIFICATION: Check a known false positive
-- ============================================================================
-- After running, verify that listing 31270 no longer has "rai kunimitsu" in search_vector:
-- SELECT id, title, search_vector::text
-- FROM listings
-- WHERE id = 31270;
