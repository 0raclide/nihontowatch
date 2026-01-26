# Postmortem: Shoubudou Items Incorrectly Marked as Sold

**Date:** 2026-01-26
**Severity:** Medium (data quality issue affecting one dealer)
**Status:** Resolved

## Summary

Shoubudou listings were being incorrectly marked as sold due to a false positive in the sold status detection logic. The base scraper's `_is_sold_indicator()` method searched the entire page text for sold patterns and found "売却済" in Shoubudou's navigation menu (which appears on every product page), causing available items to be marked as sold.

## Impact

- **243 out of 280** Shoubudou items (87%) were incorrectly marked as sold
- **8 items** were confirmed false positives that should have been available
- Affected items had their prices cleared (per normal sold item behavior)
- Items appeared in the "Sold" archive instead of active inventory

## Root Cause

### The Bug

Shoubudou's website has a category navigation sidebar on every product detail page. This sidebar includes a link to "売却済 / Sold" (category_id=29) showing their sold archive.

The base scraper's `_is_sold_indicator()` method in `scrapers/base.py:309-313`:

```python
def _is_sold_indicator(self, soup: BeautifulSoup) -> bool:
    """Check for common sold indicators in page."""
    text = soup.get_text().lower()  # Gets ALL text including navigation
    return self.price_parser.is_sold(text)
```

The `price_parser.is_sold()` method checks for patterns including `売却済`, which was found in the navigation menu text on every page.

### Why It Happened

The Shoubudou scraper already had a correct `_check_sold()` method that properly checks if an item is in the sold category (category_id=29 in the URL). However:

1. The base scraper has a "post-LLM validation" step at lines 155-162 that calls `_is_sold_indicator()` as a safety check
2. If `_is_sold_indicator()` returns True but LLM said not sold, the base scraper overrides to mark as sold
3. Shoubudou didn't override `_is_sold_indicator()`, so the base class's full-text search was used
4. The navigation text triggered false positives

## Fix

Added an override in `scrapers/shoubudou.py` to use the accurate category-based check:

```python
def _is_sold_indicator(self, soup: BeautifulSoup) -> bool:
    """Override base class sold indicator check.

    Shoubudou's navigation contains '売却済 / Sold' on EVERY page,
    which causes false positives with the base class's full-text search.
    Use our category-based check instead.
    """
    return self._check_sold(soup)
```

**Commit:** `f96510f` in Oshi-scrapper repo

## Data Remediation

1. Exported all 241 Shoubudou items marked as sold
2. Re-scraped all items with the fixed scraper
3. Fixed scraper correctly detected actual status:
   - 8 items changed from `sold` -> `available` (false positives fixed)
   - 233 items remained `sold` (truly sold items preserved)

### Before vs After

| Metric | Before | After |
|--------|--------|-------|
| Total listings | 280 | 279 |
| Available | 37 | 44 |
| Sold | 243 | 235 |
| Items corrected | - | 8 |

### Verified Items

**False positives fixed (now available):**
- product_id=345: ¥2,300,000
- product_id=288: ¥3,600,000
- product_id=272: ¥2,000,000
- product_id=304: ¥2,200,000
- product_id=332: ¥2,500,000

**True sold items preserved:**
- product_id=93, 176, 198, 58, 106 (confirmed sold on live site)

## Prevention

### For Other Dealers

Other dealers may have similar issues if their pages contain sold-related text in navigation or footers. When adding new scrapers:

1. **Always check** if navigation/sidebar contains sold category links
2. **Override `_is_sold_indicator()`** if the dealer has category-based sold detection
3. **Test with available items** to catch false positives before bulk scraping

### Dealers to Audit

Consider auditing these dealers for similar issues:
- Any dealer with a "Sold Archive" link in navigation
- Any dealer using EC-CUBE or similar platforms (Shoubudou's platform)

## Timeline

| Time | Event |
|------|-------|
| 2026-01-26 08:42 | User reports product_id=345 incorrectly marked as sold |
| 2026-01-26 10:30 | Root cause identified (navigation text false positive) |
| 2026-01-26 10:38 | Fix implemented and tested |
| 2026-01-26 10:39 | Fix committed and pushed |
| 2026-01-26 11:30 | All 241 sold items re-scraped |
| 2026-01-26 11:45 | Data remediation complete, 8 items corrected |

## Lessons Learned

1. **Full-text searches are dangerous** - Navigation, footers, and sidebars contain text that can trigger false positives
2. **Dealer-specific scrapers should override generic checks** - When a dealer has a reliable sold indicator (like category_id), use that instead of text matching
3. **Post-LLM validation can introduce bugs** - The "safety check" that was meant to catch LLM hallucinations caused false positives when the check itself was too broad

## Related

- [DEALERS.md](./DEALERS.md) - Dealer-specific documentation
- [QA_PRICE_DATA_AUDIT_20260121.md](./QA_PRICE_DATA_AUDIT_20260121.md) - Previous data quality audit
- [POSTMORTEM_TOUKEN_MATSUMOTO_SOLD.md](./POSTMORTEM_TOUKEN_MATSUMOTO_SOLD.md) - Similar LLM-related sold status issue
