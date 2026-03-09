# Showcase Layout — Phase 1 Session Handoff

**Date:** 2026-03-08
**Commit:** `8ad760e` on `main`
**Status:** Deployed to prod (Vercel auto-deploy)
**Test listing:** https://nihontowatch.com/listing/90396 (Hoshizukiyo-Masamune, status=INVENTORY, requires admin)

---

## What Was Built

An immersive, dark-themed museum-grade layout that automatically activates for listings with rich data. When a listing crosses a richness threshold (≥3 images AND ≥2 rich data sections), the `/listing/[id]` page dynamically upgrades from the standard light layout to a full-bleed showcase experience.

### Section Flow

```
Hero (video autoplay or full-bleed image)
    ↓
Identity Card (museum placard — type, artisan, measurements, cert)
    ↓
Scholar's Note (AI-generated curator's note — Phase 2b complete)
    ↓
Documentation (setsumei, sayagaki, hakogaki, oshigata — side-by-side)
    ↓
Provenance (horizontal timeline desktop, vertical mobile) + Kiwame
    ↓
Mountings (koshirae images, cert badge, maker attributions)
    ↓
Gallery (masonry grid of remaining images)
```

A sticky section nav bar appears on desktop after scrolling past the hero, showing the artisan name + cert abbreviation and jump links to each section.

---

## Architecture

### Eligibility Decision

```
ListingDetailClient.tsx
    ↓
isShowcaseEligible(listing)         ← src/lib/listing/showcase.ts
    ├─ showcase_override === true   → ALWAYS showcase
    ├─ showcase_override === false  → NEVER showcase
    └─ showcase_override === null   → AUTO:
         ├─ getAllImages(listing).length ≥ 3
         └─ countRichSections(listing) ≥ 2
    ↓
<ShowcaseLayout />                  ← dynamic import, replaces entire page
```

### Rich Section Count

`countRichSections()` counts each of these independently (max 8):

| Section | Condition |
|---------|-----------|
| Setsumei | `setsumei_text_en` or `setsumei_text_ja` exists |
| Sayagaki | `sayagaki[]` non-empty |
| Hakogaki | `hakogaki[]` non-empty |
| Provenance | `provenance[]` non-empty |
| Kiwame | `kiwame[]` non-empty |
| Koshirae | Has artisan_id, components, cert_type, or images |
| Kanto Hibisho | `kanto_hibisho` exists |
| Video | `videos[]` non-empty |

Empty koshirae (no artisan, no components, no cert, no images) is NOT counted.

### CSS Isolation

The showcase uses its own CSS custom properties under the `.showcase` class, completely independent of the site's theme system (light/dark/opus/classic):

```css
.showcase {
  --sc-bg-primary: #0f0f0f;
  --sc-bg-card: #1a1917;
  --sc-bg-document: #f5f0e8;      /* Warm parchment for document text */
  --sc-text-primary: #e8e4dc;
  --sc-text-secondary: #9a9590;
  --sc-accent-gold: #c4a35a;
  --sc-border: #2a2825;
  --sc-divider: #3a3632;
  --sc-tokuju / --sc-jubi / --sc-juyo / --sc-tokuho / --sc-hozon  /* Cert colors */
}
```

This means the showcase always renders in its own dark palette regardless of user theme preference.

### Image Deduplication

The `ShowcaseLayout` orchestrator computes a `usedImages: Set<string>` containing URLs from setsumei, sayagaki, hakogaki, provenance, koshirae, and kanto hibisho sections. The `ShowcaseImageGallery` excludes these + any Yuhinkai catalog images (`itbhfhyptogxcjbjfzwx.supabase.co` domain), so the masonry gallery only shows "regular" listing photos.

---

## File Inventory

### New Files (16)

| File | Purpose |
|------|---------|
| `supabase/migrations/115_showcase_columns.sql` | DB: `showcase_override`, `ai_curator_note_en/ja/generated_at/input_hash` |
| `src/lib/listing/showcase.ts` | `isShowcaseEligible()`, `countRichSections()` |
| `src/components/showcase/ShowcaseLayout.tsx` | Orchestrator — assembles sections, manages lightbox, computes used images |
| `src/components/showcase/ShowcaseSection.tsx` | Animated wrapper — IntersectionObserver fade-in, gold rule + section header |
| `src/components/showcase/ShowcaseHero.tsx` | Full-bleed hero — muted autoplay video or image, vignette, attribution text |
| `src/components/showcase/ShowcaseIdentityCard.tsx` | Museum placard — item type, artisan (with artist page link), measurements, mei, cert |
| `src/components/showcase/ShowcaseCuratorNotePlaceholder.tsx` | `ShowcaseScholarNote` — renders AI curator's note with translation toggle (Phase 2b) |
| `src/components/showcase/ShowcaseDocumentation.tsx` | Side-by-side document viewer (60% image / 40% parchment text card) |
| `src/components/showcase/ShowcaseTimeline.tsx` | Horizontal (desktop) / vertical (mobile) provenance timeline + kiwame cards |
| `src/components/showcase/ShowcaseKoshirae.tsx` | Mountings — images, cert badge, single/multi maker attributions |
| `src/components/showcase/ShowcaseImageGallery.tsx` | CSS columns masonry (3-col desktop, 2-col mobile), excludes used images |
| `src/components/showcase/ShowcaseStickyBar.tsx` | Sticky top nav after hero scroll (desktop only), IntersectionObserver active section |
| `src/components/showcase/ShowcaseLightbox.tsx` | Full-screen portal viewer — prev/next arrows, keyboard nav, escape to close |
| `tests/lib/listing/showcase.test.ts` | 17 tests — `countRichSections` (9) + `isShowcaseEligible` (8) |

### Modified Files (3)

| File | Change |
|------|--------|
| `src/app/globals.css` | Added `.showcase { --sc-* }` CSS custom properties block (26 lines, after theme-classic) |
| `src/app/listing/[id]/ListingDetailClient.tsx` | Added dynamic import of `ShowcaseLayout` + `isShowcaseEligible()` branch before standard render |
| `src/lib/listing/getListingDetail.ts` | Added `showcase_override` to SELECT, `ListingWithDealer`, and `EnrichedListingDetail`. Added `artisan_name_kanji` to `EnrichedListingDetail` (was spread but missing from interface). |

---

## DB Migration (115)

```sql
ALTER TABLE listings ADD COLUMN IF NOT EXISTS showcase_override BOOLEAN DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_curator_note_en TEXT DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_curator_note_ja TEXT DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_curator_note_generated_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_curator_note_input_hash TEXT DEFAULT NULL;
```

**Must be run manually** against the Supabase DB before `showcase_override` works. Without migration, the column returns `null` which is fine — auto eligibility logic still runs. Force-enable with:

```sql
UPDATE listings SET showcase_override = true WHERE id = 90396;
```

---

## Reused Existing Code

| What | From | Used By |
|------|------|---------|
| `VideoPlayer` | `src/components/video/VideoPlayer.tsx` | ShowcaseHero (autoPlay, muted, loop, controls=false) |
| `getAttributionName()` / `getAttributionSchool()` | `src/lib/listing/attribution.ts` | ShowcaseHero, ShowcaseIdentityCard |
| `getValidatedCertInfo()` | `src/lib/cert/validation.ts` | ShowcaseHero, ShowcaseIdentityCard, ShowcaseStickyBar |
| `generateArtisanSlug()` | `src/lib/artisan/slugs.ts` | ShowcaseIdentityCard, ShowcaseKoshirae |
| `getAllImages()` | `src/lib/images.ts` | ShowcaseLayout, ShowcaseHero, showcase.ts |
| `useValidatedImages()` | `src/hooks/useValidatedImages.ts` | ShowcaseLayout |
| IntersectionObserver pattern | `SectionJumpNav.tsx` | ShowcaseSection (fade-in), ShowcaseStickyBar (active section) |
| Portal lightbox pattern | `CatalogueShowcase.tsx` | ShowcaseLightbox |
| `CERT_LABELS` tier colors | `src/lib/cert/validation.ts` | ShowcaseIdentityCard, ShowcaseKoshirae |

---

## Component Design Patterns

### ShowcaseSection (animated wrapper)

Every content section is wrapped in `<ShowcaseSection id="..." title="..." titleJa="...">`. It:
1. Uses IntersectionObserver (`threshold: 0.15`) for one-shot fade-in
2. Transitions from `opacity-0 translate-y-6` → `opacity-100 translate-y-0` (700ms ease-out)
3. Once visible, stays visible (observer disconnects after triggering)
4. Optional gold rule divider + small-caps bilingual header

### ShowcaseDocumentation (DocumentCard pattern)

Each document type (setsumei, sayagaki, hakogaki, oshigata) renders as a `DocumentCard`:
- **Desktop**: 5-column grid — 3 cols image, 2 cols parchment text card
- **Mobile**: stacked (image above text)
- **Parchment card**: `bg-[var(--sc-bg-document)]` (#f5f0e8) — warm contrast against dark gallery
- **Translation toggle**: If both `text` and `textAlt` exist, toggle button switches between them
- Images are clickable → opens lightbox

### ShowcaseTimeline (responsive timeline)

- **Desktop**: Horizontal left-to-right timeline. Flex layout with dots on a 2px rule line. Gold dots when provenance images exist, gray otherwise.
- **Mobile**: Vertical timeline with left-aligned dots and padding.
- Arrow connectors between desktop nodes (except last).
- Kiwame appraisals appear below as a separate "Expert Appraisals" sub-section with type badges.

### ShowcaseStickyBar (scroll-aware nav)

- Appears when `scrollY > 70vh` (past the hero)
- Disappears above with `opacity-0 -translate-y-full`
- Uses backdrop-blur for readability
- Active section tracked via IntersectionObserver (`rootMargin: '-80px 0px -60% 0px'`)
- **Desktop only** — hidden on mobile where linear scroll serves as navigation

---

## Type Fix: `artisan_name_kanji` on `EnrichedListingDetail`

The `getListingDetail()` function conditionally spreads `artisan_name_kanji` into its return object (line 459), but the `EnrichedListingDetail` interface did not declare the field. This caused `tsc` errors when ShowcaseHero and ShowcaseIdentityCard referenced it. Fixed by adding `artisan_name_kanji?: string` to the interface. This was a pre-existing gap — the field was always present at runtime for artisans with kanji names.

---

## What's NOT in Phase 1 (Deferred)

| Item | Notes |
|------|-------|
| ~~**Curator's Note AI generation**~~ | **DONE (Phase 2b).** Display component renders notes from DB. Prompt tuned for evaluative quoting, koshirae paragraph, kiwame attribution shifts. See `docs/SESSION_20260308_SCHOLARS_NOTE_DISPLAY.md`. |
| **Dealer / Price / Inquire section** | Pure museum display — no commercial elements. Add when showcase goes public. |
| **`showcase_override` admin toggle UI** | Currently SQL-only. Needs toggle in AdminEditView. |
| **QuickView "View Exhibit" CTA** | Needs decision on public visibility first. |
| **OG image enhancement** | Custom social card for showcase listings. |
| **`generateMetadata()` enhancement** | Showcase-specific title/description for SEO. |
| **Print stylesheet** | Future — museum-quality print layout. |
| **Mobile swipe gestures in lightbox** | Uses tap navigation for now. |
| **i18n** | All labels are English-only. Should use `t()` when feature goes public. |

---

## Verification Checklist

1. **Run migration 115** against Supabase prod
2. **Force-enable** for test listing: `UPDATE listings SET showcase_override = true WHERE id = 90396`
3. Visit https://nihontowatch.com/listing/90396 as admin
4. Verify:
   - [ ] Dark theme renders, no light-mode bleed-through
   - [ ] Hero shows video (muted autoplay) or image
   - [ ] Identity card: Wakizashi, Kenchō, measurements, Juyo 32nd
   - [ ] Scholar's Note placeholder visible
   - [ ] Documentation: setsumei (32nd session) + sayagaki (Tanobe) side-by-side
   - [ ] Provenance timeline: 5 entries chronological
   - [ ] Kiwame: Hon'ami origami
   - [ ] Koshirae: Juyo 59th + Hagiya Katsuhira
   - [ ] Gallery: masonry grid, no duplicate images
   - [ ] Sticky bar appears on desktop scroll
   - [ ] Lightbox opens on image click (keyboard nav: ← → Esc)
   - [ ] Mobile: sections stack correctly, sticky bar hidden
5. Visit any standard listing → should render normal layout (not showcase)
6. `npx vitest run tests/lib/listing/showcase.test.ts` → 17/17 pass

---

## Tests

17 tests in `tests/lib/listing/showcase.test.ts`:

**countRichSections (9):**
- Bare listing → 0
- Setsumei → 1
- Sayagaki → 1
- Provenance → 1
- Kiwame → 1
- Koshirae with cert → 1
- Empty koshirae → 0
- Video → 1
- Kanto Hibisho → 1
- Multiple sections → 4

**isShowcaseEligible (8):**
- Bare listing → false
- Images < 3 with rich sections → false
- Rich sections < 2 with many images → false
- Both thresholds met → true
- `showcase_override = true` → always true
- `showcase_override = false` → always false
- `showcase_override = null` → uses auto logic
