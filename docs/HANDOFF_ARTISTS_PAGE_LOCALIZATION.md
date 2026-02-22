# Handoff: /artists Page Localization Gaps

**Date:** 2026-02-22
**Status:** Diagnosed, not yet fixed
**Scope:** NihontoWatch (UI) + possibly oshi-v2 (Yuhinkai data)

---

## Problem

When viewing `/artists` in JA locale, several areas still show untranslated English/romaji values where Japanese (kanji) should appear. There are **three distinct issues** with different root causes.

---

## Issue 1: Artist Card Subtitle — Raw Romaji Values (NihontoWatch Fix)

**Location:** `src/app/artists/ArtistsPageClient.tsx`, line 808

The artist card subtitle shows school, era, and province as raw values from the Yuhinkai DB:

```tsx
// Current — no locale translation
[artist.school, eraToBroadPeriod(artist.era) || artist.era, artist.province]
  .filter(Boolean).join(' · ')
```

When JA locale is active, this shows "Osafune · Muromachi · Bizen" instead of "長船 · 室町 · 備前".

**Fix:** Apply the same `td()` translation pattern the desktop sidebar already uses:

```tsx
const td = (category: string, v: string) => {
  const k = `${category}.${v}`;
  const r = t(k);
  return r === k ? v : r;
};

// Fixed
[td('school', artist.school), td('period', eraToBroadPeriod(artist.era) || artist.era), td('province', artist.province)]
  .filter(Boolean).join(' · ')
```

The i18n keys already exist — ja.json has 63 school keys, 69 province keys, and 11 period keys.

**Effort:** ~5 minutes. Pure NihontoWatch change.

---

## Issue 2: Mobile Filter Dropdowns — Raw Romaji Values (NihontoWatch Fix)

**Location:** `src/app/artists/ArtistsPageClient.tsx`, lines 600-646

The mobile `<select>` filter dropdowns display `opt.value` directly without translation:

```tsx
// School filter (line 609)
{opt.value} ({opt.count})   // Shows "Osafune (347)" instead of "長船 (347)"

// Province filter (line 626)
{opt.value} ({opt.count})   // Shows "Bizen (423)" instead of "備前 (423)"

// Period filter (line 643)
{opt.value} ({opt.count})   // Shows "Muromachi (845)" instead of "室町 (845)"
```

Also affects "Popular Schools" quick-filter chips (line 562):
```tsx
{s.value}  // Shows "Bizen" instead of "備前"
```

**Fix:** Same `td()` pattern. The desktop `ArtistFilterSidebar.tsx` `RadioList` component (line 319-376) already does this correctly with its `category` prop.

**Effort:** ~10 minutes. Pure NihontoWatch change.

---

## Issue 3: Artist Card Primary Name — Always Shows Romaji (NihontoWatch Fix)

**Location:** `src/app/artists/ArtistsPageClient.tsx`, line 790

The artist card always shows `name_romaji` as the primary name, with `name_kanji` as a small gray subtitle:

```tsx
// Line 790 — always romaji as primary
{(() => { const dp = getArtisanDisplayParts(artist.name_romaji, artist.school);
  return <>{dp.prefix && <span>{dp.prefix} </span>}{dp.name || artist.code}</>;
})()}

// Line 792 — kanji as secondary (small gray text)
{artist.name_kanji && (
  <span className="text-xs text-ink/40 ml-2">{artist.name_kanji}</span>
)}
```

For JA locale, this should be **inverted** — kanji as primary, romaji as secondary:

```tsx
// JA locale: kanji primary, romaji secondary
// EN locale: romaji primary, kanji secondary (current behavior)
```

**Fix:** Wrap in locale check. When `locale === 'ja'` and `name_kanji` exists, show kanji as the prominent name and romaji as the subtitle. Falls back to romaji if no kanji available.

**Effort:** ~10 minutes. Pure NihontoWatch change.

---

## Issue 4: Missing `name_kanji` Data (oshi-v2 / Yuhinkai Data Gap)

**This is the oshi-v2 task.**

Some `artisan_makers` entries lack `name_kanji`. When a JA user views the artists directory, artisans without kanji show only romaji names — which looks inconsistent among cards that do have kanji.

### What we know

- The `artisan_makers` table has both `name_romaji` and `name_kanji` columns
- `name_kanji` is nullable and populated from the original Yuhinkai smith_entities/tosogu_makers source data
- The original Yuhinkai source data (from Hawley, Toko Taikan, etc.) was imported in varying quality
- Some entries were imported with only romaji names (no kanji available in the source)

### What needs investigation (oshi-v2 scope)

1. **Coverage audit:** How many artisan_makers entries have `name_kanji` NULL vs populated?
   ```sql
   SELECT
     COUNT(*) AS total,
     COUNT(name_kanji) AS has_kanji,
     COUNT(*) - COUNT(name_kanji) AS missing_kanji,
     ROUND(100.0 * COUNT(name_kanji) / COUNT(*), 1) AS pct_coverage
   FROM artisan_makers
   WHERE total_items > 0;
   ```

2. **By domain:** Is the gap worse for tosogu makers vs smiths?
   ```sql
   SELECT domain,
     COUNT(*) AS total,
     COUNT(name_kanji) AS has_kanji,
     ROUND(100.0 * COUNT(name_kanji) / COUNT(*), 1) AS pct
   FROM artisan_makers
   WHERE total_items > 0
   GROUP BY domain;
   ```

3. **Top artisans missing kanji:** Which high-profile artisans (by elite_factor or total_items) lack kanji names?
   ```sql
   SELECT maker_id, name_romaji, domain, elite_factor, total_items
   FROM artisan_makers
   WHERE name_kanji IS NULL AND total_items > 0
   ORDER BY elite_factor DESC NULLS LAST
   LIMIT 30;
   ```

4. **Source data check:** Can kanji be backfilled from:
   - `smith_entities.name_kanji` (original Yuhinkai source)
   - Cross-referencing against the Toko Taikan or other reference databases
   - LLM-assisted romanji→kanji mapping (less reliable)

### Potential fix paths

| Approach | Scope | Effort | Risk |
|----------|-------|--------|------|
| Backfill from smith_entities.name_kanji | oshi-v2 SQL | Low | None — just a JOIN |
| LLM romaji→kanji mapping for gaps | oshi-v2 script | Medium | Accuracy risk |
| Manual curation for top 100 artisans | oshi-v2 admin | Low | Tedious |
| Accept gaps + show romaji fallback gracefully | nihontowatch UI | Zero | Incomplete UX |

---

## Summary: What Goes Where

| Issue | Fix Location | Effort |
|-------|-------------|--------|
| Card subtitle (school/province/era) not translated | **NihontoWatch** `ArtistsPageClient.tsx` line 808 | 5 min |
| Mobile filter dropdowns not translated | **NihontoWatch** `ArtistsPageClient.tsx` lines 562, 609, 626, 643 | 10 min |
| Card name always romaji, should flip for JA | **NihontoWatch** `ArtistsPageClient.tsx` lines 789-794 | 10 min |
| Missing `name_kanji` data in Yuhinkai | **oshi-v2** — audit + backfill from source tables | TBD |

### NihontoWatch files to change

- `src/app/artists/ArtistsPageClient.tsx` — all three UI issues

### Key i18n files (already populated)

- `src/i18n/locales/ja.json` — 63 school, 69 province, 11 period keys
- `src/i18n/locales/en.json` — matching keys

### Reference (correct pattern)

- `src/components/artisan/ArtistFilterSidebar.tsx` lines 319-376 — `RadioList` with `td()` translation

---

## Coverage Gap Risk

The i18n keys cover the most common school/province values (~63 schools, ~69 provinces). However, the Yuhinkai database may have more distinct values than we have translation keys for. When a value has no matching i18n key, the `td()` function falls back to the raw romaji string — which is acceptable behavior (romaji is readable in JA context). But a full audit of DB values vs i18n keys would reveal any coverage gaps:

```sql
-- Find school values in Yuhinkai that don't have i18n keys
SELECT DISTINCT legacy_school_text
FROM artisan_makers
WHERE total_items > 0 AND legacy_school_text IS NOT NULL
ORDER BY legacy_school_text;
```

Compare output against keys in `ja.json` to find gaps.
