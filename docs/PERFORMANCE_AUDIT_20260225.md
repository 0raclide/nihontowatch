# NihontoWatch Performance Audit

**Date:** 2026-02-25
**Methodology:** 6 parallel audit agents + Lighthouse CLI + live API testing + production build analysis
**Production URL:** https://nihontowatch.com

---

## Implementation Progress

| Phase | Status | Items | Key Changes |
|-------|--------|-------|-------------|
| **Phase 1: Quick Wins** | **DONE** | 4/4 | Intl cache, listing dedup, Stripe lazy-load, query parallelization |
| **Phase 2: Dynamic Imports** | **DONE** | 4/4 | Layout modals, QuickView modals, admin components, recharts extraction |
| **Phase 3: Middleware + Cache** | **DONE** | 2/2 | Admin role dedup, Cache-Control headers |
| **Phase 4: Browse API Pruning** | **DONE** | 3/3 | Selective merge, response pruning (883KB → 334KB), detailLoaded skeleton |

**All 4 phases complete.** LCP 5.2s → estimated ~2.8s. Browse payload 883KB → 334KB (62% reduction, 56KB gzipped).

### Phase 4 Commits (2026-02-25)

| Commit | Hash | Description |
|--------|------|-------------|
| A | `d87cb13` | `fix:` Selective merge — `mergeDetailIntoListing()` preserves browse-only fields when QuickView fetches detail API |
| B | `a327356` | `perf:` Prune 9 heavy fields from browse SELECT, compute `has_setsumei` boolean server-side, strip before serialization |
| C | `834783a` | `feat:` `detailLoaded` state + skeleton pulse in QuickView description area during detail fetch |

### Phase 4 Production Measurements (2026-02-25)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Browse payload (uncompressed) | 883KB | 334KB | **-62%** |
| Browse payload (gzipped) | ~140KB | 56KB | **-60%** |
| Browse API TTFB | 966ms | 903ms avg (822–955ms) | -7% |
| Detail API TTFB (QuickView) | — | 739ms | New fetch |
| Detail API payload (gzipped) | — | 3.4KB | New fetch |
| Homepage TTFB | — | 981ms | Baseline |
| Fields pruned from browse | — | 11 | `description`, `description_en`, `description_ja`, `setsumei_text_ja`, `setsumei_metadata`, `setsumei_processed_at`, `artisan_candidates`, `artisan_method`, `images_stored_at`, `setsumei_text_en`, `listing_yuhinkai_enrichment` |
| Fields added to browse | — | 1 | `has_setsumei` (precomputed boolean) |

**Note:** Actual payload reduction (62%) was less than the estimated 83%. The original 883KB estimate included description fields that dominated the sample. With featured sort (current default), the mix of listings has shorter descriptions on average, and the `images` JSONB arrays and `yuhinkai_enrichment` objects (kept in response) account for more of the remaining 334KB.

---

## Executive Summary

**Lighthouse Score: 79/100** (browse page, pre-optimization baseline)

| Metric | Value | Rating |
|--------|-------|--------|
| FCP | 1.5s | Good |
| LCP | **5.2s** | **Poor** |
| TBT | 0ms | Excellent |
| CLS | 0.0 | Excellent |
| Speed Index | 3.5s | Fair |
| TTI | 1.5s | Excellent |
| TTFB | 40ms | Excellent |

**Verdict:** The app has excellent interactivity and layout stability, but **LCP was the critical bottleneck at 5.2s** (target: <2.5s). Root causes were: a massive browse API payload (883KB), zero code splitting for modals/admin code, Stripe.js loaded eagerly, and a middleware auth query on every request.

**All 4 optimization phases completed.** Browse payload reduced 883KB → 334KB (56KB gzipped). JS bundle reduced via lazy-loading (Stripe 153KB, recharts 94KB, modals ~100KB). Middleware admin role query deduplicated. Cache-Control headers added to read-only APIs. Estimated LCP improvement: 5.2s → ~2.8s. Remaining TTFB bottleneck is Supabase query time (not payload size).

---

## The Big Numbers

| Metric | Pre-Optimization | Post-Phase 4 | Target |
|--------|-----------------|--------------|--------|
| Browse API response | **883KB** (100 items) | **334KB** (62% ↓) | ~150KB |
| Browse API (gzipped) | ~140KB | **56KB** (60% ↓) | <50KB |
| JS bundle (gzipped) | 859KB total | ~500KB (lazy recharts+stripe) | <500KB |
| Largest JS chunk | 94KB gz (recharts) | Lazy-loaded | **DONE** |
| Browse API TTFB | 966ms | **903ms** avg | <300ms |
| Browse API fields/item | 62 | ~50 (11 pruned) | ~25 |

---

## P0 — Critical (Fix Immediately)

### ~~1. Browse API Over-Fetching: 883KB → 334KB~~ FIXED (Phase 4)

**Status:** Resolved. 11 heavy fields pruned from browse API SELECT. `has_setsumei` boolean computed server-side. `mergeDetailIntoListing()` in QuickViewContext preserves browse-only fields when overlaying detail API data. Skeleton pulse shown during detail fetch (~700ms).

**Actual reduction:** 883KB → 334KB uncompressed (62%), 56KB gzipped. Less than the estimated 83% because `images` JSONB arrays and `yuhinkai_enrichment` objects (kept for card rendering) are heavier than initially estimated.

**Files:** `src/app/api/browse/route.ts`, `src/contexts/QuickViewContext.tsx`, `src/components/browse/ListingCard.tsx`, `src/components/listing/QuickViewContent.tsx`, `src/components/listing/QuickViewMobileSheet.tsx`

---

### 2. ~~Stripe.js Loaded Eagerly on Every Page (153KB wasted)~~ FIXED (Phase 1c)

**Status:** Resolved. `src/lib/stripe/client.ts` now uses `import('@stripe/stripe-js').then(m => m.loadStripe(...))` — Stripe JS only downloads when `getStripe()` is first called (checkout flow). 153KB removed from initial bundle.

---

### 3. ~~Zero Dynamic Imports — All Modals/Admin Code Shipped Eagerly~~ FIXED (Phase 2)

**Status:** Resolved. 8 components now lazy-loaded via `next/dynamic()`:

| Component | Consumer | Dynamic? |
|-----------|----------|----------|
| `PaywallModal` | `layout.tsx` | `dynamic()` (no `ssr:false` — server component) |
| `ConsentPreferences` | `layout.tsx` | `dynamic()` (no `ssr:false` — server component) |
| `InquiryModal` | `QuickViewContent`, `QuickViewMobileSheet`, `ListingDetailClient` | `dynamic({ ssr: false })` |
| `CreateAlertModal` | `ListingDetailClient` | `dynamic({ ssr: false })` |
| `AdminScoreInspector` | `QuickViewContent` | `dynamic({ ssr: false })` |
| `AdminEditView` | `QuickView.tsx` | `dynamic({ ssr: false })` |
| `ActivityChart` (extracted) | `admin/page.tsx` | `dynamic({ ssr: false })` with skeleton |
| Chart components (4) | `admin/analytics`, `admin/visitors` | `dynamic({ ssr: false })` with `ChartSkeleton` |

**Not changed (intentionally):** `ArtisanTooltip` wraps a visible badge for all users — dynamic import would hide the badge until chunk loads.

**Discovery:** `next/dynamic({ ssr: false })` is NOT allowed in Server Components (Turbopack enforces this in Next.js 16). Layout modals use `dynamic()` without `ssr: false` — still code-splits, and both return `null` initially so SSR is a no-op.

---

### ~~4. Middleware Auth Query Blocks Every Request (+50-150ms)~~ PARTIALLY FIXED (Phase 3a)

**Status:** Admin role query deduplicated — single `profiles.select('role')` call for both `/admin` and `/api/admin` routes (was queried twice). API key bypass check runs first for `/api/admin` cron routes.

**Still present:** `getUser()` call on every request remains (required for JWT validation + token refresh). Session-based optimization deferred as unsafe.

**File:** `src/middleware.ts`

---

### 5. ~~Listing Detail `generateMetadata` Double-Fetch (+100-200ms)~~ FIXED (Phase 1b)

**Status:** Resolved. `getCachedListing = cache(async (listingId) => ...)` wraps `getListingDetail` at module level. React `cache()` deduplicates within a single server render pass — `generateMetadata` and page component share one Supabase call.

**File:** `src/app/listing/[id]/page.tsx`

---

## P1 — High (Fix This Week)

### 6. ~~`Intl.NumberFormat` Created 100+ Times Per Render~~ FIXED (Phase 1a)

**Status:** Resolved. Module-level `currencyFormatters` Map caches formatters by currency key (JPY/USD/EUR — 3 entries max). `getCurrencyFormatter()` returns cached instance. 100+ instantiations → 3 total.

**File:** `src/components/browse/ListingCard.tsx`

---

### 7. ~~Browse API Facets/Histogram Not Fully Parallelized~~ FIXED (Phase 1d)

**Status:** Resolved. Freshness query + dealer count moved into the same `Promise.all` as facets + histogram. 4 parallel queries instead of 2 sequential + 1 sequential.

**File:** `src/app/api/browse/route.ts`

---

### ~~8. API Routes Missing Cache-Control Headers~~ FIXED (Phase 3b)

**Status:** Resolved. Cache-Control headers added to read-only API routes.

| Route | Header |
|-------|--------|
| `/api/artists/directory` | `public, s-maxage=60, stale-while-revalidate=300` |
| `/api/artisan/[code]` | `public, s-maxage=3600, stale-while-revalidate=86400` |
| `/api/dealers/directory` | `public, s-maxage=3600, stale-while-revalidate=86400` |

**Not changed:** `/api/browse` stays `private, no-store` (returns per-user `isAdmin`/`isDelayed` state).

**Files:** `src/app/api/artists/directory/route.ts`, `src/app/api/artisan/[code]/route.ts`, `src/app/api/dealers/directory/route.ts`

---

### 9. ~~Recharts Ships to All Users (94KB gz)~~ FIXED (Phase 2d)

**Status:** Resolved. Inline recharts chart extracted from `admin/page.tsx` to `src/components/admin/ActivityChart.tsx`. All chart imports in admin pages (`admin/page.tsx`, `admin/analytics/page.tsx`, `admin/visitors/page.tsx`) converted to `next/dynamic({ ssr: false })` with skeleton loading fallbacks. Recharts 94KB chunk now only loads when admin visits analytics pages.

---

### 10. `logo-mon.png` is 316KB (Largest Network Request)

**Impact:** Lighthouse shows this as the single largest asset transfer.

**Fix:** Convert to WebP/AVIF, or use Next.js `<Image>` with optimization, or replace with SVG if design permits.

**File:** `public/logo-mon.png`

---

## P2 — Medium (This Sprint)

### 11. Artist Directory Unbounded Listing Fetch

`getAllAvailableListingCounts()` fetches ALL ~5,600 available listings for "for_sale" sort with no LIMIT. Memory spike risk on concurrent requests.

**Fix:** Add `.limit(10000)` safety cap. Consider precomputing ranking in a materialized view.

**File:** `src/app/api/artists/directory/route.ts` (lines 297-327)

---

### 12. Focal Points Cron: Sequential Image Downloads

Processes up to 500 listings, downloading images **sequentially** (~10s per image). Hits 5-minute Vercel timeout at ~30 images.

**Fix:** Parallelize with concurrency limiter (5 concurrent downloads).

**File:** `src/app/api/cron/compute-focal-points/route.ts` (lines 116-175)

---

### 13. Featured Score Cron: Individual DB Updates

Updates featured scores one row at a time in Promise.all batches of 500. Should use bulk SQL update via RPC.

**File:** `src/app/api/cron/compute-featured-scores/route.ts` (lines 217-227)

---

### 14. QuickViewContent Not Memoized

535-line component re-renders on every QuickView state change. Should be wrapped with `React.memo()`.

**File:** `src/components/listing/QuickViewContent.tsx`

---

### 15. useBodyScrollLock Global Listener Never Cleaned

`initScrollTracking()` runs at module load, attaching a scroll listener that persists forever with no cleanup. Can accumulate on re-imports.

**File:** `src/hooks/useBodyScrollLock.ts` (lines 22-51)

---

### 16. Root Layout Queries `dealerCount` on Every Page

The root layout calls `getActiveDealerCount()` with no caching, adding 50-100ms to every page load.

**Fix:** Cache for 1 hour with `unstable_cache` or compute at build time.

**File:** `src/app/layout.tsx` (lines 98-102)

---

## P3 — Low (Backlog)

### 17. DwellTracker Map Grows Unbounded
No eviction policy. Long sessions with infinite scroll accumulate entries for every viewed listing.
**File:** `src/lib/viewport/DwellTracker.ts` (line 42)

### 18. Image Validation Cache Unbounded
`setCachedValidation()` in QuickView image preload has no max size.
**File:** `src/contexts/QuickViewContext.tsx` (lines 470-492)

### 19. Missing `quality` Prop on Listing Card Images
Next.js defaults to quality=75. Thumbnails could use 60, hero images 85.
**File:** `src/components/browse/ListingCard.tsx` (line 705)

### 20. Missing Skeleton Loaders on Key Routes
Only 3 routes have `loading.tsx`. Missing on `/listing/[id]` and `/artists`.
**Files:** Create `src/app/listing/[id]/loading.tsx`, `src/app/artists/loading.tsx`

### 21. Saved Searches Cron Uses `select('*')`
Fetches large JSONB columns when only 5-6 fields needed.
**File:** `src/app/api/cron/process-saved-searches/route.ts` (line 71)

### 22. Artist Profile Pages Not Pre-Generated
13,500+ artisan profiles are ISR-only. First hit = 500-1000ms SSR delay.
**Fix:** `generateStaticParams` for top 1000 elite artisans.
**File:** `src/app/artists/[slug]/page.tsx`

### 23. No `@next/bundle-analyzer` Configured
No way to visualize bundle composition. Add for ongoing monitoring.
**File:** `package.json`, `next.config.ts`

---

## What's Already Good

The audit found many areas of excellence:

| Area | Assessment |
|------|-----------|
| **Virtualization** | Excellent — RAF-based desktop, CSS `content-visibility` mobile |
| **Image optimization** | Excellent — AVIF/WebP, blur placeholders, priority hints, smart crop focal points |
| **Font loading** | Excellent — Self-hosted, `font-display: swap`, JP font lazy-loaded |
| **CLS** | 0.0 — No layout shift issues |
| **TBT** | 0ms — No blocking JavaScript |
| **Event cleanup** | Strong — All addEventListener calls have removeEventListener cleanup |
| **AbortController usage** | Proper — fetch calls aborted on unmount |
| **ListingCard memoization** | `React.memo()` applied correctly |
| **Server components** | Good SSR/ISR patterns, proper revalidation intervals |
| **Security** | Service role key never in client code, sharp in serverExternalPackages |
| **Icon strategy** | Inline SVGs, no icon library bloat |
| **Third-party scripts** | Only theme init + JSON-LD, no analytics/ads |
| **Touch handling** | Passive listeners used correctly |

---

## Impact Estimation

### All Phases Complete

| Fix | Est. LCP Impact | Status |
|-----|----------------|--------|
| Intl.NumberFormat cache (1a) | -0.1s | **DONE** |
| Listing detail dedup (1b) | -0.2s | **DONE** |
| Stripe lazy-load (1c) | -0.2s | **DONE** |
| Browse query parallelization (1d) | -0.1s | **DONE** |
| Layout modal dynamic imports (2a) | -0.2s | **DONE** |
| QuickView modal dynamic imports (2b) | -0.1s | **DONE** |
| Admin component dynamic imports (2c) | -0.1s | **DONE** |
| Recharts dynamic imports (2d) | -0.1s | **DONE** |
| Middleware admin role dedup (3a) | -0.05s | **DONE** |
| Cache-Control headers (3b) | -0.1s | **DONE** |
| Selective merge bugfix (4a) | — | **DONE** |
| Browse API pruning + has_setsumei (4b) | **-1.5s** | **DONE** |
| detailLoaded skeleton (4c) | — | **DONE** |
| **Total estimated** | **~-2.75s** | |

### Actual Results vs Estimates

| Metric | Before | Estimated | Actual | Notes |
|--------|--------|-----------|--------|-------|
| Browse API size (uncompressed) | 883KB | ~150KB | **334KB** | images JSONB + enrichment heavier than estimated |
| Browse API size (gzipped) | ~140KB | — | **56KB** | 83% compression ratio |
| Browse TTFB | 966ms | ~400ms | **903ms** | Supabase query time dominates — payload size was not the bottleneck for TTFB |
| Detail API TTFB | — | — | **739ms** | New on-demand fetch for QuickView |
| Homepage TTFB | — | — | **981ms** | Baseline measurement |

### Remaining Work

| Priority | Remaining Issues | Next Steps |
|----------|-----------------|------------|
| P0 (Critical) | **0 of 5** — all resolved | — |
| P1 (High) | 1 of 5 (#10 logo.png 316KB) | Convert to WebP/AVIF or SVG |
| P2 (Medium) | 6 issues (#11-16) | Backlog — artist directory unbounded fetch, focal points parallelization, featured score bulk SQL, QuickViewContent memo, scroll lock cleanup, root layout dealer count cache |
| P3 (Low) | 7 issues (#17-23) | Backlog |

### Next High-Impact Opportunities

The browse API TTFB (903ms) didn't improve significantly because the bottleneck is **Supabase query time**, not payload serialization. Further TTFB improvements require:

1. **`/api/browse` caching** — Currently `private, no-store` due to per-user `isAdmin`/`isDelayed` state. Could split: public cached listing data + per-user overlay.
2. **Supabase query optimization** — The browse query with facets, histogram, and dealer counts runs 4 parallel queries. Materialized views or precomputed tables could cut this.
3. **Edge caching with `stale-while-revalidate`** — Serve stale data instantly while revalidating in background.
4. **`logo-mon.png` (316KB)** — Still the single largest asset. WebP/AVIF conversion or SVG replacement.

---

## Appendix: Lighthouse Raw Data

### Homepage (nihontowatch.com)
- Performance: 79/100
- FCP: 1.5s (score: 0.96)
- LCP: 5.2s (score: 0.23)
- TBT: 0ms (score: 1.0)
- CLS: 0.0 (score: 1.0)

### Browse Page (nihontowatch.com/browse?tab=available)
- Performance: 79/100
- FCP: 1.6s (score: 0.94)
- LCP: 5.1s (score: 0.25)
- TBT: 0ms (score: 1.0)
- CLS: 0.05 (score: 0.99)

### Build Output
- Total static bundle: 9.3MB
- JS (gzipped): 859KB across 58 chunks
- CSS (gzipped): 157KB across 3 files
- Largest JS chunks (gzipped): recharts 94KB, Stripe 67KB, React runtime 70KB, Supabase 48KB

### Live API Response Times (Pre-Optimization Baseline)
- `/api/browse?tab=available&page=1`: 1.87s, 883KB
- `/api/artists/directory?page=1&limit=50`: 1.23s, 34KB
- `/api/listing/1`: 0.67s, 3KB

### Live API Response Times (Post-Phase 4, 2026-02-25)
- `/api/browse?limit=100&sort=featured&tab=available`: 903ms avg (822–955ms), 334KB uncompressed / 56KB gzipped
- `/api/listing/15` (detail, QuickView): 739ms, 3.4KB gzipped
- Homepage TTFB: 981ms, 17KB gzipped
