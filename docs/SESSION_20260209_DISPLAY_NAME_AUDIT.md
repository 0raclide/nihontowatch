# Session: Display Name Comprehensive Audit & Fix

**Date:** 2026-02-09
**Commits:** `4d0c5e9`, `ab16a04`, `28c4b1f`, `9a62840`

## Problem

The initial `schoolPrefix()` dedup (3 copies across files) was replaced with a shared `getArtisanDisplayParts()` utility, but the new rules had gaps:

1. **Rule 3 prefix duplication**: Returned both `prefix` and `name=school`, so rendering showed "Saburō Saburō Kunimune"
2. **Hyphenated schools missed**: "Sue-Naminohira" + "Naminohira" wasn't caught (only checked space separator)
3. **"Province" residue**: Rule 5 geo-stripped "Nagato" from "Nagato Province", leaving "Province" as prefix for 391 tosogu makers
4. **Rule 4 false positives**: 4-char prefix match showed wrong person — "Kunihiro" displayed for Kunitomo (48 smiths)
5. **Missing geo prefixes**: "Dewa", "Mimasaka", "Tanba", "Suo" not in the set (49 tosogu)
6. **School starts with name**: "Oishi Sa" + "Oishi" → "Oishi Sa Oishi"
7. **"/" separator**: "Natsuo / Tokyo Fine Arts" + "Natsuo" → doubled

## Solution

Rewrote `src/lib/artisan/displayName.ts` with 7 rules:

| Rule | When | Result | Example |
|------|------|--------|---------|
| 1 | school = name (macron-norm) | Just name | Gotō → Gotō |
| 2 | Name starts with school | Just name | Shōami + Shōami Denbei → Shōami Denbei |
| 2b | School starts with name | School only | Oishi Sa + Oishi → Oishi Sa |
| 3 | School ends with name (space/hyphen) | School only | Sue-Naminohira + Naminohira → Sue-Naminohira |
| 3b | Name is a token in school (handles /) | School only | Natsuo / Tokyo Fine Arts + Natsuo |
| 4 | Lineage substitution (4-char root) | School prefix + real name | Horikawa Kunihiro + Kunitomo → Horikawa Kunitomo |
| 5 | Geo prefix strip (skip generic words) | Stripped prefix + name | Osaka Gassan + Sadakazu → Gassan Sadakazu |
| 6 | Default | School + name | Osafune + Kanemitsu → Osafune Kanemitsu |

## Records Fixed

| Issue | Count |
|-------|-------|
| "Province" prefix on tosogu makers | 391 |
| Wrong person displayed (lineage) | 48 |
| Missing geo prefixes | 49 |
| School starts with name | 2 |
| "/" separator | 1 |
| Hyphenated schools | ~15 |
| Rule 3 duplication (Saburō Saburō) | ~20 |

## Database Changes

- **KUN636**: `school` updated from "Saburō Kunimune" to "Naomune"
- **NS-SueNaminohira**: Created new school code record (末波平, Satsuma, `is_school_code: true`)

## Files Changed

- `src/lib/artisan/displayName.ts` — Complete rewrite of dedup logic
- `src/app/artists/ArtistsPageClient.tsx` — Uses shared utility
- `src/app/artists/[slug]/ArtistPageClient.tsx` — Uses shared utility
- `src/app/artists/[slug]/page.tsx` — Uses shared utility for metadata

## Verification

- 18/18 targeted test cases pass
- 3617/3617 unit tests pass
- TypeScript: 0 errors
- Full audit of 13,605 records (12,452 smiths + 1,153 tosogu makers)
