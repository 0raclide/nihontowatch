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
| Phase 3: Middleware + Cache | Planned | 0/2 | Admin role dedup, Cache-Control headers |
| Phase 4: Browse API Pruning | Planned | 0/6 | QuickView detail fetch, response pruning (883KB → ~195KB) |

**Estimated LCP after Phase 1+2: ~4.2s** (from 5.2s). Phases 3+4 needed to reach ~2.5s target.

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

**Verdict:** The app has excellent interactivity and layout stability, but **LCP is the critical bottleneck at 5.2s** (target: <2.5s). The root causes are: a massive browse API payload (883KB), zero code splitting for modals/admin code, Stripe.js loaded eagerly, and a middleware auth query on every request.

**Estimated improvement from all fixes: LCP 5.2s → ~2.5s**

---

## The Big Numbers

| Metric | Current | Target |
|--------|---------|--------|
| Browse API response | **883KB** (100 items) | ~150KB |
| JS bundle (gzipped) | 859KB total | <500KB |
| CSS (gzipped) | 157KB total | ~100KB |
| Largest JS chunk | 94KB gz (recharts) | Lazy-loaded |
| Unused JS (Lighthouse) | 262KB | <50KB |
| Browse API TTFB | 966ms | <300ms |
| Browse API fields/item | 62 | ~25 |

---

## P0 — Critical (Fix Immediately)

### 1. Browse API Over-Fetching: 883KB → ~150KB

**Impact:** Single biggest performance win. Cuts network payload by 83%.

The browse API returns **62 fields per listing** including full descriptions, setsumei text, artisan candidates, and duplicate image arrays. The listing card uses ~25 fields.

**Field-by-field waste analysis (100 items):**

| Field | Bytes | % of Total | Needed by Card? |
|-------|-------|------------|-----------------|
| `description` | 305KB | 31.7% | No |
| `setsumei_metadata` | 96KB | 10.0% | No |
| `stored_images` | 83KB | 8.6% | No (uses `images[0]`) |
| `artisan_candidates` | 65KB | 6.8% | No |
| `description_ja` | 61KB | 6.3% | No |
| `setsumei_text_ja` | 47KB | 4.9% | No |
| `yuhinkai_enrichment` | 45KB | 4.7% | No |
| `listing_yuhinkai_enrichment` | 45KB | 4.7% | No |
| `description_en` | 37KB | 3.8% | No |
| `setsumei_text_en` | 32KB | 3.4% | No |
| **Total waste** | **~816KB** | **~85%** | |

**Fix:** Create a `BROWSE_SELECT_FIELDS` constant with only the ~25 fields the listing card actually renders. Move heavy fields to the listing detail API (which already exists).

**File:** `src/app/api/browse/route.ts`

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

### 4. Middleware Auth Query Blocks Every Request (+50-150ms)

**Impact:** Adds 50-150ms latency to **every single request** including static pages.

```typescript
// src/middleware.ts line 88 — runs on ALL requests
const { data: { user } } = await supabase.auth.getUser();
```

This queries Supabase auth on every request. For `/admin` routes, it then queries the `profiles` table for role — and this query is **duplicated** for `/api/admin` routes.

**Fix:**
1. Use Supabase session from cookie (already SSR-enabled) instead of `getUser()` call
2. Move admin role checks to the `/admin` layout server component, not middleware
3. Or cache role lookups for 5 minutes

**File:** `src/middleware.ts` (lines 88-139)

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

### 8. API Routes Missing Cache-Control Headers

**Impact:** Every request hits the server; no browser/CDN caching.

| Route | Current | Recommended |
|-------|---------|-------------|
| `/api/browse` | No header | `public, s-maxage=60, stale-while-revalidate=300` |
| `/api/artists/directory` | force-dynamic | `public, s-maxage=3600, stale-while-revalidate=86400` |
| `/api/artisan/[code]` | No header | `public, s-maxage=3600` |
| `/api/dealers/directory` | No header | `public, s-maxage=3600` |

**Fix:** Add `Cache-Control` response headers to API routes.

**Files:** Various API routes in `src/app/api/`

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

### Completed (Phase 1 + Phase 2)

| Fix | Est. LCP Impact | Status |
|-----|----------------|--------|
| Intl.NumberFormat cache (1a) | -0.1s | DONE |
| Listing detail dedup (1b) | -0.2s | DONE |
| Stripe lazy-load (1c) | -0.2s | DONE |
| Browse query parallelization (1d) | -0.1s | DONE |
| Layout modal dynamic imports (2a) | -0.2s | DONE |
| QuickView modal dynamic imports (2b) | -0.1s | DONE |
| Admin component dynamic imports (2c) | -0.1s | DONE |
| Recharts dynamic imports (2d) | -0.1s | DONE |
| **Subtotal Phase 1+2** | **~-1.1s** | |

### Remaining (Phase 3 + Phase 4)

| Fix | Est. LCP Impact | Status |
|-----|----------------|--------|
| Middleware admin role dedup (3a) | -0.05s | Planned |
| Cache-Control headers (3b) | -0.1s | Planned |
| Browse API pruning (4d) | **-1.5s** | Planned |
| **Subtotal Phase 3+4** | **~-1.65s** | |

### If All Fixes Are Applied

| Metric | Before | After (Est.) | Change |
|--------|--------|-------------|--------|
| LCP | 5.2s | ~2.5s | -52% |
| Browse API size | 883KB | ~150KB | -83% |
| JS transferred | 859KB | ~500KB | -42% |
| Browse TTFB | 966ms | ~400ms | -59% |
| Lighthouse score | 79 | ~92 | +13pts |

### Remaining Work

| Priority | Remaining Issues | Next Steps |
|----------|-----------------|------------|
| P0 (Critical) | 2 of 5 (#1 browse pruning, #4 middleware) | Phase 3 + Phase 4 |
| P1 (High) | 2 of 5 (#8 cache headers, #10 logo) | Phase 3b + backlog |
| P2 (Medium) | 6 issues | Backlog |
| P3 (Low) | 7 issues | Backlog |

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

### Live API Response Times
- `/api/browse?tab=available&page=1`: 1.87s, 883KB
- `/api/artists/directory?page=1&limit=50`: 1.23s, 34KB
- `/api/listing/1`: 0.67s, 3KB
