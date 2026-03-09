# Hero Image Selection & Image Classification — Session Handoff

**Date:** 2026-03-08
**Commits:** `e6216ee`..`47004d1` (6 commits on `main`)
**Status:** Deployed to prod (Vercel auto-deploy)
**Depends on:** Showcase Layout Phase 1 (`docs/SESSION_20260308_SHOWCASE_LAYOUT.md`)
**Migrations required:** 116 + 117 must be run on prod Supabase before deploy (see Prod Incident below)

---

## What Was Built

Two interconnected features:

1. **Hero image selection** — Dealers (and admins) can choose which image appears as the listing thumbnail instead of always using `images[0]`. A `hero_image_index` column stores an explicit index into the images array. NULL = use index 0 (fully backwards compatible).

2. **Image classification utility** — Centralized `src/lib/images/classification.ts` replaces 4 inline copies of the Yuhinkai catalog domain check and adds catalog image type classification (oshigata vs setsumei vs combined), enabling the Showcase Documentation section to show setsumei page scans alongside the setsumei text card.

Plus 4 showcase polish fixes (vertical sidebar nav, hero redesign, Header restoration, kanto hibisho image upload bug).

---

## Commit History

| Commit | Description |
|--------|-------------|
| `e6216ee` | Showcase: replace horizontal top bar with vertical sidebar index |
| `a29a7c9` | Showcase: hero redesign — two-column layout (image + metadata), video moves below scholar's note |
| `4485672` | Add missing `classification.ts` (ShowcaseHero import) |
| `2055f4b` | Fix kanto hibisho image upload 404 when section added before save |
| `37d5ae7` | Add `<Header />` to showcase layout — site nav was missing |
| `47004d1` | **feat: hero image selection + image classification utility** (main commit) |

---

## Database

### Migration 116 — `hero_image_index` column

```sql
ALTER TABLE listings ADD COLUMN hero_image_index INTEGER DEFAULT NULL;
```

Nullable integer, index into `images[]` array. NULL = fallback to index 0. Written by dealer form or admin. Scraper never touches this column.

### Migration 117 — Invalidation trigger extension

Extends the existing `invalidate_focal_point()` trigger to also NULL `hero_image_index` when `images` or `stored_images` change:

```sql
CREATE OR REPLACE FUNCTION invalidate_focal_point()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.images IS DISTINCT FROM NEW.images
     OR OLD.stored_images IS DISTINCT FROM NEW.stored_images THEN
    NEW.focal_x := NULL;
    NEW.focal_y := NULL;
    NEW.hero_image_index := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Rationale:** If the scraper replaces the images array, the old hero index may point to a different image or be out of bounds. Safer to reset to NULL (defaults to index 0) and let the dealer re-select.

---

## New Utility: `src/lib/images/classification.ts`

Single source of truth for Yuhinkai catalog image detection and hero image resolution.

### Exports

| Function | Signature | Purpose |
|----------|-----------|---------|
| `YUHINKAI_CATALOG_DOMAIN` | `string` constant | `itbhfhyptogxcjbjfzwx.supabase.co` — was duplicated in 4 files |
| `isYuhinkaiCatalogImage(url)` | `string → boolean` | Checks if URL contains the catalog storage path |
| `classifyCatalogImage(url)` | `string → 'oshigata' \| 'setsumei' \| 'combined' \| null` | Classifies by filename: `_oshigata.`, `_setsumei.`, `_combined.` |
| `getHeroImage(listing)` | `ImageSource & {hero_image_index?} → string \| null` | Resolves hero URL: explicit index if valid, else index 0 |
| `getHeroImageIndex(listing)` | `ImageSource & {hero_image_index?} → number` | Returns 0-based index (for initializing viewers) |
| `getKoshiraeHeroImage(koshirae)` | `KoshiraeData → string \| null` | Same for koshirae images array |

### Files That Now Import From classification.ts (replacing inline checks)

- `ShowcaseHero.tsx` — `getHeroImage(listing)` instead of `getAllImages(listing)[0]`
- `ShowcaseLayout.tsx` — `getHeroImage(listing)` for `usedImages` hero exclusion
- `ShowcaseDocumentation.tsx` — `isYuhinkaiCatalogImage()` + `classifyCatalogImage()` for oshigata/setsumei split
- `ShowcaseImageGallery.tsx` — `isYuhinkaiCatalogImage()` replaces inline domain string
- `KoshiraeSection.tsx` — `isYuhinkaiCatalogImage()` replaces inline domain check
- `ListingCard.tsx` — `getHeroImageIndex()` for thumbnail selection
- `ListingDetailClient.tsx` — `getHeroImageIndex()` for initial image viewer position

---

## Type Changes

`hero_image_index?: number | null` added to:

| Type | File |
|------|------|
| `Listing` | `src/types/index.ts` |
| `KoshiraeData` | `src/types/index.ts` |
| `ListingWithDealer` | `src/lib/listing/getListingDetail.ts` |
| `EnrichedListingDetail` | `src/lib/listing/getListingDetail.ts` |
| `DisplayItem` | `src/types/displayItem.ts` |
| `DealerListingInitialData` | `src/components/dealer/DealerListingForm.tsx` |
| `ListingInput` (fromListing mapper) | `src/lib/displayItem/fromListing.ts` |

---

## API Changes

| API | Change |
|-----|--------|
| Browse (`/api/browse`) | Added `hero_image_index` to SELECT |
| getListingDetail | Added to SELECT + return object |
| Artisan listings (`/api/artisan/[code]/listings`) | Added to SELECT |
| Dealer POST (`/api/dealer/listings`) | Accepts `hero_image_index` in body, sanitized |
| Dealer PATCH (`/api/dealer/listings/[id]`) | Added to `ALLOWED_FIELDS` + sanitization |
| `sanitizeKoshirae()` | Whitelists `hero_image_index` in koshirae JSONB |

---

## Display Integration

### ListingCard (browse thumbnail)

`getHeroImageIndex(listing)` resolves the hero index. The thumbnail selection logic tries the hero image first before falling back to the standard "first valid image" loop:

```typescript
const heroIdx = getHeroImageIndex(listing);
if (heroIdx < allImages.length) {
  const heroUrl = allImages[heroIdx];
  if (heroUrl && getCachedValidation(heroUrl) !== 'invalid' && !isRenderFailed(heroUrl)) {
    return heroUrl;
  }
}
// Fall back to first valid image...
```

### ListingDetailClient (image viewer)

`selectedImageIndex` initializes to `getHeroImageIndex(initialData)` so the viewer opens on the hero image:

```typescript
const [selectedImageIndex, setSelectedImageIndex] = useState(
  () => initialData ? getHeroImageIndex(initialData) : 0
);
```

### ShowcaseHero

Uses `getHeroImage(listing)` directly for the hero section image. The hero image is also added to `usedImages` in `ShowcaseLayout` so it's excluded from the masonry gallery.

### Smart Crop Cron

`getFirstImageUrl()` renamed to `getHeroCropImageUrl()`. Now reads `hero_image_index` from the listing and computes the focal point for the hero image (not necessarily `images[0]`):

```typescript
function getHeroCropImageUrl(listing: ListingRow): string | null {
  const idx = listing.hero_image_index;
  if (typeof idx === 'number' && idx >= 0) {
    if (idx < stored.length && stored[idx]) return stored[idx];
    if (idx < original.length && original[idx]) return original[idx];
  }
  // Fallback: first image
  ...
}
```

### ImageUploadZone (dealer form)

New props: `heroImageIndex`, `onHeroImageChange`. Thumbnail strip shows:
- **Gold ring** (`ring-2 ring-gold`) on the current cover image
- **Gold "Cover" label** bar at the bottom of the hero thumbnail
- **Star icon** (hover-visible) on non-hero thumbnails to change cover selection
- On image removal: resets hero if removed image was the hero, or adjusts index if a preceding image was removed

### ShowcaseDocumentation (catalog image split)

Pre-classifies all catalog images into oshigata vs setsumei using `classifyCatalogImage()`:
- **Setsumei page scans** — shown alongside setsumei text in the same DocumentCard (images column)
- **Oshigata diagrams** — shown as a standalone "Oshigata" DocumentCard
- **Combined (JuBun)** — grouped with oshigata
- **Standalone setsumei images** — only rendered as a separate card when no setsumei text exists (otherwise they're already in the setsumei card)

---

## Showcase Polish (commits e6216ee..37d5ae7)

### Vertical Sidebar Nav (replaces horizontal top bar)

`ShowcaseStickyBar` redesigned from a horizontal top bar to a fixed vertical sidebar index:
- **Position:** Left-aligned (`fixed left-8 top-1/2 -translate-y-1/2`), desktop only (`hidden lg:flex`)
- **Visual:** Thin vertical border line + section links. Active section in gold, others muted
- **Behavior:** Appears when `scrollY > 300`, IntersectionObserver tracks active section

### Hero Redesign (two-column layout)

`ShowcaseHero` changed from a full-bleed image/video hero to a two-column layout matching the artist page's museum-catalog aesthetic:
- **Left:** Image in `aspect-[3/4]` frame with cert caption below (tier color + session ordinal)
- **Right:** Gold accent bar → item type label → artisan name (linked to `/artists/[slug]`) → kanji → metadata grid (school, period, province, signature, measurements) → description
- **Mobile:** Title above image (single column), responsive metadata grid
- **Video:** Moved below Scholar's Note section (not in hero)

### Header Restoration

`ShowcaseLayout` was missing the site `<Header />` component — showcase pages had no navigation bar. Fixed by wrapping in `ListingDetailClient.tsx`:

```tsx
if (isShowcaseEligible(listing)) {
  return (
    <>
      <Header />
      <ShowcaseLayout listing={listing} />
    </>
  );
}
```

### Kanto Hibisho Image Upload 404 Fix

`kanto-hibisho-images/route.ts` returned 404 when `listing.kanto_hibisho` was null (user adds section, uploads image before saving the listing). Fixed: initialize empty `KantoHibishoData` instead of rejecting.

**Note from MEMORY.md:** This same pattern (image upload before parent JSONB is saved) was also fixed for koshirae images. Same bug may exist in `sayagaki-images` and `provenance-images` routes.

---

## Tests

- **30 new tests** in `tests/lib/images/classification.test.ts`:
  - `isYuhinkaiCatalogImage` (5): detects catalog URLs, rejects non-catalog
  - `classifyCatalogImage` (8): oshigata, setsumei, combined, unclassified Yuhinkai (→oshigata), non-Yuhinkai (→null)
  - `getHeroImage` (8): explicit valid/invalid/out-of-bounds index, null index, no images, empty images
  - `getHeroImageIndex` (5): valid/invalid/null index, no images
  - `getKoshiraeHeroImage` (4): explicit index, null index, no images
- **1 new test** in `tests/lib/dealer/sanitizeKoshirae.test.ts` — `hero_image_index` whitelisted
- All 4,952 tests pass (1 pre-existing failure in dealer-source-guard from curator-note route)
- Build passes cleanly

---

## Key Files

| Component | Location |
|-----------|----------|
| **Image classification** | `src/lib/images/classification.ts` |
| **Tests (30)** | `tests/lib/images/classification.test.ts` |
| **DB: hero_image_index** | `supabase/migrations/116_hero_image_index.sql` |
| **DB: invalidation** | `supabase/migrations/117_hero_image_invalidation.sql` |
| **ListingCard thumbnail** | `src/components/browse/ListingCard.tsx` |
| **Listing detail viewer** | `src/app/listing/[id]/ListingDetailClient.tsx` |
| **Showcase hero** | `src/components/showcase/ShowcaseHero.tsx` |
| **Showcase layout** | `src/components/showcase/ShowcaseLayout.tsx` |
| **Showcase documentation** | `src/components/showcase/ShowcaseDocumentation.tsx` |
| **Showcase sidebar** | `src/components/showcase/ShowcaseStickyBar.tsx` |
| **Showcase gallery** | `src/components/showcase/ShowcaseImageGallery.tsx` |
| **ImageUploadZone** | `src/components/collection/ImageUploadZone.tsx` |
| **Dealer form** | `src/components/dealer/DealerListingForm.tsx` |
| **Koshirae section** | `src/components/dealer/KoshiraeSection.tsx` |
| **Sanitizer** | `src/lib/dealer/sanitizeKoshirae.ts` |
| **Smart crop cron** | `src/app/api/cron/compute-focal-points/route.ts` |
| **fromListing mapper** | `src/lib/displayItem/fromListing.ts` |
| **Types** | `src/types/index.ts`, `src/types/displayItem.ts` |

---

## Prod Incident: "Listing not found" on Dealer Edit (2026-03-08)

**Symptom:** Clicking edit on any existing dealer listing showed "Listing not found" with a "Back to My Listings" link. All dealer edit operations broken.

**Root cause:** Commit `47004d1` added `hero_image_index` to the SELECT in `GET /api/dealer/listings/[id]` (line 39), but migration 116 had not been run on the production Supabase database. PostgREST returns an error when selecting a nonexistent column. The error was swallowed by the generic `if (error || !listing)` → 404 handler on line 45.

**Fix:** Run migration 116 (`ALTER TABLE listings ADD COLUMN hero_image_index INTEGER DEFAULT NULL`) on prod Supabase.

**Lesson — CRITICAL:** Code that SELECTs new columns must not be deployed before the migration is run. The same `hero_image_index` SELECT was also added to the browse API and artisan listings API — those may have also returned empty results silently (array queries don't hard-fail like `.single()` does, but the PostgREST error would still prevent any results from returning).

**Blast radius:** All three APIs that added `hero_image_index` to their SELECT were affected:
- `GET /api/dealer/listings/[id]` — hard 404 (`.single()` + error check)
- `GET /api/browse` — likely returned 0 results (error swallowed)
- `GET /api/artisan/[code]/listings` — likely returned 0 results (error swallowed)

**Prevention pattern:** Always run new column migrations on prod **before** deploying code that references them. Or: make new column SELECTs fail-safe by catching the error and falling back to a query without the new column.

---

## How to Use Hero Image Selection

### Currently Available: Dealer Form Only

The hero image selector is wired up in the dealer listing form (`/dealer/edit/[id]`):

1. Open a listing for editing
2. In the **image upload zone**, thumbnails appear in a horizontal strip
3. The current cover image shows a **gold ring** border and a **"Cover"** label
4. **Hover** over any other thumbnail to reveal a **star icon** (top-left)
5. **Click the star** to set that image as the new cover photo
6. The change is saved with the listing (included in the PATCH payload as `hero_image_index`)

The hero image is used in:
- **Browse grid** — ListingCard thumbnail shows the hero image
- **Listing detail** — Image viewer opens at the hero image index
- **Showcase layout** — ShowcaseHero displays the hero image
- **Smart crop** — Focal point is computed for the hero image (not always images[0])

### Not Yet Available

| Context | Status |
|---------|--------|
| **AdminEditView** (QuickView pen icon) | No hero picker — would allow setting cover on any listing including scraped ones |
| **Koshirae images** | `KoshiraeData.hero_image_index` is typed and sanitized but no UI surfaces it |
| **Standard listing detail page** | No admin controls for hero selection |

---

## Known Gaps / Future Work

| Item | Notes |
|------|-------|
| **Hero image selection in AdminEditView** | Would allow admins to set cover images on scraped listings (not just dealer-created). The API and DB already support it — just needs UI in `FieldEditSection` or a dedicated image picker. |
| **Koshirae hero image UI** | `KoshiraeData.hero_image_index` is typed and sanitized but no UI surfaces it yet. The `getKoshiraeHeroImage()` function is ready. |
| **Sayagaki/provenance image 404** | Same pre-save upload bug as kanto hibisho likely exists in sayagaki-images and provenance-images routes (init empty parent JSONB). |
| **Showcase CSS independence** | Session doc notes `.showcase` class with `--sc-*` vars, but current ShowcaseHero actually uses standard theme tokens (`text-ink`, `bg-surface-elevated`, `text-gold`). The `--sc-*` vars from Phase 1 are partially orphaned — components were rewritten to use standard theme. Consider removing `.showcase` CSS block or migrating remaining components. |
| **Migration-before-deploy guard** | No CI check prevents deploying code that SELECTs columns not yet in prod. Consider a pre-deploy migration check or making new column SELECTs fail-safe. |
