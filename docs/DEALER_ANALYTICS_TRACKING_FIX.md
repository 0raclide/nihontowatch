# Dealer Analytics Tracking Fix

**Date:** January 31, 2026
**Status:** Implemented
**Related Files:** See [Files Changed](#files-changed) section

---

## Executive Summary

Fixed a critical bug in dealer analytics where "click-throughs" were being massively overcounted. The metrics shown on `/admin/dealers` were actually counting QuickView opens (internal UI interactions) instead of actual visits to dealer websites.

**Impact:**
- Dealer analytics now shows accurate click-through numbers
- New `quickview_open` event captures user engagement previously lost
- No data migration needed - historical data left as-is

---

## Problem Statement

### Symptoms
The dealer analytics dashboard (`/admin/dealers`) showed suspicious numbers:
- 1,000 "click-throughs"
- 180 "listing views"
- 30 "active dealers"
- 33 "avg clicks/dealer"

These numbers looked like placeholders but were actually real - just measuring the wrong thing.

### Root Cause

**Bug Location:** `src/components/browse/ListingCard.tsx:437-458`

When users clicked a listing card to open QuickView (an internal modal), the code was calling `trackExternalLinkClick()` - an event meant to track when users actually leave the site to visit dealer websites.

```typescript
// BEFORE (incorrect)
const handleClick = useCallback((e: React.MouseEvent) => {
  if (activity) {
    activity.trackExternalLinkClick(  // WRONG - this opens QuickView, not dealer site
      listing.url,
      Number(listing.id),
      listing.dealers?.name
    );
  }
  if (quickView) {
    quickView.openQuickView(listing);  // Opens internal modal
  }
}, [activity, quickView, listing]);
```

### Additional Issue

The actual "View on [dealer]" buttons in QuickView components had **no tracking at all**:
- `QuickViewContent.tsx` - desktop view, no tracking
- `QuickViewMobileSheet.tsx` - mobile view, no tracking

This meant real click-throughs to dealer sites were never being recorded.

---

## Solution

### 1. New Event Type: `quickview_open`

Created a new event type to track when users open QuickView (engagement metric):

```typescript
// src/lib/activity/types.ts
export interface QuickViewOpenEvent extends BaseActivityEvent {
  type: 'quickview_open';
  listingId: number;
  dealerName?: string;
  source: 'listing_card' | 'search_results' | 'favorites';
}
```

### 2. Fixed ListingCard Tracking

Changed card click to track `quickview_open` instead of `external_link_click`:

```typescript
// AFTER (correct)
const handleClick = useCallback((e: React.MouseEvent) => {
  if (activity) {
    activity.trackQuickViewOpen(  // Correct - tracks engagement
      Number(listing.id),
      listing.dealers?.name,
      'listing_card'
    );
  }
  if (quickView) {
    quickView.openQuickView(listing);
  }
}, [activity, quickView, listing]);
```

### 3. Added Real Click-Through Tracking

Added `trackExternalLinkClick` to the actual "View on [dealer]" buttons:

**QuickViewContent.tsx (desktop):**
```typescript
const handleDealerLinkClick = useCallback(() => {
  if (activityTracker && listing) {
    activityTracker.trackExternalLinkClick(
      listing.url,
      Number(listing.id),
      listing.dealers?.name || listing.dealer?.name
    );
  }
}, [activityTracker, listing]);

// On the <a> tag:
<a href={listing.url} onClick={handleDealerLinkClick} ...>
```

**QuickViewMobileSheet.tsx (mobile):**
```typescript
// Preserves stopPropagation() for gesture handling
<a
  href={listing.url}
  onClick={(e) => {
    e.stopPropagation();  // Required for mobile sheet gestures
    handleDealerLinkClick();
  }}
  ...
>
```

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `src/lib/activity/types.ts` | Modified | Added `quickview_open` to event types, added `QuickViewOpenEvent` interface |
| `src/lib/tracking/ActivityTracker.tsx` | Modified | Added `trackQuickViewOpen()` method to interface and implementation |
| `src/app/api/activity/route.ts` | Modified | Added `quickview_open` to valid event types array |
| `src/app/api/track/route.ts` | Modified | Added `quickview_open` to valid event types array + validation |
| `src/components/browse/ListingCard.tsx` | Modified | Changed `trackExternalLinkClick` → `trackQuickViewOpen` |
| `src/components/listing/QuickViewContent.tsx` | Modified | Added activity tracker, handler, and onClick to dealer button |
| `src/components/listing/QuickViewMobileSheet.tsx` | Modified | Added activity tracker, handler, and onClick to dealer button |
| `tests/api/track/route.test.ts` | Modified | Added tests for `quickview_open` event validation |

---

## Testing

### Automated Tests

All relevant tests pass:

```bash
# Track API tests (including new quickview_open tests)
npm test -- --run tests/api/track/route.test.ts
# Result: 31 passed

# ListingCard component tests
npm test -- --run tests/components/browse/ListingCard.test.tsx
# Result: 52 passed

# QuickView component tests
npm test -- --run tests/components/listing/QuickViewContent.test.tsx
npm test -- --run tests/components/listing/QuickViewMobileSheet.test.tsx
# Result: 44 passed
```

### Manual Testing Checklist

To verify the fix is working in production:

1. **Open browser DevTools → Network tab**
2. **Filter by "activity"**
3. **Click a listing card** (should open QuickView)
   - Check: Request to `/api/activity` with `quickview_open` event
   - Verify: `listingId`, `dealerName`, `source: "listing_card"` in payload
4. **Click "View on [dealer]" button** (should open dealer site)
   - Check: Request to `/api/activity` with `external_link_click` event
   - Verify: `url`, `listingId`, `dealerName` in payload

---

## Analytics Impact

### Before Fix
| Metric | Meaning | Accuracy |
|--------|---------|----------|
| `external_link_click` count | QuickView opens | WRONG |
| Dealer "click-throughs" | QuickView opens | WRONG |
| Real dealer visits | Not tracked | MISSING |

### After Fix
| Metric | Meaning | Accuracy |
|--------|---------|----------|
| `quickview_open` count | User engagement (opened QuickView) | CORRECT |
| `external_link_click` count | Actual dealer site visits | CORRECT |
| Dealer "click-throughs" | Real traffic sent to dealers | CORRECT |

### Expected Dashboard Changes

After deployment, the dealer analytics dashboard will show:
- **Lower click-through numbers** (these are now accurate)
- **New data available**: `quickview_open` events for engagement analysis
- **More meaningful metrics**: Click-through rate is now real conversion, not just UI interactions

---

## Historical Data

**Decision:** Leave historical data as-is.

Rationale:
- Historical `external_link_click` events are technically valid data points (they show QuickView engagement)
- Purging would lose information
- No disclaimer needed on dashboard - the sudden drop is self-explanatory
- Going forward, data will be accurate

If needed in the future, historical data can be identified by timestamp (events before this fix are QuickView opens, events after are real click-throughs).

---

## Related Documentation

- **Plan file:** `/Users/christopherhill/.claude/plans/harmonic-swinging-beaver.md`
- **Activity tracking docs:** `docs/USER_BEHAVIOR_TRACKING.md`
- **Dealer analytics schema:** `docs/sql/dealer_analytics_schema.sql`

---

## Future Considerations

### Potential Enhancements

1. **Dashboard update**: Add `quickview_open` as a visible metric on dealer analytics
2. **Conversion funnel**: Track QuickView open → dealer click-through conversion rate
3. **Source attribution**: Use `source` field to distinguish where QuickView was opened from

### Migration Notes (if needed)

If you ever need to distinguish historical data:

```sql
-- Events before 2026-01-31 are QuickView opens (mislabeled)
-- Events after 2026-01-31 are real dealer click-throughs
SELECT * FROM activity_events
WHERE event_type = 'external_link_click'
AND created_at < '2026-01-31';
```

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-01-31 | Claude | Initial implementation of tracking fix |
