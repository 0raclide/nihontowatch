-- Migration 006: Comprehensive Data Normalization
-- Fixes all data variants to ensure consistent filtering and faceting

-- ============================================================================
-- ITEM_TYPE NORMALIZATION (lowercase)
-- ============================================================================
UPDATE listings SET item_type = 'katana' WHERE LOWER(item_type) = 'katana';
UPDATE listings SET item_type = 'wakizashi' WHERE LOWER(item_type) = 'wakizashi';
UPDATE listings SET item_type = 'tanto' WHERE LOWER(item_type) = 'tanto';
UPDATE listings SET item_type = 'tachi' WHERE LOWER(item_type) = 'tachi';
UPDATE listings SET item_type = 'tsuba' WHERE LOWER(item_type) = 'tsuba';
UPDATE listings SET item_type = 'kozuka' WHERE LOWER(item_type) = 'kozuka';
UPDATE listings SET item_type = 'menuki' WHERE LOWER(item_type) = 'menuki';
UPDATE listings SET item_type = 'fuchi-kashira' WHERE LOWER(item_type) IN ('fuchi-kashira', 'fuchi_kashira', 'fuchikashira');
UPDATE listings SET item_type = 'koshirae' WHERE LOWER(item_type) = 'koshirae';
UPDATE listings SET item_type = 'yari' WHERE LOWER(item_type) = 'yari';
UPDATE listings SET item_type = 'naginata' WHERE LOWER(item_type) = 'naginata';
UPDATE listings SET item_type = 'ken' WHERE LOWER(item_type) = 'ken';
UPDATE listings SET item_type = 'kodachi' WHERE LOWER(item_type) = 'kodachi';
UPDATE listings SET item_type = 'tanegashima' WHERE LOWER(item_type) = 'tanegashima';
UPDATE listings SET item_type = 'unknown' WHERE LOWER(item_type) IN ('unknown', 'other', '');

-- ============================================================================
-- CERT_TYPE NORMALIZATION (Title Case standard)
-- ============================================================================
UPDATE listings SET cert_type = 'Juyo' WHERE LOWER(cert_type) = 'juyo';
UPDATE listings SET cert_type = 'Tokuju' WHERE LOWER(cert_type) IN ('tokuju', 'tokubetsu juyo', 'tokubetsu_juyo');
UPDATE listings SET cert_type = 'TokuHozon' WHERE LOWER(cert_type) IN ('tokuhozon', 'tokubetsu hozon', 'tokubetsu_hozon');
UPDATE listings SET cert_type = 'Hozon' WHERE LOWER(cert_type) = 'hozon';
UPDATE listings SET cert_type = 'TokuKicho' WHERE LOWER(cert_type) IN ('tokukicho', 'tokubetsu kicho', 'tokubetsu_kicho', 'kicho');
-- Clean up "null" string values
UPDATE listings SET cert_type = NULL WHERE cert_type = 'null';

-- ============================================================================
-- STATUS NORMALIZATION
-- ============================================================================
-- Treat "active" as "available"
UPDATE listings SET status = 'available' WHERE status = 'active';
-- Update is_available/is_sold flags based on status
UPDATE listings SET is_available = true WHERE status = 'available' AND (is_available IS NULL OR is_available = false);
UPDATE listings SET is_sold = true WHERE status IN ('sold', 'presumed_sold') AND (is_sold IS NULL OR is_sold = false);
-- Handle "unknown" status - keep it but ensure is_available is set if item appears available
UPDATE listings SET is_available = true WHERE status = 'unknown' AND is_available IS NULL;

-- ============================================================================
-- UPDATE TRIGGER TO HANDLE ALL NORMALIZATIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION normalize_listing_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize item_type to lowercase
  IF NEW.item_type IS NOT NULL THEN
    NEW.item_type := LOWER(NEW.item_type);
    -- Handle special cases
    IF NEW.item_type IN ('fuchi_kashira', 'fuchikashira') THEN
      NEW.item_type := 'fuchi-kashira';
    END IF;
    IF NEW.item_type IN ('other', '') THEN
      NEW.item_type := 'unknown';
    END IF;
  END IF;

  -- Normalize cert_type
  IF NEW.cert_type IS NOT NULL THEN
    -- Handle "null" string
    IF NEW.cert_type = 'null' THEN
      NEW.cert_type := NULL;
    ELSE
      CASE LOWER(NEW.cert_type)
        WHEN 'juyo' THEN NEW.cert_type := 'Juyo';
        WHEN 'tokuju' THEN NEW.cert_type := 'Tokuju';
        WHEN 'tokubetsu juyo' THEN NEW.cert_type := 'Tokuju';
        WHEN 'tokubetsu_juyo' THEN NEW.cert_type := 'Tokuju';
        WHEN 'tokuhozon' THEN NEW.cert_type := 'TokuHozon';
        WHEN 'tokubetsu hozon' THEN NEW.cert_type := 'TokuHozon';
        WHEN 'tokubetsu_hozon' THEN NEW.cert_type := 'TokuHozon';
        WHEN 'hozon' THEN NEW.cert_type := 'Hozon';
        WHEN 'tokukicho' THEN NEW.cert_type := 'TokuKicho';
        WHEN 'tokubetsu kicho' THEN NEW.cert_type := 'TokuKicho';
        WHEN 'tokubetsu_kicho' THEN NEW.cert_type := 'TokuKicho';
        WHEN 'kicho' THEN NEW.cert_type := 'TokuKicho';
        ELSE NULL; -- Keep as-is if no match
      END CASE;
    END IF;
  END IF;

  -- Normalize status
  IF NEW.status = 'active' THEN
    NEW.status := 'available';
  END IF;

  -- Auto-set availability flags based on status
  IF NEW.status = 'available' THEN
    NEW.is_available := true;
    NEW.is_sold := false;
  ELSIF NEW.status IN ('sold', 'presumed_sold') THEN
    NEW.is_available := false;
    NEW.is_sold := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS normalize_listing_trigger ON listings;
CREATE TRIGGER normalize_listing_trigger
  BEFORE INSERT OR UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION normalize_listing_fields();

-- ============================================================================
-- VERIFICATION QUERY (run manually to verify)
-- ============================================================================
-- SELECT item_type, COUNT(*) FROM listings GROUP BY item_type ORDER BY COUNT(*) DESC;
-- SELECT cert_type, COUNT(*) FROM listings GROUP BY cert_type ORDER BY COUNT(*) DESC;
-- SELECT status, COUNT(*) FROM listings GROUP BY status ORDER BY COUNT(*) DESC;
