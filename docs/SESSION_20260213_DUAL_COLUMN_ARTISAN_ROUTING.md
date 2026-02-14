# Session: Dual-Column Artisan Routing Fix (HIT041)

**Date:** 2026-02-13
**Commits:** `110900b` (nihontowatch), `3e409bd` (oshi-v2)
**Trigger:** HIT041 (Hagiya Katsuhira) showed 7 Juyo instead of 11 across stats, distributions, hero image, and provenance

---

## Problem

Artisan HIT041 has 11 objects in the Yuhinkai database but only 7 appeared on the NihontoWatch artist page. The bug affected stats counters, form distribution charts, hero image selection, and provenance (denrai) data.

### Data Layout

| Column | Objects | Forms |
|--------|---------|-------|
| `gold_maker_id = 'HIT041'` | 7 | tsuba (6), menuki (1) |
| `gold_smith_id = 'HIT041'` | 4 | uchigatana (1), daishō-soroi-kanagu (1), mitsudogu (1), tosogu (1) |

The 4 objects in `gold_smith_id` were invisible to all single-column queries.

## Root Cause (Three Layers)

### Layer 1: `synthesize_object()` form-type whitelist (oshi-v2)

Migration 270 rewrote `synthesize_object()` with a hardcoded 9-item whitelist to decide whether an artisan code goes in `gold_maker_id` (tosogu) or `gold_smith_id` (smith):

```sql
IF v_form_type IN ('tsuba','fuchi-kashira','menuki','kozuka','kogai',
                   'fuchi','kashira','soroimono','mitokoromono') THEN
  v_maker_id := v_winning_code;
ELSE
  v_smith_id := v_winning_code;
END IF;
```

Forms like `mitsudogu`, `daishō-soroi-kanagu`, and `tosogu` (the generic label) were **not** in the whitelist, so they fell through to `gold_smith_id` even when the artisan was a tosogu maker.

### Layer 2: Stats functions query one column (oshi-v2)

`recompute_artisan_stats()`, `compute_maker_statistics()`, `compute_provenance_factor()`, and `recompute_provenance_factor()` each used single-column `WHERE` clauses:
- Smith branch: `WHERE gv.gold_smith_id = v_code`
- Maker branch: `WHERE gv.gold_maker_id = v_code`

Misrouted objects in the wrong column were invisible to stats computation.

### Layer 3: Frontend queries one column (nihontowatch)

Three functions in `yuhinkai.ts` selected the query column based on `entityType`:

```typescript
const idCol = entityType === 'smith' ? 'gold_smith_id' : 'gold_maker_id';
.eq(idCol, code)
```

This matched the database bug, compounding the undercount on the frontend.

## Fix

### Migration 290: Reference-table lookup in `synthesize_object()` (oshi-v2)

Replaced the form-type whitelist in Step D with reference-table lookups against `tosogu_makers` and `smith_entities`:

```sql
SELECT EXISTS(SELECT 1 FROM tosogu_makers WHERE maker_id = v_winning_code)
  INTO v_in_tosogu_makers;
SELECT EXISTS(SELECT 1 FROM smith_entities WHERE smith_id = v_winning_code)
  INTO v_in_smith_entities;

IF v_in_tosogu_makers THEN
  v_maker_id := v_winning_code;
ELSIF v_in_smith_entities THEN
  v_smith_id := v_winning_code;
ELSE
  -- Fallback to gold_item_type
  IF v_item_type = 'tosogu' THEN v_maker_id := v_winning_code;
  ELSE v_smith_id := v_winning_code;
  END IF;
END IF;
```

**Data repair** at the end of the migration re-synthesized all misrouted objects:
- 611 objects where `gold_smith_id` belonged to a `tosogu_makers` entry
- 24 objects where `gold_maker_id` belonged to a `smith_entities` entry

### Migration 291: Dual-column stats & provenance (oshi-v2)

Rewrote all four stats/provenance functions:

| Function | Pattern | Change |
|----------|---------|--------|
| `recompute_artisan_stats()` | Targeted (per-code) | `WHERE (gv.gold_smith_id = v_code OR gv.gold_maker_id = v_code)` |
| `compute_maker_statistics()` | Batch (all artisans) | UNION to normalize both columns into single `artisan_id` |
| `recompute_provenance_factor()` | Targeted | Same OR pattern |
| `compute_provenance_factor()` | Batch | Same UNION pattern |

Migration ends by re-running both batch functions to repopulate all stats.

### `yuhinkai.ts`: Three functions fixed (nihontowatch)

All three changes follow the same pattern:

```typescript
// Before:
const idCol = entityType === 'smith' ? 'gold_smith_id' : 'gold_maker_id';
.eq(idCol, code)

// After:
.or(`gold_smith_id.eq.${code},gold_maker_id.eq.${code}`)
```

| Function | Line | Purpose |
|----------|------|---------|
| `getArtisanDistributions()` | ~1194 | Form/mei/collection distribution charts |
| `getArtisanHeroImage()` | ~1269 | Best image for artist profile header |
| `getDenraiForArtisan()` | ~1829 | Provenance (denrai) owner analysis |

Note: `getPublishedCatalogueEntries()` was already fixed in `35791b5` (previous session).

## Implementation Notes

### Migration 290 required full function copy

The first attempt tried to surgically modify only Step D of `synthesize_object()` while simplifying sections 5-9. This caused a SQL syntax error (`WITH ORDINALITY` inside a subquery). The correct approach was copying migration 270 **verbatim** (all 943 lines, 9 sections) and only changing Step D + adding 2 DECLARE variables.

### UNION vs OR patterns

- **Targeted functions** (per-artisan-code loop): Simple `OR` in WHERE clause
- **Batch functions** (all artisans at once): `UNION` to normalize both columns into a single `artisan_id` CTE, then aggregate from that CTE. Required mirrored joins to ensure smith codes in `gold_maker_id` are attributed correctly and vice versa.

## Files Changed

### oshi-v2

| File | Change |
|------|--------|
| `supabase/migrations/290_fix_artisan_routing.sql` | New: Reference-table lookup in `synthesize_object()` + data repair |
| `supabase/migrations/291_dual_column_stats.sql` | New: Dual-column stats/provenance functions |
| `tests/artisan-routing.test.ts` | New: 4 golden tests (live DB integration) |

### nihontowatch

| File | Change |
|------|--------|
| `src/lib/supabase/yuhinkai.ts` | `.eq()` to `.or()` in 3 functions |
| `tests/lib/dualColumnArtisan.test.ts` | New: 8 golden tests (mocked Supabase) |

## Golden Tests

### oshi-v2 (`tests/artisan-routing.test.ts`) — 4 tests, live DB

1. **HIT041 total_items = 11 after recompute** — canonical regression test
2. **Misrouted objects counted by recompute_artisan_stats** — OR logic works for both columns
3. **synthesize_object routes HIT041 to gold_maker_id** — reference-table lookup correct
4. **gold_smith_id and gold_maker_id mutually exclusive** — invariant: zero rows with both set

### nihontowatch (`tests/lib/dualColumnArtisan.test.ts`) — 8 tests, mocked

1. `getArtisanDistributions` queries both columns via `.or()`
2. `getArtisanDistributions` includes objects from both columns
3. `getArtisanDistributions` uses `.or()` even with smith entityType
4. `getArtisanHeroImage` queries both columns via `.or()`
5. `getDenraiForArtisan` queries both columns via `.or()`
6. `getDenraiForArtisan` returns empty result when no data
7. `getDenraiForArtisan` uses `.or()` even with smith entityType
8. Structural: all three functions use dual-column `.or()` pattern

## Verification

- **Database:** HIT041 `total_items=11`, `juyo_count=11` (was 7)
- **Invariant:** 0 rows with both `gold_smith_id` and `gold_maker_id` set
- **Data repair:** 611 tosogu-maker objects + 24 smith objects re-synthesized
- **nihontowatch tests:** 3,994/3,994 pass
- **oshi-v2 artisan-routing tests:** 4/4 pass
- **oshi-v2 artisan-links tests:** 22/22 pass (9 pre-existing failures unchanged, unrelated to this fix)
- **Live site:** `/artists/katsuhira-HIT041` shows 11 Juyo

## Related Sessions

- `SESSION_20260212_CATALOGUE_PUBLICATION_BUG.md` — First discovery of the dual-column issue, fixed `getPublishedCatalogueEntries()` only
- This session completes the fix across all remaining functions and the database layer

## Regression Guard

**DO NOT** revert these changes:
- `synthesize_object()` must use reference-table lookup, not form-type whitelist
- Stats/provenance functions must query both columns (OR for targeted, UNION for batch)
- NihontoWatch `yuhinkai.ts` functions must use `.or()`, not `.eq()` on a single column

If new functions are added that query `gold_values` by artisan code, they **MUST** use the dual-column pattern.
