# Session: Provenance Split — Portrait + Chain-Level Documents

**Date:** 2026-03-14
**Commit:** `cf1d4691`
**Files:** 28 modified (22 source + 6 test files), 1047 insertions, 483 deletions

## Problem

Provenance entries stored images as a flat array per entry (`ProvenanceEntry.images: string[]`). This conflated two distinct concepts:
1. **Portrait image** — a single image identifying the owner (photo, mon, dealer logo)
2. **Supporting documents** — scans of certificates, bills of sale, auction records that belong to the ownership chain, not a specific owner

The flat model caused UX confusion (which image slot is the portrait?), made the form unnecessarily complex (multi-image grid per entry), and couldn't represent chain-level documents that span multiple owners.

## Solution

### Data Model

```typescript
// Before
interface ProvenanceEntry {
  // ...
  images: string[];  // images[0] = portrait, images[1:] = documents (implicit)
}
type Listing.provenance = ProvenanceEntry[] | null;

// After
interface ProvenanceEntry {
  // ...
  portrait_image: string | null;  // single portrait per owner
}
interface ProvenanceData {
  entries: ProvenanceEntry[];
  documents: string[];  // chain-level supporting documents
}
type Listing.provenance = ProvenanceData | null;
```

No DB migration needed — JSONB column stores both shapes. Normalizer converts legacy on read.

### Backward Compatibility

`normalizeProvenance()` (`src/lib/provenance/normalize.ts`) detects legacy shape (flat array) vs new shape (ProvenanceData object) and converts:
- Legacy `images[0]` → `portrait_image`
- Legacy `images[1:]` → chain-level `documents`
- `sanitizeProvenance()` handles both shapes from untrusted client payloads

### Form UX

- **ProvenanceCard**: Single portrait upload with replace semantics (was multi-image grid)
- **ProvenanceSection**: Entries section + "Supporting Documents" zone below with drag-and-drop upload
- **DealerListingForm**: Split state (`provenanceEntries` + `provenanceDocuments`), merged into `ProvenanceData` for API payload

### Display

- **ProvenanceDisplay**: Timeline with portrait circles per entry + documents thumbnail grid below
- **ShowcaseTimeline**: Uses `portrait_image` for owner nodes + `documents` for showcase gallery
- **ShowcaseLayout**: Updated `usedImages` collector and `hasProvenance` check

### Image API

`POST /api/dealer/provenance-images` and `/api/collection/provenance-images`:
- `role=portrait` → finds entry by `provenanceId`, replaces `portrait_image` (singular)
- `role=document` → appends to chain-level `documents[]` array
- DELETE mirrors same role logic
- Both normalize legacy data on read before updating

## Files Changed

### Types & Utilities (4)
| File | Change |
|------|--------|
| `src/types/index.ts` | `ProvenanceEntry.images` → `.portrait_image`, new `ProvenanceData` type |
| `src/types/itemData.ts` | Updated provenance field type |
| `src/lib/provenance/normalize.ts` | **NEW** — legacy array → ProvenanceData converter (11 tests) |
| `src/lib/dealer/sanitizeSections.ts` | Rewrote `sanitizeProvenance()` for dual-shape compat (12 tests) |

### Form Components (3)
| File | Change |
|------|--------|
| `src/components/dealer/ProvenanceCard.tsx` | Single portrait upload (was multi-image grid) |
| `src/components/dealer/ProvenanceSection.tsx` | Chain-level documents zone below entries |
| `src/components/dealer/DealerListingForm.tsx` | State split, payload construction, pending file uploads |

### Display Components (5)
| File | Change |
|------|--------|
| `src/components/listing/ProvenanceDisplay.tsx` | Timeline + documents section |
| `src/components/listing/QuickViewContent.tsx` | Updated guard check |
| `src/components/listing/QuickViewMobileSheet.tsx` | Updated guard check |
| `src/components/showcase/ShowcaseTimeline.tsx` | Uses portrait_image + documents |
| `src/components/showcase/ShowcaseLayout.tsx` | Updated usedImages + hasProvenance |

### APIs (2)
| File | Change |
|------|--------|
| `src/app/api/dealer/provenance-images/route.ts` | Role param (portrait/document), normalizes legacy |
| `src/app/api/collection/provenance-images/route.ts` | Same changes |

### Business Logic (6)
| File | Change |
|------|--------|
| `src/lib/media/contentStream.ts` | Updated ContentBlock type, section def, image URLs |
| `src/lib/media/groupedMedia.ts` | Updated provenance image extraction |
| `src/lib/listing/curatorNote.ts` | Updated both assembleCuratorContext functions |
| `src/lib/listing/getListingDetail.ts` | Updated type annotations |
| `src/lib/listing/showcase.ts` | Updated countRichSections() |
| `src/lib/displayItem/fromShowcaseItem.ts` | Updated type |
| `src/app/listing/[id]/ListingDetailClient.tsx` | Updated guard check |

### i18n (2)
| File | Change |
|------|--------|
| `src/i18n/locales/en.json` | 5 new keys (supporting documents, portrait labels) |
| `src/i18n/locales/ja.json` | 5 new keys |

### Tests (4 files, 23 new tests)
| File | Tests |
|------|-------|
| `tests/lib/provenance/normalize.test.ts` | **NEW** — 11 tests (legacy conversion, new passthrough, null/empty) |
| `tests/lib/dealer/sanitizeSections.test.ts` | Rewritten provenance section — 12 tests |
| `tests/lib/listing/showcase.test.ts` | Updated test data for new shape |
| `tests/lib/listing/curatorNote.test.ts` | Updated test data |
| `tests/lib/media/groupedMedia.test.ts` | Updated test data |

## Test Results

5683 passed, 3 failed (pre-existing: LoginModal + exchange-rates API — unrelated).
