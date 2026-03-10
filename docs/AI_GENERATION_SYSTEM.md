# AI Content Generation System

NihontoWatch uses **4 AI generation pipelines**, all routed through OpenRouter. Setsumei translations are human-curated (not AI-generated).

---

## Architecture Overview

| Feature | Trigger | Model | Output | Stored? |
|---------|---------|-------|--------|---------|
| **Curator Notes** | Admin button or script | `anthropic/claude-opus-4-6` | EN + JA scholarly texts | Yes (`ai_curator_note_{en,ja}`) |
| **Translations** | Auto on locale switch | `google/gemini-3-flash-preview` | Title or description | Yes (`{title,description}_{en,ja}`) |
| **Inquiry Emails** | User form submit | `google/gemini-2.0-flash-001` | EN + JA business email | No (user copies) |
| **Dealer Descriptions** | Dealer form preview | `anthropic/claude-opus-4-6` | EN preview text | No (preview only) |

**Common config:**
- API: `https://openrouter.ai/api/v1/chat/completions`
- Auth: `OPENROUTER_API_KEY` env var
- Headers: `HTTP-Referer: https://nihontowatch.com`

---

## 1. Curator's Notes

Museum-quality scholarly descriptions for significant listings. The most complex pipeline.

### Trigger Points
- **API**: `POST /api/listing/[id]/curator-note` (admin-only, `?force=true` to regenerate)
- **Script**: `npx tsx scripts/generate-curator-note.mts <listing_id>`
- **Dealer preview**: `POST /api/dealer/generate-description` (EN only, cert-gated to Juyo/Tokuju)

### Pipeline

```
Listing (DB) ─────────────────────────┐
Artisan entity (Yuhinkai) ────────────┤
AI biography (Yuhinkai) ──────────────┤─→ assembleCuratorContext()
Artist page data → distillArtistOverview() ──┤    ↓
Research notes (free text) ───────────┘  CuratorNoteContext
                                              ↓
                                    buildSystemPrompt(lang)
                                    buildUserPrompt(context, lang)
                                              ↓
                                    generateCuratorNote(context, 'en')
                                    generateCuratorNote(context, 'ja')
                                              ↓
                                    Store: ai_curator_note_en/ja
                                           ai_curator_note_input_hash
                                           ai_curator_note_generated_at
```

### Context Assembly (`curatorNote.ts`)

Two entry points, same output type:
- **`assembleCuratorContext(listing, artisanEntity, aiDescription, artistOverview)`** — from DB listing
- **`assembleCuratorContextFromFormData(formData, artisanEntity, aiDescription, artistOverview)`** — from dealer form (pre-save preview)

**10 structured sections** (only included when data exists):

| # | Section | Source |
|---|---------|--------|
| 1 | Sword data | Listing: type, specs, mei, era, province, school, cert |
| 2 | Artisan data | Yuhinkai: name, school, era, teacher, elite_factor, cert counts, ai_biography |
| 3 | Setsumei | Listing: setsumei_text_en/ja |
| 4 | Sayagaki | Listing JSONB: author + content array |
| 5 | Hakogaki | Listing JSONB: author + content array |
| 6 | Provenance | Listing JSONB: owner_name, notes array |
| 7 | Kiwame | Listing JSONB: judge_name, type, notes array |
| 8 | Koshirae | Listing JSONB: cert, artisan, description |
| 9 | Research notes | Listing: free-text dealer/collector context |
| 10 | Artist overview | Distilled from Yuhinkai page: form/mei distributions, top students, school ancestry, elite percentile, provenance owners |

### Data Richness Classification

Drives prompt length instructions:

| Level | Criteria | EN words | JA chars |
|-------|----------|----------|----------|
| `full` | Setsumei + (sayagaki/provenance/koshirae/hakogaki/kiwame/research_notes) + artisan | 350-500 | 800-1400 |
| `moderate` | Setsumei + artisan, no rich supplementary data | 200-300 | 500-800 |
| `sparse` | Artisan OR setsumei (not both) | 150-200 | 300-500 |
| `minimal` | Neither artisan nor setsumei | Skipped | Skipped |

### Input Hash Caching

- `computeInputHash(context)` — SHA-256 of serialized context
- If hash matches stored `ai_curator_note_input_hash`, returns cached notes
- `?force=true` bypasses cache

### Skip Logic

`shouldSkipGeneration(context)` returns true if no artisan AND no setsumei — not enough data for a meaningful note.

### Prompt Design (`curatorNotePrompt.ts`)

**System prompts** (separate EN/JA):
- NBTHK-trained scholar voice
- No fabrication, no price/value refs, no promotional language
- Cite statistics, attribute claims, hedge unverified research notes (rule 6: "according to the consignor")
- Structure: Context → Observation → Significance → Koshirae (optional)
- EN: italicize *technical terms*, use macrons (Juyo → Jūyō), quote setsumei in "quotes"
- JA: no markdown, kanji technical terms, formal scholarly register

**Model params:** `temperature: 0.4`, `max_tokens: 1500 (EN) / 2000 (JA)`

### Artist Overview Distillation (`distillArtistOverview.ts`)

Compresses full `ArtisanPageResponse` into compact `ArtistOverview`:
- `form_distribution`: Record<string, number> (e.g., `{katana: 45, wakizashi: 12}`)
- `mei_distribution`: Record<string, number> (e.g., `{zaimei: 30, mumei: 8}`)
- `top_students`: top 5 by elite_factor with cert counts
- `school_ancestry`: string[] breadcrumb lineage
- `elite_percentile`: 0-100 ranking
- `top_provenance_owners`: top 5 with counts

**Non-fatal** — wrapped in try/catch; generation continues if Yuhinkai call fails.

### Key Files

| Component | Location |
|-----------|----------|
| API route | `src/app/api/listing/[id]/curator-note/route.ts` |
| Context assembly | `src/lib/listing/curatorNote.ts` |
| Prompt builder | `src/lib/listing/curatorNotePrompt.ts` |
| OpenRouter call | `src/lib/listing/generateCuratorNote.ts` |
| Artist overview | `src/lib/listing/distillArtistOverview.ts` |
| Batch script | `scripts/generate-curator-note.mts` |
| Dealer preview | `src/app/api/dealer/generate-description/route.ts` |
| Tests (50) | `tests/lib/listing/curatorNote.test.ts`, `curatorNotePrompt.test.ts`, `distillArtistOverview.test.ts` |

---

## 2. Listing Translations

Bidirectional JP↔EN translation of titles and descriptions. Auto-detects direction from source text.

### API: `POST /api/translate`

Public endpoint (rate-limited: 10/min per IP).

**Request:** `{ listingId, type: "title" | "description" }`

### Direction Detection

Uses `isPredominantlyJapanese()` from `src/lib/text/japanese.ts`:

| Source language | Type | Cached column |
|----------------|------|---------------|
| Japanese → EN | title | `title_en` |
| Japanese → EN | description | `description_en` |
| English → JP | title | `title_ja` |
| English → JP | description | `description_ja` |

### Model

`google/gemini-3-flash-preview`, `temperature: 0.3`, `max_tokens: 200 (title) / 2000 (description)`

### Prompts

- JP→EN: Preserve technical terms in romaji (mei, mumei, nagasa, sori, shakudo)
- EN→JP: Use kanji nihonto terminology (銘, 無銘, 長さ, 反り, 赤銅, 四分一)

### UI Integration

- **`TranslatedTitle`** — Auto-fetches on demand per locale
- **`TranslatedDescription`** — Toggle: "Show original" / "翻訳を表示"
- **`ListingCard`** — Uses `title_en`/`title_ja` if cached
- **`MetadataGrid`** — `getArtisanInfo(listing, locale)` localizes artisan names

### Key Files

| Component | Location |
|-----------|----------|
| API route | `src/app/api/translate/route.ts` |
| Japanese detection | `src/lib/text/japanese.ts` |
| TranslatedTitle | `src/components/listing/TranslatedTitle.tsx` |
| TranslatedDescription | `src/components/listing/TranslatedDescription.tsx` |
| Tests (20+) | `tests/api/translate.test.ts` |

---

## 3. Inquiry Emails

Generates culturally-appropriate Japanese business emails (keigo) for collectors contacting Japanese dealers.

### API: `POST /api/inquiry/generate`

Authenticated users only.

**Request:** `{ listingId, buyerName, buyerCountry, message }`

**Response:** `{ email_ja, email_en, subject_ja, subject_en, dealer_email, dealer_name, dealer_policies }`

### Prompt Design (`src/lib/inquiry/prompts.ts`)

**Voice:** Expert translator + cultural consultant with deep Japanese business communication knowledge.

**Keigo structure:**
- 尊敬語 (sonkeigo) for dealer
- 謙譲語 (kenjougo) for buyer
- 丁寧語 (teineigo) general politeness

**Email format:**
1. Subject with item reference
2. [店名] 御中 / ご担当者様
3. 拝啓 + seasonal greeting (時候の挨拶) — **required**, auto-generated from `src/lib/inquiry/seasonal.ts`
4. Self-introduction (name, country, collector status)
5. 突然のご連絡失礼いたします
6. Main inquiry content
7. Tax-free export pricing mention (免税価格) when purchase intent shown
8. 敬具 / 何卒よろしくお願い申し上げます
9. Signature

**Model:** `google/gemini-2.0-flash-001`, `temperature: 0.7`, `max_tokens: 3000`

**Output parsing:** Strips markdown code fences, fixes literal newlines in JSON strings, extracts `{...}` bounds.

### Key Files

| Component | Location |
|-----------|----------|
| API route | `src/app/api/inquiry/generate/route.ts` |
| Prompts | `src/lib/inquiry/prompts.ts` |
| Validation | `src/lib/inquiry/validation.ts` |
| Seasonal greetings | `src/lib/inquiry/seasonal.ts` |
| UI modal | `src/components/inquiry/InquiryModal.tsx` |
| Tests (55+) | `tests/api/inquiry/generate.test.ts`, `tests/components/inquiry/InquiryModal.test.tsx` |

---

## 4. Dealer Description Preview

Reuses the curator note pipeline for dealer form previews. EN only, restricted to Juyo/Tokuju items.

### API: `POST /api/dealer/generate-description`

Dealer-only auth. Returns `{ description, data_richness }`.

### Differences from Curator Note API

| Aspect | Curator Note | Dealer Description |
|--------|-------------|-------------------|
| Auth | Admin | Dealer |
| Languages | EN + JA | EN only |
| Input | DB listing | Form fields (pre-save) |
| Cert gate | None | Juyo/Tokuju only |
| Storage | Yes (DB) | No (preview only) |
| Context fn | `assembleCuratorContext()` | `assembleCuratorContextFromFormData()` |

---

## Setsumei Translations (NOT AI-Generated)

NBTHK certification descriptions are **human-curated**, not AI-generated in this codebase. Imported from NBTHK documents and expert translations.

**DB columns:** `setsumei_text_en`, `setsumei_text_ja`, `setsumei_image_url`, `setsumei_metadata`, `setsumei_processed_at`

**Used as input** to curator note generation (section 3 of the prompt).

---

## Design Patterns

1. **Input hash caching** — SHA-256 of serialized context prevents redundant generation
2. **Non-fatal enrichment** — Artist overview wrapped in try/catch; generation continues on failure
3. **Adaptive prompt length** — System instructions scale output verbosity by data richness
4. **Rich section filtering** — Only include prompt sections with actual data
5. **Bidirectional auto-detection** — Translation direction determined from source text content
6. **Form context adapter** — `assembleCuratorContextFromFormData()` mirrors DB-based assembly for pre-save previews
7. **JSON response recovery** — Inquiry emails strip markdown fences, fix embedded newlines, extract JSON bounds
