# Listing Impression Tracking

**Date:** 2026-03-06
**Status:** Deployed to production
**Commit:** `c509a66`
**Migration:** `107_listing_impression_dedup.sql` (applied to prod)

## Problem

We want to predict how many views a listing will attract. The `listing_impressions` table existed (migration 028) with the right schema but had **zero rows** — impression tracking was designed but never connected. Without impression data, we can't separate "this listing is interesting" from "this listing was shown at position #3."

The featured_score→views correlation is clean (16x top-to-bottom decay), but normalizing by impressions gives us position-adjusted CTR.

## Solution

Fire impression events from the existing IntersectionObserver on **first visibility** (before dwell threshold). No second observer, no new DOM hooks. Data flows through the existing ActivityTracker batching pipeline.

### Data Flow

```
Card visible (≥50%)  →  useViewportTracking (first-seen Set)
    →  ViewportTrackingProvider.onImpression
    →  ActivityTracker.trackListingImpression()
    →  batched POST /api/activity
    →  fanOutListingImpressions()
    →  listing_impressions table (dedup via unique constraint)
```

### Dedup Strategy

One impression per listing per session per day, matching the `listing_views` pattern:
- Client-side: `impressedRef` Set prevents firing twice for the same listing in a single page session
- Server-side: Unique constraint `(listing_id, session_id, impression_date)` — duplicates get `23505` which is silently ignored

## Changes (8 files + 1 migration + 2 test files)

### Migration
| File | Purpose |
|------|---------|
| `supabase/migrations/107_listing_impression_dedup.sql` | Adds `impression_date DATE` column + unique dedup index |

### Core Pipeline
| File | Change |
|------|--------|
| `src/lib/viewport/useViewportTracking.ts` | Added `ImpressionEvent`, `TrackingMeta` types, `onImpression` callback, `impressedRef` Set (fires once per listing), `elementMetaRef` Map for position/dealerId |
| `src/lib/viewport/ViewportTrackingProvider.tsx` | Added `handleImpression` callback forwarding to `ActivityTracker.trackListingImpression()`. Updated `trackElement` signature for metadata |
| `src/lib/tracking/ActivityTracker.tsx` | Added `trackListingImpression()` method + interface entry. Follows `trackViewportDwell` pattern |
| `src/app/api/activity/route.ts` | Added `fanOutListingImpressions()` — row-by-row insert with 23505/42P01 error suppression |

### Grid Wiring
| File | Change |
|------|--------|
| `src/components/browse/VirtualListingGrid.tsx` | Passes `gridPosition={startIndex + idx}` to each `ListingCard` |
| `src/components/browse/ListingCard.tsx` | Accepts `gridPosition` prop, passes `{ position, dealerId }` metadata to `viewportTracking.trackElement()` |

### Exports
| File | Change |
|------|--------|
| `src/lib/viewport/index.ts` | Exports `TrackingMeta` and `ImpressionEvent` types |

### Tests
| File | Tests | Coverage |
|------|-------|----------|
| `tests/viewport/impressions.test.ts` | 9 | First-visibility fire, re-entry dedup, multiple listings, below-threshold skip, disabled tracking, metadata handling, untrack cleanup, dwell coexistence |
| `tests/api/activity/impressions.test.ts` | 10 | Row shape, impression_date extraction, batch handling, 23505 dedup silence, 42P01 silence, real error logging, non-impression filtering, null visitor_id, missing fields, best-effort failure |

## Volume Estimate

- ~777 views/day → ~200-400 unique sessions/day
- Each session scrolls past ~30-80 cards
- **~10K-20K impression rows/day** (with dedup constraint absorbing re-scrolls)
- ~300K-600K/month — manageable for Supabase

## What This Unlocks

1. **Position-adjusted CTR** — `views / impressions` per position bucket
2. **Listing attractiveness** — CTR normalized for position (high CTR at position 50 = genuinely interesting)
3. **Estimated views model** — `f(predicted_rank) × ctr_multiplier(listing_attributes)` with empirical calibration
4. **Dealer card signal** — "Your listing was shown 200 times and clicked 15 times (7.5% CTR)"

## Key Design Decisions

1. **Reused existing IntersectionObserver** — DwellTracker's observer already watches every card. Added impression callback before `handleIntersection()` in the same loop. Zero DOM overhead.

2. **Client-side dedup via Set, not DB round-trip** — `impressedRef` prevents firing the same listing twice in a session. Cheaper than checking the DB, and the server-side unique constraint catches edge cases (page reload, multiple tabs).

3. **`gridPosition` is NOT in memo comparator** — Position changes don't affect visual rendering, so `ListingCard`'s `memo()` comparison function doesn't include it. The tracking `useEffect` has `gridPosition` in its deps array, so re-registration happens correctly when virtual scroll repositions cards.

4. **Row-by-row insert (not batch)** — Fan-out inserts impressions one at a time so a single dedup violation doesn't reject the whole batch. Matches `fanOutListingViews` pattern.

## Verification

After deploy, verify with:
```sql
-- Should show rows accumulating
SELECT count(*) FROM listing_impressions;

-- Check dedup works (same session should not double-count)
SELECT session_id, count(*), count(DISTINCT listing_id)
FROM listing_impressions
GROUP BY session_id
ORDER BY count DESC
LIMIT 10;

-- Position distribution (should see concentration at low positions)
SELECT position, count(*)
FROM listing_impressions
WHERE position IS NOT NULL
GROUP BY position
ORDER BY position
LIMIT 20;
```
