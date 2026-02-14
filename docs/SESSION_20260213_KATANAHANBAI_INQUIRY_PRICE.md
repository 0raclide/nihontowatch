# Session: Katanahanbai Inquiry-Price Misclassification

**Date:** 2026-02-13
**Bug:** Listing 5446 (Osafune Chogi) shows 0 works for sale on artist page
**Root cause:** Scraper classifies "price on inquiry" items as `status=reserved`
**Fix:** Katanahanbai-specific `_post_llm_validation` in Oshi-scrapper
**Commit:** `117134f` (Oshi-scrapper)

---

## Symptom

User navigates to `/s/5446` (Osafune Chogi, Juyo 52nd session), clicks the smith badge to view the artist page at `/artists/osafune-chogi-CHO10`, and sees zero works for sale.

## Investigation

Listing 5446 had `status: "reserved"`, `is_available: null`, `is_sold: false`. The artist page's listings API filters on `.eq('is_available', true)`, so the listing was invisible.

Checked the actual dealer page at `katanahanbai.com/katana/chogi` — the item shows `「どうぞお問合せください」` (please inquire) in the price field. It is genuinely for sale, not reserved.

## Root Cause Chain

1. Katanahanbai page shows `<dt>価格</dt><dd>どうぞお問合せください</dd>` instead of a price
2. LLM correctly returns `price_value: null` but returns `is_available: false` (no price/buy button)
3. `_apply_llm_metadata()` sets `is_available=False`, `is_sold=False`
4. `_is_reserved_indicator()` finds no reserved patterns (no 商談中/HOLD)
5. `_is_sold_indicator()` finds no sold patterns
6. `compute_status()` maps `page_exists=True + is_available=False + is_sold=False` → **RESERVED**

## Attempted Fix 1: Broad base scraper change (REVERTED)

Added `is_inquiry(soup.get_text())` check to `base.py` post-LLM validation. This would have overridden `is_available=False` → `True` when ASK_PATTERNS match on the full page text.

**Why it was reverted:** Massive false positive risk. `ASK_PATTERNS` include `お問合せ` which appears in the nav/footer contact link of virtually every Japanese dealer site. Also `ask` matches in English text ("asked", "task") and `por` matches in "important", "support", etc.

Spot-checked the 742 total "reserved" listings across 17 dealers:
- **World Seiyudo (422):** Pages show `在庫切れ` (out of stock) — genuinely unavailable
- **Kusanagi (233):** Pages show `在庫切れ` + disabled buy button — genuinely unavailable
- **Aoi Art (20):** Pages show "sold at auction" — genuinely sold

The broad fix would have incorrectly marked ~700 items as available.

## Actual Fix: Katanahanbai-specific _post_llm_validation

### scrapers/katanahanbai.py

Added `_post_llm_validation()` that:
1. Only fires when `is_sold=False` AND `is_available=False` (LLM ambiguous state)
2. Searches `<dt>` elements for `価格` (price label)
3. Checks the paired `<dd>` for inquiry patterns: `お問合せ` / `お問い合わせ` / `応談`
4. Sets `is_available=True` only if inquiry text is in the price field specifically

**Zero false positives:** Does not match on nav/footer contact links because it only reads the `<dd>` paired with the `<dt>価格</dt>` element.

### utils/price_parser.py

Added `PriceParser.is_inquiry()` classmethod (wraps existing `ASK_PATTERNS`). Available for future dealer-specific use but NOT used in the base scraper against full page text.

## Data Fix

Updated 6 katanahanbai listings in production DB:

| ID | Title | Before | After |
|----|-------|--------|-------|
| 5446 | Chogi (Juyo 52) | reserved / is_available=null | available / is_available=true |
| 5449 | Okimasa (Juyo) | reserved / is_available=false | available / is_available=true |
| 5460 | Sanenaga (Juyo) | reserved / is_available=null | available / is_available=true |
| 5462 | Armor (Myochin) | reserved / is_available=false | available / is_available=true |
| 5463 | Naotane (Juyo 89) | reserved / is_available=null | available / is_available=true |
| 5465 | Tadayoshi | reserved / is_available=false | available / is_available=true |

Katanahanbai totals: `reserved: 6 → 0`, `available: 58 → 64`

## Scope of Broader "Reserved" Problem

742 listings across 17 dealers have `status=reserved`. Most are NOT inquiry-priced:

| Dealer | Count | Actual cause |
|--------|-------|-------------|
| World Seiyudo | 422 | 在庫切れ (out of stock) — scraped before sold detection caught this |
| Kusanagi | 233 | 在庫切れ + no-stock button — same |
| Aoi Art | 20 | Auction sold items — LLM/regex missed sold indicator |
| Eirakudo | 16 | Likely stale pre-improvement scrapes |
| Nihonto Art | 13 | Inquiry-only dealer (separate issue) |
| Others | 38 | Mixed — need per-dealer investigation |

These are mostly historical data from before the sold-detection improvements. A re-scrape would fix World Seiyudo/Kusanagi via the existing `在庫切れ` sold pattern.

## Key Lesson

**Never use `ASK_PATTERNS` against `soup.get_text()` in the base scraper.** These patterns were designed for parsing short price strings (`PriceParser.parse()`), not full page text. Japanese sites universally have `お問い合わせ` in navigation, and `ask`/`por` match common English words. Always check the **price-specific DOM element**, not the full page.

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `scrapers/katanahanbai.py` | Oshi-scrapper | Added `_post_llm_validation()` |
| `utils/price_parser.py` | Oshi-scrapper | Added `PriceParser.is_inquiry()` |
| 6 rows in `listings` table | Supabase | status: reserved → available |
