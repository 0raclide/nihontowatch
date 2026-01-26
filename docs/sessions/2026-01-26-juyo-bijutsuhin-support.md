# Session: Juyo Bijutsuhin (Jubi) Certification Support

**Date:** 2026-01-26

## Summary

Added full support for Juyo Bijutsuhin (重要美術品) certification across both Nihontowatch frontend and Oshi-scrapper backend.

## Background

Juyo Bijutsuhin ("Important Art Object") is a pre-war Japanese government designation (1933-1950) that predates and outranks NBTHK's Tokubetsu Juyo certification. Only ~200 swords received this designation before the system was discontinued.

**Certification hierarchy:**
Kokuho > Juyo Bunkazai > **Juyo Bijutsuhin** > Tokubetsu Juyo > Juyo > Tokubetsu Hozon > Hozon

## Trigger

User discovered listing #31337 (a Jubi item from World Seiyudo) was not being properly classified in the browse filters.

## Database Analysis

Found 5 existing Jubi items:
- 31337, 31363, 31920 (World Seiyudo) - English format: `Katana [...] Juyo Bijutsuhin`
- 1253, 1273 (Iida Koendo) - Japanese format: `重要美術品 [smith name]`

## Changes Made

### Nihontowatch Frontend (commit `6801dbd`)

| File | Change |
|------|--------|
| `src/lib/constants.ts` | Added `JUYO_BIJUTSUHIN` constant with priority 0 (highest) |
| `src/components/browse/FilterContent.tsx` | Added to `CERT_LABELS` and `CERT_ORDER` (first position) |
| `src/app/api/browse/route.ts` | Added to `CERT_VARIANTS` mapping |
| `src/components/listing/MetadataGrid.tsx` | Added to `CERT_CONFIG` with 'premier' tier |
| `src/lib/savedSearches/matcher.ts` | Added to `CERT_VARIANTS` for saved search matching |
| `tests/lib/certification.test.ts` | Created 30 tests for certification configuration |

### Oshi-scrapper Backend (commit `a352ce9`)

| File | Change |
|------|--------|
| `utils/llm_extractor.py` | Added Jubi pattern to `CERT_PATTERNS` (before Juyo) |
| `utils/llm_extractor.py` | Updated `extract_cert_from_body_conservative()` for structured fields |
| `tests/test_title_first_cert.py` | Added 8 Jubi test cases (53 total tests passing) |

### Database Update

Updated 5 listings directly:
```sql
UPDATE listings SET cert_type = 'Juyo Bijutsuhin' WHERE id IN (31337, 31363, 31920, 1253, 1273);
```

## Technical Details

### Pattern Ordering Critical

The pattern `重要美術品` contains `重要`, so Jubi must be checked **before** Juyo to prevent partial matching:

```python
CERT_PATTERNS = [
    # ... Tokuju patterns ...
    # Juyo Bijutsuhin (must be before Juyo)
    (r'重要美術品|juyo\s*bijutsuhin', 'Juyo Bijutsuhin'),
    # Juyo (not Tokubetsu Juyo, not Jubi)
    (r'重要刀剣|重要刀装具|juyo\s*token', 'Juyo'),
    # ...
]
```

### False Positive Prevention

Existing safeguards apply to Jubi:
- Title exclusions: `候補`, `可能性`, `candidate` reject uncertain titles
- Body patterns: Only structured contexts (`鑑定書:`, `第XX回`) are trusted
- Navigation/legend protection: Standalone sidebar mentions don't match

### Why Safe

`重要美術品` is highly specific:
1. 4-character compound (重要 + 美術品)
2. Suffix 美術品 (art object) distinct from 刀剣 (sword)
3. No common alternative meaning
4. Historical references still indicate certification

## Test Coverage

- Frontend: 30 certification tests (constants, priority, config completeness)
- Backend: 53 tests including 8 new Jubi-specific cases

## Commits

| Repository | Commit | Description |
|------------|--------|-------------|
| nihontowatch | `6801dbd` | feat: Add Juyo Bijutsuhin certification support |
| oshi-scrapper | `a352ce9` | feat: Add Juyo Bijutsuhin certification extraction |

## Future Work

None required. Future scrapes will automatically extract and preserve Jubi certifications.
