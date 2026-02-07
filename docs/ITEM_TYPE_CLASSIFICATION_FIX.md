# Item Type Classification Fix

**Date:** 2026-02-06
**Issue:** Japanese characters showing in listing card titles instead of English item type labels

## Problem

Listing 40183 (and others) displayed Japanese characters like "三所物:倶利伽羅龍図" as the thumbnail title instead of "Mitokoromono".

**Root causes identified:**

1. **Scraper bug (Oshi-scrapper):** Samurai Nippon scraper had hardcoded item type detection that missed mitokoromono, futatokoro, daisho, and other special types
2. **Frontend bug (nihontowatch):** `ITEM_TYPE_LABELS` map was missing many item types, causing fallback to Japanese titles

## Fixes Applied

### 1. Oshi-scrapper: Samurai Nippon Scraper

**File:** `/Oshi-scrapper/scrapers/samurai_nippon.py`

Updated `_detect_item_type()` to use the centralized `classify_by_title()` from `utils/item_classifier.py` instead of hardcoded patterns.

```python
# Before: Hardcoded list missing mitokoromono, futatokoro, etc.
tosogu_types = ['鐔', '鍔', '目貫', '小柄', '笄', '縁頭']

# After: Uses centralized classifier
from utils.item_classifier import classify_by_title
item_type, confidence = classify_by_title(title)
```

### 2. Database Backfill

Ran existing backfill script to fix 260 unknown items:

```bash
cd /Oshi-scrapper
python3 scripts/backfill_unknown_items.py
```

**Results:**
- 106 items reclassified (mitokoromono, daisho, armor, stand, book, etc.)
- 18 error pages excluded (無題ドキュメント, 404 pages)
- 31 non-sword antiques marked unavailable (matchlock guns, ceramics)
- Unknown items reduced: 97 → 40

### 3. nihontowatch Frontend

**File:** `src/components/browse/ListingCard.tsx`

Added missing item type labels:

```typescript
const ITEM_TYPE_LABELS: Record<string, string> = {
  // Added:
  mitokoromono: 'Mitokoromono',
  futatokoro: 'Futatokoro',
  daisho: 'Daishō',
  ken: 'Ken',
  kogai: 'Kōgai',
  fuchi: 'Fuchi',
  kashira: 'Kashira',
  tosogu: 'Tosogu',
  stand: 'Stand',
  book: 'Book',
  helmet: 'Kabuto',
  fuchi_kashira: 'Fuchi-Kashira',
  // ... existing labels
};
```

**Commit:** `1f41c21 fix: Add missing item type labels (mitokoromono, daisho, etc.)`

## Architecture Decision: Centralized Classifier

### Why scrapers have their own `_detect_item_type` methods:

1. **URL-based detection is more reliable** for some dealers:
   - Touken Matsumoto: Product ID prefix (MEN-, WA-) is 100% accurate
   - E-sword: URL path `/katana/`, `/tousougu/` is definitive

2. **The centralized classifier was designed as a fallback**, not primary detection:
   - Used for backfilling unknown items
   - Validating LLM-extracted types
   - Pre-filtering non-collectible items

3. **Dealer-specific edge cases:**
   - "刀...鍔拵え付" should be KATANA, not TSUBA
   - Some dealers need different precedence rules

### Recommendation:

- **Keep URL-based detection** where it's reliable
- **Add centralized classifier as fallback** when dealer-specific detection returns UNKNOWN
- **Run backfill periodically** as a safety net
- **For Samurai Nippon:** Using centralized classifier directly is fine (no URL patterns, title-based detection was incomplete)

## Verification

```bash
# Check mitokoromono listings
curl -s "https://nihontowatch.com/api/browse?type=mitokoromono" | python3 -c "
import json, sys
for l in json.load(sys.stdin).get('listings', []):
    print(f\"{l['id']}: {l['item_type']} - {l['title'][:40]}\")"
```

All 8 mitokoromono items now have correct `item_type: mitokoromono` and display "Mitokoromono" in the UI.

## Files Changed

| Repository | File | Change |
|------------|------|--------|
| Oshi-scrapper | `scrapers/samurai_nippon.py` | Use centralized classifier |
| nihontowatch | `src/components/browse/ListingCard.tsx` | Add missing item type labels |

## Related

- Backfill script: `/Oshi-scrapper/scripts/backfill_unknown_items.py`
- Centralized classifier: `/Oshi-scrapper/utils/item_classifier.py`
- Filter labels (already had mitokoromono): `src/components/browse/FilterContent.tsx`
