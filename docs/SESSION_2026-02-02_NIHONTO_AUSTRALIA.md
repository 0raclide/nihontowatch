# Session Summary: Nihonto Australia Integration

**Date:** 2026-02-02
**Duration:** Full session
**Dealer:** Nihonto Australia (nihonto.com.au)
**Dealer ID:** 70

---

## Objectives Completed

1. ✅ Push scraper to production and run backfill
2. ✅ Fix banner image appearing as first image
3. ✅ Add AUD currency conversion support
4. ✅ Add dealer to International filter (AU)
5. ✅ QA all listings from dealer

---

## Work Summary

### 1. Banner Image Fix

**Issue:** Site header banner (`nihonto-australia-header-no-text.jpg`) was captured as first product image in ~18 listings.

**Solution:** Added `_is_icon()` override in `NihontoAuScraper` to filter banner patterns.

**Files:**
- `Oshi-scrapper/scrapers/dealers/nihonto_au.py`

**Commit:** `69a4e29` (Oshi-scrapper)

---

### 2. AUD Currency Support

**Issue:** AUD not in exchange rates API, so Australian prices couldn't be converted to USD/JPY/EUR.

**Solution:**
- Added AUD to Frankfurter API call
- Added AUD fallback rate (1.55 USD/AUD)
- Added AUD to analytics rates (97 JPY/AUD)

**Files:**
- `src/app/api/exchange-rates/route.ts`
- `src/lib/currency/convert.ts`

**Commit:** `15a6f5a` (nihontowatch)

---

### 3. Dealer Filter

**Issue:** Nihonto Australia not appearing in International dealers section.

**Solution:** Added `'Nihonto Australia': 'AU'` to `DEALER_COUNTRIES` mapping.

**Files:**
- `src/components/browse/FilterContent.tsx`

**Commit:** `5da440a` (nihontowatch)

---

### 4. Database Fixes

| Fix | Count | Method |
|-----|-------|--------|
| USD → AUD currency | 82 total | SQL update via service role |
| Remove banner images | 18 | Python script |
| Unknown → proper type | 23 | Python script |
| Tosogu attribution | 64 | Python script (school→tosogu_school) |

---

### 5. QA Results

**Final Statistics:**

| Metric | Value |
|--------|-------|
| Total listings | 390 |
| Unknown items | 0 ✓ |
| Currency (AUD) | 100% ✓ |
| Banner images | 0 ✓ |
| Price coverage | 53.6% |
| Image coverage | 95.4% |
| Sword smith | 86.2% |
| Tosogu attribution | 27.7% |

**Item Type Distribution:**
- tsuba: 153 (39%)
- katana: 72 (19%)
- menuki: 32 (8%)
- tanto: 31 (8%)
- wakizashi: 21 (5%)
- Other: 81 (21%)

---

## All Commits

| Repo | Commit | Description |
|------|--------|-------------|
| nihontowatch | `5da440a` | Add dealer to International filter (AU) |
| nihontowatch | `15a6f5a` | Add AUD currency conversion support |
| nihontowatch | `3ac3e38` | Add integration postmortem doc |
| nihontowatch | `1180021` | Add QA report to postmortem |
| Oshi-scrapper | `69a4e29` | Filter banner images from gallery |

---

## Documentation Created

1. `docs/POSTMORTEM_NIHONTO_AUSTRALIA_INTEGRATION.md` - Full integration details
2. `docs/SESSION_2026-02-02_NIHONTO_AUSTRALIA.md` - This session summary

---

## Known Issues / Notes

1. **18 listings have no images** - Dealer-side issue (placeholder images on website)
2. **46% have no price** - Dealer uses "Contact for Price" for many items
3. **Backfill used old code** - Required multiple USD→AUD fixes as items were scraped with old code in memory

---

## Currency Conversion Flow

```
Stored: AUD $5,000
    ↓
API Rate: 1 USD = 1.43 AUD
    ↓
Display (user's choice):
  • JPY: ¥539,770 (default)
  • USD: $3,505
  • EUR: €2,944
```

---

## Session End State

- Backfill: Complete (390/390)
- All fixes applied
- Documentation committed
- Ready for production use
