# Choshuya Item Type & Certification Fix

**Date:** 2026-02-07
**Status:** Complete
**Affected Dealer:** Choshuya (ID: 9)

## Problem Statement

Multiple Choshuya senrigan listings were incorrectly classified:
1. **Swords displayed as tosogu** - Blades (katana, wakizashi, tanto, etc.) showing in tosogu category
2. **False Juyo certification** - Listings showing "Juyo" certification from parenthetical references to other works
3. **Wrong sword types** - Katana vs tanto vs tachi confusion, koshirae classified as swords

Example problem URLs:
- https://nihontowatch.com/?listing=33940 (was: tosogu + Juyo, actual: wakizashi)
- https://nihontowatch.com/?listing=35758 (was: tosogu + Juyo, actual: wakizashi)
- https://nihontowatch.com/?listing=35957 (was: tosogu + Juyo, actual: wakizashi)

## Root Causes

### 1. Scraper Fallback Bug
In `scrapers/choshuya.py` line 962-963:
```python
# OLD CODE - WRONG
if listing.item_type == ItemType.UNKNOWN and '/senrigan' in listing.url:
    listing.item_type = ItemType.TOSOGU  # Defaulted ALL unknown to tosogu
```

Senrigan pages contain BOTH swords AND tosogu. The fallback incorrectly assumed all were tosogu.

### 2. False Juyo Detection
In `utils/llm_extractor.py`, the regex matched Juyo patterns inside parentheses:
```
（第二十一回重要刀剣）  ← Reference to ANOTHER work, not this listing
```

These parenthetical references are common on Choshuya pages when describing related works by the same smith.

### 3. Regex Pattern Mismatch
The item type extraction regex only matched newlines:
```python
# OLD - Only matched newlines
r'銀座長州屋\n(刀|太刀|脇差|...)'
```

But the actual page text uses pipe separators:
```
銀座長州屋 | 太刀 | 銘...
```

## Fixes Applied

### Scraper Fixes

**File: `Oshi-scrapper/scrapers/choshuya.py`**

Updated `_extract_item_type_from_wix_body()`:
- Changed regex to use flexible separator: `[\s\n|]+`
- Added support for koshirae (拵) detection
- Returns `ItemType.KOSHIRAE` for mountings instead of misclassifying as swords

```python
# NEW CODE - CORRECT
match = re.search(r'銀座長州屋[\s\n|]+(刀|太刀|脇差|短刀|剣|薙刀|槍|拵)', page_text)
if match:
    jp_type = match.group(1)
    if jp_type == '拵':
        return ItemType.KOSHIRAE
    return self.ITEM_TYPE_MAP.get(jp_type, ItemType.UNKNOWN)
```

**File: `Oshi-scrapper/utils/llm_extractor.py`**

Added negative lookbehind to exclude parenthetical references:
```python
# NEW - Excludes matches inside parentheses
r'(?<!（)第[一二三四五六七八九十〇\d]+回\s*(特別重要刀剣|重要刀剣|...)'
```

### Database Cleanup Scripts

Created two cleanup scripts in `Oshi-scrapper/scripts/`:

1. **`fix_choshuya_senrigan.py`** - Initial fix for tosogu→sword and false Juyo
   - Fixed 1,137 item type misclassifications
   - Fixed 6 false Juyo certifications

2. **`fix_choshuya_item_types.py`** - Comprehensive sword type fix
   - Fixed 171 additional misclassifications:
     - 53 katana → koshirae
     - 31 katana → tanto
     - 31 wakizashi → koshirae
     - 12 tosogu → koshirae
     - 10 katana → tachi
     - Various other corrections

## Verification

### Original Problem Listings
All 5 now correctly display:
| ID | Type | Category | Cert |
|----|------|----------|------|
| 33940 | wakizashi | Token | none |
| 35758 | wakizashi | Token | none |
| 35896 | katana | Token | none |
| 35957 | wakizashi | Token | none |
| 36051 | ken | Token | none |

### QA Audit Results
- **Before fix:** 7.5% error rate (75/1000 listings)
- **After fix:** 0% error rate (0/1000 listings)
- **Random sample:** 15/15 = 100% accuracy

## Impact

- **Total listings fixed:** ~1,308 (1,137 + 171)
- **Dealer affected:** Choshuya only
- **Categories corrected:** Token ↔ Tosogu ↔ Other

## Prevention

The scraper fixes ensure future scrapes will correctly classify:
1. Sword types based on page body content (not defaults)
2. Koshirae (mountings) as separate category
3. Certifications only when not in parentheses

## Files Changed

| Repository | File | Change |
|------------|------|--------|
| Oshi-scrapper | `scrapers/choshuya.py` | Fixed item type extraction regex and koshirae handling |
| Oshi-scrapper | `utils/llm_extractor.py` | Added negative lookbehind for parenthetical Juyo |
| Oshi-scrapper | `scripts/fix_choshuya_senrigan.py` | New cleanup script |
| Oshi-scrapper | `scripts/fix_choshuya_item_types.py` | New cleanup script |
