# Session: Provenance & Kiwame for Dealer Listing Form

**Date:** 2026-03-07
**Branch:** main (deployed to prod)

---

## Problem

Dealers had no way to record **provenance** (ownership history / 伝来) or **kiwame** (expert appraisals / 極め) when creating listings. Both are important scholarly metadata for nihonto — provenance tracks the chain of custody through notable collections, and kiwame records expert attributions (origami, kinzogan-mei, saya-mei) that validate a sword's identity.

Both are multi-entry fields (a sword can have multiple prior owners and multiple appraisals). Autofill suggestions should come from Yuhinkai's `denrai_canonical_names` (provenance owners) and `gold_kiwame_appraisers` (appraiser names).

---

## Solution

### Data Model

Two new JSONB columns on `listings`:

**ProvenanceEntry** (`listings.provenance`):
```typescript
{
  id: string;              // crypto.randomUUID()
  owner_name: string;      // Autocomplete from denrai_canonical_names
  owner_name_ja: string | null;  // Auto-populated from suggestions
  notes: string | null;
  images: string[];        // Document/origami photos
}
```

**KiwameEntry** (`listings.kiwame`):
```typescript
{
  id: string;
  judge_name: string;            // Autocomplete from gold_kiwame_appraisers
  judge_name_ja: string | null;  // Auto-populated from suggestions
  kiwame_type: 'origami' | 'kinzogan' | 'saya_mei' | 'other';
  notes: string | null;
}
```

### Architecture

Follows the established SayagakiSection/SayagakiCard pattern exactly:

1. **Shared AutocompleteInput** — debounced (300ms) text input with dropdown, fetches from `/api/dealer/suggestions`. Used by both ProvenanceCard and KiwameCard. Supports both English and Japanese input (queries both `canonical_name` and `name_ja` columns via ILIKE).

2. **Section + Card pattern** — ProvenanceSection/ProvenanceCard and KiwameSection/KiwameCard follow the same array add/remove/update pattern as SayagakiSection/SayagakiCard.

3. **Dual-mode image upload** — Provenance cards support image upload with the same add-mode (blob preview + pending files) / edit-mode (immediate upload) pattern as sayagaki.

4. **Kiwame has no images** — simpler card with type pills (origami/kinzogan/saya_mei/other) instead.

---

## Files Created (10)

| File | Purpose |
|------|---------|
| `supabase/migrations/109_provenance_kiwame.sql` | DB columns (JSONB) |
| `src/app/api/dealer/suggestions/route.ts` | Autocomplete API — queries Yuhinkai `denrai_canonical_names` and `gold_kiwame_appraisers` |
| `src/app/api/dealer/provenance-images/route.ts` | Image upload/delete (mirrors sayagaki-images) |
| `src/components/dealer/AutocompleteInput.tsx` | Shared debounced autocomplete with dropdown |
| `src/components/dealer/ProvenanceSection.tsx` | Provenance array manager |
| `src/components/dealer/ProvenanceCard.tsx` | Provenance entry card (autocomplete + notes + images) |
| `src/components/dealer/KiwameSection.tsx` | Kiwame array manager |
| `src/components/dealer/KiwameCard.tsx` | Kiwame entry card (autocomplete + type pills + notes) |
| `src/components/listing/ProvenanceDisplay.tsx` | Read-only provenance display with lightbox |
| `src/components/listing/KiwameDisplay.tsx` | Read-only kiwame display with type pills |

## Files Modified (10)

| File | Change |
|------|--------|
| `src/types/index.ts` | `ProvenanceEntry`, `KiwameEntry`, `KiwameType` types; fields on `Listing` |
| `src/components/dealer/DealerListingForm.tsx` | State, draft, submit, image upload, reset, JSX sections |
| `src/app/api/dealer/listings/route.ts` | POST: destructure + serialize provenance/kiwame |
| `src/app/api/dealer/listings/[id]/route.ts` | GET: select; PATCH: ALLOWED_FIELDS |
| `src/lib/listing/getListingDetail.ts` | Types, SELECT query, return object |
| `src/components/listing/QuickViewContent.tsx` | Render ProvenanceDisplay + KiwameDisplay |
| `src/components/listing/QuickViewMobileSheet.tsx` | Same |
| `src/app/listing/[id]/ListingDetailClient.tsx` | Same |
| `src/i18n/locales/en.json` | 21 new keys |
| `src/i18n/locales/ja.json` | 21 new keys |

---

## Key Design Decisions

1. **JSONB over relational tables** — Provenance and kiwame are always read/written as part of the listing. No need for separate tables, joins, or foreign keys. Matches sayagaki/koshirae pattern.

2. **Shared AutocompleteInput** — Single component shared between provenance and kiwame cards, avoiding duplicate debounce/dropdown/fetch logic. Takes `fetchUrl` as a prop for different data sources.

3. **Bilingual autocomplete** — Suggestions API queries both `canonical_name` (romaji) and `name_ja` (kanji) via ILIKE, so dealers can type in either language. Dropdown shows both forms side by side.

4. **Provenance images, kiwame no images** — Provenance entries support document photos (origami, certificates of ownership). Kiwame entries don't need images since the appraisal is typically recorded as an inscription on the sword itself (kinzogan-mei, saya-mei).

5. **Kiwame type pills** — Four types cover the main forms of kiwame: origami (paper certificate), kinzogan-mei (gold inlay attribution), saya-mei (scabbard inscription), and other.

---

## i18n Keys Added

21 keys per locale covering: section labels, add/remove buttons, field labels, placeholders, kiwame type names. All Japanese translations use proper nihonto terminology (伝来, 極め, 折紙, 金象嵌銘, 鞘書).
