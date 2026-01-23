-- Migration: Add trigger to compute price_jpy on insert/update
-- This ensures new listings automatically have price_jpy populated
-- without waiting for the periodic refresh job.
--
-- The trigger uses fixed exchange rates as defaults. The periodic
-- refresh_price_jpy function should still be called to update
-- with live rates.

-- Create a function to compute price_jpy for a single row
CREATE OR REPLACE FUNCTION compute_price_jpy()
RETURNS TRIGGER AS $$
DECLARE
  -- Default exchange rates (updated periodically by refresh_price_jpy)
  -- These are reasonable approximations as of early 2025
  usd_to_jpy CONSTANT NUMERIC := 156;
  eur_to_jpy CONSTANT NUMERIC := 163;
  gbp_to_jpy CONSTANT NUMERIC := 195;
BEGIN
  -- Only compute if price_value is set
  IF NEW.price_value IS NOT NULL THEN
    NEW.price_jpy := CASE
      WHEN NEW.price_currency = 'JPY' OR NEW.price_currency IS NULL THEN NEW.price_value
      WHEN NEW.price_currency = 'USD' THEN NEW.price_value * usd_to_jpy
      WHEN NEW.price_currency = 'EUR' THEN NEW.price_value * eur_to_jpy
      WHEN NEW.price_currency = 'GBP' THEN NEW.price_value * gbp_to_jpy
      ELSE NEW.price_value  -- fallback for unknown currencies
    END;
  ELSE
    -- Clear price_jpy if price_value is cleared
    NEW.price_jpy := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT
DROP TRIGGER IF EXISTS trigger_compute_price_jpy_insert ON listings;
CREATE TRIGGER trigger_compute_price_jpy_insert
  BEFORE INSERT ON listings
  FOR EACH ROW
  EXECUTE FUNCTION compute_price_jpy();

-- Create trigger for UPDATE (only when price changes)
DROP TRIGGER IF EXISTS trigger_compute_price_jpy_update ON listings;
CREATE TRIGGER trigger_compute_price_jpy_update
  BEFORE UPDATE ON listings
  FOR EACH ROW
  WHEN (
    OLD.price_value IS DISTINCT FROM NEW.price_value OR
    OLD.price_currency IS DISTINCT FROM NEW.price_currency
  )
  EXECUTE FUNCTION compute_price_jpy();

-- Add comments
COMMENT ON FUNCTION compute_price_jpy IS 'Trigger function to compute price_jpy from price_value and price_currency on insert/update';
