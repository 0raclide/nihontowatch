# Session: Artist Page Image Previews + QuickView Jumpiness

**Date:** 2026-02-09
**Commits:** `dc848ea` (QuickView fix) + artisan listings fix (committed earlier in session)

---

## Issues Addressed

### 1. Artist page item previews not loading (`/artists/NS-Goto`)

**Root cause:** The artisan listings API (`/api/artisan/[code]/listings`) was not selecting `stored_images` from the database, and the `ArtisanListings` component used `listing.images?.[0]` (raw dealer URLs) instead of the `getImageUrl()` helper that prefers Supabase Storage URLs.

Many dealer image URLs are broken due to hotlink protection or expired links, while the Supabase-hosted copies remain available.

**Fix:**
- `src/app/api/artisan/[code]/listings/route.ts` — Added `stored_images` to LISTING_FIELDS select
- `src/components/artisan/ArtisanListings.tsx` — Replaced `listing.images?.[0]` with `getImageUrl(listing)` (same helper used by ListingCard and QuickView)

### 2. QuickView images loading with jumpy behavior

**Root cause (primary):** `useValidatedImages` had a two-phase approach that caused massive layout shifts:
- Phase 1: Show ALL images (before any validation completes)
- Phase 2: Show ONLY validated images (after first image is checked)

With 10 images, the list would jump 10 → 1 → 2 → ... → 8 as each image validated asynchronously. The moment the first image was checked, the entire list collapsed to just that one image.

**Root cause (secondary):** `getAllImages(currentListing)` in QuickView created a new array reference every render. When `fetchFullListing` replaced `currentListing` in the QuickView context (same image data, different object reference), the `useValidatedImages` effect re-fired unnecessarily.

**Fix:**
- `src/hooks/useValidatedImages.ts` — Replaced two-phase approach with "optimistic valid":
  - All images assumed valid until proven otherwise
  - Invalid images removed one at a time (not all-at-once switch)
  - Results batched: removals only start after 3+ images checked (prevents single-item flickers)
  - Final image set is identical to before; only the transition is smoother
- `src/components/listing/QuickView.tsx` — Memoized `rawImages` with a stable fingerprint (`listingId:imageCount:storedCount`) so the validation hook doesn't re-fire when the listing object is replaced with identical image data

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/artisan/[code]/listings/route.ts` | Added `stored_images` to select |
| `src/components/artisan/ArtisanListings.tsx` | Import + use `getImageUrl()` |
| `src/hooks/useValidatedImages.ts` | Optimistic-valid approach (71 lines changed) |
| `src/components/listing/QuickView.tsx` | `useMemo` on `rawImages` array |

## Test Coverage

- 91 existing image tests pass (images.test.ts + images-regression.test.ts)
- Tests cover: `getAllImages` deduplication, stored vs dealer URL priority, index merging, real production data from listings 6759, 204, 9340, 10751
- `useValidatedImages` hook has no unit tests (behavioral change only — same final image set)

## Architecture Note: Image Loading Pipeline

When a user opens QuickView, images go through multiple stages:

1. **Preloader** (ListingCard hover): `new Image()` loads first 3 raw URLs → populates browser cache + validation cache
2. **Validator** (`useValidatedImages`): Checks dimensions of all images → filters out scraped icons/buttons
3. **Display** (Next.js `<Image>`): Loads through `/_next/image` optimization proxy (AVIF/WebP)
4. **Prefetcher** (QuickViewContext): Preloads adjacent listings for J/K navigation

The validator and preloader share a global cache (`validationCache` in `lib/images.ts`) to avoid duplicate work. The browser also caches raw URLs after first load.
