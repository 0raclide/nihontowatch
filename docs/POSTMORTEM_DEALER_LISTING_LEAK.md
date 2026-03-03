# Postmortem: Dealer Portal Test Listings Leaked to Users

**Date:** 2026-03-03
**Severity:** P0
**Duration:** Unknown (discovered same day as test listings posted)
**Impact:** Real users received email alerts for test dealer portal listings

---

## Summary

Test listings submitted through the Dealer Portal (behind `NEXT_PUBLIC_DEALER_LISTINGS_LIVE` feature flag) triggered saved search email notifications to real users. The notifications showed "Matched Juyo" and "Matched Tokuju" alerts for test items that were never supposed to be visible.

## Timeline

| Time | Event |
|------|-------|
| 2026-03-03 ~T12:00 | Test listings posted via dealer portal for QA |
| 2026-03-03 ~T12:15 | Saved search cron fires (runs every 15 min) |
| 2026-03-03 ~T12:15 | Users receive email + in-app notifications for test listings |
| 2026-03-03 ~T13:00 | Issue reported — notifications visible in app |
| 2026-03-03 ~T13:30 | Root cause identified — matcher.ts has no source filter |
| 2026-03-03 ~T13:45 | P0 hotfix deployed (11 files, commit `d5c552b`) |
| 2026-03-03 ~T14:30 | Full audit reveals 15+ additional unprotected paths |
| 2026-03-03 ~T15:00 | Comprehensive fix deployed + RLS structural safeguard |

## Root Cause

When the Dealer Portal was implemented (migration 097), the `source` column was added to the `listings` table with a default of `'scraper'`. Dealer-submitted listings are tagged `source = 'dealer'`. The feature flag `NEXT_PUBLIC_DEALER_LISTINGS_LIVE` controls visibility.

**The visibility guard was only applied to 3 of 18+ query paths:**

| Protected (3) | Unprotected (15+) |
|---|---|
| Browse API (`/api/browse`) | Saved search matcher |
| Listing detail (`getListingDetail`) | Price drop alert cron |
| Featured score cron | Back-in-stock alert cron |
| | Artisan listings API |
| | Artist directory API (3 queries) |
| | Artist page data |
| | Dealer detail page (3 queries) |
| | Related listings (listing detail page) |
| | Search suggestions |
| | New items count |
| | Category preview (SEO) |
| | Home page preview (SSR) |
| | Sitemap XML |
| | Favorites API |
| | Alerts API |
| | Translate API |
| | Inquiry email API |
| | Notifications API |
| | Share page metadata |
| | SQL RPCs (browse facets, price histogram, nagasa histogram) |

The original Dealer Portal MVP session doc (`docs/SESSION_20260303_DEALER_PORTAL_MVP.md`) listed only 3 "testing gate" insertion points. The implicit assumption was that only the browse API mattered — but the system has 18+ independent paths that query listings.

## Impact

- **Users received false notifications** for non-existent inventory
- **Credibility damage** — users may question data accuracy
- **No financial impact** — test listings had no dealer URLs to click through
- **No data corruption** — test listings are clearly tagged `source = 'dealer'`

## Fix

### Immediate (Hotfix — commit `d5c552b`)

Added `.neq('source', 'dealer')` guard to the 12 most critical unprotected paths, prioritizing the saved search matcher (direct cause of the alert leak).

### Comprehensive (Follow-up)

1. **Application-level guards** — Added the filter to all 18+ user-facing query paths
2. **Database-level RLS policy** (migration 098) — Replaced the `listings_public_read` policy (`USING (true)`) with `USING (source IS DISTINCT FROM 'dealer')`. This protects ALL query paths at the database level, including SQL RPCs and any future code. Service role key (used by dealer portal, admin, cron) bypasses RLS.
3. **Regression test** (`tests/lib/dealer-source-guard.test.ts`) — Scans all `.from('listings')` calls in `src/` and fails if any user-facing file lacks the guard. New files must either add the guard or be added to the allowlist with justification.

### Defense-in-depth layers

| Layer | Scope | Catches |
|-------|-------|---------|
| RLS policy (migration 098) | All DB queries via anon/authenticated key | Everything, including RPCs |
| Application `.neq()` guards | Each individual query | Explicit, reviewable |
| Regression test | CI pipeline | New unguarded code |

## Lessons Learned

### 1. Feature flags need exhaustive insertion point audits

The `NEXT_PUBLIC_DEALER_LISTINGS_LIVE` flag was only applied where the developer thought to add it. The assumption that "browse API = all user visibility" was wrong. A single database table (`listings`) is queried from 18+ independent code paths — alerts, search, SEO, artist pages, notifications, favorites, etc.

**Rule:** When adding a new `source`/`status`/`visibility` flag to a shared table, audit EVERY `.from('table')` call, not just the obvious ones. Use `grep` exhaustively.

### 2. Cron jobs are a blind spot for feature flags

The saved search cron (`process-saved-searches`) queries `listings` directly using `findMatchingListings()` — it never touches the browse API. Feature flags gating UI paths don't protect backend cron pipelines.

**Rule:** When gating a feature, check all cron jobs in `vercel.json` and `src/app/api/cron/` for unprotected paths.

### 3. Database-level guards (RLS) beat application-level guards

18 individual `.neq()` calls can be forgotten. One RLS policy cannot. The structural fix (migration 098) ensures that even if a developer adds a new `.from('listings')` query and forgets the guard, dealer listings are still invisible to users.

**Rule:** For data isolation requirements, prefer database-level enforcement (RLS, views) over application-level filtering.

### 4. Regression tests catch future drift

The structural regression test (`dealer-source-guard.test.ts`) scans all source files for unguarded queries. It caught `notifications/recent/route.ts` during development. Without it, future developers adding new listing queries would silently reintroduce the leak.

**Rule:** For critical data isolation, add a "lint-style" test that scans code for compliance.

## Action Items

| # | Action | Status |
|---|--------|--------|
| 1 | Deploy hotfix (matcher + cron alerts) | Done (commit `d5c552b`) |
| 2 | Fix all remaining TS query paths (15+) | Done |
| 3 | Apply RLS migration 098 to production | **TODO** — run via Supabase dashboard |
| 4 | Add regression test | Done |
| 5 | Clean up test dealer listings from DB | **TODO** — delete via admin or SQL |
| 6 | Update MEMORY.md | Done |
| 7 | When dealer portal goes live: update RLS policy to `USING (true)` and remove application-level guards | Future |

## Files Changed

### Hotfix (commit `d5c552b`)
- `src/lib/savedSearches/matcher.ts` — both `findMatchingListings` and `countMatchingListings`
- `src/app/api/cron/process-price-alerts/route.ts`
- `src/app/api/cron/process-stock-alerts/route.ts`
- `src/app/api/artisan/[code]/listings/route.ts`
- `src/app/api/user/new-items-count/route.ts`
- `src/app/api/search/suggestions/route.ts`
- `src/lib/seo/fetchCategoryPreview.ts`
- `src/lib/browse/getHomePreview.ts`
- `src/app/sitemap.ts`
- `tests/api/cron/process-price-alerts.test.ts`
- `tests/api/cron/process-stock-alerts.test.ts`

### Comprehensive fix
- `src/app/dealers/[slug]/page.tsx` (3 queries)
- `src/app/listing/[id]/page.tsx` (2 related listing queries)
- `src/app/api/dealers/directory/route.ts`
- `src/app/api/artists/directory/route.ts` (3 queries)
- `src/lib/artisan/getArtistPageData.ts`
- `src/app/s/[id]/page.tsx`
- `src/app/api/translate/route.ts`
- `src/app/api/inquiry/generate/route.ts`
- `src/app/api/favorites/route.ts`
- `src/app/api/alerts/route.ts`
- `src/app/api/notifications/recent/route.ts`
- `supabase/migrations/098_exclude_dealer_source_from_rpcs.sql` (RLS policy)
- `tests/lib/dealer-source-guard.test.ts` (regression test)
- `tests/api/translate.test.ts` (mock fix)
- `tests/api/inquiry/generate.test.ts` (mock fix)
- `tests/api/notifications/recent.test.ts` (mock fix)
