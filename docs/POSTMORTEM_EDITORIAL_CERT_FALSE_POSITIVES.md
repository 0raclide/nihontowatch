# Post-Mortem: Editorial Content Cert False Positives (nihonart.com)

**Date:** 2026-02-16
**Severity:** P1 — incorrect Tokuju/Juyo badges on 3 live listings
**Status:** Resolved — 3-layer fix shipped to both repos
**Related:** `SESSION_20260212_CERT_FALSE_POSITIVE_FIX.md` (prior incident: Aoi Art related-items bleed)

## Incident

Listing 49759 (nihonart.com, "Naoe Shizu katana with Kanzan sayagaki") displayed a **Tokubetsu Juyo** badge despite having no NBTHK certification. Database audit found 2 additional misclassified listings from the same dealer:

| Listing | Displayed Cert | Actual Cert | Root Cause |
|---------|---------------|-------------|------------|
| 49759 | Tokuju | None | Editorial praise: "Shizu has 14 Tokubetsu Juyo designations" |
| 49700 | Juyo | None | Explicit negation: "non-Juyo" in description |
| 49693 | Juyo | None | Comparison: "resembles a Juyo [different sword]" |

All three are from **Nihon Art** (nihonart.com / Swords of Japan), which writes unusually rich editorial content with historical context, smith reputation analysis, and cross-references to other swords.

## Root Cause Analysis

### Why the previous fix didn't catch this

The Feb 12 cert false positive fix (`SESSION_20260212_CERT_FALSE_POSITIVE_FIX.md`) addressed:
- **Related Products text bleed** (parenthetical guard, proximity guard, multi-type guard)
- **Biographical session references** (Japanese `第XX回重要刀剣` pattern)

But nihonart.com's false positives are a fundamentally different class: **editorial prose** where certifications are mentioned in natural English sentences about a smith's reputation, not in structured related-item sections.

### The extraction pipeline leak

Two independent extraction paths both leaked:

1. **`nihon_art.py` PRIORITY 2 (body text)**: Scans description text with broad `CERT_PATTERNS` regex. The only context guard checked for `in_text_context` — whether the match appeared in a paragraph. But editorial prose IS paragraph text, so the guard passed.

2. **`llm_extractor.py` `_english_cert_is_false_positive()`**: Only had 2 guards — parenthetical enclosure and "Related Products" proximity. Neither catches natural-language editorial references like "has 14 Tokubetsu Juyo" or "non-Juyo" or "resembles a Juyo".

### Why the frontend defense didn't fully help

The ListingCard.tsx price-plausibility defense (added Feb 12) would have caught listing 49759 if it had a low price, but nihonart.com lists prices in USD at levels where conversion to JPY was ambiguous. More critically, **ListingDetailClient.tsx had ZERO defense** — it displayed whatever `cert_type` the database returned with no validation at all.

## Fix (3 layers)

### Layer 1: Database (immediate)

```sql
UPDATE listings SET cert_type = NULL WHERE id IN (49759, 49700, 49693);
```

### Layer 2: Scraper — Editorial context guards (Oshi-scrapper)

**Files:** `utils/llm_extractor.py`, `scrapers/nihon_art.py`

Added 7 editorial context guards to `_english_cert_is_false_positive()` and nihon_art.py's PRIORITY 2 extraction:

| Guard | Pattern | Example blocked |
|-------|---------|----------------|
| Statistics | `(of which\|of these\|of those)` following cert | "14 Tokubetsu Juyo (of which 3 are...)" |
| Comparison | `resembles a\|similar to\|compare with` preceding cert | "resembles a Juyo Norishige" |
| Article comparison | `a ` preceding + `that\|which\|I` following | "a Juyo piece that was sold" |
| Cross-reference | `on my site\|from this` following cert | "a Juyo piece on my site" |
| Negation | `non-\|not ` preceding cert | "non-Juyo" |
| Counting | `has N\|have N\|placing\|ranks` preceding cert | "has 14 Tokubetsu Juyo" |
| Bare count | `and N\|or N` preceding cert | "and 14 Tokubetsu Juyo" |
| Ranking context | `to ` preceding + ranking language in broader context | "from Juyo to Tokubetsu Juyo level" |

### Layer 3: Frontend — Shared validation with defense-in-depth (NihontoWatch)

**New file:** `src/lib/cert/validation.ts`

Extracted cert validation into a shared utility used by both ListingCard.tsx and ListingDetailClient.tsx:

- Price-plausibility check (Tokuju < ¥5M or Juyo < ¥1M → suppress)
- Title/URL override (cert in title or URL → trust regardless of price)
- **ListingDetailClient.tsx previously had NO defense at all** — now uses the same shared validation

## Tests

**File:** `tests/test_title_first_cert.py` — Added `TestEditorialCertFalsePositives` class (7 tests):

| Test | Covers |
|------|--------|
| `test_listing_49759_naoe_shizu_not_tokuju` | Statistics: "14 Tokubetsu Juyo designations" |
| `test_listing_49700_norishige_not_juyo` | Negation: "non-Juyo" |
| `test_listing_49693_ko_uda_not_juyo` | Comparison: "resembles a Juyo" |
| `test_counting_works_not_cert` | Counting: "has 14 Tokubetsu Juyo" |
| `test_ranking_language_not_cert` | Ranking: "from Juyo to Tokubetsu Juyo level" |
| `test_genuine_english_cert_still_detected` | No false negatives: real Tokuju passes |
| `test_genuine_designation_language_still_detected` | No false negatives: "designated as Juyo" passes |

**Results:** 143/143 cert tests pass, 2855/2855 total scraper tests pass.

## Why This Keeps Happening

This is the **second** cert false positive incident in 4 days. The pattern:

1. **Feb 12**: Aoi Art related-items text bleed + biographical Japanese references
2. **Feb 16**: Nihon Art editorial English prose

Both share the same architectural weakness: the cert extraction pipeline was designed for **structured** dealer pages (metadata fields, formatted spec tables) but English-language dealers write **narrative prose** where certifications appear in editorial context.

### Systemic pattern

The extraction pipeline has 3 cert sources with decreasing reliability:

| Priority | Source | Reliability | Guard quality |
|----------|--------|-------------|---------------|
| 0 | HTML tags/metadata | Very high | N/A (structured) |
| 1 | Title | High | N/A (title = item identity) |
| 2 | Body text | **Low** | **Now has 10+ guards** |

PRIORITY 2 (body text) is inherently unreliable because it matches free-form prose. The Feb 12 and Feb 16 fixes have progressively hardened it, but new editorial patterns could still leak.

### Recommendation

Consider downgrading PRIORITY 2 matches to `artisan_confidence: MEDIUM` equivalent — flag them for manual review rather than auto-publishing. The defense-in-depth on the frontend (price plausibility) provides a safety net, but prevention at the extraction level is more durable.

## Files Changed

### Oshi-scrapper
| File | Change |
|------|--------|
| `utils/llm_extractor.py` | 7 editorial context guards in `_english_cert_is_false_positive()` |
| `scrapers/nihon_art.py` | Matching guards in PRIORITY 2 body text extraction |
| `tests/test_title_first_cert.py` | 7 regression tests (`TestEditorialCertFalsePositives`) |

### NihontoWatch
| File | Change |
|------|--------|
| `src/lib/cert/validation.ts` | **New** — shared cert validation utility |
| `src/components/browse/ListingCard.tsx` | Replaced inline CERT_LABELS with shared `getValidatedCertInfo()` |
| `src/app/listing/[id]/ListingDetailClient.tsx` | Added defense-in-depth via shared `getValidatedCertInfo()` (was zero defense) |

### Database
| Listing | Before | After | Reason |
|---------|--------|-------|--------|
| 49759 | Tokuju | NULL | Editorial smith reputation statistics |
| 49700 | Juyo | NULL | "non-Juyo" negation in description |
| 49693 | Juyo | NULL | Comparison to a different Juyo sword |

## Commits

| Repo | Commit | Message |
|------|--------|---------|
| nihontowatch | `52f9abe` | fix: Add cert validation defense-in-depth against editorial false positives |
| Oshi-scrapper | `b6201ee` | fix: Add editorial context guards to prevent cert false positives |
