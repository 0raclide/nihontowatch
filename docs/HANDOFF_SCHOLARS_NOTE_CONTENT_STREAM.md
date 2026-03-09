# Handoff: Scholar's Note Not Appearing in Dealer Content Stream

**Date:** 2026-03-09
**Status:** UNRESOLVED — partial fix deployed, note still not rendering
**Listing:** 91337 (The Kan'in Mitsutada, Tokubetsu Juyo)

---

## Problem

The dealer edit form shows a Scholar's Note in the "Notes / Description" textarea (AI-generated via "Regenerate Scholar's Note" button). But the content stream in the dealer QuickView does NOT display it. The setsumei appears directly below the hero image with no curator note block between them.

## Root Cause Analysis

### The field mismatch

Two separate storage paths exist for what is conceptually the same content:

| Path | Writes to | Read by |
|------|-----------|---------|
| **Dealer form** "Regenerate Scholar's Note" | `description` column (via `setDescription()` in `handleGenerateNote`) | Form textarea |
| **Standalone curator-note API** (`/api/listing/[id]/curator-note`) | `ai_curator_note_en` column | Content stream, ShowcaseLayout |

The content stream's `buildContentStream()` only checked `listing.ai_curator_note_en` — never `listing.description`. The dealer form's generate button wrote to `description` — never `ai_curator_note_en`.

### What was deployed (commit ff9d709)

Three changes were made but the note **still does not appear**:

1. **Content stream fallback** (`src/lib/media/contentStream.ts`):
   ```ts
   const curatorNoteEn = listing.ai_curator_note_en || listing.description || null;
   ```
   Added `|| listing.description` fallback, matching what ShowcaseLayout already does.

2. **Form submit** (`DealerListingForm.tsx`): Added `ai_curator_note_en: description || null` to the submit payload so future saves populate both columns.

3. **APIs**: Added `ai_curator_note_en`, `ai_curator_note_ja` to ALLOWED_FIELDS in PATCH route, and to the POST route insert payload.

### Why it still doesn't work

Unknown. The deployed code should show the note via the `description` fallback. Possible causes to investigate:

1. **Listing 91337's `description` column is NULL in the DB** — The form shows the note in the textarea, but maybe it was generated and never saved (the form has no auto-save — requires explicit Save button click). Check: `SELECT description, ai_curator_note_en FROM listings WHERE id = 91337;`

2. **The edit form loads from `description` OR `ai_curator_note_en`** — The form state initializes from `initialData?.description`. If the note was generated via the standalone curator-note API (which writes to `ai_curator_note_en`), the form would show it only if it also reads from that column. Check form init: `useState(initialData?.description || ...)` — does it fall back to `ai_curator_note_en`?

3. **The content stream `curator_note` block renders but is invisible** — The `ShowcaseScholarNote` component wraps content in `max-w-[960px] mx-auto px-4` which is designed for the full Showcase page layout, not the narrow QuickView panel. The content might be rendering but overflowing or clipped.

4. **Vercel deploy not live** — The build may not have completed. Hard refresh (Cmd+Shift+R) needed.

5. **`description` field not in the Listing type for content stream path** — TypeScript shows it exists on `Listing` interface, but verify the runtime data actually includes it.

## Key Files

| File | Role |
|------|------|
| `src/lib/media/contentStream.ts:296-303` | Curator note block creation (fallback added) |
| `src/components/listing/ContentStreamRenderer.tsx:72-77` | Renders `curator_note` block via `ShowcaseScholarNote` |
| `src/components/showcase/ShowcaseCuratorNotePlaceholder.tsx` | The actual display component — designed for 960px showcase, may not fit QuickView |
| `src/components/dealer/DealerListingForm.tsx:813-865` | `handleGenerateNote` — writes to `setDescription()`, calls `/api/dealer/generate-description` |
| `src/components/dealer/DealerListingForm.tsx:519` | Submit payload — now includes `ai_curator_note_en: description \|\| null` |
| `src/app/api/dealer/listings/[id]/route.ts:54-75` | PATCH ALLOWED_FIELDS — now includes `ai_curator_note_en` |
| `src/app/api/dealer/listings/route.ts:170-220` | POST — now includes `ai_curator_note_en` in insert |
| `src/app/api/listing/[id]/curator-note/route.ts` | Standalone API — writes directly to `ai_curator_note_en` (bypasses form) |
| `src/components/showcase/ShowcaseLayout.tsx:96` | ShowcaseLayout already had the fallback: `listing.ai_curator_note_en \|\| listing.description` |

## Debugging Steps

1. **Check DB state:**
   ```sql
   SELECT id, description, ai_curator_note_en, ai_curator_note_ja
   FROM listings WHERE id = 91337;
   ```
   If both are NULL, the note was never saved.

2. **Check form initialization** — does the textarea populate from `ai_curator_note_en` when `description` is NULL?
   ```ts
   // DealerListingForm.tsx line 262
   const [description, setDescription] = useState(initialData?.description || draft?.description || '');
   ```
   If `description` is NULL but `ai_curator_note_en` has the note, the form shows it from a different source (e.g., the GET endpoint might merge them). But the content stream won't get it via `listing.description`.

3. **Check ShowcaseScholarNote rendering in QuickView context** — the component uses `max-w-[960px]` and `max-w-[65ch]` containers that assume full-page width. In the ~60% left panel of QuickView, these may cause issues. Add a temporary border to verify it renders:
   ```tsx
   <div key="curator-note" className="py-4 border border-red-500">
   ```

4. **Console log in buildContentStream** — add a temporary log to verify the block is created:
   ```ts
   console.log('curator note check:', {
     ai: listing.ai_curator_note_en,
     desc: listing.description,
     result: curatorNoteEn
   });
   ```

## Architecture Decision Needed

The current dual-column approach (`description` + `ai_curator_note_en`) is confusing:

- **Option A: Single column** — Merge everything into `ai_curator_note_en`. The "description" textarea in the form reads/writes `ai_curator_note_en`. `description` column becomes legacy/unused for dealer listings.

- **Option B: Keep both, clear separation** — `description` = manual dealer notes (short, plain text). `ai_curator_note_en` = AI-generated scholarly analysis (long, markdown). Form has two sections. Generate button writes to curator note, not description.

- **Option C: Current approach (sync on save)** — Form textarea = `description`. Submit copies to `ai_curator_note_en`. Content stream falls back. Risk: columns drift if one is updated without the other.

Recommendation: **Option A** for dealer listings. There's no practical distinction between "description" and "curator note" in the dealer context — dealers have one text field for their listing narrative.

## Also Done This Session

### Provenance Golden Thread Timeline (deployed, commit 300d207)

Redesigned `ProvenanceDisplay.tsx` from flat list to vertical timeline:
- Gold line (1.5px, 50% opacity, gradient terminals) runs down left margin
- First image per entry becomes circular portrait node (40px mobile / 48px desktop) with gold ring
- Entries without images get hollow gold dot
- Remaining images show as document thumbnails below notes
- Component API unchanged — no changes needed in consumers

A polish pass (chevrons, tighter spacing, centered text — commit 16a0b33) was reverted per user preference (commit fe64c4d). The original V1 design was preferred.
