# Postmortem: Share URL Redirect to Wrong Page

**Date:** 2025-01-20
**Status:** Resolved
**Commit:** 6917c00

## Summary

Shared listing URLs were redirecting users to the full listing detail page (`/listing/{id}`) instead of opening the quickview modal on the home page (`/?listing={id}`).

## Impact

When users clicked a shared link (e.g., from Discord, iMessage, email), they saw a different view than the person who shared it. The sharer saw a quickview modal; the recipient saw a full detail page.

## Root Cause

The share proxy route (`/s/[id]/page.tsx`) was redirecting to the wrong destination:

```typescript
// Before (incorrect)
const targetUrl = isNaN(listingId) ? '/' : `/listing/${listingId}`;

// After (correct)
const targetUrl = isNaN(listingId) ? '/' : `/?listing=${listingId}`;
```

## URL Flow

```
ShareButton click
    ↓
Copies /s/{id}?v={version} to clipboard
    ↓
Recipient visits /s/{id}?v={version}
    ↓
Share proxy serves OG metadata (for social crawlers)
    ↓
Share proxy redirects humans to /?listing={id}
    ↓
DeepLinkHandler detects ?listing= param
    ↓
QuickView modal opens automatically
```

## Fix

Single line change in `src/app/s/[id]/page.tsx:202`:
- Changed redirect target from `/listing/${listingId}` to `/?listing=${listingId}`

## Tests Added

### Unit Test (`tests/app/share-proxy.test.ts`)
- Verifies redirect target is `/?listing={id}`
- Explicit regression guard: "NEVER redirects to /listing/ path"
- 6 test cases covering valid IDs, invalid IDs, edge cases

### E2E Test (`tests/e2e/share-deeplink.spec.ts`)
- New test: "share proxy /s/{id} redirects to home with ?listing= and opens QuickView"
- Visits `/s/{id}?v=test123` directly
- Asserts final URL pathname is `/` with `?listing={id}` param
- Verifies QuickView modal opens

## Prevention

The regression guard test explicitly checks:
```typescript
it('NEVER redirects to /listing/ path (regression guard)', () => {
  const testIds = ['1', '123', '999', '12345'];
  for (const id of testIds) {
    const target = buildShareProxyRedirectTarget(id);
    expect(target).not.toMatch(/^\/listing\//);
    expect(target).toMatch(/^\/\?listing=/);
  }
});
```

## Related Files

| File | Purpose |
|------|---------|
| `src/app/s/[id]/page.tsx` | Share proxy route (serves OG metadata, redirects humans) |
| `src/components/share/ShareButton.tsx` | Generates share URLs (`/s/{id}?v={version}`) |
| `src/components/browse/DeepLinkHandler.tsx` | Opens quickview when `?listing=` param present |
| `src/contexts/QuickViewContext.tsx` | Manages quickview modal state |
