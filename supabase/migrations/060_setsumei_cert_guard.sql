-- Migration 060: Setsumei certification guard
--
-- Problem: When a listing's cert_type is corrected from Juyo/Tokubetsu Juyo
-- to something else (e.g., Hozon), orphaned hallucinated setsumei translations
-- persist in the database and can leak into the UI.
--
-- Fix:
-- 1. Trigger that auto-nulls OCR setsumei fields when cert_type changes away
--    from Juyo/Tokubetsu Juyo
-- 2. One-time cleanup of existing orphaned setsumei data

-- =============================================================================
-- TRIGGER: Auto-clear setsumei when cert changes to non-Juyo/Tokuju
-- =============================================================================

CREATE OR REPLACE FUNCTION clear_setsumei_on_cert_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when cert_type actually changed
  IF OLD.cert_type IS DISTINCT FROM NEW.cert_type THEN
    -- If new cert is NOT Juyo/Tokubetsu Juyo, clear all OCR setsumei fields
    IF NEW.cert_type IS NULL
       OR NEW.cert_type NOT IN ('Juyo', 'Tokubetsu Juyo') THEN
      NEW.setsumei_text_en := NULL;
      NEW.setsumei_text_ja := NULL;
      NEW.setsumei_image_url := NULL;
      NEW.setsumei_metadata := NULL;
      NEW.setsumei_processed_at := NULL;
      NEW.setsumei_pipeline_version := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists (idempotent)
DROP TRIGGER IF EXISTS trg_clear_setsumei_on_cert_change ON listings;

CREATE TRIGGER trg_clear_setsumei_on_cert_change
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION clear_setsumei_on_cert_change();

-- =============================================================================
-- ONE-TIME CLEANUP: Null out orphaned setsumei on non-Juyo/Tokuju listings
-- =============================================================================

UPDATE listings
SET
  setsumei_text_en = NULL,
  setsumei_text_ja = NULL,
  setsumei_image_url = NULL,
  setsumei_metadata = NULL,
  setsumei_processed_at = NULL,
  setsumei_pipeline_version = NULL
WHERE setsumei_text_en IS NOT NULL
  AND (cert_type IS NULL OR cert_type NOT IN ('Juyo', 'Tokubetsu Juyo'));

-- Also delete orphaned Yuhinkai enrichments for non-Juyo/Tokuju listings
DELETE FROM yuhinkai_enrichments
WHERE listing_id IN (
  SELECT id FROM listings
  WHERE cert_type IS NULL OR cert_type NOT IN ('Juyo', 'Tokubetsu Juyo')
);
