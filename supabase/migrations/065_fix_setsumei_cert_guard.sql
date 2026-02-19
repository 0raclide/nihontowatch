-- Migration 065: Fix setsumei cert guard to include all Juyo-tier variants
--
-- Problem: Migration 060 used cert_type NOT IN ('Juyo', 'Tokubetsu Juyo')
-- but the database stores 'Tokuju' (not 'Tokubetsu Juyo') and uses
-- 'Juyo Tosogu' / 'Tokubetsu Juyo Tosogu' for fittings.
--
-- This caused:
-- 1. DELETE of all Tokuju enrichment records (permanent data loss)
-- 2. Trigger that clears setsumei fields on Tokuju listings
--
-- Fix: Update trigger to recognize all Juyo-tier cert_type variants.
-- Mirrors SETSUMEI_ELIGIBLE_CERT_TYPES from Oshi-scrapper/cert_types.py.

-- =============================================================================
-- FIX TRIGGER: Include all Juyo-tier cert variants
-- =============================================================================

CREATE OR REPLACE FUNCTION clear_setsumei_on_cert_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when cert_type actually changed
  IF OLD.cert_type IS DISTINCT FROM NEW.cert_type THEN
    -- If new cert is NOT a Juyo-tier type, clear all OCR setsumei fields.
    -- Must include all variants: Tokuju (canonical), Tokubetsu Juyo (legacy),
    -- and tosogu-specific types.
    IF NEW.cert_type IS NULL
       OR NEW.cert_type NOT IN (
         'Juyo',
         'Tokuju',
         'Tokubetsu Juyo',
         'Juyo Tosogu',
         'Tokubetsu Juyo Tosogu'
       ) THEN
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
