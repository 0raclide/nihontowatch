# Price Normalization for Cross-Currency Sorting

## Problem

Items from Western dealers (nihonto.com, nihontoart.com, swordsofjapan.com) are priced in USD, while Japanese dealers use JPY. When sorting by price, a $50,000 USD item was incorrectly appearing below a ¥1,000,000 JPY item because the database was comparing raw numeric values (50000 < 1000000), not their actual value.

## Solution: Hybrid Approach

We use a `price_jpy` column that stores all prices normalized to JPY for consistent sorting. This column is:
1. **Populated on scrape** - Scraper computes `price_jpy` when saving listings
2. **Refreshed periodically** - API endpoint updates all values with live exchange rates

## Implementation

### Database Changes

Migration `022_add_price_jpy.sql` adds:
- `price_jpy` column (NUMERIC) - Normalized price in JPY
- Index `idx_listings_price_jpy` - For efficient sorting
- Function `refresh_price_jpy(usd_to_jpy, eur_to_jpy, gbp_to_jpy)` - Batch refresh all prices

### API Changes

**Browse API** (`/api/browse`)
- Now sorts by `price_jpy` instead of `price_value`

**Refresh API** (`/api/admin/refresh-price-jpy`)
- GET/POST endpoint to refresh all `price_jpy` values
- Fetches live exchange rates from Frankfurter API
- Call weekly or when rates shift significantly

### Running the Migration

Execute the following SQL in your Supabase SQL Editor:

```sql
-- Add the normalized price column
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_jpy NUMERIC;

-- Add index for sorting performance
CREATE INDEX IF NOT EXISTS idx_listings_price_jpy ON listings(price_jpy DESC NULLS LAST);

-- Populate existing data with current approximate rates
UPDATE listings
SET price_jpy = CASE
  WHEN price_currency = 'JPY' OR price_currency IS NULL THEN price_value
  WHEN price_currency = 'USD' THEN price_value * 150
  WHEN price_currency = 'EUR' THEN price_value * 160
  WHEN price_currency = 'GBP' THEN price_value * 190
  ELSE price_value
END
WHERE price_value IS NOT NULL;

-- Create refresh function
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

GRANT EXECUTE ON FUNCTION refresh_price_jpy TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_price_jpy TO service_role;
```

### Scraper Changes (Oshi-scrapper)

Update `db/repository.py` in the `_listing_to_db_row` method to compute `price_jpy`:

```python
# In _listing_to_db_row(), after setting price fields:

# Compute normalized price in JPY for sorting
price_jpy = None
if listing.price_value is not None:
    currency = (listing.price_currency or 'JPY').upper()
    # Approximate rates - will be refreshed periodically
    RATES_TO_JPY = {
        'JPY': 1,
        'USD': 150,
        'EUR': 160,
        'GBP': 190,
    }
    rate = RATES_TO_JPY.get(currency, 1)
    price_jpy = listing.price_value * rate

row = {
    # ... existing fields ...
    "price_value": listing.price_value,
    "price_currency": listing.price_currency,
    "price_raw": listing.price_raw,
    "price_jpy": price_jpy,  # ADD THIS LINE
    # ...
}
```

## Maintenance

### Refresh Schedule

Call the refresh endpoint periodically:
- **Weekly** via cron or Vercel cron
- **After bulk imports** to ensure new listings are normalized
- **Manually** after significant currency movements (>5%)

```bash
# Manual refresh
curl -X POST https://nihontowatch.com/api/admin/refresh-price-jpy

# Response
{
  "success": true,
  "updatedCount": 5432,
  "rates": {
    "usdToJpy": 149.85,
    "eurToJpy": 162.34,
    "gbpToJpy": 189.12
  },
  "timestamp": "2025-01-18T12:00:00.000Z"
}
```

### Exchange Rate Source

Uses [Frankfurter API](https://www.frankfurter.app/) (free, no API key required):
- Updates rates every hour
- Fallback to hardcoded rates if API unavailable

## Notes

- Sorting accuracy depends on exchange rate freshness
- For most use cases, weekly refreshes are sufficient
- Rate variations of ±5% don't significantly affect sort order
- The scraper's hardcoded rates are a starting point; the refresh API corrects them
