# Performance Optimization Plan — COMPLETE

**Goal:** LCP 5.2s → ~2.5s
**Audit:** `docs/PERFORMANCE_AUDIT_20260225.md`
**Ordering:** Low-risk first, high-risk last. Build & test after each phase.
**Status:** All 4 phases implemented and deployed to production (2026-02-25).

---

## Phase 1: Safe Quick Wins (4 changes, ~1h total)

### 1a. Cache `Intl.NumberFormat` — RISK: NONE

**File:** `src/components/browse/ListingCard.tsx`
**Lines:** 363-382

Add module-level formatter cache. Replace `new Intl.NumberFormat(...)` inside `formatPrice()` with cached lookup. Only 3 currency keys possible (JPY/USD/EUR).

```typescript
const formatters = new Map<string, Intl.NumberFormat>();
function getFormatter(currency: string): Intl.NumberFormat {
  if (!formatters.has(currency)) {
    formatters.set(currency, new Intl.NumberFormat('en-US', {
      style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
    }));
  }
  return formatters.get(currency)!;
}
```

### 1b. Listing Detail Dedup — RISK: LOW

**File:** `src/app/listing/[id]/page.tsx`
**Lines:** 43 (`generateMetadata`) and 136 (page component)

Wrap `getListingDetail` with React `cache()` at module level. Both `generateMetadata` and `ListingPage` call the cached version. React deduplicates within a single server render pass.

```typescript
import { cache } from 'react';

const getCachedListing = cache(async (listingId: number) => {
  const supabase = createServiceClient();
  return getListingDetail(supabase, listingId);
});
```

### 1c. Stripe Lazy-Load — RISK: LOW

**File:** `src/lib/stripe/client.ts`
**Line 7:** `import { loadStripe, type Stripe } from '@stripe/stripe-js';`

Change to type-only import + dynamic import inside `getStripe()`:

```typescript
import type { Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
      return Promise.resolve(null);
    }
    stripePromise = import('@stripe/stripe-js').then(m => m.loadStripe(publishableKey));
  }
  return stripePromise;
}
```

`getStripe()` is already async — callers don't change.

### 1d. Parallelize Browse API Tail Queries — RISK: LOW

**File:** `src/app/api/browse/route.ts`
**Lines:** 847-864

Freshness query (line 853) and dealer count (line 861) run sequentially after the `Promise.all` for facets+histogram. Move them into the same `Promise.all`. They're independent queries with no ordering dependency.

### Verify Phase 1
- `npm run build` succeeds
- `npm test` passes
- Browse page renders correctly
- Listing detail page renders correctly

---

## Phase 2: Dynamic Imports (MODERATE RISK)

### 2a. Root Layout Modals

**PaywallModal:**
- Defined: `src/components/subscription/PaywallModal.tsx`
- Consumer: `src/app/layout.tsx` line 12
- Guard: Returns `null` until `paywallInfo` is set (triggered by `showPaywall()`)
- Change: `const PaywallModal = dynamic(() => import('@/components/subscription/PaywallModal').then(m => ({ default: m.PaywallModal })), { ssr: false });`

**ConsentPreferences:**
- Defined: `src/components/consent/ConsentPreferences.tsx`
- Consumer: `src/app/layout.tsx` line 19
- Guard: Returns `null` until `showPreferences` is set
- Change: Same pattern as PaywallModal

### 2b. QuickView Modals

**InquiryModal** (3 consumers):
- Consumer 1: `src/components/listing/QuickViewContent.tsx` line 6
- Consumer 2: `src/components/listing/QuickViewMobileSheet.tsx` line 11
- Consumer 3: `src/app/listing/[id]/ListingDetailClient.tsx` line 12
- Guard: `isOpen` prop (state variable toggled by click)
- Change in each consumer: `const InquiryModal = dynamic(() => import('@/components/inquiry/InquiryModal').then(m => ({ default: m.InquiryModal })), { ssr: false });`

**CreateAlertModal:**
- Consumer: `src/app/listing/[id]/ListingDetailClient.tsx` line 10
- Guard: `isOpen` prop
- Same dynamic pattern

### 2c. Admin-Only Components

**AdminScoreInspector:**
- Consumer: `src/components/listing/QuickViewContent.tsx` line 20
- Guard: `isAdmin && listing.featured_score !== undefined`
- Change: `const AdminScoreInspector = dynamic(() => import('./AdminScoreInspector').then(m => ({ default: m.AdminScoreInspector })), { ssr: false });`

**AdminEditView:**
- Consumer: `src/components/listing/QuickView.tsx` line 8
- Guard: `isAdminEditMode === true`
- Same dynamic pattern

**NOTE: ArtisanTooltip is NOT dynamically imported.** It wraps the artisan badge (visible UI for all users). Dynamic importing it would hide the badge until the chunk loads — visible regression. The tooltip panel only opens on admin click, but the wrapper itself must be in the initial bundle.

### 2d. Recharts in Admin Analytics

7 chart files in `src/components/admin/analytics/`:
- `SessionDistributionChart.tsx`
- `VisitorsChart.tsx`
- `UserGrowthChart.tsx`
- `CategoryBreakdownChart.tsx`
- `PriceDistributionChart.tsx`
- `TrendLineChart.tsx`

Consumer: `src/app/admin/page.tsx`

Wrap each chart import in the admin page with `next/dynamic({ ssr: false })` and add pulse skeleton loading fallback. This removes the 94KB gzipped recharts chunk from the shared bundle.

### Verify Phase 2
- `npm run build` — recharts chunk should NOT appear in shared bundles
- `npm test` passes
- Open PaywallModal, InquiryModal, ConsentPreferences — verify they load
- Admin: open ScoreInspector, AdminEditView, charts — verify they load
- Check build output for reduced initial JS size

---

## Phase 3: Middleware + Cache Headers (MODERATE RISK)

### 3a. Deduplicate Admin Role Check

**File:** `src/middleware.ts` lines 88-143

Lines 100-104 and 135-139 run the identical `profiles.select('role')` query. Restructure to query once:

```typescript
const { data: { user } } = await supabase.auth.getUser(); // Keep — needed for token refresh

const pathname = request.nextUrl.pathname;
const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');

if (isAdminPath) {
  // Check API key bypass first (for /api/admin only)
  if (pathname.startsWith('/api/admin')) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const cronHeader = request.headers.get('x-cron-secret');
    if (cronSecret && (authHeader === `Bearer ${cronSecret}` || cronHeader === cronSecret)) {
      return supabaseResponse; // API key auth — skip role check
    }
  }

  if (!user) {
    // Handle unauthenticated — redirect or 401 based on route type
    ...
  }

  // Single role query for both /admin and /api/admin
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();

  if (profile?.role !== 'admin') {
    // Handle non-admin — redirect or 403 based on route type
    ...
  }
}
```

**NOT changing:** `getUser()` stays (required for JWT validation + token refresh). Middleware matcher stays (not narrowing API routes — too risky without separate evaluation).

### 3b. Cache-Control Headers on Read-Only API Routes

| Route File | Header to Add |
|------------|--------------|
| `src/app/api/artists/directory/route.ts` | `public, s-maxage=60, stale-while-revalidate=300` |
| `src/app/api/artisan/[code]/route.ts` | `public, s-maxage=3600, stale-while-revalidate=86400` |
| `src/app/api/dealers/directory/route.ts` | `public, s-maxage=3600, stale-while-revalidate=86400` |

**NOT changing:** `/api/browse` stays `private, no-store` (returns per-user `isAdmin`/`isDelayed` state).

### Verify Phase 3
- `npm test` passes
- Admin pages still load (role check works)
- API key-authenticated webhook requests to `/api/admin/*` still work
- Non-admin users redirected from `/admin` routes
- Response headers correct on artist/dealer directory APIs

---

## Phase 4: Browse API Pruning + QuickView Lazy Fetch (HIGH RISK)

**Impact: 883KB → ~195KB (-78%). The single biggest LCP improvement.**

### Execution Order (safety-first)

```
Step 4a: Fix EnrichedListingDetail type bug (pre-existing)
Step 4b: Add QuickView detail fetch + selective merge (ADDITIVE — nothing breaks)
Step 4c: Verify QuickView works with detail data
Step 4d: Prune browse API response (BREAKING — requires 4b working)
Step 4e: Update setsumei badge to use has_setsumei boolean
Step 4f: Full verification
```

### Step 4a: Fix EnrichedListingDetail Type

**File:** `src/lib/listing/getListingDetail.ts` (~line 106-174)

Add `artisan_name_kanji?: string` to `EnrichedListingDetail` interface. The function already returns it (line 399) but the type omits it.

### Step 4b: QuickView Detail Fetch + Selective Merge

**Files:**
- `src/contexts/QuickViewContext.tsx` — add fetch on listing change
- `src/components/listing/QuickViewContent.tsx` — consume merged data
- `src/components/listing/QuickViewMobileSheet.tsx` — consume merged data

**New data flow:**
1. User clicks card → `openQuickView(browseListing)` → renders immediately with card-level data
2. QuickViewContext fetches `/api/listing/${id}` → response is `{ listing: {...} }`
3. **Selective merge** — overlays only the fields being pruned, preserves browse enrichments
4. Components re-render with full data (description, setsumei, admin fields fill in)
5. `detailLoaded` boolean state controls skeleton visibility

**The merge function** (define in QuickViewContext or a shared util):

```typescript
/**
 * Merge detail API data into browse listing. SELECTIVE — browse enrichments
 * (sold_data, featured_score, thumbnail_url, status_changed_at) are NOT in
 * the detail API and must not be overwritten with undefined.
 */
function mergeDetailIntoListing(
  browse: Listing,
  detail: EnrichedListingDetail
): Listing {
  return {
    ...browse,
    // Only overlay fields that are being pruned from browse API:
    description: detail.description,
    description_en: detail.description_en,
    description_ja: detail.description_ja,
    setsumei_text_en: detail.setsumei_text_en,
    setsumei_text_ja: detail.setsumei_text_ja,
    setsumei_metadata: detail.setsumei_metadata,
    artisan_candidates: detail.artisan_candidates,
    artisan_method: detail.artisan_method,
    og_image_url: detail.og_image_url,
    yuhinkai_enrichment: detail.yuhinkai_enrichment ?? browse.yuhinkai_enrichment,
  };
}
```

**Why selective:** These browse-only fields would be wiped by a naive spread:
- `sold_data` — browse computes it, detail does NOT → sold overlay breaks
- `featured_score` — browse has it, detail does NOT → AdminScoreInspector breaks
- `thumbnail_url` — browse has it, detail does NOT
- `status_changed_at` — browse has it, detail does NOT

**Error handling:** If detail fetch fails, QuickView degrades gracefully — shows card-level data, description section stays empty. No crash.

**Skeleton sections in QuickView while `!detailLoaded`:**
- TranslatedDescription → show 3-line pulse skeleton
- AdminSetsumeiWidget → hidden until detail loads (admin-only, acceptable)
- ArtisanTooltip `artisan_candidates` → tooltip shows "Loading..." on click before detail arrives

### Step 4c: Verify QuickView Detail Fetch

Test BEFORE pruning the browse API (at this point, both browse and detail have all fields — the fetch is redundant but harmless):
- QuickView opens instantly
- Detail fetch completes and merge doesn't corrupt any fields
- `sold_data` overlay still works after merge
- `featured_score` preserved for AdminScoreInspector
- Navigate between listings with arrow keys — each triggers new fetch
- Error case: block network → QuickView shows card data gracefully

### Step 4d: Prune Browse API Response

**File:** `src/app/api/browse/route.ts`

**Approach: Strip-after-query (safest).** Keep `setsumei_text_en` and `listing_yuhinkai_enrichment(setsumei_en)` in the Supabase SELECT so we can compute `has_setsumei` server-side. Then destructure out the heavy fields before sending the response.

In the enrichment step (~lines 700-708), compute `has_setsumei` and strip:

```typescript
enrichedListings = enrichedListings.map((listing: any) => {
  const has_setsumei = isSetsumeiEligibleCert(listing.cert_type) && (
    !!listing.setsumei_text_en ||
    !!listing.listing_yuhinkai_enrichment?.[0]?.setsumei_en
  );

  const {
    description, description_en, description_ja,
    setsumei_text_en, setsumei_text_ja, setsumei_metadata, setsumei_processed_at,
    artisan_candidates, artisan_method, images_stored_at,
    listing_yuhinkai_enrichment,
    ...slimListing
  } = listing;

  return {
    ...slimListing,
    has_setsumei,
    // Keep the normalized yuhinkai_enrichment (already set earlier as single object)
    // but strip the raw array form
  };
});
```

**Also remove from SELECT** (not needed even for server computation):
- `description_en`, `description_ja` — not used server-side
- `setsumei_text_ja` — not used server-side
- `setsumei_metadata` — not used anywhere
- `setsumei_processed_at` — not used anywhere
- `artisan_candidates` — not used server-side
- `artisan_method` — not used server-side
- `images_stored_at` — not used anywhere

**Keep in SELECT but strip from response:**
- `description` — used by `computeSoldData`? Check. If not, remove from SELECT too.
- `setsumei_text_en` — needed for `has_setsumei` computation

**Fields removed from response: ~688KB savings.**

### Step 4e: Update Setsumei Badge

**File:** `src/components/browse/ListingCard.tsx`

Update `hasSetsumeiTranslation()` to use the pre-computed boolean:

```typescript
function hasSetsumeiTranslation(listing: Listing): boolean {
  // New path: browse API pre-computes this
  if ('has_setsumei' in listing) return (listing as any).has_setsumei;
  // Legacy path: full listing data (detail page, QuickView after merge)
  if (!isSetsumeiEligibleCert(listing.cert_type)) return false;
  return !!(listing.setsumei_text_en) || !!(listing.yuhinkai_enrichment?.setsumei_en);
}
```

Backwards compatible — works with both browse API (has `has_setsumei`) and detail API (has full fields).

### Step 4f: Full Verification

- [ ] Browse payload is ~195KB (was 883KB)
- [ ] Listing cards render identically: cert badge, setsumei badge, artisan badge, price, images
- [ ] QuickView opens instantly with card data
- [ ] Description fills in after ~200ms (skeleton → content transition)
- [ ] Setsumei study mode works after detail loads
- [ ] Admin tooltip shows artisan candidates after detail loads
- [ ] AdminScoreInspector shows correct featured_score (from browse data, not wiped)
- [ ] Sold overlay renders (sold_data from browse, not wiped)
- [ ] Share buttons get og_image_url after detail fetch
- [ ] Sold tab still enriches sale prices from price_history
- [ ] QuickView arrow navigation triggers new detail fetches
- [ ] Detail fetch failure → graceful degradation (no crash, just missing description)
- [ ] `npm run build` succeeds
- [ ] `npm test` passes

---

## Summary — ALL COMPLETE

| # | Phase | Files Changed | Risk | LCP Impact | Status |
|---|-------|--------------|------|------------|--------|
| 1a | Intl.NumberFormat cache | ListingCard.tsx | None | -0.1s | **DONE** |
| 1b | Listing detail dedup | listing/[id]/page.tsx | Low | -0.2s | **DONE** |
| 1c | Stripe lazy-load | stripe/client.ts | Low | -0.2s | **DONE** |
| 1d | Parallelize browse queries | browse/route.ts | Low | -0.1s | **DONE** |
| 2a | Layout modal dynamic imports | layout.tsx | Moderate | -0.2s | **DONE** |
| 2b | QuickView modal dynamic imports | QuickViewContent, MobileSheet, ListingDetailClient | Moderate | -0.1s | **DONE** |
| 2c | Admin component dynamic imports | QuickViewContent, QuickView.tsx | Moderate | -0.1s | **DONE** |
| 2d | Recharts dynamic import | admin/page.tsx | Moderate | -0.1s | **DONE** |
| 3a | Middleware dedup | middleware.ts | Moderate | -0.05s | **DONE** |
| 3b | Cache-Control headers | 3 API route files | Low | -0.1s | **DONE** |
| 4a | Selective merge | QuickViewContext.tsx | High | — | **DONE** (`d87cb13`) |
| 4b | Prune browse API + has_setsumei | browse/route.ts, ListingCard.tsx | High | **-1.5s** | **DONE** (`a327356`) |
| 4c | detailLoaded skeleton | QuickViewContext, QuickViewContent, MobileSheet | Moderate | — | **DONE** (`834783a`) |

**Estimated total: LCP 5.2s → ~2.8s**
**Browse payload: 883KB → 334KB (56KB gzipped)**

---

## What NOT to Change

- `getUser()` → `getSession()` in middleware — **UNSAFE** (breaks JWT refresh + verification)
- Middleware matcher narrowing — defer (risk of breaking cookie refresh)
- ArtisanTooltip dynamic import — wraps visible badge for ALL users
- Browse API `Cache-Control` — stays `private, no-store` (per-user state)
- ListingCard `React.memo()` — already correct
- Image optimization — already excellent
- Font loading — already optimal
- Virtualization — already excellent

---

## Rollback Strategy

- **Phases 1a-1d:** Single-file changes, trivial `git revert`
- **Phase 2:** Each dynamic import is one import statement change. Revert = restore static import.
- **Phase 3:** Middleware restructure is one file. Revert = restore original branching.
- **Phase 4 (two layers):**
  - **If merge is broken:** Revert `mergeDetailIntoListing`. QuickView uses browse data as-is (no description but no crash).
  - **If prune is broken:** Revert browse API SELECT to include all fields. QuickView fetch code stays harmlessly (fetches redundant data).
  - The strip-after-query approach means the Supabase query stays stable — risk is only in JS response construction.
