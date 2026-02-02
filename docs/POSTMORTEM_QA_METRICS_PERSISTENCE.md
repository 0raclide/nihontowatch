# Postmortem: QA Metrics Not Persisting to Supabase

**Date:** 2026-02-02
**Status:** Resolved
**Severity:** Low (dashboard data quality issue)

## Summary

The `/admin/scrapers` page displayed **QA Pass Rate: 0%** despite QA validation running successfully during scrapes. The root cause was that QA metrics were being stored in a local SQLite database but never persisted to the Supabase `extraction_metrics` table that the admin dashboard queries.

## Impact

- Admin scrapers dashboard showed misleading 0% QA pass rate
- No visibility into extraction quality trends over time
- QA Issues by Dealer section was empty

## Root Cause

The Oshi-scrapper had comprehensive QA infrastructure:
- `qa/` - QA validation pipeline
- `qa_monitoring/` - Signal-based monitoring with SQLite storage
- `ExtractionMetricsRepository.save_extraction_metrics()` - Method to persist to Supabase

However, `save_extraction_metrics()` was **never called** in the scrape flow. QA ran, signals went to SQLite, but nothing was written to Supabase.

## Resolution

### Files Modified (Oshi-scrapper)

| File | Change |
|------|--------|
| `utils/qa_integration.py` | Added `qa_result_to_metrics_dict()` converter function |
| `db/__init__.py` | Exported `ExtractionMetricsRepository` |
| `main.py` | Added metrics persistence to two code paths |

### Code Changes

1. **New helper function** (`utils/qa_integration.py:389-449`):
```python
def qa_result_to_metrics_dict(result: QAResult, listing: ScrapedListing) -> dict:
    """Convert QAResult to metrics dict for save_extraction_metrics()."""
    # Extracts confidence scores, validation errors, quality scores, etc.
```

2. **Modified `save_listings_to_db_parallel()`** (`main.py:497-530`):
   - Import `ExtractionMetricsRepository`
   - Initialize `metrics_repo`
   - Capture QA result from `run_qa_on_listing()`
   - Call `metrics_repo.save_extraction_metrics()` after upsert

3. **Modified `scrape_urls_with_db()`** (`main.py:2755-2815`):
   - Same pattern as above for single-URL scraping with `--db` flag

### Key Integration Point

```python
# After upserting listing to get the ID
saved_row = listing_repo.upsert(result)

# Save QA metrics to Supabase
if qa_result and saved_row and saved_row.get("id"):
    try:
        metrics_dict = qa_result_to_metrics_dict(qa_result, result)
        metrics_repo.save_extraction_metrics(
            listing_id=saved_row["id"],
            metrics=metrics_dict,
            dealer_name=result.dealer,
            llm_model=getattr(result, "llm_model", None),
        )
    except Exception as metrics_err:
        logger.warning(f"Failed to save QA metrics: {metrics_err}")
```

## Verification

After fix, test scrapes successfully populated `extraction_metrics`:

```sql
SELECT id, listing_id, qa_status, quality_score, overall_confidence
FROM extraction_metrics ORDER BY id DESC LIMIT 2;

-- Results:
-- id=2, listing_id=42516, qa_status='passed', quality_score=0.81, confidence=0.95
-- id=1, listing_id=42515, qa_status='passed', quality_score=0.81, confidence=0.95
```

## Prevention

- The existing infrastructure was well-designed but the integration point was missing
- Future features should verify data flows end-to-end (source → database → dashboard)
- Consider adding integration tests that verify metrics are written after scrapes

## Related Files

- Admin dashboard: `nihontowatch/src/app/admin/scrapers/page.tsx`
- Stats API: `nihontowatch/src/app/api/admin/scrapers/stats/route.ts`
- QA API: `nihontowatch/src/app/api/admin/scrapers/qa/route.ts`
- Table schema: `nihontowatch/docs/sql/scraper_tables.sql`
