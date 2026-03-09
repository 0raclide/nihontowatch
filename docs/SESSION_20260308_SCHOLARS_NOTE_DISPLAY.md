# Scholar's Note Display + Prompt Improvements — Session Handoff

**Date:** 2026-03-08
**Commits:** `35c24c4` (display), `6fe5c5b` (prompt improvements)
**Status:** Deployed to prod, note regenerated for listing 90396

---

## What Was Done

### 1. Display Component (Phase 2b)

Replaced the `ShowcaseCuratorNotePlaceholder` ("Scholar's note coming soon") with a real `ShowcaseScholarNote` component that renders AI-generated curator's notes.

**Component:** `src/components/showcase/ShowcaseCuratorNotePlaceholder.tsx`
- Renamed export to `ShowcaseScholarNote`
- Props: `{ noteEn: string | null; noteJa: string | null }`
- Returns `null` when both are null (hides section entirely)
- Renders through `HighlightedMarkdown` (same as `DocumentCard` in `ShowcaseDocumentation.tsx`)
- Styling: `bg-surface-elevated rounded p-6 md:p-8 border border-border`, `prose-translation text-[13px] leading-[1.8] font-light`
- Translation toggle: "翻訳" / "Original" when both languages available

**Layout integration:** `src/components/showcase/ShowcaseLayout.tsx`
- `hasCuratorNote` boolean gates both the section render and nav entry
- Listings without notes: no Scholar's Note section, no nav entry

### 2. Prompt Improvements (3 targeted changes)

**Problem diagnosed on listing 90396:**
- P2 (Observation) mechanically restated the setsumei's measurements — the setsumei is already displayed separately in the Documentation section
- Koshirae was invisible to the prompt structure and richness classification
- Kiwame attribution shifts (e.g., Masamune → Kunishige → Kanenaga) weren't discussed

**Changes to `src/lib/listing/curatorNotePrompt.ts`:**

| Change | Before | After |
|--------|--------|-------|
| Setsumei quoting | "Quote the setsumei's technical descriptions" | "Quote the setsumei's evaluative conclusions... Do NOT mechanically restate measurements" |
| P2 synthesis | Quote each source in isolation | "When multiple sources speak to the same point, synthesize them together" |
| Kiwame shifts | Not mentioned | "If kiwame data records earlier attributions that differ from the current one, note the shift" |
| Koshirae paragraph | Not in structure | P4: "Discuss the mountings as an independent artistic achievement... connect to blade's history" |
| Word budget (full) | 300-400 words, 3 paragraphs | 350-500 words, 3-4 paragraphs |
| JA word budget (full) | 800-1200 chars, 3 paragraphs | 800-1400 chars, 3-4 paragraphs |
| Macrons | Inconsistent (Juyo, Soshu) | Consistent (Jūyō, Sōshū, Nanbokuchō) |

**Changes to `src/lib/listing/curatorNote.ts`:**
- `getDataRichness()` now includes `hasKoshirae` in `full` classification
- A listing with setsumei + artisan + koshirae (but no sayagaki/provenance) now qualifies as `full` instead of `moderate`

### 3. Failed Approach: Narrative-First Prompt

An intermediate attempt rewrote the prompt to prioritize "finding the central narrative thread" and "opening with what makes this object remarkable." This produced essay-like prose that lost the institutional NBTHK voice — it read like a magazine feature instead of museum wall text. Reverted entirely. The structured Context → Observation → Significance arc is correct; the fixes needed were surgical (don't restate measurements, synthesize across sources, add koshirae paragraph).

**Lesson:** The NBTHK voice comes from the rigid paragraph structure, not from creative-writing instructions. Telling the model to "find the story" pushes it toward editorial commentary. Telling it to "quote the setsumei's evaluative conclusions" keeps it grounded in the sources.

---

## Data Flow

```
DB: listings.ai_curator_note_en / ai_curator_note_ja
    ↓
getListingDetail() — fetches both columns, returns on EnrichedListingDetail
    ↓
ListingDetailClient.tsx — passes listing to ShowcaseLayout (when eligible)
    ↓
ShowcaseLayout.tsx — reads listing.ai_curator_note_en/ja
    ├─ hasCuratorNote = !!(en || ja)
    ├─ navSections conditionally includes 'scholars-note'
    └─ <ShowcaseScholarNote noteEn={...} noteJa={...} />
        ↓
    ShowcaseScholarNote — HighlightedMarkdown + translation toggle
```

## Generation Pipeline

```
scripts/generate-curator-note.mts <listing_id>
    ↓
Fetch listing from NW Supabase (setsumei, sayagaki, provenance, kiwame, koshirae)
    ↓
Fetch artisan from Yuhinkai (designation stats, AI biography)
    ↓
assembleCuratorContext() / getDataRichness()
    ↓
buildSystemPrompt('en') + buildUserPrompt(context, 'en')
    ↓
OpenRouter → Claude Opus 4.6 (temperature 0.4, max_tokens 1500)
    ↓
Same for JA (max_tokens 2000)
    ↓
Store ai_curator_note_en/ja + input_hash in DB
```

**Input hash:** SHA-256 of the serialized context. Used for cache invalidation — if source data changes, re-running the script produces a different hash and regenerates.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/components/showcase/ShowcaseCuratorNotePlaceholder.tsx` | Display component (`ShowcaseScholarNote`) |
| `src/components/showcase/ShowcaseLayout.tsx` | Orchestrator — conditional section render |
| `src/lib/listing/curatorNotePrompt.ts` | System + user prompts (EN/JA) |
| `src/lib/listing/curatorNote.ts` | Context assembly, richness classification, input hash |
| `scripts/generate-curator-note.mts` | One-shot generation script |
| `docs/CURATOR_NOTE_GUIDE.md` | Voice and philosophy guide |

---

## Verification

1. Visit `nihontowatch.com/listing/90396` — Scholar's Note section shows generated note
2. Toggle "翻訳" — switches to Japanese text
3. Visit any listing without `ai_curator_note_en/ja` — no Scholar's Note section, no nav entry
4. `npx tsc --noEmit` — clean
