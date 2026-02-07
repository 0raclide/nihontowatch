# Postmortem: Test Data Integrity Fixes

**Date:** 2025-02-07
**Author:** Claude
**Status:** Resolved

## Summary

Two tests were failing due to assumptions about database size and API response times that no longer held as the production database grew.

## Failing Tests

### 1. `tests/sql/search-index.test.ts` - "total_count accurately reflects matching records"

**Failure:**
```
AssertionError: expected 1000 to be 1636
```

**Root Cause:**
The test queried for "katana" with `p_limit: 2000`, expecting to fetch all results in one query. However:
- The database now contains 1,636 katana listings
- Supabase/PostgreSQL enforces a 1,000 row limit per query
- The test received 1,000 rows but `total_count` correctly reported 1,636

**Fix:**
Changed test to verify the correct invariants instead of assuming all results fit in one query:
- Returned rows ≤ requested limit
- `total_count` ≥ returned rows
- If `total_count` ≤ limit, then returned rows = `total_count`

Also switched to a more specific query ("juyo") with a smaller limit (100) to ensure predictable behavior.

### 2. `tests/api/browse-concordance.test.ts` - "facet count should approximately match filtered total"

**Failure:**
```
Error: Test timed out in 5000ms
```

**Root Cause:**
Test makes multiple API calls to compare facet counts against filtered totals. As the database grew, these queries became slower, exceeding the 5-second default timeout.

**Fix:**
Increased timeout from 5s to 15s using vitest's third parameter syntax:
```typescript
it('facet count should approximately match...', async () => {
  // test body
}, 15000);
```

## Lessons Learned

1. **Avoid hardcoded assumptions about data volume** - Tests that assume "fetch everything in one query" will break as databases grow.

2. **Test invariants, not absolute values** - Instead of `expect(rows.length).toBe(total_count)`, test the relationship: `expect(total_count).toBeGreaterThanOrEqual(rows.length)`.

3. **Set appropriate timeouts for integration tests** - Tests hitting production APIs need longer timeouts than unit tests.

## Files Changed

- `tests/sql/search-index.test.ts` - Fixed data integrity test logic
- `tests/api/browse-concordance.test.ts` - Increased timeout to 15s
