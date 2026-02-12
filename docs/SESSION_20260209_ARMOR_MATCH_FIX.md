# Session: Fix False Artisan Match on Armor Listing (Chōgi / Myōchin Collision)

**Date:** 2026-02-09
**Trigger:** Listing 5428 (Kaga armor, Katanahanbai) incorrectly matched to Osafune Chōgi (CHO10).

## Problem

A Kaga-style suit of armor (甲冑 色々威二枚胴加賀具足) signed by **Myōchin Nagayoshi** (明珍長義) was matched to **Osafune Chōgi** (長義), a famous Nanbokuchō-era Bizen swordsmith.

### Root Cause — Kanji Homograph Collision

1. Matcher extracted smith field: **明珍長義** (Myōchin Nagayoshi)
2. `strip_japanese_titles()` treated 明珍 (Myōchin) as a school prefix and stripped it
3. Remaining kanji **長義** matched Chōgi in `smith_entities` — identical kanji, different reading:
   - 長義 → "Nagayoshi" (Myōchin armorer, Edo period)
   - 長義 → "Chōgi" (Osafune swordsmith, Kenmu 1334-1338)
4. Tagged as `exact_kanji_stripped_title` with HIGH confidence (0.95)

### Why It's Fundamentally Wrong

| Signal | Listing | Matched Artisan |
|--------|---------|-----------------|
| Item type | Armor (`unknown` in DB) | Swordsmith |
| Era | Edo period | Kenmu (1334-1338) |
| School | Myōchin (armorers) | Osafune (swordsmiths) |
| Province | Nagato/Chōshū | Bizen |

### Key Insight

Yuhinkai only contains **swordsmiths** (12,447) and **tosogu makers** (1,119). Armorers are not in the database. Any match of a non-sword, non-tosogu listing is a false positive by definition.

## Fixes

### 1. Listing 5428 — Database Cleanup

Cleared all artisan fields and flagged as reviewed:

```sql
artisan_id = NULL, artisan_confidence = NULL, artisan_method = NULL,
artisan_candidates = NULL, artisan_matched_at = NULL,
artisan_verified = 'incorrect'
```

### 2. Oshi-scrapper — Skip Rule for Non-Matchable Item Types

**File:** `artisan_matcher/matcher.py`

Added `NON_MATCHABLE_TYPES` constant and early return in `match_listing()`:

```python
NON_MATCHABLE_TYPES = {'armor', 'helmet', 'stand', 'book', 'other', 'unknown'}
```

Any listing with one of these types now returns immediately:
- `artisan_id = None`
- `confidence = NONE`
- `method = 'skipped_non_matchable_item_type'`

The retriever and LLM disambiguator never run — zero wasted API calls.

**Why this is robust:** No armorers exist in Yuhinkai. Zero possible correct matches → zero false negatives from skipping. The rule is categorical, not heuristic.

### 3. Test Added

**File:** `tests/artisan_matcher/test_hooks.py`

`test_skips_non_matchable_item_types` — verifies all 6 non-matchable types return `None` with correct method string. Runs through the real `match_listing()` code path.

**All 16 tests pass.**

## Files Changed

| Repo | File | Change |
|------|------|--------|
| Oshi-scrapper | `artisan_matcher/matcher.py` | Added `NON_MATCHABLE_TYPES` set + early return in `match_listing()` |
| Oshi-scrapper | `tests/artisan_matcher/test_hooks.py` | Added `test_skips_non_matchable_item_types` |
| Database | `listings` (id=5428) | Cleared artisan fields, set `artisan_verified = 'incorrect'` |

## Future Consideration

Listing 5428 has `item_type = 'unknown'` — the scraper didn't classify it as armor. If Katanahanbai item classification improves, the `'armor'` entry in `NON_MATCHABLE_TYPES` provides a second layer of protection. The `'unknown'` entry catches the current state.
