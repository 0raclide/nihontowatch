# Session 01: Facet Concordance Fix

**Date:** 2026-01-16

## Summary

Fixed the facet/filter concordance issue where facet counts didn't match filtered results (e.g., "Tokuju facet shows 2 but returns 3 items").

## Root Cause

Supabase has a default 1000-row limit for queries. The facet queries were only counting the first 1000 rows, causing incorrect counts for any dataset larger than 1000 items.

## Solution (borrowed from oshi-v2)

### 1. SQL RPC Function for Facets

Created `get_listing_facets` SQL function that does aggregation in the database, avoiding the row limit entirely:

```sql
-- Migration 002_facet_aggregation_function.sql
CREATE OR REPLACE FUNCTION get_listing_facets(p_tab TEXT)
RETURNS JSONB
-- Aggregates counts for item_type, cert_type, and dealers
-- Returns all facet data in single efficient query
```

### 2. Data Normalization

Created migrations to normalize inconsistent data:

- **cert_type**: "Tokubetsu Hozon" → "TokuHozon", "tokuju" → "Tokuju", etc.
- **item_type**: Lowercased, "fuchi_kashira" → "fuchi-kashira"
- **Database trigger**: Auto-normalizes new data on insert/update

### 3. Case-Insensitive Item Type Filtering

Updated the main query to use ILIKE for case-insensitive matching:

```typescript
// Before: query.in('item_type', params.itemTypes)
// After:
const typeConditions = params.itemTypes
  .map(t => `item_type.ilike.${t}`)
  .join(',');
query = query.or(typeConditions);
```

## Files Created/Modified

### New Migrations
- `supabase/migrations/002_facet_aggregation_function.sql` - SQL RPC function
- `supabase/migrations/003_rerun_cert_normalization.sql` - Data normalization

### Modified
- `src/app/api/browse/route.ts` - Uses RPC function, case-insensitive filters, ask-only filter

### New Tests
- `tests/api/concordance.test.ts` - 23 two-way concordance tests
- `tests/api/browse.test.ts` - 38 browse API tests

## Test Results

```
✓ 23 concordance tests passing
✓ 38 browse tests passing
```

## Key Learnings

1. **Supabase row limits**: Default 1000-row limit affects all queries. For facets/aggregations, do the work in SQL.

2. **oshi-v2 pattern**: The `search_gold_with_facets` approach of computing facets via CTEs in SQL is the right pattern - efficient and avoids client-side pagination issues.

3. **Data normalization**: Normalizing at the database level (with triggers) is more durable than normalizing in application code.

## Next Steps (if needed)

- Consider adding indexes for facet queries if performance becomes an issue
- The first normalization migration (001_normalize_listings.sql) has a trigger that should auto-normalize future data
