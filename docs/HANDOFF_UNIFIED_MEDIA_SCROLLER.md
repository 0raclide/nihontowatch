# Handoff: Unified Media Scroller — QuickView Narrative Scroll

> **Date**: 2026-03-09
> **Commits**: `85b3550` (v1 grouped sections), `939cb06` (reorder + inline video + catalog split), `d080d7e` (section catalog filter), `11db43c` (dealer QuickView section data)
> **Status**: Phase 1 deployed. Phase 2 (inline text blocks) designed, not started.

---

## What This Is

QuickView's vertical image scroller presents **all listing media in a single intentional narrative scroll** — hero image, inline videos, item photos, section images grouped by type, and NBTHK documentation pushed to the end. Catalog images (oshigata/setsumei from Yuhinkai) are automatically identified and separated from dealer photos.

Phase 2 will evolve the scroller into a **museum catalog experience** by interleaving text blocks with their associated images — setsumei text paired with its page scan, sayagaki inscription text alongside the calligraphy photo.

---

## Current State (Phase 1)

### Scroll Order

```
1. Hero image (cover photo)
2. Videos (inline — same scroll flow as images)
3. Remaining sword/item photos
4. ── Koshirae ──────────────── (dealer koshirae photos, catalog images removed)
5. ── Sayagaki ──────────────── (or Hakogaki for tosogu — mutually exclusive slot)
6. ── Kantō Hibishō ─────────── (page scan photos)
7. ── Provenance ────────────── (seal/document photos)
8. ── NBTHK Documentation ───── (ALL catalog oshigata + setsumei from every source)
```

### Key Behaviors

- **Catalog image filtering**: `isYuhinkaiCatalogImage()` identifies Yuhinkai URLs in both primary `images[]` and section arrays (`koshirae.images[]`, etc.). All catalog images are pulled to the Documentation group at the end, regardless of where they originate.
- **Videos inline**: Video items are interleaved in `flatItems[]` with `type: 'video'`, rendered as `VideoGalleryItem` within the same scroll loop. No separate video block.
- **Empty groups omitted**: If a section has no regular photos (only catalog images or nothing), the section group doesn't appear.
- **Deduplication**: Running `Set<string>` across all groups. First appearance wins.
- **Deferred progress bar**: Denominator stays at primary count until user scrolls past it, preventing jumps when section data loads.

### Data Flow

```
QuickView opens (browse source)
  → Browse API returns listing (primary images only, no section data)
  → collectGroupedMedia(displayImages, listing, detailLoaded=false, videoItems)
  → Returns: hero → videos → photos (catalog filtered to Documentation)
  → Progress bar: "1 of N"

~300ms later, detail API resolves
  → detailLoaded flips to true
  → Section images appear with group dividers
  → Catalog images from sections merge into Documentation group
  → Progress bar stays deferred until user scrolls past current boundary

QuickView opens (dealer source)
  → Dealer API returns listing WITH section fields (koshirae, sayagaki, etc.)
  → detailLoaded set to true immediately (no public API fetch — RLS blocks it)
  → Full scroll renders on first paint
```

---

## Phase 2: Inline Text Blocks (Museum Catalog Scroll)

### Vision

Transform the scroller from a photo gallery into a **narrative reading experience**. Each section pairs its text content with its associated images, the way an exhibition catalog would present a sword. The reference experience is the existing `StudySetsumeiView` — scholarly typography, cream background card, translation toggle.

### Proposed Scroll Order

```
1.  Hero image
2.  Videos (inline)
3.  Remaining sword/item photos
4.  ── Scholar's Note ──────────────────────
    [TEXT BLOCK: ai_curator_note_en/ja]
5.  ── Koshirae ────────────────────────────
    [koshirae photos]
    [TEXT BLOCK: koshirae setsumei_text_en/ja, if any]
6.  ── NBTHK Documentation ─────────────────
    [TEXT BLOCK: setsumei_text_en/ja]
    [oshigata image]
    [setsumei page scan]
7.  ── Sayagaki ────────────────────────────  (or Hakogaki for tosogu)
    [TEXT BLOCK: sayagaki content + author attribution]
    [sayagaki photos]
8.  ── Kantō Hibishō ───────────────────────
    [TEXT BLOCK: "Vol. X, No. Y" + text]
    [page scan images]
9.  ── Provenance ──────────────────────────
    [TEXT BLOCK: owner chain + kiwame entries]
    [provenance photos]
```

### Available Text Content Per Section

| Section | DB Fields | Format | Availability |
|---------|-----------|--------|-------------|
| Scholar's Note | `ai_curator_note_en`, `ai_curator_note_ja` | Markdown | Generated on demand, few listings |
| Setsumei (NBTHK) | `setsumei_text_en`, `setsumei_text_ja` | Markdown/plain | Juyo/TJ with Yuhinkai data |
| Koshirae setsumei | `koshirae.setsumei_text_en`, `koshirae.setsumei_text_ja` | Markdown | Dealer-entered koshirae with catalog |
| Sayagaki | `sayagaki[].content`, `sayagaki[].author` | Preformatted | Dealer-entered, often Japanese only |
| Hakogaki | `hakogaki[].content` | Preformatted | Tosogu only |
| Kantō Hibishō | `kanto_hibisho.text`, `.volume`, `.entry_number` | Preformatted | Rare, scholarly |
| Provenance | `provenance[].owner_name`, `.owner_name_ja`, `.notes` | Preformatted | Dealer-entered |
| Kiwame | `kiwame[].judge_name`, `.judge_name_ja`, `.notes`, `.kiwame_type` | Preformatted | Dealer-entered |
| Description | `description` | Free-form | Most scraped listings |

### Implementation Approach

**`FlatMediaItem` gets a third type: `'text'`**

```typescript
interface FlatMediaItem {
  type: 'image' | 'video' | 'text';
  // ... existing image/video fields ...

  // Text-specific (only when type === 'text')
  textContent?: string;          // Primary text (EN or locale-default)
  textContentAlt?: string;       // Alternate language text (for toggle)
  textFormat?: 'markdown' | 'preformatted';
  textAuthor?: string;           // e.g., "Tanobe Michihiro" for sayagaki
  textMeta?: string;             // e.g., "Vol. 2, No. 1110" for Kantō Hibishō
  textSource?: string;           // e.g., "Yuhinkai Catalog", "NBTHK Zufu"
}
```

**New `ScrollerTextBlock` component** (~80 lines):

- Cream background card with subtle gold border (`bg-cream/50 border border-gold/15 rounded-xl p-5`)
- Scholarly typography matching `StudySetsumeiView` (`prose-translation` class)
- Per-block translation toggle (small pill, not the full study mode toggle)
- Markdown rendered via `HighlightedMarkdown` (already exists), preformatted via `whitespace-pre-wrap`
- Author attribution line when available
- Source attribution ("Yuhinkai Catalog" / "NBTHK Zufu" / "AI Generated")
- Participates in progress bar tracking via globalIndex

**`collectGroupedMedia` changes**:

- Accept listing text fields alongside images
- For each section, emit text items BEFORE image items (text → images reading order)
- Scholar's Note is a standalone text group after primary photos
- Provenance + Kiwame merge into one group (both are authentication/history chain)

**QuickView render loop** — three-way branch:

```tsx
{item.type === 'text' ? (
  <ScrollerTextBlock item={item} locale={locale} />
) : item.type === 'video' ? (
  <VideoGalleryItem ... />
) : (
  <LazyImage ... />
)}
```

### Desktop Right Panel Cleanup

With text blocks moving into the scroller, the right panel (QuickViewContent) gets simpler. The sections that duplicate scroller content should be removed:

**Remove from right panel**: SetsumeiSection, SayagakiDisplay, HakogakiDisplay, KoshiraeDisplay, ProvenanceDisplay, KiwameDisplay, KantoHibishoDisplay

**Keep in right panel**: Price, cert/specs (MetadataGrid), dealer row, description, CTA, admin tools

This is a significant simplification of `QuickViewContent.tsx` — ~6 display components removed.

### Edge Cases

- **Most scraped listings have none of this** — no text blocks appear, scroller looks exactly as it does today. Progressive enhancement only.
- **Text-only sections (no images)** — still render. A sayagaki text block without a calligraphy photo is valuable on its own.
- **Image-only sections (no text)** — still render. Photos without inscription text (common for scraped data).
- **Translation toggle** — only shown when both `textContent` and `textContentAlt` are present. Japanese text uses `font-jp` class with `leading-[1.9]` per JA UX rules.
- **Long text** — no truncation. The scroll is the reading experience. Users can scroll past.

### Listing 90396 as Reference

The Hoshizukiyo-Masamune listing (`docs/SHOWCASE_ILLUSTRATION_90396.md`) has every section populated:

- Scholar's Note (AI-generated, ~3 paragraphs)
- Setsumei text EN/JA + 2 catalog images (blade)
- Sayagaki text by Tanobe + calligraphy photo
- 5 provenance entries (Yoshiteru → Shingen → Ieyasu → Yorifusa → Tsuchiya)
- Kiwame (Hon'ami origami, 5000 kan Masamune attribution)
- Koshirae (Hagiya Katsuhira, Juyo 59th session) + setsumei text + 2 catalog images
- Video

This is the ideal test case for Phase 2 — it exercises every text block type.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/media/groupedMedia.ts` | `collectGroupedMedia()` — groups, deduplicates, filters catalog images, integrates videos, builds `flatItems[]` |
| `src/lib/images/classification.ts` | `isYuhinkaiCatalogImage()` — single source of truth for catalog URL detection |
| `src/components/listing/QuickView.tsx` | Orchestrator — calls `collectGroupedMedia`, renders `flatItems` with image/video branching, manages progress bar |
| `src/components/listing/MediaGroupDivider.tsx` | Centered-text divider (`──── LABEL ────`) |
| `src/components/video/VideoGalleryItem.tsx` | Click-to-play video thumbnail/player (used inline in scroller) |
| `src/components/listing/StudySetsumeiView.tsx` | **Reference for Phase 2 text styling** — scholarly typography, translation toggle, cream card |
| `src/components/glossary/HighlightedMarkdown.tsx` | Markdown renderer with glossary linking (reuse in Phase 2) |
| `src/contexts/QuickViewContext.tsx` | `detailLoaded` flag, `mergeDetailIntoListing()`, dealer skip-fetch logic |
| `src/app/api/dealer/listings/route.ts` | Dealer GET now includes section JSONB fields |
| `src/i18n/locales/en.json` | `quickview.sectionPhotos`, `quickview.sectionVideos`, `quickview.sectionDocumentation` |
| `src/i18n/locales/ja.json` | Same keys in Japanese |
| `tests/lib/media/groupedMedia.test.ts` | 37 tests (group logic, catalog filtering, video integration, flatItems, combined scenarios) |

---

## Types

### `FlatMediaItem` (current)

```typescript
interface FlatMediaItem {
  src: string;               // Image URL (empty for video items)
  globalIndex: number;       // Sequential index across all groups
  groupLabelKey: string;     // i18n key for group label
  isFirstInGroup: boolean;   // True → render divider before this item
  isFirstGroup: boolean;     // True → suppress divider (first group)
  type: 'image' | 'video';  // Media type
  // Video-specific (type === 'video')
  streamUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  videoStatus?: 'processing' | 'ready' | 'failed';
  videoId?: string;
}
```

### `VideoMediaItem` (input to collectGroupedMedia)

```typescript
interface VideoMediaItem {
  streamUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  status?: 'processing' | 'ready' | 'failed';
  videoId?: string;
}
```

---

## Deduplication Strategy

Images are deduplicated across all groups using a running `Set<string>`:

1. Primary `displayImages` (all, including catalog) added to `seen` first
2. Each section's images filtered: skip if URL is empty or already in `seen`
3. After filtering, URL added to `seen` for subsequent sections
4. Catalog images filtered from both primary and section arrays → merged into Documentation

This means:
- A sayagaki image also in primary photos → only in photos group
- A shared image between sayagaki and hakogaki → only in sayagaki (first wins)
- A catalog image in koshirae.images[] → pulled to Documentation, not in Koshirae group
- If dedup + catalog filtering removes ALL images from a section → section omitted

---

## Dealer QuickView: Section Data Path

Prior to commit `11db43c`, dealer QuickView never showed section images because:

1. Dealer listings API didn't SELECT section JSONB columns
2. `fetchFullListing()` called the public `/api/listing/{id}` which returns 404 for `source='dealer'` (RLS)
3. `detailLoaded` stayed `false` forever

**Fix**: Two changes:
- Dealer listings API now selects: `sayagaki, hakogaki, koshirae, provenance, kiwame, kanto_hibisho, setsumei_text_en, setsumei_text_ja`
- `openQuickView` with `source='dealer'` sets `detailLoaded=true` immediately and skips `fetchFullListing()`

---

## Testing

```bash
# Grouped media tests (37 tests, <1s)
npx vitest run tests/lib/media/groupedMedia.test.ts

# Full suite (verify no regressions)
npx vitest run
```

### What the Tests Cover (37 tests)

**Group logic (13 tests)**:
- Null listing, `detailLoaded=false`, no section data → photos only
- Section ordering: koshirae → sayagaki → hakogaki → kanto hibisho → provenance
- Cross-section deduplication, empty sections omitted
- Multiple entries per section, falsy URL filtering, null fields

**Catalog image filtering (7 tests)**:
- Primary catalog images split to Documentation group
- No Documentation group when no catalog images
- Documentation after all sections
- Catalog images from section data (koshirae) pulled to Documentation
- Combined primary + section catalog images merged
- Section with only catalog images omitted (no empty group)

**Video integration (8 tests)**:
- Video type, props, position after hero, multiple videos
- No-photos edge case, contiguous globalIndex, isFirstGroup, totalCount, allImageUrls exclusion

**FlatItems (6 tests)**:
- Sequential globalIndex, isFirstInGroup, isFirstGroup, groupLabelKey, empty input, type field

**Combined scenario (1 test)**:
- Full end-to-end: hero → video → photos → koshirae → sayagaki → documentation (with catalog from both primary + koshirae)

---

## Adding a New Section Type

To add a new JSONB section (e.g., `origami`) to the scroller:

1. **`groupedMedia.ts`** — Add entry to `SECTION_DEFS` (position = display order):
   ```typescript
   {
     labelKey: 'dealer.origami',
     getImages: (l) => {
       if (!l.origami) return [];
       return l.origami.images || [];
     },
   },
   ```

2. **`QuickViewContext.tsx`** — Add to `mergeDetailIntoListing()`:
   ```typescript
   origami: detail.origami ?? browse.origami,
   ```

3. **`QuickView.tsx`** — Add to `groupedMedia` memo dependency array:
   ```typescript
   currentListing?.origami
   ```

4. **Dealer API** — Add `origami` to the SELECT in `/api/dealer/listings/route.ts`

5. **i18n** — Add `dealer.origami` key to `en.json` and `ja.json`

6. **Test** — Add test case to `groupedMedia.test.ts`

Catalog images in the new section are automatically filtered to Documentation — no extra code needed.
