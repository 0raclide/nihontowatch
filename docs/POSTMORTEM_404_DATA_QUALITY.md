# Postmortem: 404 Pages Stored as Available Listings

**Date:** 2026-02-06
**Severity:** Medium (Data quality issue affecting user experience)
**Status:** Resolved

## Summary

34 listings from Samurai Nippon (and other dealers) were displaying on nihontowatch.com with error page content as titles (e.g., "ご指定のページは見つかりません。" - "Page not found"). These listings were marked as `is_available=true` despite `page_exists=false`, causing them to appear in browse results.

## Impact

- Users saw nonsensical listings with Japanese 404 error messages as titles
- 34 total affected listings across multiple dealers
- Samurai Nippon most affected with 7 visible cases

## Root Cause

**The bug had two components:**

### 1. Initial Scrape Bypass
When URLs were first discovered and scraped (Jan 17, 2026), some pages were already 404s. The scraper:
- Correctly detected `page_exists=false`
- But still inserted the listing with `is_available=true` (the default)
- Stored the 404 error message as the title

### 2. Multi-404 Threshold Never Triggered
The repository uses a conservative "innocent until proven gone" approach requiring 3+ consecutive 404s over 48+ hours before marking unavailable. But:
- These listings had `scrape_count=1` (only scraped once at discovery)
- The threshold could never be met since they weren't being re-scraped
- Result: Permanent `page_exists=false` + `is_available=true` inconsistency

## Data Evidence

```
ID: 10644
title: "ご指定のページは見つかりません。"
page_exists: false
is_available: true  ← INCONSISTENT
scrape_count: 1
consecutive_404_count: 0  ← Never incremented
```

## Resolution

### Immediate Fix
Updated 34 listings in database:
```sql
UPDATE listings
SET is_available = false, status = 'withdrawn'
WHERE page_exists = false AND is_available = true;
```

### Preventive Fixes (Oshi-scrapper)

**1. Dead-on-arrival check in `db/repository.py`:**
```python
# Don't insert new listings that are already 404s
if not existing and not listing.page_exists:
    logger.info(f"Skipping new listing with page_exists=False: {listing.url}")
    return {}
```

**2. Consistency invariant in `_listing_to_db_row()`:**
```python
# If page doesn't exist, it cannot be available
if not listing.page_exists:
    is_available = False
```

**3. New data quality tests in `tests/test_data_quality.py`:**
- `TestPageExistsConsistency::test_no_available_404_pages`
- `TestErrorPageTitles::test_no_error_page_titles`
- `TestErrorPageTitles::test_no_null_titles_available`

## Why Existing Tests Didn't Catch This

The `test_data_quality.py` tests checked for:
- ✅ Juyo certification accuracy
- ✅ Field coverage thresholds
- ✅ Price/measurement ranges
- ❌ `page_exists`/`is_available` consistency (now added)
- ❌ Error messages as titles (now added)

## Lessons Learned

1. **Data invariants need explicit tests** - The invariant "if page doesn't exist, it can't be available" was implicit but not enforced
2. **Edge cases at boundaries** - The multi-404 system was designed for existing listings becoming 404, not new listings that are DOA
3. **Defense in depth** - Added checks at both the row-building and upsert levels

## Files Changed

| File | Change |
|------|--------|
| `Oshi-scrapper/db/repository.py` | Added DOA check and consistency invariant |
| `Oshi-scrapper/tests/test_data_quality.py` | Added 3 new tests |

## Monitoring

Run data quality tests periodically:
```bash
cd Oshi-scrapper
python3 -m pytest tests/test_data_quality.py::TestPageExistsConsistency -v
python3 -m pytest tests/test_data_quality.py::TestErrorPageTitles -v
```

## Related Issues

- None (first occurrence)
