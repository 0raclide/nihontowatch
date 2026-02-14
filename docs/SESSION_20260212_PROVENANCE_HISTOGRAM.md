# Session: Provenance Standing Histogram

**Date:** 2026-02-12
**Commits:** `b0c750e`, `17a443d`, `5a94bf8`

## What Was Done

Added a distribution histogram to the Provenance Standing (i) info panel on artist profiles, mirroring the existing Elite Standing histogram.

### 1. `getProvenanceDistribution()` — `src/lib/supabase/yuhinkai.ts`

New query function returning 100 buckets at 0.1 resolution over the 0–10 provenance_factor range. Filters `NOT NULL` on `provenance_factor`. Added after `getEliteDistribution()`.

### 2. API Route — `src/app/api/artisan/provenance-distribution/route.ts`

New GET endpoint accepting `?type=smith|tosogu`. Returns `{ buckets, total }` with 1-hour cache (`s-maxage=3600`).

### 3. `ProvenanceHistogram` — `src/components/artisan/ProvenancePyramid.tsx`

Canvas histogram component mirroring `EliteHistogram` with:
- 0–10 score scale (not 0–1 like elite)
- Log-scale bar heights
- Gold marker on the current artisan's bucket
- Leading + trailing empty bucket trimming (see bugfix below)

`ProvenanceFactorDisplay` updated with lazy-load `useEffect` that fetches distribution only when (i) panel is opened, with spinner fallback.

## Bugfix: Empty Leading Buckets

**Problem:** The Bayesian prior floors all `provenance_factor` values at ~2.0, so buckets 0–19 were completely empty — 35% dead horizontal space on the left of the histogram.

**Fix:** Trim leading zeros the same way trailing zeros were already trimmed. `startBucket` is set to `max(firstNonZero - 1, 0)`, and x-axis labels reflect the visible range (e.g., "1.9" to "5.7" instead of "0" to "5.7").

## Label Fix: "Available Now" → "On the Market"

Changed the artist profile stats bar label from "AVAILABLE NOW" to "ON THE MARKET" to match the wording already used on directory cards.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/supabase/yuhinkai.ts` | Added `getProvenanceDistribution()` |
| `src/app/api/artisan/provenance-distribution/route.ts` | **New** — API route |
| `src/components/artisan/ProvenancePyramid.tsx` | Added `ProvenanceHistogram`, lazy-load in `ProvenanceFactorDisplay` |
| `src/app/artists/[slug]/ArtistPageClient.tsx` | Label: "Available Now" → "On the Market" |

## Verification

- `npx tsc --noEmit` — clean
- 3,958 tests pass
- Visit `/artists/masamune-MAS590` → Provenance Standing → click (i) → histogram with trimmed range and gold marker
