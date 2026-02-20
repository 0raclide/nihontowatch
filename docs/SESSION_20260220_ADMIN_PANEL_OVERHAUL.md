# Session: Admin Panel Security, Data Accuracy & UI Overhaul

**Date**: 2026-02-20
**Scope**: 19 fixes across 18 files + 3 new SQL migrations
**Tests**: 144 files, 4054 tests passing

---

## Problem

A deep audit of the admin panel revealed 19 issues across three categories:

1. **Security** (3 issues): Auth bypass on 2 routes, PostgREST filter injection on 1 route
2. **Data accuracy** (12 issues): Silent data truncation from JS-side aggregation hitting Supabase row limits
3. **UI completeness** (4 issues): Missing event labels, debug console.logs, duplicate auth implementation

### Root Cause — Data Accuracy

The same anti-pattern caused most data issues: fetch N rows with `.limit()` then aggregate in JavaScript. This silently truncates data when row counts exceed the limit. Supabase PostgREST also has an undocumented default 1000-row limit when no `.limit()` is specified.

Example: The featured scores cron had 5 separate unbounded queries that each hit the 1000-row default, producing wrong scores for any listing beyond the first 1000 behavioral events per category.

---

## Changes

### Phase 1: Security Hotfixes

| Route | Bug | Fix |
|-------|-----|-----|
| `/api/admin/dealers/analytics` | Only checked `user` exists, no role check — any authenticated user could access dealer analytics | Added `verifyAdmin()` from `@/lib/admin/auth` |
| `/api/admin/visitors/geo` | Same — no role check | Added `verifyAdmin()` |
| `/api/admin/users` | PostgREST filter injection: `query.or(\`email.ilike.%${search}%,...\`)` | Sanitize search by stripping `,.()` characters |

### Phase 2: Featured Scores Cron

**File**: `src/app/api/cron/compute-featured-scores/route.ts`

**Before**: 5 separate unbounded queries (favorites, dealer_clicks, listing_views, quickview_opens, pinch_zooms), each hitting 1000-row default, merged into JavaScript Maps.

**After**: Single RPC call `get_listing_engagement_counts(p_since)` with FULL OUTER JOINs across all 5 data sources.

**Migration**: `071_featured_score_rpc.sql`

### Phase 3: Dealer Analytics

**File**: `src/app/api/admin/dealers/analytics/route.ts`

**Before**: 7 parallel queries (dealers, click stats, prev clicks, dwell, favorites, daily clicks, listings) with unbounded or high limits + JS aggregation.

**After**: 5 RPC calls + 2 direct queries. All aggregation in SQL.

**Migration**: `072_dealer_analytics_rpc.sql` — 5 functions:
- `get_dealer_click_stats(p_start, p_end)` — clicks + unique visitors per dealer
- `get_dealer_click_stats_prev(p_start, p_end)` — previous period for trend
- `get_dealer_dwell_stats(p_start, p_end)` — SUM dwell seconds
- `get_dealer_favorite_stats(p_start, p_end)` — favorites via JOIN to listings
- `get_dealer_daily_clicks(p_start, p_end)` — daily breakdown for charts

### Phase 4: Activity Chart + Stats (Pragmatic Fix)

Added `.limit(100000)` to queries that had no limit or low limits:
- `activity-chart/route.ts`: 3 queries had no `.limit()` (1000 default!)
- `stats/route.ts`: limits increased from 1000/10000 to 100000

### Phase 5: Engagement Routes (RPC Rewrite)

**Migration**: `073_engagement_analytics_rpc.sql` — 5 functions:
- `get_top_searches(p_start, p_end, p_admin_ids, p_limit)` — aggregated search terms
- `get_search_totals(p_start, p_end, p_admin_ids)` — total/unique/clicks
- `get_top_listings(p_start, p_end, p_admin_ids, p_limit)` — views + favorites
- `get_engagement_counts(p_start, p_end, p_admin_ids)` — session/view/search counts
- `get_funnel_counts(p_start, p_end, p_admin_ids)` — all 8 funnel stages

Routes rewritten:
- `searches/route.ts` — `.from('user_searches').limit(50000)` + JS GROUP BY → `rpc('get_top_searches')` + `rpc('get_search_totals')`
- `top-listings/route.ts` — `.from('listing_views').limit(50000)` + JS counting → `rpc('get_top_listings')`

Routes with increased limits:
- `overview/route.ts` — 50000/10000 → 100000
- `funnel/route.ts` — 50000/10000 → 100000

### Phase 6: UI Polish

| File | Fix |
|------|-----|
| `src/app/admin/visitors/page.tsx` | Added 8 missing `EVENT_TYPE_LABELS`: `dealer_click`, `listing_detail_view`, `search_click`, `quickview_open`, `alert_create`, `alert_delete`, `listing_view`, `listing_impression` |
| `src/components/admin/VisitorDetailModal.tsx` | Added 8 missing cases to `getEventDisplay()` and `getEventDescription()` |
| `src/app/api/admin/visitors/[visitorId]/route.ts` | Added `dealer_click` case to event switch |
| `src/app/admin/AdminLayoutClient.tsx` | Removed 4 debug `console.log` statements |

### Phase 7: Auth Consolidation

Two incompatible `verifyAdmin` implementations:
- `src/lib/admin/auth.ts` → `{ isAdmin, user, error }` (canonical)
- `engagement/_lib/utils.ts` → `{ success, userId, response }` (duplicate)

Removed the duplicate. All routes now import from `@/lib/admin/auth`. The `_lib/utils.ts` retains: `getAdminUserIds`, `parsePeriodParam`, `parseLimitParam`, `parseSortByParam`, `calculatePeriodDates`, `successResponse`, `errorResponse`, `roundTo`, `safeDivide`.

---

## Files Modified

```
# Security (Phase 1)
src/app/api/admin/dealers/analytics/route.ts
src/app/api/admin/visitors/geo/route.ts
src/app/api/admin/users/route.ts

# Featured scores (Phase 2)
src/app/api/cron/compute-featured-scores/route.ts

# Dealer analytics (Phase 3)
src/app/api/admin/dealers/analytics/route.ts        # Also Phase 1

# Activity chart + stats (Phase 4)
src/app/api/admin/stats/activity-chart/route.ts
src/app/api/admin/stats/route.ts

# Engagement routes (Phase 5)
src/app/api/admin/analytics/engagement/searches/route.ts
src/app/api/admin/analytics/engagement/top-listings/route.ts
src/app/api/admin/analytics/engagement/overview/route.ts
src/app/api/admin/analytics/engagement/funnel/route.ts

# UI polish (Phase 6)
src/app/admin/visitors/page.tsx
src/components/admin/VisitorDetailModal.tsx
src/app/api/admin/visitors/[visitorId]/route.ts
src/app/admin/AdminLayoutClient.tsx

# Auth consolidation (Phase 7)
src/app/api/admin/analytics/engagement/_lib/utils.ts
src/app/api/admin/analytics/engagement/growth/route.ts

# Tests
tests/api/admin/analytics/engagement/searches.test.ts
tests/api/admin/analytics/engagement/top-listings.test.ts

# New migrations
supabase/migrations/071_featured_score_rpc.sql
supabase/migrations/072_dealer_analytics_rpc.sql
supabase/migrations/073_engagement_analytics_rpc.sql
```

---

## RPC Functions Reference

All functions use `LANGUAGE sql SECURITY DEFINER`.

### Migration 071 — Featured Score Engagement

| Function | Parameters | Returns |
|----------|-----------|---------|
| `get_listing_engagement_counts` | `p_since TIMESTAMPTZ` | `TABLE(listing_id, favorites, dealer_clicks, views, quickview_opens, pinch_zooms)` |

### Migration 072 — Dealer Analytics

| Function | Parameters | Returns |
|----------|-----------|---------|
| `get_dealer_click_stats` | `p_start, p_end` | `TABLE(dealer_name, dealer_id, clicks, unique_visitors)` |
| `get_dealer_click_stats_prev` | `p_start, p_end` | `TABLE(dealer_name, dealer_id, clicks)` |
| `get_dealer_dwell_stats` | `p_start, p_end` | `TABLE(dealer_id, total_dwell_seconds)` |
| `get_dealer_favorite_stats` | `p_start, p_end` | `TABLE(dealer_id, favorites)` |
| `get_dealer_daily_clicks` | `p_start, p_end` | `TABLE(click_date, dealer_name, clicks)` |

### Migration 073 — Engagement Analytics

| Function | Parameters | Returns |
|----------|-----------|---------|
| `get_top_searches` | `p_start, p_end, p_admin_ids UUID[], p_limit INT` | `TABLE(query_normalized, search_count, unique_users, avg_results, has_click)` |
| `get_search_totals` | `p_start, p_end, p_admin_ids UUID[]` | `TABLE(total_searches, unique_searchers, total_clicks)` |
| `get_top_listings` | `p_start, p_end, p_admin_ids UUID[], p_limit INT` | `TABLE(listing_id, view_count, unique_viewers, favorite_count)` |
| `get_engagement_counts` | `p_start, p_end, p_admin_ids UUID[]` | `TABLE(session_count, view_count, search_count, unique_searchers)` |
| `get_funnel_counts` | `p_start, p_end, p_admin_ids UUID[]` | `TABLE(visitors, searchers, viewers, signed_up, engagers, high_intent, dealer_clickers, drafters)` |

---

## Pattern: When to Use RPC vs Direct Query

After this overhaul, the codebase uses two patterns:

**Use RPC** when:
- You need GROUP BY / COUNT / SUM aggregation across potentially large datasets
- Multiple tables need JOINing for a single result
- Admin filtering (exclude admin user IDs) is required
- Data volume could exceed 1000 rows

**Use direct `.from()` query** when:
- Fetching specific rows by ID (e.g., listing details after RPC gives you IDs)
- Simple equality filters with known small result sets
- Schema is in generated Supabase types (RPC functions aren't, requiring `as any` casts)

**TypeScript note**: RPC functions aren't in generated Supabase types, so calls use `(supabase.rpc as any)('fn_name', { ... })` with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`.
