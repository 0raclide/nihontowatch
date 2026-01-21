# Session Summary: Data Quality Fixes (2026-01-21)

## Issues Addressed

### 1. Failing Concordance Test: `nihonto + tosogu cert counts should approximately equal all cert counts`

**Symptom**: Test expected `6 >= 16.15` but got `6`

**Root Cause**: 13 TokuKicho-certified items had `item_type = 'unknown'` instead of proper armor classifications (yoroi, kabuto, menpo). These items weren't counted in either nihonto or tosogu categories.

**Investigation**:
```
TokuKicho breakdown:
- unknown: 13 items  ← Problem
- tsuba (tosogu): 3 items
- menuki (tosogu): 2 items
- katana (nihonto): 1 item
Total: 19 items
```

**Data Fix**: Updated 16 World Seiyudo listings:
- 11 Yoroi → `armor`
- 4 Kabuto → `helmet`
- 1 Menpo → `menpo`

**Test Fix**: Updated concordance test to include armor category in sum:
- Before: `nihonto + tosogu ≈ all`
- After: `nihonto + tosogu + armor ≈ all`

**Files Changed**:
- `tests/api/browse-concordance.test.ts` - Added armorResponse, updated sum checks

---

### 2. Low-Price Items Appearing in Browse Results

**Symptom**: Listing 33218 (Katana-Makura, ¥1,200) appeared in browse despite MIN_PRICE_JPY = 100,000

**Root Cause**: 329 JPY-priced items had `price_jpy = NULL`. The filter logic allowed `price_jpy IS NULL` (intended for ASK listings), so low-price items with missing `price_jpy` slipped through.

**Investigation**:
```sql
-- Items with price but no normalized JPY
SELECT COUNT(*) FROM listings
WHERE price_value IS NOT NULL
  AND price_jpy IS NULL
  AND is_available = true;
-- Result: 329 items (mostly World Seiyudo, Yushindou, Choshuya)
```

**Data Fix**: Backfilled `price_jpy` for all JPY items:
```sql
UPDATE listings
SET price_jpy = price_value
WHERE price_currency = 'JPY'
  AND price_value IS NOT NULL
  AND price_jpy IS NULL;
-- Updated: 329 rows
```

**Code Fix** (`src/app/api/browse/route.ts:171`):
```javascript
// Before (buggy): Allowed items with price_value but null price_jpy
query.or(`price_jpy.is.null,price_jpy.gte.${MIN_PRICE_JPY}`)

// After (fixed): Only true ASK listings pass through
query.or(`price_value.is.null,price_jpy.gte.${MIN_PRICE_JPY}`)
```

**Test Added**: 3 new tests in `tests/api/browse-concordance.test.ts`:
- `no priced items below minimum should appear in results`
- `ASK listings (no price) should still appear`
- `items with price_value but missing price_jpy should not appear if low-priced`

---

## Files Modified

| File | Changes |
|------|---------|
| `src/app/api/browse/route.ts` | Fixed min price filter to check `price_value.is.null` instead of `price_jpy.is.null` |
| `tests/api/browse-concordance.test.ts` | Added armor category to sum checks; added 3 min price filter tests |

## Database Changes

| Table | Records | Change |
|-------|---------|--------|
| listings | 16 | Updated `item_type` from 'unknown' to armor types |
| listings | 329 | Backfilled `price_jpy` for JPY items |

## Test Results

All 55 concordance tests pass:
- 52 original tests
- 3 new minimum price filter tests

## Prevention

1. **Armor category now tracked**: Test validates `nihonto + tosogu + armor ≈ all`
2. **Price filter hardened**: Uses `price_value IS NULL` for ASK detection, not `price_jpy`
3. **Regression tests**: Will catch future issues with low-price items appearing

## Dealers Affected

- **World Seiyudo**: 268 items had missing `price_jpy`, 13 items had wrong `item_type`
- **Yushindou**: 22 items had missing `price_jpy`
- **Choshuya**: 14 items had missing `price_jpy`
- **Aoi Art**: 11 items had missing `price_jpy`
