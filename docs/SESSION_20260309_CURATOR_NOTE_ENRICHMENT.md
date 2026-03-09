# Session: Curator Note Enrichment — Research Notes + Artist Overview

**Date:** 2026-03-09
**Status:** Complete, untested against live generation
**Migration:** 131 (not yet applied to prod DB)

---

## What Was Done

Two new data sources were added to the AI curator note generation pipeline:

### Feature 1: Collector's Research Notes

**Problem:** Collectors and dealers know things the system doesn't — publication history, exhibition references, scholarly observations. There was no way to feed this into AI note generation.

**Solution:** A free-text `research_notes` column on both `listings` and `collection_items`. Content is fed into the AI prompt as a labeled section with an "unverified" caveat, and the system prompt instructs the model to attribute with "according to the consignor" or similar hedging language.

**Key design decisions:**
- **Not displayed publicly** — only used as AI generation context
- **Max 5000 characters** — enforced in all 4 API routes (POST + PATCH for both tables)
- **System prompt rule 6** — explicit instruction to attribute as third-party claims (EN + JA)
- **Richness impact** — research notes can elevate `moderate → full` (when combined with setsumei + artisan), but alone cannot elevate `sparse → moderate`

### Feature 2: Artist Statistical Overview

**Problem:** Only basic artisan entity fields (name, school, cert counts) were passed to the AI. The rich statistical data from `buildArtistPageData()` — form distributions, mei patterns, lineage, school ancestry, provenance patterns, elite ranking — was never used.

**Solution:** A pure distillation function `distillArtistOverview()` that extracts a compact `ArtistOverview` from the full `ArtisanPageResponse`, passed to the prompt as a structured section.

**Key design decisions:**
- **Non-fatal** — both API routes wrap the fetch + distill in try/catch. If Yuhinkai is down or the artisan has no page data, generation proceeds without it
- **Compact** — only top 5 students, top 5 provenance owners, distributions as raw counts (prompt builder renders percentages)
- **Returns null** when no meaningful supplementary data exists (empty stats + no students + no ancestry + no provenance)

---

## Files Changed

### New Files (4)
| File | Purpose |
|------|---------|
| `supabase/migrations/131_research_notes.sql` | Adds `research_notes TEXT` to both tables |
| `src/lib/listing/distillArtistOverview.ts` | Pure function: `ArtisanPageResponse → ArtistOverview \| null` |
| `tests/lib/listing/distillArtistOverview.test.ts` | 8 tests for distillation |
| `tests/lib/listing/curatorNotePrompt.test.ts` | 10 tests for prompt builder sections |

### Modified Files (19)

**Types & data model:**
| File | Change |
|------|--------|
| `src/types/itemData.ts` | `research_notes` added to `ItemDataFields` + `SHARED_COLUMNS` |
| `src/lib/listing/getListingDetail.ts` | `research_notes` in SELECT, `ListingWithDealer`, `EnrichedListingDetail`, return object |
| `src/lib/listing/curatorNote.ts` | `ArtistOverview` interface, `research_notes` + `artist_overview` on `CuratorNoteContext`, `research_notes` on `GenerateDescriptionFormData`, 4th param on both assembly functions, `hasResearchNotes` in richness check |

**Prompt builder:**
| File | Change |
|------|--------|
| `src/lib/listing/curatorNotePrompt.ts` | System prompt rule 6 (EN + JA), `buildResearchNotesSection()`, `buildArtistOverviewSection()`, sections 9 + 10 in `buildUserPrompt()` |

**API routes (6):**
| File | Change |
|------|--------|
| `src/app/api/dealer/listings/route.ts` | POST: destructure + write `research_notes` |
| `src/app/api/dealer/listings/[id]/route.ts` | PATCH: `research_notes` in `ALLOWED_FIELDS` + sanitize |
| `src/app/api/collection/items/route.ts` | POST: destructure + write `research_notes` |
| `src/app/api/collection/items/[id]/route.ts` | PATCH: `research_notes` in `ALLOWED_FIELDS` + sanitize |
| `src/app/api/dealer/generate-description/route.ts` | `research_notes` in formData + artist overview distillation |
| `src/app/api/listing/[id]/curator-note/route.ts` | Artist overview distillation |

**UI:**
| File | Change |
|------|--------|
| `src/components/dealer/DealerListingForm.tsx` | `researchNotes` state, textarea UI, draft save, submit payload, generate-note payload, `DealerListingInitialData` + `DealerDraft` types |
| `src/i18n/locales/en.json` | 3 keys: `dealer.researchNotes`, `dealer.researchNotesHint`, `dealer.researchNotesPlaceholder` |
| `src/i18n/locales/ja.json` | Same 3 keys in Japanese |

**Script:**
| File | Change |
|------|--------|
| `scripts/generate-curator-note.mts` | `research_notes` in SELECT + context, artist overview distillation |

**Golden test sync:**
| File | Change |
|------|--------|
| `supabase/migrations/120_collection_items.sql` | `research_notes TEXT` column definition |
| `supabase/migrations/128_promote_to_listing.sql` | `research_notes` in INSERT + UPDATE column lists |
| `supabase/migrations/129_delist_to_collection.sql` | `research_notes` in INSERT column + value lists |
| `tests/lib/collection-schema-sync.test.ts` | `research_notes` in both hardcoded column lists |
| `tests/lib/listing/curatorNote.test.ts` | 12 new tests + factory update |

---

## Test Results

**48 new/updated tests across 4 files** (236 total in affected files):

| File | Tests | Coverage |
|------|-------|----------|
| `distillArtistOverview.test.ts` | 8 | Null return, top-5 limits, zero-filter, code fallback, missing ancestry |
| `curatorNote.test.ts` | 30 (12 new) | Research notes extraction/trim/null, artist overview passthrough, hash changes, richness with research notes |
| `curatorNotePrompt.test.ts` | 10 | Research notes section EN/JA, artist overview section EN/JA, system prompt rules, omission when null |
| `collection-schema-sync.test.ts` | 142 (2 new) | Golden test column sync |

All tests pass. No new TypeScript errors introduced (5 pre-existing errors remain).

---

## Migration Checklist

Before deploying:

1. **Apply migration 131** to prod Supabase:
   ```sql
   ALTER TABLE listings ADD COLUMN IF NOT EXISTS research_notes TEXT;
   ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS research_notes TEXT;
   ```

2. **Re-apply RPCs 128 + 129** (promote/delist) — they now include `research_notes` in the column transfer. Without this, promote/delist will silently drop research notes.

---

## Verification Steps

1. **Unit tests:** `npx vitest run tests/lib/listing/` — all pass
2. **Script test:** `npx tsx scripts/generate-curator-note.mts <listing_id_with_artisan>` — verify `[ARTIST STATISTICAL OVERVIEW]` section appears in user prompt
3. **Form test:** In dealer form, add research notes to a listing, trigger Scholar's Note generation — verify `[RESEARCH NOTES]` appears in prompt and generated note uses attribution language
4. **Promote/delist test:** Promote a collection item with research notes — verify notes survive the transit

---

## Architecture Notes

### Data flow for research notes
```
Dealer form textarea → POST/PATCH API → DB (research_notes TEXT)
                                           ↓
                              assembleCuratorContext() extracts + trims
                                           ↓
                              buildResearchNotesSection() renders in prompt
                                           ↓
                              AI generates note with attribution language
```

### Data flow for artist overview
```
listing.artisan_id → buildArtistPageData() → distillArtistOverview()
                         ↓ (Yuhinkai DB)           ↓
                   ArtisanPageResponse        ArtistOverview | null
                                                    ↓
                                    buildArtistOverviewSection() renders in prompt
```

### Backward compatibility
- Both assembly functions accept `artistOverview` as an optional 4th parameter (defaults to `undefined → null`)
- `CuratorNoteContext` now always has `research_notes` and `artist_overview` fields, but both can be null
- Input hash changes when either field is added/modified (by design — triggers re-generation)

---

## Known Limitations

1. **No display of research notes** — they're input-only for AI. If we ever want to show them publicly, a separate display component is needed.
2. **Artist overview adds latency** — `buildArtistPageData()` makes ~8 Yuhinkai queries. The try/catch ensures it's non-blocking on failure, but adds ~500ms on success. Acceptable for generation (which already takes 5-15s for the LLM call).
3. **Script uses dynamic imports** for `buildArtistPageData` and `distillArtistOverview` since it can't use `@/` path aliases. These imports may fail if the module structure changes.
