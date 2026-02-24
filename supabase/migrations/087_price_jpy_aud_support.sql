-- Migration: Add AUD support to price_jpy conversion
-- Nihonto Australia lists prices in AUD. Without an AUD case,
-- the ELSE fallback stores raw AUD values as JPY (e.g., AUD $500 → price_jpy = 500
-- instead of ~48,500). This breaks cross-currency price sorting.

-- 1. Update the trigger function to handle AUD
CREATE OR REPLACE FUNCTION compute_price_jpy()
RETURNS TRIGGER AS $$
DECLARE
  usd_to_jpy CONSTANT NUMERIC := 156;
  eur_to_jpy CONSTANT NUMERIC := 163;
  gbp_to_jpy CONSTANT NUMERIC := 195;
  aud_to_jpy CONSTANT NUMERIC := 97;
BEGIN
  IF NEW.price_value IS NOT NULL THEN
    NEW.price_jpy := CASE
      WHEN NEW.price_currency = 'JPY' OR NEW.price_currency IS NULL THEN NEW.price_value
      WHEN NEW.price_currency = 'USD' THEN NEW.price_value * usd_to_jpy
      WHEN NEW.price_currency = 'EUR' THEN NEW.price_value * eur_to_jpy
      WHEN NEW.price_currency = 'GBP' THEN NEW.price_value * gbp_to_jpy
      WHEN NEW.price_currency = 'AUD' THEN NEW.price_value * aud_to_jpy
      ELSE NEW.price_value
    END;
  ELSE
    NEW.price_jpy := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Update the batch refresh function to accept AUD rate
CREATE OR REPLACE FUNCTION refresh_price_jpy(
  usd_to_jpy NUMERIC DEFAULT 150,
  eur_to_jpy NUMERIC DEFAULT 160,
  gbp_to_jpy NUMERIC DEFAULT 190,
  aud_to_jpy NUMERIC DEFAULT 97
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE listings
  SET price_jpy = CASE
    WHEN price_currency = 'JPY' OR price_currency IS NULL THEN price_value
    WHEN price_currency = 'USD' THEN price_value * usd_to_jpy
    WHEN price_currency = 'EUR' THEN price_value * eur_to_jpy
    WHEN price_currency = 'GBP' THEN price_value * gbp_to_jpy
    WHEN price_currency = 'AUD' THEN price_value * aud_to_jpy
    ELSE price_value
  END
  WHERE price_value IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix existing AUD listings that have incorrect price_jpy
UPDATE listings
SET price_jpy = price_value * 97
WHERE price_currency = 'AUD'
  AND price_value IS NOT NULL;
