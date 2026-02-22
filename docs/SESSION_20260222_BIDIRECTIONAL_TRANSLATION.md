# Session: Bidirectional Translation (EN→JP for International Dealers)

**Date:** 2026-02-22
**Status:** Complete

## Problem

When the site is in JA locale, listings from the 8 international dealers (Legacy Swords, Nihonto.com, etc.) display English titles and descriptions with no Japanese translation. The existing system only translated JP→EN (for Japanese dealer listings). This created an asymmetric experience — Japanese users saw untranslated English text for ~20% of dealers.

## Solution

Mirrored the existing on-demand JP→EN translation flow so that JA-locale users get auto-translated Japanese for English-source listings. Also upgraded the translation model and extracted a shared utility.

### Direction Auto-Detection

The `/api/translate` endpoint now auto-detects direction based on source text:

| Source text | Direction | Target column | Prompt language |
|-------------|-----------|---------------|-----------------|
| Has Japanese | JP→EN (existing) | `title_en` / `description_en` | "Translate to English..." |
| No Japanese | EN→JP (new) | `title_ja` / `description_ja` | "Translate to natural Japanese..." |

No new API parameters needed — detection uses `containsJapanese()` on the source field.

### Model Upgrade

Replaced `google/gemini-2.0-flash-001` with `google/gemini-3-flash-preview` (Gemini 3 Flash).

### EN→JP Prompt Design

Prompts are tuned for nihonto-specific Japanese:
- **Title prompt:** Use appropriate kanji for standard sword terminology, preserve proper names in standard kanji form
- **Description prompt:** Write as a knowledgeable Japanese dealer would — formal but accessible, using standard nihonto terminology in kanji (銘, 無銘, 長さ, 反り, 赤銅, 四分一, etc.)

## Changes

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/083_ja_translation_columns.sql` | Adds `title_ja` and `description_ja` TEXT columns to listings |
| `src/lib/text/japanese.ts` | Shared `containsJapanese()` utility — single source of truth for Japanese character detection |

### Modified Files

| File | Change |
|------|--------|
| `src/app/api/translate/route.ts` | Bidirectional auto-detection, EN→JP prompts, model upgrade, `title_ja`/`description_ja` in SELECT and cache logic |
| `src/components/listing/TranslatedTitle.tsx` | JA-locale auto-fetch for English-source listings, uses cached `title_ja` |
| `src/components/listing/TranslatedDescription.tsx` | JA-locale auto-fetch for English-source listings, uses cached `description_ja` |
| `src/components/browse/ListingCard.tsx` | Uses `title_ja` for JA locale in browse grid, added to local interface and memo deps |
| `src/app/api/browse/route.ts` | Added `title_ja`, `description_ja` to SELECT columns |
| `src/lib/listing/getListingDetail.ts` | Added to `LISTING_SELECT`, `ListingWithDealer`, `EnrichedListingDetail`, return object |
| `src/types/index.ts` | Added `title_ja`, `description_ja` to `Listing` interface |
| `src/components/listing/MetadataGrid.tsx` | Import shared `containsJapanese` (was local copy) |
| `src/lib/seo/metaTitle.ts` | Import shared `containsJapanese` (was local copy) |
| `tests/api/translate.test.ts` | Rewrote for bidirectional: 41 tests (EN→JP section, model assertion, caching) |
| `tests/components/listing/TranslatedDescription.test.tsx` | Updated for EN→JP auto-fetch behavior: 14 tests |
| `CLAUDE.md` | Documented bidirectional translation, new columns, model upgrade |

## Data Flow

```
User opens listing in JA locale
    → TranslatedTitle / TranslatedDescription component mounts
    → containsJapanese(listing.description) → false (English source)
    → locale === 'ja' && !hasJapanese && !listing.description_ja
    → fetch('/api/translate', { listingId })
        → API auto-detects EN→JP direction
        → Calls OpenRouter (gemini-3-flash-preview) with EN→JP prompt
        → Caches result in listings.description_ja
        → Returns translation
    → Component displays Japanese translation
    → Next visit: cached description_ja returned immediately (no API call)
```

## Shared Utility Extraction

The `JAPANESE_REGEX` pattern was duplicated in 6 files. Extracted to `src/lib/text/japanese.ts`:

```typescript
const JAPANESE_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
export function containsJapanese(str: string): boolean {
  return JAPANESE_REGEX.test(str);
}
```

Updated imports in: translate API, TranslatedTitle, TranslatedDescription, MetadataGrid, metaTitle.

## Test Coverage

- **Translate API tests:** 41 tests (was ~30) — added EN→JP translation, EN→JP caching, EN→JP prompt validation, model assertion
- **TranslatedDescription tests:** 14 tests — updated "English in JA locale" test to verify EN→JP fetch trigger, added cached `description_ja` test
- **All pre-existing tests pass** — no regressions

## Key Design Decisions

1. **No new API parameters** — Direction auto-detected from source text, keeping the client interface unchanged
2. **Browse grid uses cached values only** — ListingCard reads `title_ja` but never triggers on-demand translation. Cache fills organically when users open QuickView/detail pages.
3. **JA locale defaults to showing original** — `showOriginal = true` for JA locale means English source text shows initially with translation loading in background, then toggle becomes available
4. **Backward compatible** — JP→EN flow completely unchanged; EN→JP is additive
