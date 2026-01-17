-- =============================================================================
-- NIHONTOWATCH SQL SEARCH TESTS
-- =============================================================================
--
-- This file contains SQL test queries to verify search functionality works
-- correctly against the database schema. These queries are executed by the
-- TypeScript test runner (search.test.ts) to validate:
--
--   1. Case-insensitive ILIKE matching
--   2. Multi-field OR search patterns
--   3. Numeric comparisons (blade length, price)
--   4. Combined text + numeric filters
--   5. Certification matching with variants
--   6. Status filtering
--
-- The database has a `listings` table with these relevant columns:
--   - title, description (text)
--   - smith, tosogu_maker, school, tosogu_school (text)
--   - province, era, mei_type (text)
--   - cert_type, item_type, item_category (text)
--   - material (text)
--   - nagasa_cm (numeric)
--   - price_value (numeric)
--   - status, is_available, is_sold (for filtering)
--
-- =============================================================================


-- =============================================================================
-- TEST 1: CASE-INSENSITIVE ILIKE MATCHING
-- =============================================================================
-- PostgreSQL's ILIKE operator performs case-insensitive pattern matching.
-- This is essential for user searches where "katana", "Katana", and "KATANA"
-- should all return the same results.
-- =============================================================================

-- TEST 1.1: Basic case-insensitive item_type search
-- Should match 'Katana', 'katana', 'KATANA', 'kAtAnA'
-- Expected: Returns all listings where item_type contains 'katana' regardless of case
SELECT id, title, item_type
FROM listings
WHERE item_type ILIKE '%katana%';

-- TEST 1.2: Case-insensitive school search
-- Should match 'Bizen', 'bizen', 'BIZEN'
SELECT id, title, school
FROM listings
WHERE school ILIKE '%bizen%';

-- TEST 1.3: Case-insensitive smith search
-- Should match variations like 'Masamune', 'MASAMUNE', 'masamune'
SELECT id, title, smith
FROM listings
WHERE smith ILIKE '%masamune%';

-- TEST 1.4: Case-insensitive certification search
-- Should match 'Juyo', 'juyo', 'JUYO'
SELECT id, title, cert_type
FROM listings
WHERE cert_type ILIKE '%juyo%';

-- TEST 1.5: Case-insensitive title search
-- Should match title containing 'sword' in any case
SELECT id, title
FROM listings
WHERE title ILIKE '%sword%';


-- =============================================================================
-- TEST 2: MULTI-FIELD OR SEARCH
-- =============================================================================
-- When users search for a term like "bizen", it could match:
--   - school (Bizen school swordsmiths)
--   - province (Bizen province)
--   - title/description (general reference)
--
-- Multi-field OR queries ensure comprehensive results.
-- =============================================================================

-- TEST 2.1: Search "bizen" across multiple fields
-- A term like "bizen" could be a school name OR a province name
SELECT id, title, school, province
FROM listings
WHERE
  title ILIKE '%bizen%' OR
  school ILIKE '%bizen%' OR
  province ILIKE '%bizen%';

-- TEST 2.2: Search "goto" across smith and tosogu_maker
-- "Goto" is both a famous sword smith and a renowned tosogu maker family
SELECT id, title, smith, tosogu_maker
FROM listings
WHERE
  smith ILIKE '%goto%' OR
  tosogu_maker ILIKE '%goto%';

-- TEST 2.3: Search "mino" across school and province
-- Mino is both a sword tradition and a province
SELECT id, title, school, province
FROM listings
WHERE
  school ILIKE '%mino%' OR
  province ILIKE '%mino%';

-- TEST 2.4: Search "iron" across material and description
-- Material searches may appear in descriptions too
SELECT id, title, material, description
FROM listings
WHERE
  material ILIKE '%iron%' OR
  description ILIKE '%iron%';

-- TEST 2.5: Comprehensive text search across all text fields
-- Full-text search simulation for a term
SELECT id, title, smith, school, province, tosogu_maker, tosogu_school
FROM listings
WHERE
  title ILIKE '%yamato%' OR
  description ILIKE '%yamato%' OR
  smith ILIKE '%yamato%' OR
  school ILIKE '%yamato%' OR
  province ILIKE '%yamato%' OR
  tosogu_maker ILIKE '%yamato%' OR
  tosogu_school ILIKE '%yamato%';


-- =============================================================================
-- TEST 3: NUMERIC COMPARISONS
-- =============================================================================
-- Numeric fields like nagasa_cm (blade length) and price_value require
-- different comparison operators: >, <, >=, <=, BETWEEN, =
-- =============================================================================

-- TEST 3.1: Blade length greater than threshold
-- Standard katana length is typically > 60cm
SELECT id, title, nagasa_cm
FROM listings
WHERE nagasa_cm > 70;

-- TEST 3.2: Blade length less than threshold
-- Tanto are typically < 30cm
SELECT id, title, nagasa_cm
FROM listings
WHERE nagasa_cm < 30;

-- TEST 3.3: Price less than threshold
-- Budget-conscious collectors
SELECT id, title, price_value, price_currency
FROM listings
WHERE price_value < 500000;

-- TEST 3.4: Price greater than threshold
-- Premium items
SELECT id, title, price_value, price_currency
FROM listings
WHERE price_value > 1000000;

-- TEST 3.5: Blade length range (BETWEEN equivalent)
-- Typical wakizashi length range (30-60cm)
SELECT id, title, nagasa_cm
FROM listings
WHERE nagasa_cm >= 30 AND nagasa_cm <= 60;

-- TEST 3.6: Price range filter
-- Mid-range items between 100,000 and 500,000 JPY
SELECT id, title, price_value
FROM listings
WHERE price_value >= 100000 AND price_value <= 500000;

-- TEST 3.7: NULL handling in numeric comparisons
-- Ensure NULL values don't break comparisons
SELECT id, title, nagasa_cm
FROM listings
WHERE nagasa_cm > 70 OR nagasa_cm IS NULL;

-- TEST 3.8: Exact numeric match
-- Find items with specific blade length
SELECT id, title, nagasa_cm
FROM listings
WHERE nagasa_cm = 72.5;


-- =============================================================================
-- TEST 4: COMBINED TEXT + NUMERIC FILTERS
-- =============================================================================
-- Real searches often combine text criteria with numeric ranges.
-- Example: "Find Bizen school katana longer than 70cm under 1M yen"
-- =============================================================================

-- TEST 4.1: School + blade length
-- Bizen school swords with substantial length
SELECT id, title, school, province, nagasa_cm
FROM listings
WHERE
  (school ILIKE '%bizen%' OR province ILIKE '%bizen%')
  AND nagasa_cm > 70;

-- TEST 4.2: Item type + price range
-- Katana within budget
SELECT id, title, item_type, price_value
FROM listings
WHERE
  item_type ILIKE '%katana%'
  AND price_value >= 100000
  AND price_value <= 500000;

-- TEST 4.3: Smith + blade length + availability
-- Search for specific smith's work with size criteria
SELECT id, title, smith, nagasa_cm, is_available
FROM listings
WHERE
  smith ILIKE '%kunihiro%'
  AND nagasa_cm > 65
  AND is_available = true;

-- TEST 4.4: Certification + price minimum
-- High-end certified pieces
SELECT id, title, cert_type, price_value
FROM listings
WHERE
  cert_type ILIKE '%juyo%'
  AND price_value > 500000;

-- TEST 4.5: Province + era + blade length range
-- Historical search with multiple criteria
SELECT id, title, province, era, nagasa_cm
FROM listings
WHERE
  province ILIKE '%sagami%'
  AND era ILIKE '%kamakura%'
  AND nagasa_cm >= 70
  AND nagasa_cm <= 80;

-- TEST 4.6: Tosogu search with material
-- Fittings search combining maker and material
SELECT id, title, tosogu_maker, material, price_value
FROM listings
WHERE
  (tosogu_maker ILIKE '%goto%' OR tosogu_school ILIKE '%goto%')
  AND material ILIKE '%gold%';

-- TEST 4.7: Complex multi-field text + numeric
-- Comprehensive filter combining multiple criteria
SELECT id, title, smith, school, nagasa_cm, price_value, cert_type
FROM listings
WHERE
  (smith ILIKE '%nobu%' OR school ILIKE '%yamato%')
  AND nagasa_cm > 65
  AND price_value < 1000000
  AND is_available = true;


-- =============================================================================
-- TEST 5: CERTIFICATION MATCHING WITH VARIANTS
-- =============================================================================
-- Certifications can be written in different formats:
--   - "Juyo" vs "juyo" (case)
--   - "Tokubetsu Juyo" vs "tokubetsu juyo" vs "tokubetsu_juyo" (spacing)
--   - "TJ" vs "Tokubetsu Juyo" (abbreviations)
--   - "NBTHK" vs "nbthk" (organization names)
-- =============================================================================

-- TEST 5.1: Basic certification case insensitivity
-- Match any case variation of "Juyo"
SELECT id, title, cert_type, cert_organization
FROM listings
WHERE cert_type ILIKE 'juyo';

-- TEST 5.2: Exact match with IN clause (case-sensitive fallback)
-- Note: IN clause is case-sensitive by default
SELECT id, title, cert_type
FROM listings
WHERE cert_type IN ('Juyo', 'juyo', 'JUYO');

-- TEST 5.3: Case-insensitive IN equivalent using LOWER
-- Convert to lowercase for consistent matching
SELECT id, title, cert_type
FROM listings
WHERE LOWER(cert_type) = 'juyo';

-- TEST 5.4: Tokubetsu variants with space vs underscore
-- Handle different formatting conventions
SELECT id, title, cert_type
FROM listings
WHERE
  cert_type ILIKE '%tokubetsu juyo%'
  OR cert_type ILIKE '%tokubetsu_juyo%'
  OR cert_type ILIKE '%tokubetsujuyo%';

-- TEST 5.5: Tokubetsu Hozon variants
-- Handle Hozon certification variants
SELECT id, title, cert_type
FROM listings
WHERE
  cert_type ILIKE '%tokubetsu hozon%'
  OR cert_type ILIKE '%tokubetsu_hozon%'
  OR cert_type ILIKE '%tokubetsuhozon%';

-- TEST 5.6: Organization filter
-- Filter by certification organization (NBTHK, NTHK)
SELECT id, title, cert_type, cert_organization
FROM listings
WHERE cert_organization ILIKE '%nbthk%';

-- TEST 5.7: Combined cert_type and organization
-- Specific certification from specific organization
SELECT id, title, cert_type, cert_organization
FROM listings
WHERE
  cert_type ILIKE '%hozon%'
  AND cert_organization ILIKE '%nbthk%';

-- TEST 5.8: Multiple certification levels
-- Find any Juyo or Tokubetsu piece
SELECT id, title, cert_type
FROM listings
WHERE
  cert_type ILIKE '%juyo%'
  OR cert_type ILIKE '%tokubetsu%';

-- TEST 5.9: Certification exclusion (find uncertified items)
-- Items without major certifications (potentially undervalued)
SELECT id, title, cert_type
FROM listings
WHERE
  cert_type IS NULL
  OR (
    cert_type NOT ILIKE '%juyo%'
    AND cert_type NOT ILIKE '%hozon%'
    AND cert_type NOT ILIKE '%tokubetsu%'
  );


-- =============================================================================
-- TEST 6: STATUS FILTERING
-- =============================================================================
-- Listings have multiple status indicators:
--   - status: enum/string ('available', 'sold', 'withdrawn', etc.)
--   - is_available: boolean (true if currently for sale)
--   - is_sold: boolean (true if item has been sold)
--
-- These may overlap or be used redundantly for different purposes.
-- =============================================================================

-- TEST 6.1: Basic availability filter using status string
-- Filter for available items only
SELECT id, title, status, is_available
FROM listings
WHERE status = 'available';

-- TEST 6.2: Availability filter using boolean
-- Alternative using is_available flag
SELECT id, title, status, is_available
FROM listings
WHERE is_available = true;

-- TEST 6.3: Combined status OR is_available
-- Handle potential data inconsistencies
SELECT id, title, status, is_available
FROM listings
WHERE status = 'available' OR is_available = true;

-- TEST 6.4: Sold items filter
-- Find sold items (for price history/research)
SELECT id, title, status, is_sold, price_value
FROM listings
WHERE is_sold = true;

-- TEST 6.5: Sold items by status string
-- Alternative sold filter
SELECT id, title, status
FROM listings
WHERE status ILIKE '%sold%';

-- TEST 6.6: Exclude sold items
-- Only show items that haven't been sold
SELECT id, title, status, is_sold
FROM listings
WHERE is_sold = false OR is_sold IS NULL;

-- TEST 6.7: Exclude unavailable items
-- Filter out items marked as unavailable
SELECT id, title, is_available
FROM listings
WHERE is_available IS NOT false;

-- TEST 6.8: Case-insensitive status matching
-- Handle status case variations
SELECT id, title, status
FROM listings
WHERE LOWER(status) = 'available';

-- TEST 6.9: Combined availability with other filters
-- Real-world query: available Bizen swords
SELECT id, title, school, status, is_available
FROM listings
WHERE
  school ILIKE '%bizen%'
  AND (status = 'available' OR is_available = true);

-- TEST 6.10: Status exclusion list
-- Exclude multiple status types
SELECT id, title, status
FROM listings
WHERE status NOT IN ('sold', 'withdrawn', 'expired', 'error');


-- =============================================================================
-- TEST 7: ADDITIONAL SEARCH PATTERNS
-- =============================================================================
-- Additional queries to test edge cases and common patterns
-- =============================================================================

-- TEST 7.1: Partial word matching with wildcards
-- Find items with partial smith names
SELECT id, title, smith
FROM listings
WHERE smith ILIKE '%yoshi%';

-- TEST 7.2: Beginning-of-word matching
-- Smith names starting with "Kuni"
SELECT id, title, smith
FROM listings
WHERE smith ILIKE 'kuni%';

-- TEST 7.3: End-of-word matching
-- Smith names ending with "hiro"
SELECT id, title, smith
FROM listings
WHERE smith ILIKE '%hiro';

-- TEST 7.4: Multiple item types
-- Search for multiple sword types
SELECT id, title, item_type
FROM listings
WHERE
  item_type ILIKE '%katana%'
  OR item_type ILIKE '%wakizashi%'
  OR item_type ILIKE '%tanto%';

-- TEST 7.5: Era/period search variations
-- Match era names with different formats
SELECT id, title, era
FROM listings
WHERE
  era ILIKE '%edo%'
  OR era ILIKE '%tokugawa%';

-- TEST 7.6: Material search for tosogu
-- Common fittings materials
SELECT id, title, material, item_type
FROM listings
WHERE
  material ILIKE '%shakudo%'
  OR material ILIKE '%shibuichi%'
  OR material ILIKE '%iron%'
  OR material ILIKE '%gold%';

-- TEST 7.7: Japanese text search (if supported)
-- Search using Japanese characters
SELECT id, title, smith, school
FROM listings
WHERE
  title LIKE '%刀%'
  OR school LIKE '%備前%';

-- TEST 7.8: Combined sort and filter
-- Search with ordering by price
SELECT id, title, price_value, school, nagasa_cm
FROM listings
WHERE
  school ILIKE '%bizen%'
  AND is_available = true
ORDER BY price_value DESC
LIMIT 10;

-- TEST 7.9: Aggregate count for search results
-- Count matching items (for pagination UI)
SELECT COUNT(*) as total_count
FROM listings
WHERE
  school ILIKE '%bizen%'
  AND is_available = true;

-- TEST 7.10: NULL handling in text searches
-- Ensure NULL values don't break searches
SELECT id, title, smith
FROM listings
WHERE
  (smith ILIKE '%goto%' OR smith IS NULL)
  AND item_type IS NOT NULL;


-- =============================================================================
-- END OF TEST QUERIES
-- =============================================================================
