# Session: Discount Gyobutsu from Elite Factor Post-Nanbokucho

**Date:** 2026-02-10
**Repo:** oshi-v2
**Migration:** `20260210010000_discount_gyobutsu_post_nanbokucho.sql`
**Status:** Applied to production, verified end-to-end

---

## Problem

The elite factor ranking on `/artists` was distorted for Muromachi and Edo periods. Obscure smiths with 1-2 Gyobutsu (Imperial Collection) works and zero other elite designations ranked above famous smiths like Kotetsu (17 genuine elite works). This happened because Gyobutsu for later periods reflects provenance (political gifts, tribute to the imperial household) rather than NBTHK-judged quality.

**Example before fix:** An Edo smith with 1 Gyobutsu and 0 other designations would get `elite_factor = (0+0+0+1+0+1)/(1+10) = 0.1818`, ranking above Kotetsu who had `elite_factor = (17+1)/(76+10) = 0.2093` — but only because Kotetsu's large body of work diluted his ratio.

The core issue: Gyobutsu is meaningful for Kamakura/Nanbokucho smiths (where it correlates with NBTHK quality judgment) but noise for later periods.

## Solution

Exclude `gyobutsu_count` from the `elite_count` and `elite_factor` numerator when the artisan's era starts at or after 1392 (end of Nanbokucho period). The `gyobutsu_count` column is still populated — it's just excluded from the ranking formula.

### Cutoff: 1392 (End of Nanbokucho)

- **Pre-1392** (Heian, Kamakura, Nanbokucho): Gyobutsu INCLUDED in elite factor
- **1392+** (Muromachi, Sengoku, Momoyama, Edo, Meiji+): Gyobutsu EXCLUDED from elite factor

### Components

#### 1. `is_post_nanbokucho(era TEXT)` — Helper function

`IMMUTABLE` SQL function that returns TRUE for post-Nanbokucho artisans. Handles two era formats:

| Format | Example | Method |
|--------|---------|--------|
| Parenthesized dates | `"Ōei (1394-1428)"` | Parse start year, check >= 1392 |
| Period names | `"Edo"`, `"Late Muromachi"` | Regex match on known period names |
| NULL | — | Returns FALSE (conservative: include gyobutsu) |

#### 2. Updated `compute_maker_statistics()` (batch)

Changed elite_count and elite_factor SET clauses for both smiths and tosogu:

```sql
-- Before:
elite_count = ss.kokuho_ct + ss.jubun_ct + ss.jubi_ct + ss.gyobutsu_ct + ss.tokuju_ct

-- After:
elite_count = ss.kokuho_ct + ss.jubun_ct + ss.jubi_ct + ss.tokuju_ct
            + CASE WHEN is_post_nanbokucho(se.era) THEN 0 ELSE ss.gyobutsu_ct END
```

The `se.era` reference comes from the UPDATE target table (`smith_entities se`), so each artisan is evaluated individually.

#### 3. Updated `recompute_artisan_stats(TEXT[])` (targeted)

Same discount logic. Looks up the artisan's era before computing elite counts:

```sql
SELECT se.era INTO v_era FROM smith_entities se WHERE se.smith_id = v_code;
v_post_nanbokucho := is_post_nanbokucho(v_era);
-- ...
v_elite := v_kokuho + v_jubun + v_jubi + v_tokuju
         + CASE WHEN v_post_nanbokucho THEN 0 ELSE v_gyobutsu END;
```

#### 4. Recompute all stats

Migration ends with `SELECT * FROM compute_maker_statistics();` to apply immediately.

## Verification Results

### Per-Era Checks

| Era | Artisans w/ Gyobutsu | Gyobutsu Treatment | Math Validation |
|-----|---------------------|-------------------|-----------------|
| **Kamakura** | 40 | INCLUDED | All 40 pass |
| **Nanbokucho** | 22 | INCLUDED (all start years < 1392) | All 22 pass |
| **Muromachi** | 10 | EXCLUDED | All 10 pass |
| **Edo** | 10 | EXCLUDED | All 10 pass |

### Global Cross-Era Check

48 artisans with gyobutsu in top 500 notable artisans: **all pass** math validation.

### Key Rankings After Fix

**Edo top 5:**
1. Masamori (MAS546) — ef=0.2353
2. Nagayuki (NAG562) — ef=0.2353
3. Kunikane (KUN306) — ef=0.2222
4. Masanao (MAS1712) — ef=0.2143
5. **Kotetsu (KO29)** — ef=0.2093 (was pushed down by pure-Gyobutsu smiths)

**Kamakura top 3 (unchanged):**
1. Yoshimitsu (YOS463) — ef=0.6406 (5 gyobutsu counted)
2. Mitsutada (MIT281) — ef=0.6250 (2 gyobutsu counted)
3. Masamune (MAS590) — ef=0.5755 (2 gyobutsu counted)

### Boundary Case: Nanbokucho

Shigeyoshi (SHI688), era `"Meitoku (1390-1394)"` — start year 1390 < 1392 — gyobutsu correctly INCLUDED.

### Page Health

- `/artists` directory: 200 OK
- `/artists/kotetsu-KO29` profile: 200 OK

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `supabase/migrations/20260210010000_discount_gyobutsu_post_nanbokucho.sql` | oshi-v2 | New migration |

No frontend changes required — the directory API reads `elite_factor` directly from the database.

## Design Decisions

1. **Conservative NULL handling**: When era is NULL, `is_post_nanbokucho()` returns FALSE, meaning gyobutsu IS counted. This avoids accidentally demoting artisans with missing era data.

2. **Column still populated**: `gyobutsu_count` is still written correctly to the database. Only `elite_count` and `elite_factor` are affected. This means the UI can still display the Gyobutsu pyramid segment — it just doesn't influence ranking.

3. **total_items unchanged**: Gyobutsu works are real items that exist. They contribute to `total_items` (the denominator) regardless of era. Only the numerator is affected.

4. **IMMUTABLE function**: `is_post_nanbokucho()` is marked IMMUTABLE since era data doesn't change. This allows PostgreSQL to cache results and potentially inline the function.
