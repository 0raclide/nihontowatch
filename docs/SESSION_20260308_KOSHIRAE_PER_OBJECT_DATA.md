# Session: Koshirae Per-Object Data Model Extension

**Date:** 2026-03-08
**Commits:** `783aaa6` (data model + sanitizer), `78cd6b0` (cert pills overflow), `0dc44bc` (image upload 404)
**Trigger:** Listing 90396 (Juyo Wakizashi with Juyo Koshirae) — Showcase rendered "Mito School · Meiji Period" but `KoshiraeData` had no fields to store this. The blade and koshirae are two distinct physical objects with independent attribution.

---

## Problem

The koshirae JSONB lacked attribution context fields. A koshirae could reference a maker (artisan_id) but couldn't record:
- **Era** — the koshirae's period (e.g., Meiji), independent of the blade's era (e.g., Kamakura)
- **Province** — where the koshirae was made (e.g., Hitachi/Mito)
- **School** — the tradition (e.g., Mito school, Yokoya school)

Similarly, individual koshirae components (tsuba, menuki, etc.) had no way to record whether they bear a maker's signature.

---

## Changes

### New Fields

**KoshiraeData** (3 new — all optional for backward compat):
| Field | Type | Purpose |
|-------|------|---------|
| `era` | `string \| null` | Period of the koshirae |
| `province` | `string \| null` | Province of koshirae maker |
| `school` | `string \| null` | School/tradition |

**KoshiraeComponentEntry** (2 new — all optional):
| Field | Type | Purpose |
|-------|------|---------|
| `signed` | `boolean` | Whether component bears a signature |
| `mei_text` | `string \| null` | Kanji of the signature. Normalized to null when `signed === false` |

### Files Changed (11)

| File | Change |
|------|--------|
| `src/types/index.ts` | Added 5 new fields to interfaces |
| `src/components/dealer/KoshiraeSection.tsx` | `createEmptyKoshirae()` includes new fields; era/province/school input row; catalog prefill wires through era/province/school |
| `src/components/dealer/KoshiraeMakerSection.tsx` | `createEmptyComponent()` includes `signed: false, mei_text: null` |
| `src/components/dealer/KoshiraeComponentCard.tsx` | "Signed (在銘)" checkbox + conditional mei_text input |
| `src/app/api/dealer/listings/route.ts` | POST handler uses shared `sanitizeKoshirae()` |
| `src/app/api/dealer/listings/[id]/route.ts` | PATCH handler now sanitizes koshirae JSONB (was unsanitized) |
| `src/components/listing/KoshiraeDisplay.tsx` | Era/province/school metadata line; signed mei_text on components |
| `src/components/showcase/ShowcaseKoshirae.tsx` | Era/province/school centered line; signed mei_text on component cards |
| `src/i18n/locales/en.json` | 6 new keys |
| `src/i18n/locales/ja.json` | 6 new keys |
| `src/lib/dealer/sanitizeKoshirae.ts` | **NEW** — shared sanitizer |
| `tests/lib/dealer/sanitizeKoshirae.test.ts` | **NEW** — 16 tests |

### No DB Migration

JSONB is schema-less — new fields are simply present or absent. Old data without the new fields renders correctly via optional chaining (`koshirae.era &&`, `comp.signed &&`).

---

## sanitizeKoshirae() — Security Fix

### Before
- **POST** handler had 40 lines of inline `(koshirae as Record<string, unknown>).field` casts — correct but verbose
- **PATCH** handler passed koshirae JSONB straight through to Supabase via `ALLOWED_FIELDS` — **no field whitelisting, no length limits, no type coercion**. An attacker could inject arbitrary keys into the JSONB column.

### After
Shared `sanitizeKoshirae(raw: unknown): KoshiraeData | null` in `src/lib/dealer/sanitizeKoshirae.ts`:
- Whitelists every field explicitly — unknown keys are dropped
- Trims strings and enforces length limits (era/province/school: 100, mei_text: 200, description: 2000, setsumei: 10000)
- Strips `blob:` URLs from images
- Validates `component_type` against allowed values (defaults to `'other'`)
- Normalizes `mei_text` to null when `signed === false`
- Generates UUID for components with missing `id`

Both POST and PATCH now call the same function.

### Test Coverage
16 tests in `tests/lib/dealer/sanitizeKoshirae.test.ts`:
- Null/falsy/non-object input → null
- Valid field passthrough
- Blob URL stripping
- String trimming + length enforcement
- Injected field stripping
- Component type validation
- Signed/mei_text normalization
- Backward compatibility with legacy data

---

## Design Notes & Known Gaps

### 1. `signed`/`mei_text` missing from single-maker mode
Added to `KoshiraeComponentEntry` (multi-maker) but not to `KoshiraeData` itself. A single-maker koshirae can bear the maker's signature (e.g., issaku by Umetada Myōju). To record this today, the dealer must use multi-maker mode with one component. Low priority — most signed koshirae have individually attributed components anyway.

### 2. `era` name collision
Both the listing and its koshirae now have `era` fields. The blade's era lives in `listings.era` (a DB column). The koshirae's era lives in `listings.koshirae->>'era'` (JSONB). Display code correctly scopes to `koshirae.era`, but future queries or grep-based searches should be aware of both contexts.

### 3. JSONB complexity growing
The koshirae JSONB now has ~18 fields with nested arrays. If koshirae ever becomes searchable/filterable (e.g., "show me all koshirae from Meiji period"), a dedicated table would be more appropriate than GIN-indexing JSONB paths. For now (display-only, dealer-entered), JSONB is fine.

### 4. Catalog prefill
`handleCatalogPrefill` in `KoshiraeSection.tsx` now wires through `era`, `province`, and `school` from `CatalogPrefillFields`. Whether Yuhinkai catalog cards actually populate these fields for koshirae entries depends on the RPC — the fields exist in the interface but may be null for most koshirae catalog records.

---

## i18n Keys Added

| Key | EN | JA |
|-----|----|----|
| `dealer.koshiraeAttribution` | Era / Province / School | 時代・国・流派 |
| `dealer.koshiraeEra` | Era (e.g. Meiji) | 時代（例：明治） |
| `dealer.koshiraeProvince` | Province (e.g. Hitachi) | 国（例：常陸） |
| `dealer.koshiraeSchool` | School (e.g. Mito) | 流派（例：水戸） |
| `dealer.componentSigned` | Signed (在銘) | 在銘 |
| `dealer.componentMeiText` | Inscription (銘文) | 銘文 |

---

## Display Rendering

### KoshiraeDisplay (QuickView / MobileSheet / ListingDetail)
- Era/province/school shown as dot-separated line: `Meiji · Hitachi · Mito School`
- Only segments with values shown (filter Boolean)
- Positioned after cert badge, before maker display
- Component mei_text shown inline after artisan name: `Nobuie (信家)`

### ShowcaseKoshirae (Showcase layout)
- Centered era/province/school line below cert badge
- Component mei_text shown below kanji in italic

Both use the same pattern: `{[koshirae.era, koshirae.province, koshirae.school].filter(Boolean).join(' · ')}`

---

## Bug Fixes (same session)

### Cert pills overflow koshirae card (`78cd6b0`)
**Problem:** The 5 cert pills (Tokujū, Jūyō, Jūyō Bijutsuhin, Tokuho, Hozon) plus "No Papers" exceeded the width of the koshirae card's `p-3` padding on narrow viewports.

**Fix:**
- `CertPills.tsx`: Reduced pill sizing from `px-3 py-1.5 text-[12px] gap-2` → `px-2.5 py-1 text-[11px] gap-1.5`
- `KoshiraeSection.tsx`: Added `overflow-hidden` on the card container as a safety net

**Note:** `CertPills` is also used on the main form's cert row. The tighter sizing applies globally, but all 6 pills now fit on one row at ~760px+ width.

### Koshirae image upload 404 after delete + re-add (`0dc44bc`)
**Problem:** In edit mode, when a dealer deletes koshirae (Remove Koshirae button) and re-adds it, the new koshirae only exists in client state — the PATCH hasn't fired yet. Attempting to upload photos hits `POST /api/dealer/koshirae-images`, which reads `listing.koshirae` from the DB, finds `null`, and returns `404: "Koshirae data not found on listing"`.

**Fix:** `koshirae-images/route.ts` line 55-56 — instead of rejecting when `listing.koshirae` is null, initialize a default empty `KoshiraeData` and proceed with the upload. The DB write at line 92 creates the koshirae JSONB with the new image URL.

**Root cause:** The edit-mode image upload is eager (fires immediately on file select), but the koshirae container state is lazy (only PATCHed on form save). This ordering mismatch meant the API's existence check (`if (!koshirae) return 404`) was too strict.

**Same pattern exists for:** The sayagaki and provenance image upload APIs likely have the same issue — they may also reject if the parent JSONB doesn't exist in DB yet. Not verified this session.

---

## Other JSONB fields with the same PATCH sanitization gap

The `sanitizeKoshirae()` extraction fixed the koshirae PATCH path. These JSONB fields still have **no PATCH-side validation** — raw client JSON goes straight to DB:

| Field | POST validation | PATCH validation | Risk |
|-------|----------------|------------------|------|
| `sayagaki` | Inline whitelist (route.ts) | None | Arbitrary JSONB injection |
| `hakogaki` | Inline whitelist (route.ts) | None | Arbitrary JSONB injection |
| `provenance` | Inline whitelist (route.ts) | None | Arbitrary JSONB injection |
| `kiwame` | Inline whitelist (route.ts) | None | Arbitrary JSONB injection |
| `kanto_hibisho` | Inline whitelist (route.ts) | None | Arbitrary JSONB injection |
| `koshirae` | `sanitizeKoshirae()` | `sanitizeKoshirae()` | **Fixed** |

Each should get the same treatment: extract a `sanitize{Field}()` helper, wire into both POST and PATCH.
