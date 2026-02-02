# Postmortem: Toukentakarado Description Pollution

**Date:** 2026-02-02
**Severity:** Medium (data quality issue)
**Affected:** 24 listings from Toukentakarado dealer
**Status:** Resolved

## Summary

All 24 listings from the newly added Toukentakarado dealer had polluted descriptions containing navigation menu text, UI elements, and concatenated content without proper formatting.

## Impact

- User-facing descriptions started with garbage text: `"ServicesConsignment/Buyer's AgentKoshirae Commission..."`
- UI elements like `"View fullsize"` and `"ORDER"` appeared mid-description
- Descriptions were truncated mid-word at the 3000 character limit
- Poor user experience on listing detail pages

## Root Cause

The `_extract_description()` method in `/Oshi-scrapper/scrapers/toukentakarado.py` iterated through all `<p>` and `<div>` elements without first removing Squarespace's navigation structure.

Squarespace sites have deeply nested `<div>` structures where navigation lives inside content containers (not separate `<nav>` elements). When the method found a large container `<div>`, it captured the entire page text including:
- Header navigation menu
- Image gallery UI buttons
- Purchase buttons
- The actual content (concatenated)

**Problematic code:**
```python
for p in soup.find_all(['p', 'div']):  # <-- Grabbed container divs
    text = p.get_text(strip=True)
    # ... no nav filtering before extraction
```

## Resolution

**Fixed in:** `Oshi-scrapper/scrapers/toukentakarado.py`

Modified `_extract_description()` to:
1. Work on a copy of the soup to avoid side effects
2. Remove navigation elements (`nav`, `header`, `footer`, Squarespace-specific classes) before extraction
3. Only extract from `<p>` tags, not container `<div>` elements
4. Filter known pollution patterns (`ServicesConsignment`, `View fullsize`, `ORDER`)
5. Clean up any residual UI text post-extraction

**Data fix:** Re-scraped all 24 Toukentakarado listings with the fixed scraper, overwriting polluted data.

## Verification

```
✓ 0 listings with "ServicesConsignment" in description
✓ 0 listings with "ServicesConsignment" in description_en
✓ 24/24 listings now have clean description_en content
```

## Lessons Learned

1. **Squarespace sites need special handling** - Their deeply nested div structure means standard extraction patterns can grab too much content
2. **Test new dealers thoroughly** - Should have caught this in QA before going live
3. **Extract from specific tags, not containers** - Prefer `<p>` tags over `<div>` for description extraction

## Prevention

- Add QA check for common pollution patterns in descriptions
- Consider adding automated tests for new dealer scrapers that check for nav/UI text in extracted content
- Document Squarespace-specific extraction patterns for future dealer implementations

## Timeline

| Time | Event |
|------|-------|
| 2026-02-02 10:20 | Issue reported via QA check on listing 42438 |
| 2026-02-02 10:22 | Root cause identified in `_extract_description()` |
| 2026-02-02 10:24 | Fix implemented and tested locally |
| 2026-02-02 10:25 | All 24 listings re-scraped with fix |
| 2026-02-02 10:27 | Verification complete - all data clean |

## Files Changed

| Repository | File | Change |
|------------|------|--------|
| Oshi-scrapper | `scrapers/toukentakarado.py` | Fixed `_extract_description()` method |
| nihontowatch | `docs/PLAN_TOUKENTAKARADO_DESCRIPTION_CLEANUP.md` | Investigation plan (marked complete) |
| nihontowatch | `docs/POSTMORTEM_TOUKENTAKARADO_DESCRIPTION_POLLUTION.md` | This postmortem |
