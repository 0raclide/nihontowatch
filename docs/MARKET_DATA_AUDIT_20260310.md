# Market Transparency — Phase 0: Data Audit

**Date:** 2026-03-10
**Script:** `scripts/market-data-audit.ts`
**Method:** Read-only queries against prod Supabase (anon key)

---

## Executive Summary

The data audit reveals a **mixed picture** for market price features:

- **Price coverage is good for available items** (78.8%) but **near-zero for sold items** (2.0%)
- **Artisan matching covers 54.3%** of available listings (HIGH/MEDIUM confidence)
- **Artisan × cert combos are extremely sparse** — only 12 combos have ≥10 data points
- **Sold price data is essentially nonexistent** — only 133 sold items have prices (most dealers strip prices on sale)
- **School-level aggregation (NS-* codes) is the only viable granularity** — individual smith combos rarely exceed 2-3 data points

**Bottom line:** We cannot build a "comparable sales" feature in the traditional sense. We *can* build price-range guidance at the **school × cert** level for tosogu (where NS-* codes dominate), and at the **item_type × cert** level for blades.

---

## Raw Results

### Q1 — Price Coverage by Status

| Status | Total | With Price | Coverage |
|--------|-------|------------|----------|
| available | 7,338 | 5,781 | **78.8%** |
| sold | 6,568 | 133 | **2.0%** |
| reserved | 734 | 39 | 5.3% |
| withdrawn | 74 | 30 | 40.5% |

**Key insight:** Sold items almost never retain prices. Dealers either remove listings entirely or strip the price field. The 133 priced sold items are mostly from international dealers who leave prices up. This means **we cannot do "recent sale price" comparisons** — we can only compare against currently-listed inventory.

### Q2 — Artisan ID Coverage (Available)

| Metric | Count | % |
|--------|-------|---|
| Total available | 7,338 | 100% |
| With artisan (non-UNKNOWN) | 3,985 | 54.3% |
| — HIGH confidence | 2,743 | 68.8% of matched |
| — MEDIUM confidence | 600 | 15.1% of matched |
| — NONE confidence | 642 | 16.1% of matched |
| Unmatched | 3,353 | 45.7% |

**Key insight:** 3,343 available listings have usable artisan matches (HIGH + MEDIUM). But ~46% of listings have no artisan match at all — these can only use coarser fallbacks.

### Q3 — Certification Distribution

| Cert Type | Available | Sold | Total |
|-----------|-----------|------|-------|
| (none) | 3,447 | 2,764 | 6,211 |
| Tokubetsu Hozon | 1,643 | 1,827 | 3,470 |
| Hozon | 1,779 | 1,562 | 3,341 |
| Juyo | 238 | 191 | 429 |
| Registration | 87 | 162 | 249 |
| Tokubetsu Kicho | 79 | 36 | 115 |
| Tokuju | 9 | 7 | 16 |
| Juyo Bijutsuhin | 4 | 6 | 10 |

**Key insight:** Hozon and Tokubetsu Hozon are the workhorses (~70% of certified items). Juyo (429 total) is viable for aggregate stats but thin for per-artisan breakdown. Tokuju (16 total) is too rare for any statistical feature.

### Q4 — Artisan × Cert Combo Viability (THE Key Query)

**Available only, priced, HIGH/MEDIUM confidence:**

| Combo Size | Count |
|-----------|-------|
| 1 item | 947 |
| 2 items | 144 |
| 3–4 items | 58 |
| 5–9 items | 30 |
| 10–19 items | 7 |
| 20+ items | 5 |

- **Qualified rows:** 1,802
- **Unique combos:** 1,191
- **79.5% of combos have only 1 data point** — useless for price estimation

**Top combos are ALL schools (NS-* codes), not individual smiths:**
1. NS-KyoKinko × Hozon: 25 items
2. NS-Goto × Tokubetsu Hozon: 25 items
3. NS-Goto × Hozon: 23 items
4. NS-Owari × Hozon: 20 items
5. NS-Akasaka × Hozon: 20 items

**Sold data adds almost nothing** — only 31 qualified sold rows across 30 unique combos.

**Combined pool (available + sold):**
- Viable combos (≥3 data points): **101**
- Viable combos (≥5 data points): **43**
- Viable combos (≥10 data points): **12**

### Q5 — Item Type × Cert (Coarser Fallback)

This granularity works much better:

| Item Type | Cert | Total Available | Priced | % Priced |
|-----------|------|-----------------|--------|----------|
| tsuba | (none) | 1,045 | 914 | 87.5% |
| tsuba | Hozon | 634 | 610 | 96.2% |
| katana | Tokubetsu Hozon | 593 | 411 | 69.3% |
| katana | (none) | 548 | 390 | 71.2% |
| katana | Hozon | 381 | 277 | 72.7% |
| wakizashi | Tokubetsu Hozon | 292 | 254 | 87.0% |
| fuchi-kashira | (none) | 287 | 275 | 95.8% |
| tsuba | Tokubetsu Hozon | 274 | 246 | 89.8% |

**Key insight:** At item_type × cert_type granularity, most combos have 100+ priced data points. This is viable for "price range" features (showing percentile bands). The trade-off: it's very coarse — a Tokubetsu Hozon katana by Masamune and one by an unknown Shinto smith are in the same bucket.

### Q6 — Price Distribution (Available, Est. JPY)

| Range | Count |
|-------|-------|
| < ¥50K | 717 |
| ¥50K–100K | 848 |
| ¥100K–250K | 1,080 |
| ¥250K–500K | 1,262 |
| ¥500K–1M | 974 |
| ¥1M–2.5M | 570 |
| ¥2.5M–5M | 213 |
| ¥5M–10M | 100 |
| ¥10M+ | 17 |
| No price | 1,557 |

**Key insight:** Nice bell curve centered around ¥250K–500K. 21.2% have no price (inquiry-based). Enough depth at every price tier for statistical features.

### Q7 — Currency Distribution

| Currency | Total | Priced |
|----------|-------|--------|
| JPY | 5,149 | 5,117 |
| (null) | 1,508 | 0 |
| USD | 400 | 400 |
| AUD | 136 | 136 |
| EUR | 128 | 128 |
| ASK | 17 | 0 |

**Key insight:** 88.5% of priced items are in JPY. Currency conversion is needed but doesn't introduce major noise. The 1,508 NULL-currency items are the inquiry-based ones.

### Q8 — Date Coverage

- **Available:** 7,338/7,338 (100%)
- **Sold:** 6,568/6,568 (100%)
- Sold by year: 2025 (735), 2026 (5,833)

**Key insight:** We have dates for everything. Recent data heavily skewed to 2026 (site launched late 2025).

### Q9 — Price History

- **Total records:** 2,780
- **Unique listings:** 2,589
- **By type:** presumed_sold (1,386), sold (1,217), decrease (95), increase (82)

**Key insight:** Price changes are rare (177 actual price changes vs 2,603 status changes). Not enough data for "price trend" features. But the sold/presumed_sold transitions are useful for time-on-market analysis.

### Q10 — Top Artisans by Priced Available Inventory

Top 5 are all tosogu schools:
1. **NS-Goto** — 62 priced (Hozon, Juyo, TokuHozon)
2. **NS-Akasaka** — 34 priced
3. **NS-KyoKinko** — 32 priced
4. **NS-Owari** — 27 priced
5. **NS-Kokinko** — 25 priced

First individual smith (non-school) doesn't appear until #12 (ECH014 with 14 priced items).

---

## Viability Assessment

### Tier 1: Artisan × Cert Price Range — NOT VIABLE (now)

The "dream" feature — "A Juyo katana by Sadamune typically sells for ¥X–Y" — is not viable with current data. Only 12 artisan×cert combos have ≥10 data points, and these are all school codes, not individual smiths. The sold-price data pool is essentially empty (2% coverage).

**What would make it viable:** Either (a) historical auction data import (Bonhams, Christie's, etc.), or (b) 2+ years of price capture before items sell.

### Tier 2: School × Cert Price Range — VIABLE for tosogu

For tosogu (fittings), school-level codes (NS-Goto, NS-Akasaka, etc.) have 10–60+ priced items per cert tier. We could show:
- "Goto school × Tokubetsu Hozon: ¥120K–¥1.1M (median ¥500K)"
- Based on 25 currently-listed items

**Limitation:** This is a "current asking price" range, not a "market value" range. Still useful for collectors.

### Tier 3: Item Type × Cert Price Range — VIABLE broadly

At the coarsest level, item_type × cert has hundreds of data points per bucket:
- "Katana × Tokubetsu Hozon: ¥X–Y (N items)"
- "Tsuba × Hozon: ¥X–Y (N items)"

This is very coarse but still useful for newcomers who have no price intuition.

### Tier 4: Price Distribution Visualization — VIABLE now

A histogram showing "where this listing sits" relative to similar items (same type, same cert) needs no comp data — just the current inventory. This is the easiest, safest, and most immediately useful feature.

### Tier 5: Time-on-Market Analysis — VIABLE with caveats

With `first_seen_at` for all items + sold status transitions, we can compute "how long items typically stay listed before selling" by type/cert/price tier. Useful for collectors evaluating urgency.

---

## Recommended Next Steps

### Phase 1 (ship first): Price Context Band
For each listing, show where its price sits within the distribution of currently-listed items of the same type and certification tier. No comparables needed — just a percentile indicator. "This katana is priced in the top 15% of Tokubetsu Hozon katana."

### Phase 2: School-Level Price Range (tosogu first)
For tosogu with matched school codes, show the price range for that school × cert tier. Start with the ~12 combos that have ≥10 data points.

### Phase 3: Price Capture Pipeline
Start storing `last_known_price` before items are marked sold (Oshi-scrapper already has `price_history`). Over 6–12 months this builds the sold-price pool needed for Tier 1.

### Phase 4 (future): Auction Data Import
Partner with or scrape auction house results (public record post-sale) to build a true comparable sales database.

---

## Data Quality Notes

1. **Price range within combos can be extreme:** NS-KyoKinko × Hozon ranges from ¥525 to ¥450,000. The ¥525 items are likely USD prices stored without currency (data quality issue in scraper).
2. **`Juyo Bijutsuhin` vs `juyo_bijutsuhin`:** Two cert type variants exist (10 vs 1). Should be normalized.
3. **Tosogu cert types** (`Hozon Tosogu`, `Tokubetsu Hozon Tosogu`) are separate from blade certs — only 39 items total. May need to merge with their blade equivalents for statistical purposes.
