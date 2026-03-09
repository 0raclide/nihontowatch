# Postmortem: Dealer QuickView Section Images Missing

**Date:** 2026-03-09
**Severity:** P1 — dealer-facing feature silently broken for full session
**Duration:** ~8 hours (08:01 → 16:02 UTC+1)
**Impact:** Dealer QuickView showed only primary photos. Section images (provenance, koshirae, sayagaki, hakogaki, kanto hibisho) were invisible. Listing 90396 showed 11/22 images.
**Fixed in:** `2ae484f`

---

## Timeline

| Time | Commit | What happened |
|------|--------|---------------|
| 08:01 | `85b3550` | **Introduced bug.** `collectGroupedMedia()` added to QuickView — reads section data from `currentListing`. Works for browse (detail API merges section data). Dealer path passes `DisplayItem` which has no section fields → silently shows 0 section images. |
| 12:26 | `939cb06` | Reordered media scroller. Bug still present, unnoticed. |
| 12:39 | `d080d7e` | Filtered catalog images to Documentation group. Bug still present. |
| 13:33 | `11db43c` | **Attempted fix (wrong layer).** Added section fields to dealer listings API SELECT + set `detailLoaded=true` immediately for dealer source. This fixed two real issues (API not returning fields, detail fetch 404-ing on RLS) but missed that the data was being stripped by the `DisplayItem` mapper before reaching QuickView. |
| 14:29 | `b2c6c6e` | Split grouping by source (dealer vs browse). Bug still present. |
| 16:02 | `2ae484f` | **Actual fix.** `handleCardClick` now looks up raw listing from `listings` state instead of passing the DisplayItem. |

---

## Root Cause

**The `listingToDisplayItem()` mapper constructs a new object with explicitly enumerated fields. It does NOT spread the input.** Section JSONB fields (`provenance`, `koshirae`, `sayagaki`, `hakogaki`, `kiwame`, `kanto_hibisho`) are not listed in the mapper, so they are silently dropped.

The dealer page flow:
1. `/api/dealer/listings` returns listings **with** all section data ✓
2. `dealerListingToDisplayItem()` → `listingToDisplayItem()` creates new object **without** section fields ✗
3. Card click passes `DisplayItem as unknown as Listing` to QuickView
4. `collectGroupedMedia()` reads `listing.provenance` → `undefined` → no section groups

The `as unknown as Listing` cast hid the type mismatch — TypeScript couldn't warn that section fields were absent.

**Why `11db43c` didn't fix it:** That commit correctly identified two problems (API missing fields, detail fetch 404) and fixed both. But the data loss happened *after* the API response, in the client-side mapper. The fix addressed the data source but not the data pipeline.

---

## Why It Wasn't Caught

1. **No test for the dealer QuickView → section data path.** Tests for `collectGroupedMedia` verified section grouping works when section data is present, but no integration test verified that the dealer page actually passes section data through.

2. **Silent failure pattern.** `collectGroupedMedia` treats missing section data as "no sections" (empty groups omitted). No warning, no error, no visual indicator that data was expected but absent. The QuickView simply showed fewer images.

3. **Browse path works correctly.** Browse listings fetch section data via the detail API (`fetchFullListing`), which returns a raw Supabase row. `mergeDetailIntoListing` copies section fields onto the listing. This path never goes through `listingToDisplayItem`, so it was never affected.

4. **The `as unknown as Listing` double-cast.** This intentionally bypasses TypeScript's type checking. The DisplayItem type lacks section fields, and TypeScript would have flagged `DisplayItem` being passed where `Listing` is expected — but the cast silenced it.

---

## Fix

**One-line change** in `DealerPageClient.tsx`:

```typescript
// Before (broken)
const handleCardClick = useCallback((item: DisplayItem) => {
  quickView.openQuickView(item as unknown as Listing, { source: 'dealer' });
}, [quickView]);

// After (fixed)
const handleCardClick = useCallback((item: DisplayItem) => {
  const rawListing = listings.find(l => l.id === item.id);
  quickView.openQuickView((rawListing || item) as unknown as Listing, { source: 'dealer' });
}, [quickView, listings]);
```

The `listings` state contains raw API responses with all section data intact. The DisplayItem is only needed for card rendering — QuickView needs the full listing.

---

## Lessons

### 1. Explicit mappers are data firewalls
`listingToDisplayItem()` constructs a new object with ~50 explicitly listed fields. Adding a new JSONB field to the API response does nothing if the mapper doesn't also list it. **Any field not in the mapper is silently dropped.** This is by design (prevents untyped data leaking) but creates a maintenance trap when downstream consumers (QuickView) expect fields that the mapper doesn't know about.

**Rule:** When adding JSONB fields to a listing API, grep for `listingToDisplayItem` and check if the new fields need to flow through.

### 2. Double-casts (`as unknown as T`) are bug amplifiers
The `as unknown as Listing` cast exists because DisplayItem and Listing are structurally different types that QuickView treats interchangeably. This is a known tech debt from the DisplayItem migration. The cast prevents TypeScript from catching exactly the kind of field-absence bug that occurred here.

### 3. "Fix at the wrong layer" is a common failure mode
Commit `11db43c` correctly diagnosed two real problems and fixed them. But the actual data loss happened one step later in the pipeline. When debugging data absence, **trace the full path from source to render** — don't stop at the first plausible bottleneck.

### 4. Silent zero/empty is the most dangerous pattern in this codebase
This is the fourth instance of the "silent zero" pattern:
- `listing_views.created_at` → silently 0 views (rule #11)
- `activity_events.listing_id` → silently 0 events (rule #13)
- `admin_hidden` not in SELECT → Supabase error (Feb 2026)
- **DisplayItem strips section data → silently 0 section images** (this incident)

The common thread: a query/mapper returns an empty/zero result that the consumer treats as "no data" rather than "data missing."

---

## Prevention

1. **Add section fields to `DisplayItem` type and mapper** (future hardening). Even though the immediate fix bypasses the mapper, the DisplayItem should carry section data for any future consumer that needs it. This eliminates the need for the raw-listing lookup pattern.

2. **Reduce double-cast surface.** The `as unknown as Listing` cast in the dealer page should eventually be replaced by making QuickView accept `DisplayItem | Listing` natively, or by adding section fields to DisplayItem so the cast is structurally safe.

3. **Add a regression test** that verifies dealer QuickView receives section data fields when opened from the grid.
