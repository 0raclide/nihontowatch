# Postmortem: Aoi Art Listings Incorrectly Marked as Sold

**Date:** 2026-02-02
**Severity:** Medium (5 high-value items incorrectly hidden from users)
**Status:** Resolved

---

## Executive Summary

Five Aoi Art listings, including a 41st Juyo Yoshioka Ichimonji tachi worth ¥13,500,000, were incorrectly marked as "sold" despite being actively available for purchase. These items were invisible to users for approximately 33 days.

This was **NOT** connected to the false 404 detection bug being addressed in `PLAN_STATUS_TRACKING_SYSTEM_V2.md`. It was a separate issue caused by the multi-404 tracking migration not being applied, preventing database upserts from correcting incorrectly marked listings.

---

## Timeline

| Time | Event |
|------|-------|
| 2025-12-31 | Initial bulk import of Aoi Art listings |
| 2025-12-31 | Some listings incorrectly marked as `sold` (unknown cause) |
| 2026-01-26 | Last scrape attempt - database had stale sold status |
| 2026-02-02 | Multi-404 tracking code merged (adds `consecutive_404_count` column) |
| 2026-02-02 | Migration applied to production database |
| 2026-02-02 | User reports Yoshioka Ichimonji tachi appears sold but is available |
| 2026-02-02 | Investigation reveals 16 affected Aoi Art listings |
| 2026-02-02 | Rescrape confirms 5 were false positives, 11 actually sold |
| 2026-02-02 | All 5 false positives corrected via rescrape + upsert |

**Time items were incorrectly hidden: ~33 days**

---

## Affected Items

| ID | Title | Price | Status Before | Status After |
|----|-------|-------|---------------|--------------|
| 203 | Tachi: Ichi (Yoshioka Ichimonji) - 41st Juyo | ¥13,500,000 | sold | available |
| 6352 | Katana: Bitchu Koku ju Saemon no Jo Hidetugu - 68th Juyo | ¥9,500,000 | sold | available |
| 6504 | Tanto: Muramasa 村正 | ¥7,500,000 | sold | available |
| 1325 | Katana: Mumei (Aoe school) - 54th Juyo | ¥4,000,000 | sold | available |
| 1320 | Katana: Bizen Koku ju Osafune Magouemon Jo Kiyomitsu | ¥3,000,000 | sold | available |

**Total value incorrectly hidden: ¥37,500,000 (~$250,000 USD)**

---

## Root Cause Analysis

### Primary Cause: Missing Database Migration

The multi-404 tracking code added two new columns to the `listings` table:
- `consecutive_404_count`
- `first_404_at`

The migration file was created but **not applied to production**. This caused all upsert operations to fail with:

```
APIError: Could not find the 'consecutive_404_count' column of 'listings'
```

### Why Items Were Initially Marked Sold

Investigation revealed the LLM extraction was working correctly:

```json
{
  "is_available": true,
  "is_sold": false,
  "price_value": 13500000
}
```

But the database stored:
- `is_sold: true`
- `is_available: false`
- `price_value: null`

The initial December 31 import likely had a bug in the POST-LLM validation or regex fallback that incorrectly set `is_sold=true`. Subsequent scrapes correctly identified the items as available, but the upserts failed silently due to the missing columns.

### Evidence Chain

1. **LLM extraction correct**: `raw_fields.llm_response` shows `is_sold: false`
2. **Page has no sold indicators**: `PriceParser.is_sold(text)` returns `False`
3. **Scraper produces correct output**: Manual test shows `status: available`
4. **Upsert was failing**: `consecutive_404_count` column not found

---

## Resolution

### Immediate Fix

1. Applied the pending migration:
   ```sql
   ALTER TABLE listings ADD COLUMN consecutive_404_count INTEGER DEFAULT 0;
   ALTER TABLE listings ADD COLUMN first_404_at TIMESTAMPTZ;
   ```

2. Ran fix script to rescrape and correct all 16 affected listings:
   ```python
   # Results:
   # Fixed (now available): 5
   # Actually sold: 11
   # Errors: 0
   ```

### Verification

```
=== DB BEFORE: status=sold, is_sold=True, price=None ===
=== DB AFTER:  status=available, is_sold=False, price=13500000.0 ===
```

---

## Lessons Learned

1. **Always apply migrations before deploying code that depends on them**
   - The multi-404 tracking code was merged before the migration was applied
   - This caused silent failures in production

2. **Upsert errors should be surfaced, not swallowed**
   - The PostgREST error was being caught somewhere, preventing visibility
   - Consider adding alerting for database operation failures

3. **Separate issues can have similar symptoms**
   - Initial assumption was this was related to the 404 false detection bug
   - Investigation revealed it was a completely different issue

4. **Data quality audits are valuable**
   - The query `status=sold AND page_exists=true AND price=null` identified affected items
   - Regular audits could catch these issues earlier

---

## Prevention Measures

### Deployment Checklist Addition

```markdown
## Pre-deployment
- [ ] Run all database migrations BEFORE deploying code
- [ ] Verify new columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'listings'`
- [ ] Test upsert operation succeeds in staging
```

### Monitoring Query

Add to regular data quality checks:

```sql
-- Find potentially incorrectly marked sold items
SELECT id, url, status, is_sold, page_exists, price_value, first_seen_at
FROM listings
WHERE status = 'sold'
  AND page_exists = true
  AND price_value IS NULL
ORDER BY first_seen_at DESC;
```

---

## Related Documents

- [PLAN_STATUS_TRACKING_SYSTEM_V2.md](./PLAN_STATUS_TRACKING_SYSTEM_V2.md) - Multi-404 tracking implementation
- [POSTMORTEM_KOTETSU_STATUS_BUG.md](./POSTMORTEM_KOTETSU_STATUS_BUG.md) - Related sold detection issue
- [20260202000002_add_404_tracking.sql](../../Oshi-scrapper/supabase/migrations/20260202000002_add_404_tracking.sql) - The migration that needed applying
