# Study Setsumei Feature

## Overview

The Study Setsumei feature provides a premium reading experience for NBTHK setsumei (expert commentary) in QuickView. When a listing has setsumei data available, users can click a book icon to enter "Study mode" which replaces the image gallery with beautifully formatted setsumei content.

## Data Sources

Setsumei content comes from two sources, with Yuhinkai preferred:

1. **Yuhinkai Catalog** (preferred) - Professional English translations from the official NBTHK catalog
   - Stored in: `yuhinkai_enrichment.setsumei_en`, `yuhinkai_enrichment.setsumei_ja`
   - Only shown for **manually connected** entries (`connection_source === 'manual'`)
   - Auto-matched results are hidden (not production-ready)

2. **OCR Setsumei** (fallback) - AI-extracted text from setsumei document images
   - Stored in: `listing.setsumei_text_en`, `listing.setsumei_text_ja`
   - Source: Oshi-scrapper OCR pipeline

## User Flow

```
1. User opens QuickView for a listing
2. If setsumei data exists → book icon appears next to Share button
3. User clicks book icon → enters Study mode
4. Study mode displays:
   - Setsumei document image (if available)
   - Formatted markdown translation with glossary highlighting
   - Language toggle (English/Japanese)
   - Source attribution (Yuhinkai Catalog or NBTHK Zufu)
5. User clicks book icon again (or "View Photos") → returns to images
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      QuickView.tsx                              │
├─────────────────────────────────────────────────────────────────┤
│  isStudyMode state                                              │
│  ├─ false → render ImageScroller                                │
│  └─ true  → render StudySetsumeiView                            │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ QuickViewContent│ │QuickViewMobile  │ │ StudySetsumei   │
│     .tsx        │ │   Sheet.tsx     │ │    View.tsx     │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ Book icon button│ │ Book icon button│ │ Premium reading │
│ hasSetsumeiData │ │ hasSetsumeiData │ │ experience      │
│ check           │ │ check           │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Key Components

### `StudySetsumeiView.tsx`
Premium reading interface with:
- Setsumei image display (lazy loaded)
- Markdown rendering with `HighlightedMarkdown` for glossary terms
- English/Japanese language toggle
- Source attribution footer
- Premium paper-like styling (`bg-linen`)

### `hasSetsumeiData()` (types/index.ts)
Checks if a listing has any setsumei available:
```typescript
export function hasSetsumeiData(listing: ListingWithEnrichment): boolean {
  // Check OCR setsumei
  if (listing.setsumei_text_en) return true;

  // Check verified Yuhinkai enrichment
  if (hasVerifiedEnrichment(listing)) {
    if (listing.yuhinkai_enrichment?.setsumei_en) return true;
  }

  return false;
}
```

### `getSetsumeiContent()` (types/index.ts)
Returns the best available setsumei, preferring Yuhinkai:
```typescript
export function getSetsumeiContent(listing): SetsumeiContent | null {
  // Prefer Yuhinkai (professional translation)
  if (hasVerifiedEnrichment(listing) && listing.yuhinkai_enrichment?.setsumei_en) {
    return { source: 'yuhinkai', ... };
  }
  // Fall back to OCR
  if (listing.setsumei_text_en) {
    return { source: 'ocr', ... };
  }
  return null;
}
```

## UI Behavior

### Book Icon Button
- **Location**: Next to Share/Favorite buttons in QuickView header
- **Visibility**: Only shown when `hasSetsumeiData()` returns true
- **States**:
  - Default: Muted color, "Study setsumei" aria-label
  - Active (study mode): Gold background, "View photos" aria-label

### Study Mode Content
- **Header**: "NBTHK Setsumei" title with cert badge (e.g., "Juyo #42")
- **Image**: Setsumei document scan (if `setsumei_image_url` exists)
- **Text**: Formatted with prose typography, glossary highlighting
- **Footer**: Source attribution + "Official Translation" badge for Yuhinkai

## Enriched Metadata in MetadataGrid

When a listing has verified Yuhinkai enrichment, the MetadataGrid displays enriched metadata instead of raw listing data:

| Field | Enriched Source | Fallback |
|-------|-----------------|----------|
| Smith/Maker | `enriched_maker` | `listing.smith` / `listing.tosogu_maker` |
| School | `enriched_school` | `listing.school` / `listing.tosogu_school` |
| Era | `enriched_period` | `listing.era` |

This ensures collectors see the most accurate attribution data available.

## Testing

E2E tests in `tests/e2e/study-setsumei.spec.ts` cover:
- Study button visibility (with/without setsumei)
- Toggle behavior (enter/exit study mode)
- Content display (markdown, source attribution)
- Language toggle (English/Japanese)
- Mobile functionality
- State reset on listing navigation

## Design Decisions

1. **No inline setsumei in QuickView panel** - Setsumei is only accessible via Study mode to avoid repetition and provide a focused reading experience.

2. **Yuhinkai preferred over OCR** - Professional translations are higher quality than AI-extracted text.

3. **Manual connections only** - Auto-matched Yuhinkai results are hidden (`hasVerifiedEnrichment` filters by `connection_source === 'manual'`).

4. **State resets on navigation** - `isStudyMode` resets when `currentListing` changes to avoid confusion.
