# Handoff: QuickView Content Stream

**Date:** 2026-03-09
**Status:** Deployed to production (`c62d268`), build passing, 63 new tests, 5000 existing tests green
**Phase A cleanup (2026-03-09):** SetsumeiBlock extracted, ImageLightbox shared, scroll-spy added, JSONB sanitizers completed. +41 new tests (5 scroll-spy + 36 sanitizer). 5000 existing tests green.
**Production fixes (2026-03-09):** Curator-note source guard allowlist. Section pill scroll-to bug (two fixes — see Post-Deploy Fixes).
**Catalog image classification (2026-03-09):** Yuhinkai catalog images (oshigata/setsumei scans) routed from main photo stream to section thumbnails. Koshirae photos promoted to full-width. Three iterations to fix stored-copy detection + hero selection + koshirae thumbnail placement. See Phase B below.
**Phase C — section text consistency (2026-03-09):** Removed nested scroll boxes (`max-h-[400px] overflow-y-auto`) and gold bordered card styling from setsumei blocks. All section text (setsumei, sayagaki, provenance, kiwame, etc.) now renders consistently as flowing text within the scrollable content stream.
**Design doc:** `docs/DESIGN_QUICKVIEW_CONTENT_STREAM.md`

---

## What Was Built

The QuickView for **dealer listings only** (`source === 'dealer'`) now uses a **content stream** — a single scrollable column that interleaves images, videos, curator notes, and scholarly text sections (setsumei, sayagaki, hakogaki, provenance, kiwame, koshirae, kanto hibisho). The right panel becomes a condensed **StatsCard** with section indicator pills that scroll to sections in the stream.

Browse and collection QuickViews are **completely unchanged** — same code path, same visual, zero conditional logic touched.

---

## Architecture

### Data Layer

`buildContentStream()` in `src/lib/media/contentStream.ts` — a **pure function** with no React dependencies. Takes `(displayImages, listing, detailLoaded, videoItems)` and returns typed `ContentStreamResult`:

```
ContentStreamResult {
  blocks: ContentBlock[]      // Ordered heterogeneous blocks
  imageCount: number          // For progress bar
  allImageUrls: string[]      // For unified lightbox navigation
  sections: SectionIndicator[] // For StatsCard section pills
}
```

**Block types:** `hero_image`, `curator_note`, `video`, `image`, `section_divider`, `setsumei`, `sayagaki`, `hakogaki`, `provenance`, `kiwame`, `koshirae`, `kanto_hibisho`.

**Image deduplication:** Section images (koshirae.images, sayagaki[].images, etc.) are collected into a `Set` and removed from the primary photos block. They appear in their section instead.

**Catalog image classification:** Yuhinkai catalog images (oshigata drawings, setsumei scans) from `listing.images[]` are detected via `isYuhinkaiCatalogImage()` and routed to the setsumei section as thumbnails instead of appearing as full-width photos. Stored copies (CDN copies in `listing-images/`) are mapped back to originals via filename index extraction (`/00.jpg` → index 0). Koshirae images are classified directly (they may contain catalog images not in `displayImages`). The hero image skips catalog images, picking the first real photo.

### Rendering Layer

- `ContentStreamRenderer` — switch-case maps `ContentBlock` → React components
- `LightboxProvider` / `useLightbox()` — wraps the content stream, all images share one `ShowcaseLightbox` (reused from showcase page)
- `StatsCard` — condensed right panel: type/cert, artisan identity, price, dealer, MetadataGrid, section indicators, CTA
- `SectionIndicators` — tappable gold-dot pills that call `onSectionClick(sectionId)` → smooth scrolls to `#stream-{section}` DOM element

### Integration in QuickView.tsx

Conditional branching: `isDealer && contentStreamResult ? (stream path) : (existing path)`. The `contentStreamResult` useMemo sits before the `if (!currentListing) return null` early return (React hooks rule).

**Desktop:** Left panel `w-[65%]` with `LightboxProvider` + `ContentStreamRenderer`. Right panel `w-[35%] max-w-sm` with `StatsCard`.

**Mobile:** Content stream replaces the image scroller (no `onClick={toggleSheet}` — stream has interactive elements). Bottom sheet gets `variant="stats"` — section displays omitted, section indicator pills added.

---

## File Inventory

### New files (6 original + 5 Phase A)
| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/media/contentStream.ts` | ~220 | Pure data function + types |
| `src/contexts/LightboxContext.tsx` | ~65 | Unified lightbox state wrapping ShowcaseLightbox |
| `src/components/listing/ContentStreamRenderer.tsx` | ~140 | Block → component switch renderer (SetsumeiBlock extracted) |
| `src/components/listing/SectionIndicators.tsx` | ~40 | Tappable section pill row with scroll-spy highlighting |
| `src/components/listing/StatsCard.tsx` | ~200 | Condensed metadata panel |
| `tests/lib/media/contentStream.test.ts` | ~370 | 22 unit tests (12 original + 10 catalog classification) |
| `src/components/listing/SetsumeiBlock.tsx` | ~65 | Extracted setsumei text + translation toggle + catalog thumbnails (Phase A; Phase C removed bordered card) |
| `src/components/ui/ImageLightbox.tsx` | ~40 | Shared full-screen image lightbox overlay (Phase A) |
| `src/hooks/useScrollSpy.ts` | ~60 | IntersectionObserver-based scroll-spy hook (Phase A) |
| `src/lib/dealer/sanitizeSections.ts` | ~160 | Sanitizers for 4 JSONB section fields (Phase A) |
| `tests/hooks/useScrollSpy.test.ts` | ~120 | 5 scroll-spy tests (Phase A) |
| `tests/lib/dealer/sanitizeSections.test.ts` | ~240 | 36 sanitizer tests (Phase A) |

### Modified files (12 original + Phase A changes)
| File | Change |
|------|--------|
| `src/types/index.ts` | `ai_curator_note_en/ja` on Listing |
| `src/contexts/QuickViewContext.tsx` | Merge curator notes in `mergeDetailIntoListing()` |
| `src/app/api/dealer/listings/route.ts` | `ai_curator_note_en/ja` in SELECT; **Phase A: inline JSONB sanitization → sanitizeSections calls** |
| `src/app/api/dealer/listings/[id]/route.ts` | Same; **Phase A: PATCH now sanitizes all 5 JSONB fields (was only koshirae)** |
| `src/components/listing/SayagakiDisplay.tsx` | `onImageClick` prop; **Phase A: lightbox JSX → `<ImageLightbox>`** |
| `src/components/listing/HakogakiDisplay.tsx` | Same |
| `src/components/listing/KoshiraeDisplay.tsx` | Same; **Phase C: removed bordered card + nested scroll from KoshiraeSetsumei sub-component** |
| `src/components/listing/ProvenanceDisplay.tsx` | Same |
| `src/components/listing/KantoHibishoDisplay.tsx` | Same |
| `src/components/listing/QuickView.tsx` | Conditional content stream path; **Phase A: `useScrollSpy` hook, `activeSection` threaded to StatsCard + MobileSheet** |
| `src/components/listing/QuickViewMobileSheet.tsx` | `variant="stats"` mode; **Phase A: `activeSection` prop threaded to SectionIndicators** |
| `src/i18n/locales/{en,ja}.json` | 2 new keys each |

---

## What I'd Design Differently

### 1. QuickView.tsx is too big — should have been split before this work

QuickView.tsx was already ~700 lines before this change. Adding the content stream branch pushed it further. The right approach would have been to **extract the three source-specific layouts into separate components** first:

```
QuickView.tsx (orchestrator — hooks, state, keyboard nav)
  ├── DealerQuickViewLayout.tsx     ← content stream + StatsCard
  ├── BrowseQuickViewLayout.tsx     ← image scroller + QuickViewContent
  └── CollectionQuickViewLayout.tsx ← collection form / view modes
```

Each layout would receive the shared state (visibleImages, handleScroll, etc.) as props. The conditional branching in the JSX (`isDealer ? ... : isCollection ? ... : ...`) currently makes it hard to reason about which code runs for which source. Layout extraction would make each path self-contained and independently testable.

**Why I didn't do it:** The plan explicitly said "integrate into QuickView.tsx" with conditional branching. Splitting first would have been a larger scope change that risks more regressions. But it's the right next step.

### 2. Dual rendering paths create maintenance burden

The content stream and the grouped media scroller are two parallel rendering paths that must stay in sync for shared concerns (lazy loading, pinch zoom, progress bar, J/K navigation). Right now they share the same hooks (handleImageVisible, handleScroll, etc.) but the wiring is duplicated in JSX. If a bug is found in image loading, it might need to be fixed in both paths.

**Better design:** A single `<MediaPanel>` component that accepts either `ContentStreamResult` or `GroupedMediaResult` and handles all the shared plumbing internally. The caller just passes the data model. This would eliminate the duplicated sold-banner, progress bar, and scroll container setup.

### 3. `collectGroupedMedia` should be deprecated, not kept alongside `buildContentStream`

Both functions do similar work (collecting images, deduplicating, ordering). `collectGroupedMedia` produces `FlatMediaItem[]` with group boundaries; `buildContentStream` produces `ContentBlock[]` with rich section data. The browse path still uses `collectGroupedMedia`. Ideally, browse should also use `buildContentStream` — just with `detailLoaded=false` it produces the same hero+photos output. This would let us delete `collectGroupedMedia` entirely and have one code path.

**Why I kept it:** The plan scoped this to dealer-only. Changing browse to use `buildContentStream` would require verifying it doesn't break the existing image scroller behavior (which uses `flatItems` with `isFirstInGroup`/`isFirstGroup` flags that the content stream doesn't produce). Safe but needs a separate session.

### 4. ~~The SetsumeiBlock is inlined in ContentStreamRenderer — should be extracted~~ DONE (2026-03-09)

Extracted to `src/components/listing/SetsumeiBlock.tsx`. ContentStreamRenderer now imports it. No tests needed — presentational, API unchanged.

### 5. ~~Section indicator scroll-to doesn't have scroll-spy feedback~~ DONE (2026-03-09)

Implemented via `useScrollSpy` hook (`src/hooks/useScrollSpy.ts`) using IntersectionObserver with `rootMargin: '-20% 0px -60% 0px'` (active zone = upper 40%). Active pill gets filled gold dot, semibold text, and subtle bg tint. Threaded through `QuickView → StatsCard → SectionIndicators` (desktop) and `QuickView → QuickViewMobileSheet → SectionIndicators` (mobile). Both desktop and mobile scroll containers have independent observers. 5 tests in `tests/hooks/useScrollSpy.test.ts`.

### 6. ~~`onImageClick` prop approach works but is inelegant~~ PARTIALLY ADDRESSED (2026-03-09)

The 5 section display components still each have `useState(lightboxUrl)` for their fallback lightbox, but the ~25 lines of identical lightbox JSX (fixed overlay, close button, Image) has been extracted to a shared `ImageLightbox` component (`src/components/ui/ImageLightbox.tsx`). Each component now renders `<ImageLightbox imageUrl={!onImageClick ? lightboxUrl : null} onClose={...} />` — ~100 lines deleted, ~30 added. The `onImageClick` optional prop contract is preserved for all consumers. The remaining cleanup (removing internal lightbox state entirely by always using LightboxContext) is still a valid future improvement but is more invasive.

---

## Known Gaps

1. ~~**No scroll-spy** on section indicators~~ DONE (2026-03-09)
2. **No fade-in animation** when section blocks appear after `detailLoaded` toggles true (browse path — not relevant for dealer since `detailLoaded` is always true)
3. **ShowcaseScholarNote max-width** — the curator note component has `max-w-[960px]` designed for the showcase page's full-width layout. In the 65% content stream panel, this is fine, but on very small screens it could look off. May need a `compact` variant.
4. ~~**Pre-existing test failure** — `tests/lib/dealer-source-guard.test.ts` flags `src/app/api/listing/[id]/curator-note/route.ts` as missing a dealer source guard.~~ FIXED (2026-03-09) — Added to `KNOWN_SAFE_FILES` allowlist. POST is admin-only (`verifyAdmin`), GET returns only AI text (not listing data), and the dealer content stream calls GET for dealer listings.

---

## Post-Deploy Fixes (2026-03-09)

### Fix 1: Section pill scroll targeted hidden container (`08ba65e`)

**Symptom:** Clicking section indicator pills did nothing on mobile.

**Root cause:** `scrollToSection` used `scrollContainerRef.current || mobileScrollContainerRef.current`. Both refs are always assigned (desktop and mobile layouts are both rendered, one hidden via CSS class). On mobile, `scrollContainerRef.current` was truthy (a `display: none` element), so the `||` fallback never fired.

**Fix:** Check `clientHeight > 0` to pick the actually visible container.

### Fix 2: Duplicate DOM IDs across layouts (`77e6e16`)

**Symptom:** Section pills scrolled "up slightly" instead of to the section (desktop and mobile).

**Root cause:** Both mobile (`lg:hidden`) and desktop (`hidden lg:flex`) layouts render `ContentStreamRenderer` with the same blocks, creating duplicate DOM IDs (e.g., two `id="stream-setsumei"` elements). `document.getElementById()` always returned the first one in DOM order (the mobile element). On desktop, this element was inside a `display: none` parent, so `getBoundingClientRect()` returned zeros — scroll offset calculated as near-zero.

**Fix:** Changed `document.getElementById(sectionId)` → `container.querySelector('#' + sectionId)` to scope the search to the visible container's subtree.

**Lesson:** When mobile and desktop layouts both render the same component tree (one hidden via CSS), never use `document.getElementById()` — IDs will be duplicated. Always scope queries to the relevant container via `container.querySelector()`.

---

## Phase B: Catalog Image Classification (2026-03-09)

### Problem

Listing 90396 (dual Juyo — blade + koshirae) exposed two image routing problems in the content stream:

1. **Yuhinkai catalog images appeared as full-width photos** — oshigata drawings and setsumei page scans from catalog prefill were rendering in the main photo stream instead of as documentation thumbnails.
2. **Koshirae section mixed photo sizes** — real koshirae photos (should be full-width) rendered as 64×64 thumbnails alongside catalog oshigata drawings.

### Solution

Import `isYuhinkaiCatalogImage()` and `classifyCatalogImage()` from `src/lib/images/classification.ts` into `contentStream.ts`. Classify all images and route them:

- **Catalog images from `displayImages`** → excluded from photo blocks, routed to setsumei section as thumbnails
- **Non-catalog koshirae photos** → promoted to full-width `image` blocks after the koshirae divider
- **Catalog images in `koshirae.images[]`** → stay as thumbnails in KoshiraeDisplay
- **Hero image** → skips catalog images, picks the first real photo

### Three Iterations (Production Hotfixes)

**Commit `017f2ea` — initial implementation:** Scanned `displayImages` for catalog URLs. Worked for direct Yuhinkai URLs but missed two edge cases.

**Commit `314003e` — stored copy detection:** `getAllImages()` replaces catalog originals with stored CDN copies (`listing-images/...`). These lack the Yuhinkai domain, so classification missed them. Also: koshirae catalog images exist only in `koshirae.images[]` (not in `displayImages`), so `catalog.allUrls.has()` filtering dropped them entirely. Fix: scan `listing.images[]` (originals) for catalog URLs; use `isYuhinkaiCatalogImage()` directly for koshirae.

**Commit `c62d268` — index mapping fix:** `displayImages` is REORDERED by hero selection (hero moved to index 0). Index-based mapping `listing.images[i] ↔ displayImages[i]` was wrong — it was marking the hero (a real photo) as catalog. Fix: extract original index from stored image filenames (`/00.jpg` → index 0) and cross-check against catalog positions. Also: moved koshirae catalog thumbnails to after zufu commentary text (consistent with blade setsumei).

### Key Lessons

1. **`displayImages` ≠ `listing.images[]`**: `getAllImages()` merges stored copies, then hero selection reorders. Never assume index correspondence.
2. **Stored images lose classification signals**: Stored copies at `listing-images/{shop}/L{id}/{NN}.{ext}` don't contain the original filename patterns (`_oshigata.`, `_setsumei.`). Must map back to originals via the index in the filename.
3. **Section-specific images may not be in `displayImages`**: Koshirae has its own Juyo record with catalog images that never appear in the main `images[]` array. Use `isYuhinkaiCatalogImage()` directly, not set membership.

### Files Changed (Phase B)

| File | Change |
|------|--------|
| `src/lib/media/contentStream.ts` | Catalog classification, stored-copy detection, hero skip, koshirae image split |
| `src/components/listing/SetsumeiBlock.tsx` | `imageUrl: string \| null` → `images: string[]` (multiple thumbnails) |
| `src/components/listing/ContentStreamRenderer.tsx` | Pass `images` array to SetsumeiBlock |
| `src/components/listing/KoshiraeDisplay.tsx` | Thumbnails moved after zufu commentary (consistent with blade) |
| `tests/lib/media/contentStream.test.ts` | +10 tests for catalog classification, stored copies, hero skip |

### Stream Order (After Phase B)

```
HERO IMAGE (first non-catalog photo, full-width)
CURATOR'S NOTE
VIDEOS
PHOTOS (full-width, catalog images excluded)
─── SETSUMEI ───
  [setsumei text with translation toggle]
  [blade oshigata + setsumei thumbnails]
─── SAYAGAKI ───
  ...
─── KOSHIRAE (拵) ───
  [full-width koshirae photos]
  [koshirae metadata: cert, era, maker]
  [koshirae zufu commentary text]
  [koshirae oshigata + setsumei thumbnails]
─── PROVENANCE ───
  ...
```

---

## Testing Checklist

- [x] `npm run build` passes
- [x] 12 new `contentStream.test.ts` tests pass
- [x] All 34 existing `groupedMedia.test.ts` tests pass (regression)
- [x] 5000+ total tests pass
- [ ] Manual: Dealer page → click listing with rich data → content stream renders
- [ ] Manual: Click image in any section → unified lightbox, prev/next across all images
- [x] Manual: Click section indicator → stream scrolls to section (fixed `77e6e16`)
- [ ] Manual: Browse page → QuickView unchanged
- [ ] Manual: Mobile dealer → content stream + stats sheet
- [ ] Manual: J/K nav → stream resets scroll position

### Phase A (2026-03-09)

- [x] `npm run build` passes after all 3 steps
- [x] 5 new `useScrollSpy.test.ts` tests pass
- [x] 36 new `sanitizeSections.test.ts` tests pass
- [x] 5000 existing tests green
- [ ] Manual: Dealer QuickView → section indicator pills highlight as user scrolls through sections
- [ ] Manual: Browse QuickView → section displays still have working fallback lightboxes (no onImageClick)
- [ ] Manual: Listing detail page → section display lightboxes still work
- [ ] Manual: Mobile dealer → stats sheet section pills highlight on scroll

### Phase B (2026-03-09)

- [x] `npm run build` passes
- [x] 22 `contentStream.test.ts` tests pass (12 original + 10 catalog)
- [x] Manual: Listing 90396 — oshigata/setsumei scans not in main photo stream
- [x] Manual: Listing 90396 — setsumei section shows blade oshigata+setsumei thumbnails
- [x] Manual: Listing 90396 — koshirae photos are full-width, catalog thumbnails after zufu text
- [x] Manual: Listing 90396 — hero is a dealer photo, not catalog scan
- [x] Manual: Stored image copies correctly detected as catalog via filename index

### Phase C (2026-03-09) — Section Text Consistency

Three commits (`230da94`, `b078077`, `36fb50f`):

1. **Removed nested scroll** from SetsumeiBlock (`max-h-[400px] overflow-y-auto` → natural flow)
2. **Removed nested scroll** from KoshiraeSetsumei in KoshiraeDisplay (`max-h-[300px] overflow-y-auto` → natural flow)
3. **Removed gold bordered card** (`rounded-lg border border-gold/20 bg-gold/5`) from both setsumei components — all section text now renders consistently (plain text with translation toggle, no card wrapper)

- [x] Manual: Setsumei text flows naturally in content stream (no scroll-within-scroll)
- [x] Manual: Koshirae zufu commentary text flows naturally (no scroll-within-scroll)
- [x] Manual: All section text visually consistent (no bordered card on setsumei vs plain text on sayagaki/provenance)
