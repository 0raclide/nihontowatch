# QuickView Content Stream — Design Document

**Date:** 2026-03-09
**Status:** Draft — awaiting approval

---

## 1. Problem Statement

QuickView has a split-brain architecture:

- **Left panel**: Pure media scroller (images + videos). No text, no section context.
- **Right panel**: Pure text content (metadata, section display components, description).

This creates three problems:

1. **Section data is silently dropped** during `listingToDisplayItem()` mapping — koshirae, sayagaki, provenance, kiwame, kanto_hibisho are not in the DisplayItem type, so they're lost when dealer listings pass through the mapper.

2. **Browse listings never get section image groups** — `collectGroupedMedia()` only enables section grouping when `isDealerSource=true`. After the detail API loads section data for browse listings, those images are invisible in the left scroller.

3. **The architecture can't interleave media and text** — we want a single scrollable experience where images, videos, curator notes, and scholarly text flow together. The current two-column split makes this impossible.

---

## 2. Vision

A single **content stream** — one scrollable column of heterogeneous blocks — that serves as the primary viewing experience on both mobile and desktop.

**Content order** (tunable per listing characteristics):

```
1. Hero image
2. Curator's note (Scholar's Note — ai_curator_note_en/ja)
3. Video (first ready video)
4. Photos (remaining dealer/scraped images)
5. Kiwame text + origami image
6. Setsumei translation (NBTHK description)
7. Sayagaki/Hakogaki images + text
8. Koshirae images + attribution
9. Provenance timeline + images
10. Kanto Hibisho reference + page scans
```

The **right panel (desktop) / bottom sheet (mobile)** becomes a condensed **stats card**: measurements, artisan identity, certification, price, and a **section indicator row** showing what rich data this listing has. The indicators double as **scroll-to navigation** — tap "Koshirae" and the content stream scrolls to that section.

---

## 3. Constraints

### 3.1 Must not break browse experience

Browse listings (scraped from dealer websites) are the core product. Changes must be invisible to users who browse inventory:

- Browse API does NOT return section data (intentional — performance). Section data arrives asynchronously from the detail API (~200-500ms after QuickView opens).
- The content stream must handle **progressive enhancement**: show images immediately, then section blocks "pop in" when detail data arrives.
- `detailLoaded` flag already exists and works. Reuse it.

### 3.2 Must preserve the detail fetch pattern

- **Browse path**: openQuickView → show images immediately → async fetchFullListing → mergeDetailIntoListing → re-render with sections.
- **Dealer path**: openQuickView → show everything immediately (section data already in response) → no async fetch (public API rejects `source='dealer'` via RLS).
- **Collection path**: openQuickView → show collection-specific content → no async fetch.

### 3.3 Must work on mobile

Mobile currently has: full-screen image scroller + collapsible bottom sheet. The content stream **replaces** the image scroller entirely. The bottom sheet shrinks to a stats-only summary card.

### 3.4 Section display components must remain reusable

`SayagakiDisplay`, `KoshiraeDisplay`, `ProvenanceDisplay`, `KiwameDisplay`, `KantoHibishoDisplay`, `HakogakiDisplay` are used in:
- QuickViewContent (right panel — to be removed from here)
- QuickViewMobileSheet (expanded sheet — to be removed from here)
- ListingDetailClient (full listing page — keeps them)
- ShowcaseLayout (showcase page — keeps them)

We do NOT delete these components. We stop rendering them in the right panel/mobile sheet, and instead render them inline in the content stream.

---

## 4. Architecture

### 4.1 Content Stream Model

Replace `collectGroupedMedia()` with a new function that returns a stream of typed blocks:

```typescript
// src/lib/media/contentStream.ts

type ContentBlock =
  | { type: 'hero_image'; src: string }
  | { type: 'curator_note'; noteEn: string | null; noteJa: string | null }
  | { type: 'video'; streamUrl: string; thumbnailUrl?: string; duration?: number; status?: string; videoId?: string }
  | { type: 'image'; src: string; globalIndex: number }
  | { type: 'divider'; labelKey: string }
  | { type: 'kiwame'; data: KiwameEntry[] }
  | { type: 'setsumei'; textEn: string | null; textJa: string | null; metadata?: Record<string, unknown> | null }
  | { type: 'sayagaki'; data: SayagakiEntry[] }
  | { type: 'hakogaki'; data: HakogakiEntry[] }
  | { type: 'koshirae'; data: KoshiraeData; hideHeading: boolean }
  | { type: 'koshirae_images'; images: string[] }
  | { type: 'provenance'; data: ProvenanceEntry[] }
  | { type: 'provenance_images'; images: string[] }
  | { type: 'kanto_hibisho'; data: KantoHibishoData }
  | { type: 'kanto_hibisho_images'; images: string[] }
  | { type: 'description'; listing: Listing };

interface ContentStreamResult {
  blocks: ContentBlock[];
  /** Total image count (for progress bar) */
  imageCount: number;
  /** All image URLs in stream order (for lightbox navigation) */
  allImageUrls: string[];
  /** Section anchors present in this stream (for stats card navigation) */
  sections: SectionIndicator[];
}

interface SectionIndicator {
  id: string;           // DOM anchor id
  labelKey: string;     // i18n key
  icon?: string;        // optional icon identifier
}

function buildContentStream(
  displayImages: string[],
  listing: Listing | null,
  detailLoaded: boolean,
  videoItems: VideoMediaItem[],
): ContentStreamResult
```

### 4.2 Block Assembly Logic

The function builds blocks in priority order. Section blocks are only added when `detailLoaded === true` and the data exists. This preserves the browse progressive-enhancement pattern.

```
Always present:
  1. hero_image (displayImages[0], if exists)
  2. curator_note (if ai_curator_note_en or ai_curator_note_ja)
  3. video blocks (all ready videos)
  4. image blocks (remaining displayImages[1..n])

After detailLoaded === true:
  5. divider("Kiwame") + kiwame block (if listing.kiwame?.length)
  6. divider("Setsumei") + setsumei block (if listing.setsumei_text_en or _ja)
  7. divider("Sayagaki") + sayagaki block (if listing.sayagaki?.length)
  8. divider("Hakogaki") + hakogaki block (if listing.hakogaki?.length)
  9. divider("Koshirae") + koshirae block + koshirae_images (if listing.koshirae)
  10. divider("Provenance") + provenance block + provenance_images (if listing.provenance?.length)
  11. divider("Kanto Hibisho") + kanto_hibisho block + kanto_hibisho_images (if listing.kanto_hibisho)

Fallback (if no rich sections):
  12. description block (original listing description)
```

### 4.3 Source-Agnostic

The `isDealerSource` flag is removed. `buildContentStream` works identically for browse, dealer, and collection listings. The only gate is `detailLoaded`:

- **Browse**: `detailLoaded` starts `false`, becomes `true` after fetchFullListing. Section blocks appear after merge.
- **Dealer**: `detailLoaded` starts `true`. Section blocks appear immediately.
- **Collection**: `detailLoaded` starts `true`. No section data (collection items don't have sections currently).

### 4.4 Section Image Deduplication

Images that appear in section data (koshirae, sayagaki, provenance, etc.) are **deduplicated** against the primary image array. If an image URL exists in both `displayImages` and `listing.koshirae.images`, it appears only in the primary position (earlier in the stream). The `_images` blocks contain only images unique to that section.

### 4.5 Content Stream Rendering

QuickView's left panel (and mobile full-screen scroller) iterates over `blocks` and renders each by type:

```typescript
// In QuickView.tsx renderContentStream()
{blocks.map((block, i) => {
  switch (block.type) {
    case 'hero_image':
      return <LazyImage src={block.src} isFirst priority ... />;
    case 'curator_note':
      return <ShowcaseScholarNote noteEn={block.noteEn} noteJa={block.noteJa} />;
    case 'video':
      return <VideoGalleryItem streamUrl={block.streamUrl} ... />;
    case 'image':
      return <LazyImage src={block.src} index={block.globalIndex} ... />;
    case 'divider':
      return <MediaGroupDivider label={t(block.labelKey)} />;
    case 'kiwame':
      return <KiwameDisplay kiwame={block.data} />;
    case 'setsumei':
      return <SetsumeiBlock textEn={block.textEn} textJa={block.textJa} />;
    case 'sayagaki':
      return <SayagakiDisplay sayagaki={block.data} />;
    case 'koshirae':
      return <KoshiraeDisplay koshirae={block.data} hideHeading={block.hideHeading} />;
    case 'koshirae_images':
      return block.images.map(url => <LazyImage src={url} ... />);
    // ... etc
  }
})}
```

### 4.6 Right Panel → Stats Card

The right panel (desktop) and bottom sheet (mobile) are stripped down to:

```
┌─────────────────────────────┐
│  KATANA    TOKUBETSU JUYO   │  ← type + cert badge
│                             │
│  ⚔ Osafune Kanemitsu  ★    │  ← artisan identity (tappable → /artists)
│  Bizen Province · Nanbokucho│  ← school, province, era
│                             │
│  ¥3,800,000                 │  ← price
│  Aoi Art                    │  ← dealer name
│                             │
│  ─── Measurements ───       │
│  Nagasa 71.2cm  Sori 1.8cm  │  ← blade specs
│  Motohaba 3.1cm             │
│                             │
│  ─── This Listing Has ───   │
│  ● Koshirae  ● Sayagaki     │  ← section indicators (tappable)
│  ● Provenance  ● Setsumei   │
│  ● Kiwame                   │
│                             │
│  [ View on Dealer Site ]    │  ← CTA
│  [ I Own This ]             │
└─────────────────────────────┘
```

**Section indicators** are computed from `ContentStreamResult.sections`. Each is a tappable pill that scrolls the content stream to the corresponding `divider` block's DOM element.

### 4.7 Stats Card Bottom Sheet (Mobile)

The collapsed bottom sheet shows the essentials:
- Artisan identity (if matched) + cert badge
- Price
- Dealer name

The expanded bottom sheet shows the full stats card (measurements, section indicators, CTA).

Tap a section indicator → sheet collapses, content stream scrolls to target.

---

## 5. Component Changes

### 5.1 New Files

| File | Purpose |
|------|---------|
| `src/lib/media/contentStream.ts` | `buildContentStream()` — replaces `collectGroupedMedia()` |
| `src/components/listing/ContentStreamRenderer.tsx` | Switch-case renderer for ContentBlock[] |
| `src/components/listing/StatsCard.tsx` | Condensed metadata + section indicators |
| `src/components/listing/SectionIndicators.tsx` | Row of tappable section pills |
| `src/components/listing/SetsumeiBlock.tsx` | Inline setsumei text for content stream (extracted from QuickViewContent translation toggle) |

### 5.2 Modified Files

| File | Change |
|------|--------|
| `src/types/displayItem.ts` | Add section data fields (sayagaki, hakogaki, koshirae, provenance, kiwame, kanto_hibisho, ai_curator_note_en/ja) |
| `src/lib/displayItem/fromListing.ts` | Map section fields through (add to ListingInput + return object) |
| `src/components/listing/QuickView.tsx` | Replace `collectGroupedMedia` + `renderImageList` with `buildContentStream` + `ContentStreamRenderer`. Replace right-panel `QuickViewContent` with `StatsCard`. |
| `src/components/listing/QuickViewContent.tsx` | Gut: remove section display components (sayagaki, hakogaki, etc.), remove description, keep as thin wrapper for StatsCard or deprecate entirely |
| `src/components/listing/QuickViewMobileSheet.tsx` | Remove section display components from expanded view. Keep condensed header (artisan, price, dealer). Add section indicators. |
| `src/lib/media/groupedMedia.ts` | Deprecate (replaced by contentStream.ts). Keep for backward compat if ListingDetailClient still uses it. |

### 5.3 Unchanged Files

| File | Why |
|------|-----|
| `src/components/listing/SayagakiDisplay.tsx` | Rendered inside ContentStreamRenderer instead of QuickViewContent |
| `src/components/listing/KoshiraeDisplay.tsx` | Same — just changes render site |
| `src/components/listing/ProvenanceDisplay.tsx` | Same |
| `src/components/listing/KiwameDisplay.tsx` | Same |
| `src/components/listing/KantoHibishoDisplay.tsx` | Same |
| `src/components/listing/HakogakiDisplay.tsx` | Same |
| `src/app/listing/[id]/ListingDetailClient.tsx` | Separate page — not affected |
| `src/components/showcase/*` | Separate layout — not affected |
| `src/contexts/QuickViewContext.tsx` | No changes — mergeDetailIntoListing already handles sections |

---

## 6. Data Flow (After)

### Browse Listing

```
User clicks card in grid
  ↓
openQuickView(listing, { source: 'browse' })
  ↓
QuickView renders immediately:
  Left panel:  buildContentStream(images, listing, detailLoaded=false, videos)
               → [hero_image, images...] (no section blocks — detailLoaded is false)
  Right panel: StatsCard (type, cert, artisan, price, measurements, empty section indicators)
  ↓
fetchFullListing(id) resolves (~200-500ms)
  ↓
mergeDetailIntoListing() overlays section data
setDetailLoaded(true)
  ↓
QuickView re-renders:
  Left panel:  buildContentStream(images, listing, detailLoaded=true, videos)
               → [hero_image, curator_note?, videos, images, divider+kiwame?,
                  divider+setsumei?, divider+sayagaki?, divider+koshirae?,
                  divider+provenance?, divider+kanto_hibisho?]
  Right panel: StatsCard (section indicators now populated, tappable)
```

### Dealer Listing

```
User clicks card in dealer page
  ↓
openQuickView(listing, { source: 'dealer' })
  ↓
QuickView renders immediately:
  Left panel:  buildContentStream(images, listing, detailLoaded=true, videos)
               → Full content stream with all sections (data was in initial response)
  Right panel: StatsCard (all section indicators populated immediately)
```

---

## 7. Lightbox Strategy

Currently, each section display component manages its own lightbox state independently (5 separate `useState(lightboxUrl)` instances). This creates overlapping modals.

**New approach**: A single **LightboxContext** at the QuickView level. The `allImageUrls` array from `ContentStreamResult` provides the navigation order. Any image in the content stream (whether in the primary photos, koshirae section, or sayagaki section) opens the same lightbox, positioned at the correct index.

Section display components receive an `onImageClick(url)` prop instead of managing their own lightbox. This eliminates 5 duplicate lightbox implementations.

---

## 8. Section Indicator Design

The "This Listing Has" row in the stats card uses small pills:

```
● Koshirae  ● Sayagaki  ● Provenance  ● Setsumei  ● Kiwame
```

**Behavior**:
- **Before detailLoaded**: Show nothing (browse) or full set (dealer).
- **After detailLoaded**: Show indicators for sections that have data.
- **Tap**: Scroll content stream to `#section-{id}` anchor. On mobile, collapse the bottom sheet first.

**Styling**: `text-[10px] uppercase tracking-wider` pills with a gold dot prefix. Neutral bg, gold on hover/active.

---

## 9. Migration Path

### Phase 1: Fix the data pipeline (no visual changes)
1. Add section fields to `DisplayItem` type
2. Map them through in `listingToDisplayItem()`
3. Remove `isDealerSource` guard from `collectGroupedMedia()` (enable section groups for ALL sources)

This fixes the immediate bug (section data lost in mapping) without visual rearchitecture.

### Phase 2: Build the content stream
1. Create `buildContentStream()` in `src/lib/media/contentStream.ts`
2. Create `ContentStreamRenderer` component
3. Create `StatsCard` component
4. Create `SectionIndicators` component

### Phase 3: Integrate into QuickView
1. Replace `renderImageList()` with `ContentStreamRenderer`
2. Replace `QuickViewContent` right panel with `StatsCard`
3. Update `QuickViewMobileSheet` to use `StatsCard` layout
4. Add scroll-to-section behavior for indicator taps

### Phase 4: Polish
1. Consolidate lightbox into shared context
2. Tune section ordering per item type
3. Add scroll-spy to highlight active section indicator
4. Progressive enhancement animations (section blocks fade in when detail loads)

---

## 10. Testing Strategy

### Unit Tests

- `buildContentStream()`:
  - Browse listing with no section data → only images + videos
  - Dealer listing with full section data → all blocks present
  - Image deduplication across sections
  - Section ordering matches spec
  - `detailLoaded=false` suppresses section blocks
  - Empty sections omitted (no empty dividers)

- `StatsCard`:
  - Renders measurements, artisan, cert, price
  - Section indicators match available sections
  - Tap handler fires with correct section id

- `ContentStreamRenderer`:
  - Renders correct component per block type
  - LazyImage receives correct globalIndex
  - Dividers render between sections (not before first)

### Integration Tests

- Browse QuickView: opens → shows images → detail loads → sections appear in stream
- Dealer QuickView: opens → full stream rendered immediately
- Section indicator tap → scrolls to correct position
- Lightbox opens from any image in any section

### Regression Tests

- Browse grid + QuickView: no visual regression for listings without section data (majority of scraped listings)
- Mobile bottom sheet: collapsed height unchanged
- J/K navigation between listings: content stream resets correctly
- Deep link to listing: content stream renders after detail fetch

---

## 11. Performance Considerations

- **No new API calls.** Content stream assembles from data already fetched by existing browse + detail APIs.
- **Lazy rendering.** Images below the fold still use IntersectionObserver (`LazyImage`). Text blocks are lightweight.
- **Section blocks are conditional.** Most browse listings have zero section data — the content stream is just images + videos (identical to today).
- **No bundle size concern.** Section display components already exist and are already in the QuickView chunk. We're just moving where they render.

---

## 12. Postmortem Integration — `POSTMORTEM_DEALER_QUICKVIEW_SECTION_DATA.md`

This redesign permanently eliminates the class of bug documented in the 2026-03-09 postmortem. The root cause was:

1. `listingToDisplayItem()` is an **explicit field mapper** (~50 fields). Section JSONB fields were never listed → silently dropped.
2. Dealer page passed `DisplayItem as unknown as Listing` to QuickView → TypeScript couldn't warn about missing fields.
3. `collectGroupedMedia()` read `listing.provenance` → `undefined` → no section groups → listing 90396 showed 11/22 images.

**How the content stream prevents this:**

- **Phase 1 adds section fields to DisplayItem and the mapper.** Section data flows through the type system. The `as unknown as Listing` cast becomes structurally safe because DisplayItem now carries the same section fields. No more silent data loss.

- **`buildContentStream()` is source-agnostic.** There's no `isDealerSource` guard. The function checks `detailLoaded` and the listing's own section fields. If the data exists, it renders. If the mapper drops a field, the content stream simply has fewer blocks — but this is now visible in the type system (`DisplayItem.koshirae?: KoshiraeData | null`), not hidden behind a double-cast.

- **The "silent zero" anti-pattern is broken.** The postmortem identified this as the fourth instance of "silent zero" in the codebase (after `listing_views.created_at`, `activity_events.listing_id`, `admin_hidden` SELECT). The content stream's `SectionIndicator[]` output makes section presence explicitly visible — the stats card shows "This Listing Has: Koshirae, Sayagaki, Provenance" or shows nothing. Missing data produces a missing indicator, not a silently empty scroller.

**Regression test requirement:** Phase 3 must include a test that verifies: dealer listing with koshirae/sayagaki/provenance → QuickView content stream contains corresponding blocks. This is the test that was missing during the original incident.

---

## 13. What This Does NOT Change

- **Browse API response shape** — no new fields added to the browse endpoint
- **Detail API** — no changes
- **Dealer listings API** — no changes
- **ListingDetailClient** — full listing page keeps its own section rendering
- **ShowcaseLayout** — showcase page keeps its own architecture
- **ActivityTracker** — view/click/dwell tracking unchanged
- **Featured score computation** — unaffected
- **SEO** — listing page SEO unchanged (separate from QuickView)
