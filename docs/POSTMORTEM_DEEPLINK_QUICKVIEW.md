# Postmortem: Deep Link QuickView Empty Content

**Date:** 2026-02-07
**Severity:** Medium
**Status:** Resolved
**Commit:** 007e341

## Summary

When users navigated directly to a listing via deep link URL (e.g., `/?listing=41994`), the QuickView modal would open but display no images or metadata. The listing data was not being fetched correctly.

## Impact

- Shared listing URLs would open an empty QuickView modal
- Users clicking links from email alerts saw blank content
- Social media shares that landed on deep links were broken

## Root Cause

The `DeepLinkHandler` component was using a direct client-side Supabase query to fetch listing data:

```typescript
// OLD CODE - Direct Supabase query
const supabase = createClient();
const { data, error } = await supabase
  .from('listings')
  .select(`*, dealers (...)`)
  .eq('id', listingId)
  .single();
```

This approach had several issues:

1. **Different data path**: The client-side query used the anon key which could have different RLS policies than the server-side API
2. **Incomplete data mapping**: The manual field-by-field mapping could miss fields
3. **Silent failures**: Network/CORS issues could cause the query to fail without proper handling
4. **Inconsistent format**: The data format differed from what QuickView expected (e.g., `dealers` vs `dealer` mapping)

Meanwhile, the QuickView's internal `fetchFullListing` function used the `/api/listing/[id]` endpoint which worked correctly and returned complete data.

## Fix

Updated `DeepLinkHandler` to use the same API endpoint:

```typescript
// NEW CODE - Use API endpoint
const response = await fetch(`/api/listing/${listingId}`);
const data = await response.json();
const listing = {
  ...data.listing,
  dealer: data.listing.dealers ? { ... } : undefined,
};
```

Benefits:
- Consistent data format with the rest of the app
- Complete data including `images`, `stored_images`, and enrichment
- Proper dealer mapping for component compatibility
- Better error handling with HTTP status codes

## Detection

User reported that a specific listing URL (`?listing=41994`) showed no metadata or images in QuickView.

## Verification

1. Tested `/api/listing/41994` - returned complete data ✅
2. Build passed ✅
3. 3615 tests passed ✅

## Timeline

- **14:00** - Issue reported: QuickView empty for deep link
- **14:15** - Root cause identified: client-side Supabase vs API mismatch
- **14:25** - Fix implemented and tested
- **14:30** - Deployed to production (commit 007e341)

## Lessons Learned

1. **Prefer API endpoints over direct Supabase queries** in client components for consistency
2. **Use the same data path** that other parts of the app use - the QuickView already had `fetchFullListing` using the API
3. **Test deep links specifically** - they exercise a different code path than normal navigation

## Related Files

| File | Purpose |
|------|---------|
| `src/components/browse/DeepLinkHandler.tsx` | Handles `?listing=` URL parameter |
| `src/app/api/listing/[id]/route.ts` | API endpoint for listing data |
| `src/contexts/QuickViewContext.tsx` | QuickView state management |
| `src/components/listing/QuickView.tsx` | QuickView UI component |

## Prevention

- Consider adding E2E tests specifically for deep link scenarios
- The existing `tests/e2e/share-deeplink.spec.ts` tests that QuickView opens, but doesn't verify content is displayed
