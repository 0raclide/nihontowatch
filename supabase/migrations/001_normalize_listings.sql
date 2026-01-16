-- Durable fix: Normalize item_type and cert_type values at database level
-- This ensures all queries (API, facets, direct SQL) see consistent data

-- Step 1: Normalize item_type values (case and spelling variants)
UPDATE listings SET item_type = LOWER(item_type) WHERE item_type IS NOT NULL;

-- Normalize specific variants
UPDATE listings SET item_type = 'fuchi-kashira' WHERE item_type = 'fuchi_kashira';
UPDATE listings SET item_type = 'unknown' WHERE item_type IN ('Unknown', 'UNKNOWN');

-- Step 2: Normalize cert_type values
UPDATE listings SET cert_type = 'Juyo' WHERE LOWER(cert_type) = 'juyo';
UPDATE listings SET cert_type = 'Tokuju' WHERE LOWER(cert_type) IN ('tokuju', 'tokubetsu juyo', 'tokubetsu_juyo');
UPDATE listings SET cert_type = 'TokuHozon' WHERE LOWER(cert_type) IN ('tokuhozon', 'tokubetsu hozon', 'tokubetsu_hozon');
UPDATE listings SET cert_type = 'Hozon' WHERE LOWER(cert_type) = 'hozon';
UPDATE listings SET cert_type = 'TokuKicho' WHERE LOWER(cert_type) IN ('tokukicho', 'tokubetsu kicho', 'tokubetsu_kicho');

-- Step 3: Create a trigger function to normalize on insert/update
CREATE OR REPLACE FUNCTION normalize_listing_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize item_type to lowercase
  IF NEW.item_type IS NOT NULL THEN
    NEW.item_type := LOWER(NEW.item_type);
    -- Handle special cases
    IF NEW.item_type = 'fuchi_kashira' THEN
      NEW.item_type := 'fuchi-kashira';
    END IF;
  END IF;

  -- Normalize cert_type
  IF NEW.cert_type IS NOT NULL THEN
    CASE LOWER(NEW.cert_type)
      WHEN 'juyo' THEN NEW.cert_type := 'Juyo';
      WHEN 'tokuju', 'tokubetsu juyo', 'tokubetsu_juyo' THEN NEW.cert_type := 'Tokuju';
      WHEN 'tokuhozon', 'tokubetsu hozon', 'tokubetsu_hozon' THEN NEW.cert_type := 'TokuHozon';
      WHEN 'hozon' THEN NEW.cert_type := 'Hozon';
      WHEN 'tokukicho', 'tokubetsu kicho', 'tokubetsu_kicho' THEN NEW.cert_type := 'TokuKicho';
      ELSE NULL; -- Keep as-is if no match
    END CASE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger on listings table
DROP TRIGGER IF EXISTS normalize_listing_trigger ON listings;
CREATE TRIGGER normalize_listing_trigger
  BEFORE INSERT OR UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION normalize_listing_fields();

-- Step 5: Create an index for faster facet queries
CREATE INDEX IF NOT EXISTS idx_listings_item_type ON listings(item_type) WHERE item_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_cert_type ON listings(cert_type) WHERE cert_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_status_available ON listings(status, is_available) WHERE status = 'available' OR is_available = true;
