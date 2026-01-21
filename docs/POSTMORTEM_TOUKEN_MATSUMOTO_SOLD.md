# Postmortem: Touken Matsumoto Listings Incorrectly Marked as Sold

**Date:** 2025-01-20
**Status:** Resolved

## Summary

All 77 Touken Matsumoto listings were incorrectly marked as sold, resulting in zero available items showing on nihontowatch.com for this dealer.

## Root Cause

1. **LLM Hallucination**: Gemini Flash was returning `is_sold=True` for items without any sold indicators
2. **False Positive**: The regex pattern for "reserved" was matching "All Rights Reserved" in page footers
3. **Missing Pattern**: Touken Matsumoto uses "売却済" (baikyaku-zumi) for sold items, which wasn't in detection patterns

## Fixes Applied (in Oshi-scrapper)

| File | Change |
|------|--------|
| `utils/price_parser.py` | Added "売却済" pattern; fixed "reserved" to exclude "All Rights Reserved" |
| `utils/llm_extractor.py` | Added "売却済" to LLM prompt's sold indicators |
| `prompts/dealers/touken_matsumoto.py` | Updated dealer hints for "売却済" |
| `scrapers/touken_matsumoto.py` | Updated `_check_sold()` with all patterns |
| `scrapers/base.py` | Added post-LLM validation to override hallucinations |

### Post-LLM Validation Logic

```python
# If LLM says sold but regex finds no sold indicators → Override to available
# If LLM misses sold indicator but regex finds it → Override to sold
```

## Results

| Metric | Before | After |
|--------|--------|-------|
| Available | 0 | 60 |
| Sold | 77 | varies |

**Note:** 50 items show in browse (10 fuchi-kashira filtered by ¥100k minimum price threshold).

## Scripts Created

- `scripts/test_matsumoto_fix.py` - Test suite for the fix
- `scripts/rescrape_matsumoto.py` - Re-scrape utility
- `scripts/backfill_derived_fields.py` - Ran to update derived fields

## Lessons Learned

1. LLM extraction requires validation layer for critical boolean fields
2. Regex patterns need negative lookahead for common false positives
3. Each dealer may use different Japanese terms for "sold" status
