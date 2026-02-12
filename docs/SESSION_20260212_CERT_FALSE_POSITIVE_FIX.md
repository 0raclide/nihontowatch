# Session: Cert False Positive Fix (2026-02-12)

## Bug

Listing 54248 (Aoi Art auction katana, ¥270,000) displayed a **Tokubetsu Juyo (Tokuju)** certification badge despite having zero NBTHK certification — only an "Aoi-Art estimation Paper." A genuine Tokuju Masamune would be worth tens of millions of yen.

Audit uncovered 2 additional false positives:
- **Listing 5395** (Hyozaemon, ¥680,000): Displayed as Juyo, actually Hozon
- **Listing 42061** (Asahi Token, ¥715,000): Displayed as Juyo, actually TokuHozon

## Root Cause

### Listing 54248: Related Products text bleed

The Aoi Art page has a "Related Items" section showing other listings, including `(25th NBTHK Tokubetsu Juyo Token)`. The scraper's `base.py:_extract_clean_text()` captures ALL page text including Related Products. The conservative cert extractor's **English patterns** (lines 351-358 of `llm_extractor.py`) had **zero context guards** — unlike the Japanese standalone patterns which had multi-type, pipe-list, and product-number guards. The bare `re.search(r'Tokubetsu[- ]Juyo\b', raw_text)` matched text from a completely different listing.

### Listings 5395 & 42061: Biographical references

Body text describing the smith's historical record (e.g., "重要刀剣が６点もある" = "6 Juyo pieces exist by this smith") was matched by the standalone Japanese cert pattern. The actual cert appeared in metadata lines but was superseded by the biographical match.

## Fix (5 layers of defense)

### Layer 1: Database (immediate)
```sql
-- Listing 54248: no cert
UPDATE listings SET cert_type = NULL WHERE id = 54248;
-- Listing 5395: correct cert is Hozon
UPDATE listings SET cert_type = 'Hozon' WHERE id = 5395;
-- Listing 42061: correct cert is TokuHozon
UPDATE listings SET cert_type = 'TokuHozon' WHERE id = 42061;
```

### Layer 2: Scraper — Guard English cert patterns (Oshi-scrapper)

**File:** `utils/llm_extractor.py`

Added 3 guards to the English `Tokubetsu[- ]Juyo` and `Tokubetsu[- ]Hozon` patterns:

1. **Multi-type guard**: If 3+ distinct English cert terms (Tokubetsu Juyo, Juyo, Tokubetsu Hozon, Hozon) appear in text, skip — likely a nav/related items section listing all categories
2. **Parenthetical guard**: If match is enclosed in `(...)`, skip — e.g., "(25th NBTHK Tokubetsu Juyo Token)" is another item's cert description. Uses proper enclosure detection (no intervening `)` or `）` between opening `(` and match)
3. **"Related" proximity guard**: If match is within 500 chars after "Related Products", "Related Items", "You may also like", "関連商品", etc., skip

### Layer 3: Scraper — Strip Related Products HTML (Oshi-scrapper)

**File:** `scrapers/base.py` (`_extract_clean_text()`)

Before extracting page text, now removes:
- `<section>`/`<div>` with class matching `related|upsell|cross-sell`
- Sections headed by "Related Products", "Related Items", "関連商品", etc. (removes heading's parent container)

### Layer 4: QA Cross-Validator severity upgrade (Oshi-scrapper)

**File:** `qa/validators/cross_validators.py`

Changed price/cert mismatch from WARNING to ERROR for extreme cases:
- Tokuju under ¥5,000,000 → **ERROR** (was WARNING)
- Juyo under ¥1,000,000 → **ERROR** (was WARNING)

ERROR severity causes `ValidationResult.passed = False`, which can be used to quarantine or block save.

### Layer 5: Frontend guardrail (NihontoWatch)

**File:** `src/components/browse/ListingCard.tsx`

Suppresses cert badges when price/cert is implausible:
- Tokuju with price < ¥5M JPY equivalent → badge hidden
- Juyo with price < ¥1M JPY equivalent → badge hidden
- **Exception**: If cert term appears in the listing title, badge is shown regardless of price (handles legitimate consignment/estate sales)

## Tests

**File:** `tests/test_title_first_cert.py` — Added `TestRelatedProductsFalsePositives` class (12 tests):

| Test | What it covers |
|------|---------------|
| `test_listing_54248_aoi_art_related_items` | The exact bug scenario — full Related Items section |
| `test_english_tokuju_in_parentheses_not_matched` | Parenthetical guard |
| `test_english_tokuhozon_in_parentheses_not_matched` | Parenthetical guard (TokuHozon variant) |
| `test_english_tokuju_after_related_products_heading` | Related proximity guard |
| `test_english_multi_type_guard` | Multi-type guard (4 cert types in text) |
| `test_genuine_english_tokuju_still_works` | No false negatives — real Tokuju passes |
| `test_genuine_english_tokuhozon_still_works` | No false negatives — real TokuHozon passes |
| `test_japanese_related_products_heading` | Japanese 関連商品 heading guard |
| `test_biographical_juyo_reference_with_real_cert_first` | Listing 5395 regression |
| `test_biographical_juyo_shitei_reference_with_real_cert_first` | Listing 42061 regression (xfail — known limitation) |

**Results: 136 passed, 1 xfailed**

Pre-existing Choshuya test (`test_choshuya_gj_tokubetsu_hozon_english`) continues to pass after fixing the parenthetical guard to handle fullwidth `）`.

## Known Limitations

1. **Biographical session pattern**: `第XX回重要刀剣` in biographical text like "第39回重要刀剣に指定されている" (describing a different sword) still matches because the session pattern runs at higher priority than the standalone pattern. Marked as xfail. Future fix: add biographical context guard to session pattern.

2. **Frontend guardrail exchange rates**: Uses hardcoded approximate rates (USD=150, EUR=160, etc.) for JPY conversion. Not exact, but the thresholds have enough margin that minor rate fluctuations don't matter.

## Files Changed

### Oshi-scrapper
| File | Change |
|------|--------|
| `utils/llm_extractor.py` | Added multi-type, parenthetical, and Related proximity guards to English cert patterns |
| `scrapers/base.py` | Strip Related Products HTML sections before text extraction |
| `qa/validators/cross_validators.py` | Elevated Tokuju<¥5M and Juyo<¥1M from WARNING to ERROR |
| `tests/test_title_first_cert.py` | Added 12 regression tests for related items false positives |

### NihontoWatch
| File | Change |
|------|--------|
| `src/components/browse/ListingCard.tsx` | Suppress cert badges when price/cert is implausible (with title exception) |

### Database
| Listing | Before | After | Reason |
|---------|--------|-------|--------|
| 54248 | Tokuju | NULL | Related Products text bleed |
| 5395 | Juyo | Hozon | Biographical reference to other Juyo works |
| 42061 | Juyo | TokuHozon | Biographical session reference to different sword |
