# Session: Admin Dashboard Tracking Fixes

**Date:** 2026-02-22
**Commit:** `b0e65e0` — `fix: Admin dashboard tracking — QuickView views, PostgREST row cap, active visitors`
**Deployed:** Yes (Vercel auto-deploy from main)
**Backfill:** Yes (3,156 rows inserted into listing_views)

---

## Problem

The Activity Overview chart on `/admin` showed 5 views on Saturday but 12 favorites. This is logically impossible if "views" means what you'd expect. Investigation revealed the dashboard was severely undercounting activity due to multiple compounding issues.

---

## Root Causes Found (4 bugs)

### Bug 1: "Views" only counted listing detail page opens (CRITICAL)

**Before:** The `listing_views` fan-out in `activity/route.ts` only captured `listing_detail_view` events — i.e., when someone navigates to `/listing/[id]`. But the listing detail page is primarily for SEO; real users interact via QuickView, which generates `quickview_open` events that were never written to `listing_views`.

**Impact:** ~90% of actual listing views were invisible. Users could favorite listings (from the browse grid card) without any "view" being recorded.

**Fix:** Added `quickview_open` to the fan-out filter alongside `listing_detail_view`. QuickView events now write to `listing_views` with `referrer: 'quickview'`.

**Files:**
- `src/app/api/activity/route.ts` (line 257, 271)

### Bug 2: `.limit(100000)` silently capped at ~1000 rows (CRITICAL)

**Before:** The activity chart and stats APIs used `.limit(100000)` on Supabase queries. PostgREST's `max_rows` setting (default ~1000) silently caps this — the client receives exactly 1000 rows with no error or warning. The `fetchAllRows()` utility already existed to handle this (paginates with `.range()`) but wasn't used in these endpoints.

**Impact:** Any metric with >1000 data points in the query window was silently undercounted. Gets worse as traffic grows.

**Fix:** Replaced `.limit(100000)` with `fetchAllRows()` in:
- Activity chart: views, searches, favorites queries
- Stats API: popular listings (favorites + views), sessions, search terms

**Files:**
- `src/app/api/admin/stats/activity-chart/route.ts`
- `src/app/api/admin/stats/route.ts`

### Bug 3: "Active Users (24h)" only counted registered users (MODERATE)

**Before:** The metric queried `profiles.last_visit_at >= 24h ago`. This only counted:
1. Registered users (not anonymous visitors)
2. Who had functional cookie consent enabled
3. Who triggered the `recordVisit()` call

Most visitors are anonymous — this metric was nearly useless.

**Fix:** Changed to count distinct `visitor_id` values from `activity_events` (which tracks all non-admin visitors including anonymous). Also added a separate "Users (24h)" metric for logged-in users.

**Files:**
- `src/app/api/admin/stats/route.ts`
- `src/app/admin/page.tsx`

### Bug 4: Historical QuickView data missing from listing_views (DATA GAP)

**Before:** The fan-out fix (Bug 1) is forward-only. All 8,478 historical `quickview_open` events in `activity_events` were not in `listing_views`.

**Fix:** Ran a backfill script that:
1. Fetched all valid listing IDs (14,038)
2. Fetched all `quickview_open` events (8,478)
3. Filtered to valid listings (8,463) and deduplicated by listing/session/day (7,467)
4. Batch-inserted into `listing_views` with `ON CONFLICT DO NOTHING`
5. Result: **3,156 new rows** inserted (rest were duplicates of existing `listing_detail_view` entries)

Also created migration `079_backfill_quickview_listing_views.sql` which:
- Adds `'quickview'` to the `listing_views_referrer_check` constraint
- Runs the same backfill via SQL with an `EXISTS` subquery to skip orphaned listing IDs

**Files:**
- `supabase/migrations/079_backfill_quickview_listing_views.sql`

---

## Dashboard Changes

### Metrics Grid (was 4 cards, now 5)

| Card | Source | What it counts |
|------|--------|---------------|
| **Visitors (24h)** | `activity_events` distinct `visitor_id` | All unique devices (anonymous + logged-in) |
| **Users (24h)** | `activity_events` distinct `user_id` | Only logged-in accounts |
| **Total Users** | `profiles` count | All registered accounts |
| **Total Listings** | `listings` count | All listings in DB |
| **Favorites** | `user_favorites` count | All-time favorites |

Grid layout: `grid-cols-1 md:grid-cols-3 lg:grid-cols-5`

### Activity Overview Chart

No structural changes — still shows views/searches/favorites over 7 days. But "views" now accurately reflects QuickView opens + detail page views, and counts are no longer capped at ~1000 per metric.

---

## Tracking Pipeline Summary

```
User opens QuickView (or listing detail page)
    |
    v
ActivityTracker.trackQuickViewOpen() [client-side]
    |
    | Check: isAdmin? --> STOP (suppressed)
    | Check: isOptedOut? --> STOP
    |
    v
Queue event --> Batch every 30s --> POST /api/activity
    |
    v
Insert into activity_events (all event types)
    |
    v
Fan-out to listing_views  <-- NOW includes quickview_open
    |
    | Dedup: unique(listing_id, session_id, view_date)
    | referrer: 'quickview' or 'browse'/'search'/'direct'/etc.
    |
    v
Admin dashboard reads listing_views via fetchAllRows()
```

**Who is excluded from tracking:**
- Admin users (client-side suppression in `ActivityTrackerProvider`)
- Users who opted out of analytics (GDPR)
- Bots without JS execution

**Who IS tracked:**
- Anonymous visitors (via `visitor_id` fingerprint)
- Registered non-admin users (via `user_id` + `visitor_id`)

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/activity/route.ts` | QuickView fan-out + referrer |
| `src/app/api/admin/stats/activity-chart/route.ts` | fetchAllRows, import |
| `src/app/api/admin/stats/route.ts` | fetchAllRows, visitors+users metrics |
| `src/app/admin/page.tsx` | 5-card grid, DashboardStats type |
| `supabase/migrations/079_backfill_quickview_listing_views.sql` | Constraint + backfill |

---

## Lessons / Patterns

### PostgREST `.limit()` is not what you think
Supabase's PostgREST layer has a `max_rows` config (default 1000). Any `.limit(N)` where `N > max_rows` silently returns `max_rows` results with **no error**. Always use `fetchAllRows()` (in `_lib/utils.ts`) for analytics queries, or use `{ count: 'exact', head: true }` for counts.

### Check constraint on listing_views.referrer
The `referrer` column has a CHECK constraint: `IN ('browse', 'search', 'direct', 'external', 'alert', 'quickview')`. Migration 079 adds `'quickview'`. If adding new referrer sources, update this constraint.

### Admin tracking suppression is client-side only
Admin events never reach the server because `ActivityTrackerProvider` checks `isAdmin` and suppresses all `queueEvent()` calls. There is no server-side admin filtering in the fan-out. The stats API does filter admin user_ids from popular listings (via `getAdminUserIds()`), but the activity chart does not — it doesn't need to since admin events never arrive.

### listing_views dedup: (listing_id, session_id, view_date)
Same user viewing same listing multiple times in one day = 1 view. QuickView + detail page for the same listing in the same session/day = 1 view (dedup via `ON CONFLICT`). This is intentional.

---

## Not Changed (by design)

- **Engagement overview/funnel APIs** — Already used `fetchAllRows()` correctly
- **Visitor analytics page** (`/admin/visitors`) — Uses SQL RPCs, not affected
- **Dealer analytics** — Uses SQL RPCs, not affected
- **Featured score heat signals** — Reads from `activity_events` directly, not `listing_views`
