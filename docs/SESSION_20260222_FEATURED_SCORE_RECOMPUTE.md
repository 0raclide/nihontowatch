# Session: Inline Featured Score Recompute on Admin Actions

**Date:** 2026-02-22
**Status:** Shipped to production

## Problem

The `featured_score` column drives the default sort order in browse. Previously it was only recomputed by a cron job every 4 hours. When an admin corrected a listing's `cert_type` or `artisan_id`, the score stayed stale until the next cron run — so the listing sat at its old position in the feed.

Since quality (artisan stature + cert points) is the dominant scoring factor (up to 395 of ~555 max), admin corrections can represent massive rank changes that should be visible immediately. For example, setting a gimei (fake signature) item's artisan to UNKNOWN should drop it significantly, but it was staying at the top for hours.

## Root Cause of Initial Bug

The first deploy used a **fire-and-forget** pattern (`recomputeScoreForListing().catch(...)`) — the promise was started but not awaited. In Vercel's serverless runtime, once the HTTP response is sent, the function instance can freeze/terminate immediately. The recompute promise never completed, so the `featured_score` was never actually updated.

This was confirmed by checking listings 63960 and 63992 — both had `artisan_id: 'UNKNOWN'` (the admin mutation succeeded) but their scores hadn't changed (the recompute never ran).

## Solution

### 1. Shared scoring module (`src/lib/featured/scoring.ts`)

Extracted all scoring math from the cron route into a shared module:

- `CERT_POINTS` — certification point values
- `IGNORE_ARTISAN_IDS` — catch-all codes excluded from stature calculation (`UNKNOWN`, `unknown`)
- `ListingScoreInput` — minimal listing fields for scoring
- `computeQuality(listing)` — artisan stature + cert points + completeness (0–395)
- `computeFreshness(listing)` — age-based multiplier (0.3–1.4)
- `imageCount(listing)` — helper for image array length
- `computeFeaturedScore(listing, heat)` — combines quality + heat + freshness, returns 0 if no images
- `recomputeScoreForListing(supabase, listingId, options?)` — end-to-end: fetch listing, query behavioral counts, compute score, persist

### 2. Admin endpoint integration

| Endpoint | Behavior |
|----------|----------|
| `fix-cert` | After cert update + audit trail → `await recomputeScoreForListing(...)` |
| `fix-artisan` | After artisan update + audit trail → `await recomputeScoreForListing(..., { syncElite: true, artisanId })` (also updates `artisan_elite_factor` and `artisan_elite_count` from Yuhinkai) |
| `hide` | Hiding: sets `featured_score = 0` in same update as `admin_hidden = true`. Unhiding: `await recomputeScoreForListing(...)` to restore correct score |

### 3. Cron route DRY refactor

`src/app/api/cron/compute-featured-scores/route.ts` now imports `computeQuality`, `computeFreshness`, `imageCount`, and `ListingScoreInput` from the shared module. No behavior change — just deduplicated.

## Scoring Model

```
quality (0–395) = artisan_stature + cert_points + completeness
  artisan_stature = (elite_factor × 200) + min(√elite_count × 18, 100)
  cert_points     = CERT_POINTS[cert_type] (0–40)
  completeness    = images(0–15) + price(10) + attribution(8) + measurements(5)
                  + description(5) + era(4) + school(3) + HIGH confidence(5)

heat (0–160) = min(favorites×15, 60) + min(clicks×10, 40) + min(quickviews×3, 24)
             + min(views×1, 20) + min(pinchZooms×8, 16)

freshness = multiplier based on listing age:
  <3 days: 1.4  |  <7 days: 1.2  |  <30 days: 1.0
  <90 days: 0.85  |  <180 days: 0.5  |  ≥180 days: 0.3

featured_score = (quality + heat) × freshness
```

Listings without images → `featured_score = 0`.

`IGNORE_ARTISAN_IDS` (`UNKNOWN`, `unknown`) → artisan stature treated as 0.

## Behavioral Data Queries (Single Listing)

`recomputeScoreForListing` runs 5 parallel count queries (all scoped to one `listing_id`, 30-day window):

1. `user_favorites` — favorites count
2. `dealer_clicks` — click-throughs to dealer
3. `listing_views` — page views
4. `activity_events` where `event_type = 'quickview_open'`
5. `activity_events` where `event_type = 'image_pinch_zoom'`

## Elite Factor Sync

When `fix-artisan` changes the artisan, `recomputeScoreForListing` with `{ syncElite: true }`:

1. Queries Yuhinkai `artisan_makers` by `maker_id`
2. Falls back to `artisan_schools` for `NS-*` codes
3. Updates `artisan_elite_factor` and `artisan_elite_count` on the listing
4. If artisan not found → zeros out both columns

## Key Files

| File | Role |
|------|------|
| `src/lib/featured/scoring.ts` | **Shared scoring module** — all scoring math + `recomputeScoreForListing()` |
| `src/app/api/cron/compute-featured-scores/route.ts` | Batch cron (imports from shared module) |
| `src/app/api/listing/[id]/fix-cert/route.ts` | Cert correction → awaits recompute |
| `src/app/api/listing/[id]/fix-artisan/route.ts` | Artisan correction → awaits recompute + elite sync |
| `src/app/api/listing/[id]/hide/route.ts` | Hide/unhide → zero or recompute |
| `tests/lib/featured/scoring.test.ts` | Unit tests for scoring functions |

## Postmortem: Fire-and-Forget in Serverless

**Lesson:** Never use unawaited promises for side effects in Vercel serverless functions. The runtime can freeze the instant the response is sent. Use `await` with `try/catch` instead. If the work genuinely needs to be async after response, use Vercel's `waitUntil()` API.

This pattern appeared in 3 endpoints and was caught within hours because the admin tested the feature immediately after deploy.

## Commits

1. `7b330b4` — `feat: Inline featured_score recompute on admin cert/artisan/hide actions` (fire-and-forget version)
2. `c4d571d` — `fix: Await score recompute instead of fire-and-forget in serverless` (correct awaited version)
