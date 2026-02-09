# Session: Fix Juyo Bijutsuhin (重要美術品) Certification Extraction

**Date:** 2026-02-09
**Trigger:** Listing 5284 (Hyozaemon, Mitsunaga tachi) displayed on artist page as Jubi but had `cert_type = null` in database.

## Problem

重要美術品 (Juyo Bijutsuhin / "Important Art Object") is a pre-war Japanese government designation (1933-1950) — distinct from modern NBTHK certifications. The scraping pipeline had multiple gaps that caused Jubi items to be silently dropped or stored with non-canonical values.

### Failure Chain for Listing 5284

1. **LLM prompt** only listed 4 valid cert values (`Tokubetsu Juyo|Juyo|Tokubetsu Hozon|Hozon`). LLM returned `"Juyo"` (wrong — conflated with NBTHK Juyo).
2. **Conservative cert extractor** overrode LLM output (by design), but only matched `重要美術品` in structured `鑑定書:` fields. The Hyozaemon page has it in unstructured body text ("南北朝時代　備前　重要美術品　白鞘　参考品").
3. **Result:** `cert_type = null` in database.

### Secondary Issues Found

- **Goushuya scraper** mapped `重要美術品` → `"Important Art Object"` instead of the canonical `"Juyo Bijutsuhin"` (2 listings affected: 42957, 42961).
- **Normalization pipeline** (`names.py`) had no entry for `"juyo bijutsuhin"` or `"重要美術品"`.
- **Listing detail page** used camelCase keys (`JuyoBijutsuhin`) but DB stores `"Juyo Bijutsuhin"` (with space) — Jubi tier styling never applied.
- **Browse API facets** `normalizeCert()` didn't handle Jubi variants.

## Fixes

### Oshi-scrapper (4 files)

| File | Change |
|------|--------|
| `utils/llm_extractor.py` | Added standalone `重要美術品` pattern to `extract_cert_from_body_conservative()` with nav-count exclusion. Added `"Juyo Bijutsuhin"` to LLM prompt cert_type options + extraction rules. |
| `scrapers/hyozaemon.py` | Added `重要美術品 → 'Juyo Bijutsuhin'` to `CERT_PATTERNS`. Fixed `_extract_certification()` to use `organization=None` for Jubi (not NBTHK). |
| `scrapers/goushuya.py` | Changed `重要美術品` mapping from `'Important Art Object'` to `'Juyo Bijutsuhin'`. |
| `normalization/normalizers/names.py` | Added `'juyo bijutsuhin'`, `'important art object'`, `'重要美術品'` → `'Juyo Bijutsuhin'` to `cert_map`. |

### Nihontowatch (2 files)

| File | Change |
|------|--------|
| `src/app/listing/[id]/ListingDetailClient.tsx` | Added `'Juyo Bijutsuhin'` key (space-separated) to `CERT_LABELS` for proper Jubi tier styling. |
| `src/app/api/browse/route.ts` | Added Jubi variants (`'juyo bijutsuhin'`, `'jubi'`, `'important art object'`) to `normalizeCert()`. |

### Database (3 records)

| Listing | Dealer | Before | After |
|---------|--------|--------|-------|
| 5284 | Hyozaemon | `null` | `Juyo Bijutsuhin` |
| 42957 | Goushuya | `Important Art Object` | `Juyo Bijutsuhin` |
| 42961 | Goushuya | `Important Art Object` | `Juyo Bijutsuhin` |

## Why 重要美術品 Is Safe to Match in Unstructured Text

Unlike `重要刀剣` which commonly appears in navigation menus ("重要刀剣一覧") and category labels, `重要美術品` is a specific government designation term that does not appear in dealer site chrome. The only false-positive risk is navigation counts like "重要美術品 (3)", which the new pattern explicitly excludes.

## Test Results

- **Oshi-scrapper:** 53/53 cert extraction tests pass (including existing Jubi tests)
- **Nihontowatch:** 30/30 certification tests pass

## Current Jubi Inventory

After fixes, 8 Juyo Bijutsuhin listings in database:

| ID | Dealer | Smith | Available |
|----|--------|-------|-----------|
| 1253 | Iida Koendo | Izumi no Kami Kunisada | Sold |
| 1273 | Iida Koendo | Dewadaijo Fujiwara Kunimichi | Sold |
| 5284 | Hyozaemon | 光長 (Mitsunaga) | Available |
| 31337 | Sanmei | Kageyasu | Available |
| 31363 | Sanmei | Yoshitsugu | Available |
| 31920 | Sanmei | Sanemori | Sold |
| 42957 | Goushuya | 古青江末次 | Available |
| 42961 | Goushuya | 雲生 | Available |
