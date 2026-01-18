-- Migration: Add price_jpy column for currency-normalized sorting
-- This enables accurate price sorting across multi-currency listings
-- The column stores all prices converted to JPY for consistent comparison

-- Add the normalized price column
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_jpy NUMERIC;

-- Add index for sorting performance
CREATE INDEX IF NOT EXISTS idx_listings_price_jpy ON listings(price_jpy DESC NULLS LAST);

-- Populate existing data with current approximate rates
-- USD: ~150 JPY, EUR: ~160 JPY (as of early 2025)
-- These values will be refreshed periodically via the refresh API
UPDATE listings
SET price_jpy = CASE
  WHEN price_currency = 'JPY' OR price_currency IS NULL THEN price_value
  WHEN price_currency = 'USD' THEN price_value * 150
  WHEN price_currency = 'EUR' THEN price_value * 160
  WHEN price_currency = 'GBP' THEN price_value * 190
  ELSE price_value  -- fallback for unknown currencies
END
WHERE price_value IS NOT NULL;

-- Create a function to refresh price_jpy with given exchange rates
-- This can be called from the application with live rates
CREATE OR REPLACE FUNCTION refresh_price_jpy(
  usd_to_jpy NUMERIC DEFAULT 150,
  eur_to_jpy NUMERIC DEFAULT 160,
  gbp_to_jpy NUMERIC DEFAULT 190
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
    ELSE price_value
  END
  WHERE price_value IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (for admin refresh)
GRANT EXECUTE ON FUNCTION refresh_price_jpy TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_price_jpy TO service_role;

COMMENT ON COLUMN listings.price_jpy IS 'Price normalized to JPY for consistent cross-currency sorting. Refreshed periodically with live exchange rates.';
COMMENT ON FUNCTION refresh_price_jpy IS 'Refresh all price_jpy values using provided exchange rates. Call with live rates to update sorting order.';
