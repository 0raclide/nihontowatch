# Postmortem: Goushuya Scraper Data Quality Issues

**Date:** 2026-02-02
**Author:** Claude
**Severity:** Medium (data quality issues, not functionality)
**Status:** Resolved

---

## Executive Summary

Investigation of the Goushuya dealer (goushuya-nihontou.com) revealed multiple data extraction issues in the scraper. After fixes, all 34 listings now have correct data and 16/20 Juyo items have setsumei translations.

| Issue | Impact | Status |
|-------|--------|--------|
| Nagasa showing 2.0cm instead of ~70cm | 6 swords affected | ✅ Fixed |
| Kasane picking up sakihaba values | Data corruption | ✅ Fixed |
| Province extracting garbage "広" | Wrong province data | ✅ Fixed |
| Era showing "Kamakura" instead of correct era | Wrong era attribution | ✅ Fixed |
| Missing TokuKicho certification pattern | Certification not detected | ✅ Fixed |
| Setsumei not processed for Juyo items | Missing translations | ✅ Fixed (80%) |

---

## Issue #1: Nagasa Extraction Bug (Critical)

### Symptoms
- 6 swords had `nagasa_cm = 2.0` instead of correct values (~47-72cm)
- QA validation passed because 2.0cm is technically valid

### Root Cause
The Goushuya website uses traditional Japanese measurement format:
```
刃長
２尺3寸６分（71.5㎝）
```

The original regex `r'刃長\s*[:：]?\s*([\d.]+)\s*(?:cm|㎝)?'` matched after `刃長` but found nothing useful because:
1. The value starts with full-width number `２`
2. The cm value is inside parentheses `（71.5㎝）`

### Fix Applied
```python
# Before (broken)
nagasa_match = re.search(r'刃長\s*[:：]?\s*([\d.]+)\s*(?:cm|㎝)?', page_text)

# After (fixed) - extract from parentheses first
nagasa_match = re.search(r'刃長[^（(]*[（(]([\d.]+)\s*(?:cm|㎝)[）)]', page_text)
if not nagasa_match:
    # Fallback: simple format 刃長 : 69.2cm
    nagasa_match = re.search(r'刃長\s*[:：]\s*([\d.]+)\s*(?:cm|㎝)', page_text)
```

### Verification
All 6 affected swords now have correct nagasa values (47.0-72.0cm range).

---

## Issue #2: Kasane Cross-Line Matching Bug

### Symptoms
- Kasane values showing sakihaba values (e.g., 2.18cm instead of actual kasane)
- Occurred when `元重` field was empty

### Root Cause
WordPress table format has fields on separate lines:
```
元重

先幅
7分2厘(2.18cm)
```

The regex `r'元重[^（(]*[（(]([\d.]+)'` allowed `[^（(]*` to match across newlines, capturing the `先幅` value.

### Fix Applied
```python
# Before (broken) - could cross line boundaries
kasane_match = re.search(r'(?:元重|重ね)[^（(]*[（(]([\d.]+)\s*(?:cm|㎝)[）)]', page_text)

# After (fixed) - only allow measurement characters before parentheses
kasane_match = re.search(r'(?:元重|重ね)\s*[0-9０-９尺寸分厘.．]*[（(]([\d.]+)\s*(?:cm|㎝)[）)]', page_text)
```

---

## Issue #3: Province Extraction Garbage

### Symptoms
- Province field showing "広" (single character) instead of actual province
- Pattern was matching `国` character anywhere in text

### Root Cause
The pattern `r'国\s*[:：]?\s*(\S+)'` matched any occurrence of `国` in the text, not just the field label.

### Fix Applied
```python
# Before (broken) - matched 国 anywhere
province_match = re.search(r'国\s*[:：]?\s*(\S+)', content_text)

# After (fixed) - require line start for field label
province_match = re.search(r'^国\s*[:：]\s*(\S+)', content_text, re.MULTILINE)
if not province_match:
    province_match = re.search(r'^国\s*\n+\s*(\S+)', content_text, re.MULTILINE)
```

---

## Issue #4: Era Detection From Wrong Context

### Symptoms
- Era showing "Kamakura" for swords that should be "Nanbokucho"
- Era was being picked up from description text about school origin

### Root Cause
Era detection searched the entire page content, finding historical references in the description like "延寿一派は鎌倉末期に山城の来から分派" (Enju school branched from Yamashiro's Rai in late Kamakura).

### Fix Applied
```python
# Before (broken) - searched whole content
for pattern, era_value in era_patterns:
    if re.search(pattern, content_text):
        listing.attribution.era = era_value
        break

# After (fixed) - extract only from 時代 field
jidai_match = re.search(r'時代\s*[:：]?\s*([^\n]+)', content_text)
if jidai_match:
    era_text = jidai_match.group(1).strip()
else:
    jidai_multi = re.search(r'時代\s*\n+\s*([^\n]+)', content_text)
    era_text = jidai_multi.group(1).strip() if jidai_multi else ''

# Then apply era patterns only to extracted era_text
```

---

## Issue #5: Missing TokuKicho Certification Pattern

### Symptoms
- Items with `甲種特別貴重刀剣` (Koshu Tokubetsu Kicho Token) not having certification detected

### Fix Applied
Added legacy certification patterns:
```python
certification_patterns = [
    # ... existing NBTHK patterns ...

    # Legacy certifications (pre-NBTHK)
    (r'甲種特別貴重刀剣', 'Tokubetsu Kicho'),
    (r'特別貴重刀剣', 'Tokubetsu Kicho'),
    (r'貴重刀剣', 'Kicho'),
]
```

---

## Issue #6: Setsumei Pipeline Not Triggered

### Symptoms
- 20 Juyo/Tokuju items had no setsumei translations
- User expected translations for certified items

### Root Cause
During initial backfill, `--skip-setsumei` flag was used to speed up the process.

### Fix Applied
Ran setsumei pipeline separately:
```bash
python3 main.py setsumei --dealer Goushuya --limit 20
```

### Results
| Status | Count | % |
|--------|-------|---|
| Successful translations | 16 | 80% |
| OCR validation errors | 2 | 10% |
| No setsumei image found | 2 | 10% |

---

## Files Modified

### Oshi-scrapper
- `/Users/christopherhill/Desktop/Claude_project/Oshi-scrapper/scrapers/goushuya.py`
  - Fixed nagasa extraction for traditional format
  - Fixed kasane extraction to not cross line boundaries
  - Fixed province extraction with line-start anchor
  - Fixed era detection to use 時代 field only
  - Added TokuKicho certification patterns

---

## Data Quality After Fixes

### Measurements
| Metric | Before | After |
|--------|--------|-------|
| Nagasa correct | 28/34 (82%) | 34/34 (100%) |
| Kasane correct | ~30/34 | 34/34 (100%) |

### Derived Fields
| Field | Derivation | Status |
|-------|------------|--------|
| sword_period | From era (Nanbokucho → Koto) | ✅ Working |
| signature_status | From mei_type (mumei → unsigned) | ✅ Working |
| historical_period | From era | ✅ Working |

### QA Scores
- Average QA score: 78.75%
- QA status: All passed
- Low confidence fields: `smith` (expected for mumei attributions)

### Setsumei Coverage
- Juyo items with translations: 16/20 (80%)
- Translation length range: 1,027 - 3,734 characters

---

## Lessons Learned

1. **WordPress Elementor layouts split labels and values** - Can't rely on `label: value` format on same line
2. **Full-width Japanese numbers need special handling** - `２` ≠ `2` for regex
3. **Always use line anchors for field extraction** - Prevents matching anywhere in text
4. **Era text often appears in descriptions** - Must extract from specific field, not whole content
5. **Backfill flags matter** - `--skip-setsumei` saves time but skips important data

---

## Verification Commands

```bash
# Re-scrape all Goushuya listings
python3 main.py scrape --dealer Goushuya --rescrape-all

# Run setsumei for Juyo items
python3 main.py setsumei --dealer Goushuya --limit 20

# Check database quality
psql -c "SELECT nagasa_cm, title FROM listings WHERE dealer_id = (SELECT id FROM dealers WHERE name = 'Goushuya') AND nagasa_cm IS NOT NULL"
```

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-02 | Claude | Initial postmortem documenting all fixes |
