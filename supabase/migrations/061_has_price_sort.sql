-- Migration: Add has_price generated column for reliable price sorting
--
-- Problem: PostgreSQL DESC default puts NULLs first. ASK items (price_value=NULL)
-- appear at the top of "Price: High → Low" sort. The nullsFirst:false option in
-- Supabase JS should fix this but isn't always reliable across deployments.
--
-- Solution: A boolean generated column (true=has price, false=ASK) used as the
-- primary sort key. Boolean DESC puts TRUE before FALSE — no NULL handling needed.

-- Add generated column: automatically computed from price_value
ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_price boolean
  GENERATED ALWAYS AS (price_value IS NOT NULL) STORED;

-- Index for efficient sorting by has_price + price_jpy compound
CREATE INDEX IF NOT EXISTS idx_listings_has_price_price ON listings (has_price DESC, price_jpy DESC);
