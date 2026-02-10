# Session: Denrai (Provenance) Within-Item Deduplication

**Date:** 2026-02-10
**Commit:** `6d783b0` — fix: Deduplicate denrai provenance within items to fix inflated owner counts

## Problem

The `gold_denrai_owners` array on each `gold_values` row aggregates owner names from ALL sibling catalog records (Tokuju, JE_Koto, Juyo). When different siblings describe the same provenance differently, both names ended up in the same item's array, inflating owner counts and group totals on artist profile pages.

### Examples

**MIT281 (Mitsutada) — Imperial Family group:**
- One sibling record: "Kaninomiya Family" (category: `family`)
- Another sibling record: "Prince Kan'in Haruhito" (category: `person`)
- Both referred to the same entity, counted as 2 separate entries

**MAS590 (Masamune):**
- Sum of all owner counts was ~217, but only 96 total items exist
- Inflated because items had both generic family names AND specific person names for the same provenance

### Root Cause

`getDenraiForArtisan()` treated every unique owner string in a row's array as independent. It had no awareness of the `category` field in `denrai_canonical_names` (which distinguishes 'person' vs 'family' vs 'institution'), so it couldn't detect that "Kaninomiya Family" and "Prince Kan'in Haruhito" were redundant within the same item.

## Fix

### Dedup Rules (applied per-item before counting)

Each item's owners are grouped by `groupKey = parent_canonical || owner`, then:

1. **Remove generic parent:** If a group has any child (owner != groupKey), remove the groupKey entry itself
   - "Tokugawa Family" + "Shogun Ienobu" in same item -> remove "Tokugawa Family"
2. **Person trumps family:** Among remaining children, if both 'person' and 'family' categories exist in the same group, remove 'family' entries
   - "Kaninomiya Family" (family) + "Prince Kan'in Haruhito" (person) -> keep only the person
3. **Keep all persons:** Different people in the same family are legitimate provenance
   - "Tokugawa Ieyasu" + "Tokugawa Iesato" -> keep both
4. **Keep everything else:** institution, shrine, uncategorized entries preserved

### Changes

#### 1. `src/lib/supabase/yuhinkai.ts` — Core logic

**Added:**
- `DenraiResult` interface — bundles `owners`, `itemCount`, and `canonicalMap` so the grouped function can reuse the canonical lookup data without extra queries
- `dedupWithinItem()` — pure function implementing the 4 dedup rules above

**Modified:**
- `getDenraiForArtisan()` — return type changed from `Array<{owner, count}>` to `DenraiResult`. Now fetches `category` alongside `parent_canonical` from `denrai_canonical_names`, applies `dedupWithinItem()` per row before counting
- `getDenraiGrouped()` — accepts optional `precomputed?: DenraiResult` param. When provided, uses its `owners` + `canonicalMap` directly (zero extra queries). Falls back to calling `getDenraiForArtisan` internally for backward compat

#### 2. `src/app/artists/[slug]/page.tsx` — Artist page SSR

Replaced parallel `getDenraiForArtisan` + `getDenraiGrouped` in `Promise.all` with:
- `getDenraiForArtisan` in `Promise.all` (returns `DenraiResult`)
- `getDenraiGrouped(code, type, denraiResult)` called sequentially after (zero DB queries)
- Response uses `denraiResult.owners` for flat denrai array

#### 3. `src/app/api/artisan/[code]/route.ts` — Artisan API

Identical restructuring as page.tsx.

## Performance Impact

| Metric | Before | After |
|--------|--------|-------|
| `gold_values` queries | 2 (duplicate) | 1 |
| `denrai_canonical_names` queries | 1 (parent only) | 1 (parent + category) |
| **Total DB queries per artist page** | **3** | **2** |

## Verification (Production)

Tested on `nihontowatch.com` after deploy:

**MIT281 (Mitsutada):**
- "Kaninomiya Family" removed from Imperial Family group
- Only "Prince Kan'in Haruhito" (person) remains
- Imperial Family totalCount: 4 (was inflated before)

**MAS590 (Masamune):**
- Owner count sum: 188 (down from ~217)
- Redundant family+person entries collapsed across all groups

**CHO10 (Chogi):**
- Family-only entries preserved correctly (dedup only fires when person+family coexist)
- Grouping structure intact

**Page load:** `/artists/mitsutada-MIT281` — HTTP 200 in ~2.4s

## Key Files

| File | Change |
|------|--------|
| `src/lib/supabase/yuhinkai.ts` | `DenraiResult` interface, `dedupWithinItem()`, modified `getDenraiForArtisan` + `getDenraiGrouped` |
| `src/app/artists/[slug]/page.tsx` | Sequential denrai fetch with precomputed result |
| `src/app/api/artisan/[code]/route.ts` | Same restructuring as page.tsx |
