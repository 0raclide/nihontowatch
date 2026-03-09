# Session: Generate Scholar's Note + Markdown Description Rendering

**Date:** 2026-03-08
**Commits:** `087173e`, `8f50dd9`, `0334095`
**Status:** Deployed to production

---

## What Was Built

Two related features for the dealer listing form:

1. **"Generate Scholar's Note" button** — AI-generated scholarly descriptions for Juyo/Tokubetsu Juyo items, powered by the existing curator note pipeline (OpenRouter → Claude Opus).
2. **Markdown rendering in QuickView descriptions** — descriptions containing markdown formatting (`*italics*`, `**bold**`, headings) now render properly instead of showing raw syntax.

Additionally, Notes and More Details sections in the dealer form were unfolded by default so dealers see all available fields.

---

## Architecture

### Generate Scholar's Note Flow

```
DealerListingForm (client)
  ├── canGenerateNote = cert is Juyo or Tokubetsu Juyo
  ├── hasNoteData = artisan selected OR setsumei text present
  └── handleGenerateNote()
        │
        ▼
POST /api/dealer/generate-description
  ├── verifyDealer() auth
  ├── Validate cert_type ∈ {Juyo, Tokubetsu Juyo}
  ├── getArtisan(artisan_id) + getAiDescription(artisan_id)
  ├── assembleCuratorContextFromFormData(formData, artisan, aiDesc)
  ├── shouldSkipGeneration(context) → 400 if insufficient data
  └── generateCuratorNote(context, 'en') → OpenRouter → Opus
        │
        ▼
Response: { description: string, data_richness: DataRichness }
  └── DealerListingForm sets description textarea
```

### Markdown Rendering Flow

```
TranslatedDescription.tsx
  ├── containsMarkdown(displayText) — tight regex check
  │     regex: /(\*[a-zA-Zā-ūÀ-ÿ].+?\*|^#{1,3}\s)/m
  │
  ├── YES → <ReactMarkdown> with prose styling
  └── NO  → <p whitespace-pre-line> (unchanged behavior)
```

---

## Files Modified/Created

| File | Action | Purpose |
|------|--------|---------|
| `src/app/api/dealer/generate-description/route.ts` | **Created** | POST endpoint — auth, validation, context assembly, AI generation |
| `src/lib/listing/curatorNote.ts` | Modified | Added `GenerateDescriptionFormData` type + `assembleCuratorContextFromFormData()` adapter |
| `src/components/dealer/DealerListingForm.tsx` | Modified | Unfold details sections, add generate button + state + handler |
| `src/components/listing/TranslatedDescription.tsx` | Modified | Markdown detection + ReactMarkdown rendering for formatted descriptions |
| `src/i18n/locales/en.json` | Modified | 5 new keys for generate note UI |
| `src/i18n/locales/ja.json` | Modified | 5 new keys for generate note UI |

### Files Reused Unchanged

| File | Role |
|------|------|
| `src/lib/listing/generateCuratorNote.ts` | OpenRouter API call (Opus, temperature 0.4, max 1500 tokens) |
| `src/lib/listing/curatorNotePrompt.ts` | System + user prompts (NBTHK scholarly voice) |
| `src/lib/dealer/auth.ts` | `verifyDealer()` — subscription_tier + dealer_id check |
| `src/lib/supabase/yuhinkai.ts` | `getArtisan()`, `getAiDescription()` — Yuhinkai DB lookups |

---

## Key Design Decisions

### 1. EN Only (Not Bilingual)

The endpoint generates only an English description (`generateCuratorNote(context, 'en')`). The JA system prompt uses no markdown (plain prose). Generating both would double OpenRouter cost and latency for a single button press. If JA is needed later, add a `lang` parameter.

### 2. No Caching / No Storage

The generated text goes straight into the `description` textarea. It is NOT stored in `ai_curator_note_en`/`ai_curator_note_ja` columns — those are for the showcase feature's scholar's note (different purpose, different display location). The dealer saves it as their listing description via the normal form submit flow.

### 3. `assembleCuratorContextFromFormData` vs `assembleCuratorContext`

Two parallel context assembly functions exist:

| Function | Input | Used By |
|----------|-------|---------|
| `assembleCuratorContext` | `EnrichedListingDetail` (DB row) | Showcase curator note cron, curator-note API |
| `assembleCuratorContextFromFormData` | `GenerateDescriptionFormData` (form fields) | Generate description API |

The form adapter can't use the DB-based function because the listing may not be saved yet (add mode). Both produce identical `CuratorNoteContext` output using the same filtering logic (sayagaki by content, provenance by owner_name, etc.).

### 4. Markdown Detection Regex

The `containsMarkdown()` regex was tightened after auditing 13,081 scraped descriptions:

```
/(\*[a-zA-Zā-ūÀ-ÿ].+?\*|^#{1,3}\s)/m
```

**Matches:** `*nie*`, `*Sōshū-den*`, `**bold**`, `## Heading`
**Rejects:** `> ` breadcrumbs (413 Toushin listings), `***` separators (7 listings), `- ` nav artifacts (1), `* ` line-wrap asterisks (1)

The scholar's note prompt instructs the model to use `*italics*` for Japanese technical terms and prose paragraphs only — no headers, no bullets. The regex is designed to match exactly this output while rejecting all known scraped patterns.

### 5. Confirm Before Replace

If the description textarea already has content, `handleGenerateNote()` shows a `window.confirm()` dialog before replacing. Prevents accidental loss of manually-written descriptions.

### 6. Details Sections Unfolded

Both `<details>` elements (Notes and More Details) changed from collapsed to `open`. Dealers were missing these fields entirely because they didn't know to click the disclosure triangles.

---

## Visibility Gates

| Gate | Location | Logic |
|------|----------|-------|
| Button visible | DealerListingForm | `canGenerateNote = certType === 'Juyo' \|\| certType === 'Tokubetsu Juyo'` |
| Button enabled | DealerListingForm | `hasNoteData = !!(artisanId \|\| setsumeiTextEn \|\| setsumeiTextJa)` |
| API validation | generate-description | `certType !== 'Juyo' && certType !== 'Tokubetsu Juyo' → 400` |
| Skip check | generate-description | `shouldSkipGeneration(context)` — no artisan AND no setsumei → 400 |
| Markdown render | TranslatedDescription | `containsMarkdown(displayText)` — regex match on `*word*` or `## ` |

---

## i18n Keys

| Key | EN | JA |
|-----|----|----|
| `dealer.generateNote` | Generate Scholar's Note | 解説文を生成 |
| `dealer.regenerateNote` | Regenerate Scholar's Note | 解説文を再生成 |
| `dealer.generatingNote` | Generating... | 生成中... |
| `dealer.generateNoteReplace` | This will replace your current description. Continue? | 現在の説明文が置き換えられます。続行しますか？ |
| `dealer.generateNoteNeedData` | Select an artisan or add setsumei data first | 先に作者を選択するか、説明文データを追加してください |

---

## Request Payload Shape

The form sends all available context to maximize note quality:

```typescript
{
  cert_type: string,        // "Juyo" | "Tokubetsu Juyo"
  item_type: string | null,
  artisan_id: string | null,
  nagasa_cm: number | null,
  sori_cm: number | null,
  motohaba_cm: number | null,
  sakihaba_cm: number | null,
  mei_type: string | null,
  mei_text: string | null,
  era: string | null,
  province: string | null,
  school: string | null,
  cert_session: number | null,
  setsumei_text_en: string | null,
  setsumei_text_ja: string | null,
  sayagaki: SayagakiEntry[] | null,
  hakogaki: HakogakiEntry[] | null,
  provenance: ProvenanceEntry[] | null,
  kiwame: KiwameEntry[] | null,
  koshirae: KoshiraeData | null,
}
```

---

## Scraped Description Audit Results

Audited 13,081 non-dealer descriptions for markdown false positives:

| Pattern | Hits | Source | False positive? |
|---------|------|--------|-----------------|
| `> ` (blockquote) | 413 | Toushin breadcrumbs (`種別 > 刀装具`) | Yes — rejected by tightened regex |
| `**` / `***` | 7 | Nihonto Art video disclaimers, Giheiya separators | Yes — rejected |
| `- ` (list) | 1 | Kanshoan nav fragment | Yes — rejected |
| `* ` (list) | 1 | Nihonto Australia line-wrap artifact | Yes — rejected |
| `# ` (heading) | 0 | — | — |
| `1. ` (numbered) | 0 | — | — |

**Post-fix result:** 0 false positives across 13,081 descriptions.

---

## Future Considerations

1. **JA generation** — Add `lang` body parameter to endpoint, call `generateCuratorNote(context, 'ja')`. The JA system prompt uses no markdown (plain prose only), so no rendering concern.
2. **Hozon/Tokubetsu Hozon** — Currently restricted to Juyo/TJ because the prompt is calibrated for NBTHK designation language. Extending to lower-tier certs would need prompt adjustments.
3. **Cost** — Each generation calls Opus via OpenRouter (~$0.05-0.10 per call). No rate limiting beyond dealer auth. If usage spikes, add per-dealer daily cap.
4. **`kasane_cm`** — The form doesn't have a kasane input field, so it's always null in the context. If added to the form later, wire it through the payload.
5. **Markdown in listing detail page** — `TranslatedDescription` is used in QuickView and also imported by `ListingDetailClient`. The markdown rendering applies everywhere the component is used.
