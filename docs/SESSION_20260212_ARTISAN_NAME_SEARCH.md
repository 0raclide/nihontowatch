# Session: Artisan Name Resolution in Search

**Date:** 2026-02-12
**Commit:** `60b994b`
**Status:** Deployed to production

---

## Problem

Searching "Soshu Norishige" returned 0 results, while searching the artisan code "NOR312" directly returned 9 results.

**Root cause:** The LLM artisan matcher (Oshi-scrapper) assigns `artisan_id=NOR312` to listings, but the human-readable name "Norishige" lives only in the Yuhinkai database. For listings where the `smith` field is empty or kanji-only, there's nothing in `search_vector` for FTS to match on.

**Same bug in saved search alerts:** `matcher.ts` uses ILIKE on listing fields but never checks `artisan_id`. Alerts for "Norishige" silently miss artisan-matched listings. Additionally, `countMatchingListings` drops text words entirely after semantic extraction (counts were inflated).

---

## Solution

When text words remain after semantic extraction, resolve them to Yuhinkai artisan codes. If codes are found, switch from FTS to ILIKE on structured fields + `artisan_id.eq.CODE` conditions.

### Search Flow After Fix

```
"Soshu Norishige"
  1. parseSemanticQuery → provinces: ['Soshu'], remainingTerms: ['norishige']
  2. Apply province filter: province/school/tosogu_school ILIKE '%Soshu%'
  3. resolveArtisanCodesFromText(['norishige']) → [NOR312, NOR567, ...]
  4. Apply: .or('title.ilike.%norishige%, smith.ilike.%norishige%, ..., artisan_id.eq.NOR312, artisan_id.eq.NOR567, ...')
  5. Result: finds BOTH text-matched AND artisan-matched listings

"iron tsuba" (no artisan match)
  1. parseSemanticQuery → itemTypes: ['tsuba'], remainingTerms: ['iron']
  2. resolveArtisanCodesFromText(['iron']) → [] (no artisan named "iron")
  3. Falls through to existing FTS: .textSearch('search_vector', 'iron:*')
  4. Behavior unchanged
```

---

## Files Changed (3)

### 1. `src/lib/supabase/yuhinkai.ts` — New `resolveArtisanCodesFromText()`

```typescript
export async function resolveArtisanCodesFromText(textWords: string[]): Promise<string[]>
```

- Queries `smith_entities` and `tosogu_makers` in parallel
- For each word: `.or('name_romaji.ilike.%word%,name_kanji.ilike.%word%,school.ilike.%word%')`
- Chained `.or()` calls = AND across words (e.g., "Rai" AND "Kunimitsu")
- Excludes school codes (`is_school_code = false`)
- Limits to 100 results per table, returns deduplicated codes
- Returns `[]` if Yuhinkai not configured (graceful degradation)

### 2. `src/app/api/browse/route.ts` — Artisan-aware text search (Step 4)

**Before:** Always used FTS on `search_vector`.

**After:**
- Calls `resolveArtisanCodesFromText()` with remaining text words
- If codes found: switches to ILIKE on structured fields (`title`, `smith`, `tosogu_maker`, `school`, `tosogu_school`) + `artisan_id.eq.CODE` for each resolved code
- If no codes: falls through to existing FTS path (zero behavior change)

### 3. `src/lib/savedSearches/matcher.ts` — Three fixes

| Fix | Description |
|-----|-------------|
| **A** | Artisan code regex detection — codes like `MAS590` now add `artisan_id.ilike` condition |
| **B** | Artisan name resolution — calls `resolveArtisanCodesFromText()`, adds `artisan_id.eq.CODE` alongside existing field ILIKEs |
| **C** | `countMatchingListings` text words restored — was silently dropping `textWords` after semantic extraction, inflating alert counts |

---

## Production Test Results

| Search | Before | After | Path |
|--------|--------|-------|------|
| `Soshu Norishige` | 0 | **5** | ILIKE + artisan_id |
| `NOR312` | 9 | 9 | artisan code detection (unchanged) |
| `Norishige` | ~3 | **17** | ILIKE + artisan_id |
| `Rai Kunimitsu` | ~1 | **4** | ILIKE + artisan_id (AND logic) |
| `Katsuhira` | 1 | 1 | ILIKE + artisan_id (HIT041 resolved) |
| `iron tsuba` | 19 | 19 | FTS fallback (no artisan match) |
| `katana` | 1592 | 1592 | FTS fallback (no artisan match) |
| `Masamune` | 3 | 3 | ILIKE + artisan_id |

---

## Performance

- Yuhinkai resolution: ~50-100ms (ILIKE on ~13K rows in separate DB)
- Only triggered when non-empty text words remain after semantic extraction
- Browse API already makes a Yuhinkai round-trip for display name enrichment, so comparable additional cost
- Matcher (cron job): latency non-critical

---

## Approaches Rejected

1. **FTS inside `.or()`** — `&` in tsquery conflicts with URL parameter syntax in Supabase `.or()`. Documented codebase issue.
2. **Denormalizing artisan names into listings table** — DB migration + backfill of ~45K listings, introduces staleness if Yuhinkai names are corrected.
