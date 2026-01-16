-- Migration 007: Add Full-Text Search with tsvector
-- Enables fast PostgreSQL full-text search for Nihontowatch listings
-- Uses 'simple' config (not 'english') because Japanese romanization doesn't use English stemming

-- ============================================================================
-- STEP 1: Add tsvector column for search
-- ============================================================================
ALTER TABLE listings ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ============================================================================
-- STEP 2: Create weighted search vector function
-- Weight A (highest): title, smith, tosogu_maker (most important for search)
-- Weight B: school, tosogu_school (attribution)
-- Weight C: province, era (context)
-- Weight D (lowest): description text from raw_page_text
-- ============================================================================
CREATE OR REPLACE FUNCTION build_listing_search_vector(
  p_title TEXT,
  p_smith TEXT,
  p_tosogu_maker TEXT,
  p_school TEXT,
  p_tosogu_school TEXT,
  p_province TEXT,
  p_era TEXT,
  p_raw_page_text TEXT
)
RETURNS tsvector
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN (
    -- Weight A: Primary identifiers (title, artisan names)
    setweight(to_tsvector('simple', COALESCE(p_title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(p_smith, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(p_tosogu_maker, '')), 'A') ||
    -- Weight B: Schools/lineage
    setweight(to_tsvector('simple', COALESCE(p_school, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(p_tosogu_school, '')), 'B') ||
    -- Weight C: Location and time period
    setweight(to_tsvector('simple', COALESCE(p_province, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(p_era, '')), 'C') ||
    -- Weight D: Description (first 5000 chars to avoid huge vectors)
    setweight(to_tsvector('simple', COALESCE(LEFT(p_raw_page_text, 5000), '')), 'D')
  );
END;
$$;

-- ============================================================================
-- STEP 3: Create trigger function to auto-update search_vector
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
    NEW.raw_page_text
  );
  RETURN NEW;
END;
$$;

-- Create trigger (drop first if exists to ensure idempotency)
DROP TRIGGER IF EXISTS update_search_vector_trigger ON listings;
CREATE TRIGGER update_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, smith, tosogu_maker, school, tosogu_school, province, era, raw_page_text
  ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_listing_search_vector();

-- ============================================================================
-- STEP 4: Create GIN index for fast full-text search
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_listings_search_vector ON listings USING GIN(search_vector);

-- ============================================================================
-- STEP 5: Backfill existing records
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
  raw_page_text
)
WHERE search_vector IS NULL;

-- ============================================================================
-- STEP 6: Create RPC function for instant search (autocomplete/typeahead)
-- Returns top N results quickly for search-as-you-type
-- ============================================================================
CREATE OR REPLACE FUNCTION search_listings_instant(
  p_query TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  item_type TEXT,
  price_value NUMERIC,
  price_currency TEXT,
  images JSONB,
  dealer_id INTEGER,
  dealer_name TEXT,
  rank REAL,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tsquery tsquery;
  v_total BIGINT;
BEGIN
  -- Handle empty or null query
  IF p_query IS NULL OR TRIM(p_query) = '' THEN
    RETURN;
  END IF;

  -- Convert user query to tsquery using plainto_tsquery for simple, forgiving parsing
  v_tsquery := plainto_tsquery('simple', p_query);

  -- Get total count for "View all X results" feature
  SELECT COUNT(*) INTO v_total
  FROM listings l
  WHERE l.search_vector @@ v_tsquery
    AND (l.status = 'available' OR l.is_available = true);

  -- Return results with dealer name via join
  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.item_type,
    l.price_value,
    l.price_currency,
    l.images,
    l.dealer_id,
    d.name AS dealer_name,
    ts_rank_cd(l.search_vector, v_tsquery) AS rank,
    v_total AS total_count
  FROM listings l
  JOIN dealers d ON d.id = l.dealer_id
  WHERE l.search_vector @@ v_tsquery
    AND (l.status = 'available' OR l.is_available = true)
  ORDER BY ts_rank_cd(l.search_vector, v_tsquery) DESC
  LIMIT p_limit;
END;
$$;

-- Grant access to instant search
GRANT EXECUTE ON FUNCTION search_listings_instant(TEXT, INTEGER) TO authenticated, anon;

COMMENT ON FUNCTION search_listings_instant IS
  'Fast instant search for typeahead/autocomplete. Returns top N results with total count.';

-- ============================================================================
-- STEP 7: Create RPC function for full ranked search with filters
-- Supports all browse filters plus full-text search ranking
-- ============================================================================
CREATE OR REPLACE FUNCTION search_listings_ranked(
  p_query TEXT,
  p_tab TEXT DEFAULT 'available',
  p_item_types TEXT[] DEFAULT NULL,
  p_certifications TEXT[] DEFAULT NULL,
  p_dealers INT[] DEFAULT NULL,
  p_ask_only BOOLEAN DEFAULT FALSE,
  p_sort TEXT DEFAULT 'relevance',
  p_limit INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  url TEXT,
  title TEXT,
  item_type TEXT,
  price_value NUMERIC,
  price_currency TEXT,
  smith TEXT,
  tosogu_maker TEXT,
  school TEXT,
  tosogu_school TEXT,
  cert_type TEXT,
  nagasa_cm NUMERIC,
  images JSONB,
  first_seen_at TIMESTAMPTZ,
  last_scraped_at TIMESTAMPTZ,
  status TEXT,
  is_available BOOLEAN,
  is_sold BOOLEAN,
  dealer_id INTEGER,
  dealer_name TEXT,
  dealer_domain TEXT,
  rank REAL,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tsquery tsquery;
  v_total BIGINT;
BEGIN
  -- Convert user query to tsquery (handles empty gracefully)
  IF p_query IS NOT NULL AND TRIM(p_query) != '' THEN
    v_tsquery := plainto_tsquery('simple', p_query);
  END IF;

  -- Get total count matching all filters
  SELECT COUNT(*) INTO v_total
  FROM listings l
  WHERE
    -- Status filter
    CASE p_tab
      WHEN 'available' THEN (l.status = 'available' OR l.is_available = true)
      WHEN 'sold' THEN (l.status = 'sold' OR l.status = 'presumed_sold' OR l.is_sold = true)
      ELSE true
    END
    -- Full-text search (if query provided)
    AND (v_tsquery IS NULL OR l.search_vector @@ v_tsquery)
    -- Item type filter
    AND (p_item_types IS NULL OR LOWER(l.item_type) = ANY(p_item_types))
    -- Certification filter
    AND (p_certifications IS NULL OR l.cert_type = ANY(p_certifications))
    -- Dealer filter
    AND (p_dealers IS NULL OR l.dealer_id = ANY(p_dealers))
    -- Ask only (price on request)
    AND (NOT p_ask_only OR l.price_value IS NULL);

  -- Return results with flexible sorting
  RETURN QUERY
  SELECT
    l.id,
    l.url,
    l.title,
    l.item_type,
    l.price_value,
    l.price_currency,
    l.smith,
    l.tosogu_maker,
    l.school,
    l.tosogu_school,
    l.cert_type,
    l.nagasa_cm,
    l.images,
    l.first_seen_at,
    l.last_scraped_at,
    l.status,
    l.is_available,
    l.is_sold,
    l.dealer_id,
    d.name AS dealer_name,
    d.domain AS dealer_domain,
    CASE
      WHEN v_tsquery IS NOT NULL THEN ts_rank_cd(l.search_vector, v_tsquery)
      ELSE 0.0
    END AS rank,
    v_total AS total_count
  FROM listings l
  JOIN dealers d ON d.id = l.dealer_id
  WHERE
    -- Status filter
    CASE p_tab
      WHEN 'available' THEN (l.status = 'available' OR l.is_available = true)
      WHEN 'sold' THEN (l.status = 'sold' OR l.status = 'presumed_sold' OR l.is_sold = true)
      ELSE true
    END
    -- Full-text search (if query provided)
    AND (v_tsquery IS NULL OR l.search_vector @@ v_tsquery)
    -- Item type filter
    AND (p_item_types IS NULL OR LOWER(l.item_type) = ANY(p_item_types))
    -- Certification filter
    AND (p_certifications IS NULL OR l.cert_type = ANY(p_certifications))
    -- Dealer filter
    AND (p_dealers IS NULL OR l.dealer_id = ANY(p_dealers))
    -- Ask only (price on request)
    AND (NOT p_ask_only OR l.price_value IS NULL)
  ORDER BY
    CASE p_sort
      WHEN 'relevance' THEN
        CASE WHEN v_tsquery IS NOT NULL THEN ts_rank_cd(l.search_vector, v_tsquery) ELSE 0.0 END
    END DESC NULLS LAST,
    CASE p_sort
      WHEN 'price_asc' THEN l.price_value
    END ASC NULLS LAST,
    CASE p_sort
      WHEN 'price_desc' THEN l.price_value
    END DESC NULLS LAST,
    CASE p_sort
      WHEN 'recent' THEN l.first_seen_at
      WHEN 'relevance' THEN l.first_seen_at  -- Secondary sort by recency
    END DESC NULLS LAST,
    CASE p_sort
      WHEN 'name' THEN l.title
    END ASC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant access to ranked search
GRANT EXECUTE ON FUNCTION search_listings_ranked(TEXT, TEXT, TEXT[], TEXT[], INT[], BOOLEAN, TEXT, INTEGER, INTEGER) TO authenticated, anon;

COMMENT ON FUNCTION search_listings_ranked IS
  'Full search with filters, pagination, and flexible sorting. Supports relevance ranking when query provided.';

-- ============================================================================
-- VERIFICATION QUERIES (run manually to test)
-- ============================================================================
-- Test instant search:
-- SELECT * FROM search_listings_instant('katana');
-- SELECT * FROM search_listings_instant('Sukehiro', 5);

-- Test ranked search with filters:
-- SELECT * FROM search_listings_ranked('bizen', 'available', ARRAY['katana']::TEXT[], NULL, NULL, FALSE, 'relevance', 10, 0);

-- Check search vector is populated:
-- SELECT id, title, search_vector IS NOT NULL as has_vector FROM listings LIMIT 10;

-- Check index exists:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'listings' AND indexname = 'idx_listings_search_vector';
