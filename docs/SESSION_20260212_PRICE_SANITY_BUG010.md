# Session: LLM Price Extraction — Missing 万 Multiplier (BUG-010)

**Date:** 2026-02-12
**Trigger:** Listing 34853 (Goto Etsujo kozuka/kogai, Hozon, Choshuya) showed $5 USD on nihontowatch
**Status:** Fixed — 4-layer code defense + 3 DB rows corrected

---

## Root Cause (Revised from Plan)

The plan assumed the LLM was extracting a yen amount without the 万 multiplier. **Investigation revealed the actual root cause was different:**

Choshuya's Wix pages render price and catalog number into separate DOM elements. The scraper's text extraction captures them as disconnected lines:

```
円（税込）
...
830
```

The `830` is actually the **catalog/item number** (`No. 830`), not a price. The real price is **inquiry only** — indicated by a dash before `円（税込）` (`- 円（税込）`). The LLM mistook the catalog number for a price.

Same pattern on all three affected listings:
- **ID 34853**: `No. 830` → LLM extracted as ¥830
- **ID 35518**: `No. 679` → LLM extracted as ¥679
- **ID 33985**: `1500` in page title (catalog ref) → LLM extracted as ¥1,500

All three are explicitly inquiry pricing (`お問い合わせ` or dash before `円`).

---

## Fix: Four-Layer Defense

### Layer 1: Price sanity in `_apply_llm_metadata()` (Oshi-scrapper)

**File:** `Oshi-scrapper/scrapers/base.py`

Added post-LLM price sanity check after the price assignment block. Nulls out:
- JPY < 10,000
- USD/EUR/GBP < 50

This is the most impactful location — every LLM-using scraper calls `_extract_with_llm()` → `_apply_llm_metadata()`, including Choshuya's custom `scrape()` override.

### Layer 2: Activated `_sanity_check_value()` in PriceNormalizer (Oshi-scrapper)

**File:** `Oshi-scrapper/normalization/normalizers/price.py`

Replaced `pass` stubs with actual enforcement:
- JPY: null if < 10,000 or > 1B
- USD/EUR/GBP: null if < 50 or > 10M

Added `logging` import for warning messages.

### Layer 3: Strengthened LLM base prompt (Oshi-scrapper)

**File:** `Oshi-scrapper/utils/llm_extractor.py`

Added explicit 万 (man = ×10,000) and 百万 (hyakuman = ×1,000,000) rules to `EXTRACTION_PROMPT` so the LLM knows to apply multipliers for all dealers.

### Layer 4: Frontend MIN_PRICE_JPY filter on artist listings (nihontowatch)

**File:** `nihontowatch/src/app/api/artisan/[code]/listings/route.ts`

Added `LISTING_FILTERS.MIN_PRICE_JPY` filter (matching the browse API pattern) so artist profile pages also hide implausibly cheap listings.

---

## Data Fixes

| ID | Was | Now | Root Cause |
|---|---|---|---|
| 34853 | ¥830 (= $5) | null (inquiry) | Catalog No. 830 mistaken for price |
| 35518 | ¥679 | null (inquiry) | Catalog No. 679 mistaken for price |
| 33985 | ¥1,500 | null (inquiry) | Catalog ref 1500 in page title mistaken for price |

SQL applied:
```sql
UPDATE listings SET price_value = NULL, price_currency = NULL WHERE id IN (34853, 35518, 33985);
```

### Broader Audit Results

Checked all available listings with JPY < 10,000 across all dealers (30 items):
- **Books** (Shoubudou, Ginza Seikodo): ¥840–¥6,285 — legitimate
- **Maintenance goods** (World Seiyudo): ¥700–¥5,500 — legitimate
- **Magazine subscriptions** (Choshuya): ¥5,000 — legitimate
- **T-shirt** (Giheiya): ¥2,000 — legitimate
- **One currency misattribution** (Nihonto Australia, ID 42679): $650 AUD stored as ¥650 JPY — separate bug, but would be caught by Layer 2

No other dealers had the catalog-number-as-price bug.

---

## Tests Added

### Oshi-scrapper (37 new tests, all pass)

**`tests/test_llm_price_sanity.py`** — 14 tests for `_apply_llm_metadata` sanity:
- JPY 830, 350, 9999 → nulled
- JPY 10000, 100000, 8300000 → kept
- USD 5 → nulled; USD 50, 650 → kept
- EUR 10 → nulled; EUR 8000 → kept
- GBP 25 → nulled
- No price → stays null
- Default currency (null → JPY) + sanity

**`tests/normalization/test_price_normalizer.py`** — 23 tests:
- `_sanity_check_value`: JPY thresholds (10K, 1B), USD/EUR/GBP thresholds (50, 10M), other currencies pass through
- `_normalize_value` with 万: raw text multiplier works, no raw text → nulled
- `parse_price_string`: 830万円 → 8300000

### nihontowatch

Existing test suite: 3941 pass, 17 pre-existing timeout failures (network-dependent, unrelated).

---

## Files Modified

| # | Repo | File | Change |
|---|------|------|--------|
| 1 | Oshi-scrapper | `scrapers/base.py` | Price sanity in `_apply_llm_metadata()` |
| 2 | Oshi-scrapper | `normalization/normalizers/price.py` | Activated `_sanity_check_value()` + logging |
| 3 | Oshi-scrapper | `utils/llm_extractor.py` | 万/百万 rules in `EXTRACTION_PROMPT` |
| 4 | nihontowatch | `src/app/api/artisan/[code]/listings/route.ts` | `MIN_PRICE_JPY` filter |
| 5 | Oshi-scrapper | `tests/test_llm_price_sanity.py` | **New** — 14 tests |
| 6 | Oshi-scrapper | `tests/normalization/test_price_normalizer.py` | **New** — 23 tests |

---

## Follow-up Considerations

- **Nihonto Australia currency misattribution** (ID 42679): $650 AUD stored as ¥650 JPY. Separate bug — the scraper defaults to JPY for non-Japanese currencies it can't detect. Layer 2 catches this as a side effect.
- **Database CHECK constraint**: Could add `CHECK (price_value IS NULL OR (price_currency = 'JPY' AND price_value >= 10000) OR ...)` as a DB-level guard. Deferred until code layers are verified in production.
- **Choshuya `scrape()` override**: Tech debt — bypasses base class post-LLM validation. Layer 1 sidesteps this by hooking into `_apply_llm_metadata()` which is called regardless.
