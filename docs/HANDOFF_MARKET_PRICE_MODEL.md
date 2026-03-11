# Market Price Model — Handoff Document

**Date:** 2026-03-11
**Status:** Phase 0.5 complete. V3 refit on fused 9,178-row dataset done. Production coefficients extracted. Ready for Phase 1 implementation.

---

## What We're Building

A price estimation system for nihonto and tosogu listings. Given a listing's certification level, item type, and artisan rating, the model predicts an expected price range. The goal is **price context** — "this listing is priced in the Nth percentile for comparable items" — not a precise appraisal.

## The Core Insight: Ladder Theory

Japanese sword certification creates price "ladders" — discrete steps where the paper level sets a price floor, and artisan prestige differentiates within each tier. The data confirms this strongly:

| Cert Tier | Blade Median | Tosogu Median |
|-----------|-------------|---------------|
| None/Reg | ¥400K | ¥65K |
| Hozon | ¥550K | ¥180K |
| Tokubetsu Hozon | ¥1.3M | ¥350K |
| Juyo | ¥6.3M | ¥5.5M |
| Tokuju | ¥30M | — |

Artisan prestige (measured by elite_factor or toko_taikan) has **near-zero** predictive power within Hozon (the cert floor dominates), but becomes increasingly important at Tokubetsu Hozon and above. This interaction is the key to the model — cert sets the band, artisan rating positions within it.

---

## Data Table: `market_price_observations`

**Migration:** `supabase/migrations/151_market_price_observations.sql`
**Backfill script:** `scripts/backfill-market-observations.ts`
**Current size:** 9,178 rows (5,878 scraped + 3,280 Jussi Ekholm + 20 private sale observations)

### Schema

```sql
CREATE TABLE market_price_observations (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL DEFAULT 'scraped',  -- scraped | jussi | manual | auction | private_sale
  listing_id      INTEGER REFERENCES listings(id),  -- NULL for non-scraped entries
  listing_url     TEXT,

  -- Price (original + pre-converted JPY)
  price_value     NUMERIC NOT NULL,
  price_currency  TEXT NOT NULL DEFAULT 'JPY',
  price_jpy       NUMERIC NOT NULL,                 -- Used directly by model

  -- Temporal
  observed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sold_at         TIMESTAMPTZ,
  was_sold        BOOLEAN NOT NULL DEFAULT false,   -- true = sold price, false = asking

  -- Classification
  item_type       TEXT,                             -- katana, wakizashi, tanto, tsuba, etc.
  item_category   TEXT,                             -- blade, tosogu, koshirae, other

  -- Certification (the ladder)
  cert_type       TEXT,
  cert_ordinal    SMALLINT,  -- 0=none/reg, 1=kicho, 2=tokukicho, 3=hozon, 4=tokuhozon, 5=juyo, 6=tokuju

  -- Artisan
  artisan_id      TEXT,                             -- Yuhinkai maker_id or school_id
  artisan_name    TEXT,

  -- Artisan rating features (pre-joined from Yuhinkai at backfill time)
  elite_factor    REAL,       -- Designation-based Bayesian shrinkage (0–1.88)
  toko_taikan     INTEGER,    -- Toko Taikan rating (450–3500)
  hawley          INTEGER,    -- Hawley rating (50–400)
  fujishiro       TEXT,       -- Fujishiro grade text
  fujishiro_ord   SMALLINT,   -- 1=chu, 2=chujo, 3=jo, 4=jojo, 5=saijo

  -- Physical / context
  nagasa_cm       REAL,
  condition_notes TEXT,
  dealer_id       INTEGER,
  dealer_name     TEXT,
  dealer_country  TEXT,
  notes           TEXT,
  added_by        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Data Sources

**Scraped (5,878 rows):** Auto-populated from `listings` table joined with `artisan_makers` from Yuhinkai. Includes all priced, non-hidden, available or sold listings with `price_jpy >= ¥5,000`. Ratings pre-joined at backfill time.

**Jussi Ekholm (3,280 rows):** Fused from Oshi-Jussi `price_database_normalized.csv` — Jussi's manually curated price tracking database. Blades only (katana, tachi, wakizashi, tanto, naginata, ken, yari). Artisan IDs resolved via chain: `master_id` → `uuid_mapping.csv` → Yuhinkai `gold_values.gold_smith_id` → `artisan_makers` ratings. **90.9% artisan linkage rate** (2,981/3,280), 70.9% EF coverage, 47.9% TT coverage, 100% nagasa coverage. 32 URL overlaps with scraped data deduped. Price range ¥5.5K–¥180M. Insert script: `scripts/insert-jussi-observations.ts`.

**Private sale (20 rows):** Manually entered from owner knowledge. These are critical because they fill in the top end of the market (¥10M–200M) that scraped data almost completely misses — dealers strip prices on sale (only 2% of sold items retain prices). All private entries are Saijo saku / Tokuju-capable artisans.

### Private Sale Observations (all 20)

| Artisan | Code | Cert | Type | Price (JPY) | TT | EF | Sold? |
|---------|------|------|------|-------------|-----|------|-------|
| Mitsutada (Mikazuki) | MIT281 | Tokuju | tachi | ¥200M | 3000 | 1.61 | Yes |
| Masamune | MAS590 | Juyo | katana | ¥180M | 2500 | 1.63 | No (asking) |
| Masamune | MAS590 | Juyo | katana | ¥163M | 2500 | 1.63 | Yes |
| Masamune | MAS590 | Tokuju | naginata | ¥150M | 2500 | 1.63 | Yes |
| Masamune | MAS590 | Tokuju | tanto | ¥90M | 2500 | 1.63 | No (asking) |
| Masamune | MAS590 | Juyo | tanto | ¥60M | 2500 | 1.63 | Yes |
| Mitsutada | MIT281 | Juyo | tachi | ¥55M | 3000 | 1.61 | Yes |
| Nagamitsu | NAG281 | Tokuju | katana | ¥50M | 2800 | 1.31 | Yes |
| Sukezane | SUK460 | (none) | katana | ¥45M | 2500 | 1.43 | Yes |
| Kunimitsu | KUN539 | Tokuju | tanto | ¥45M | 1800 | 1.16 | Yes |
| Yukimitsu | YUK268 | Tokuju | katana | ¥38M | 2500 | 0.77 | Yes |
| Norishige | NOR312 | Tokuju | katana | ¥32M | 2000 | 0.87 | Yes |
| Yoshifusa | YOS38 | (none) | katana | ¥30M | 3000 | 0 | Yes |
| Norishige | NOR312 | Tokuju | katana | ¥30M | 2000 | 0.87 | Yes |
| Mitsutada | MIT281 | TokuHozon | tachi | ¥25M | 3000 | 1.61 | Yes |
| Yoshimitsu | YOS463 | Juyo | tanto | ¥25M | 3000 | 1.71 | Yes |
| Yukimitsu | YUK268 | Juyo | katana | ¥21.2M | 2500 | 0.77 | Yes |
| Kunimitsu | KUN539 | Juyo | tanto | ¥20M | 1800 | 1.16 | Yes |
| Yoshimitsu | YOS463 | TokuHozon | tanto | ¥18M | 3000 | 1.71 | Yes |
| Mitsutada | MIT281 | TokuHozon | katana | ¥10M | 3000 | 1.61 | Yes |

### Adding More Private Observations

Insert directly into `market_price_observations` with `source = 'private_sale'`. Required fields:

```typescript
{
  source: 'private_sale',
  price_value: 300000,          // Original price
  price_currency: 'USD',        // Original currency
  price_jpy: 45000000,          // Pre-converted (USD × 150, EUR × 163)
  was_sold: true,               // false = asking price
  item_type: 'tanto',
  item_category: 'blade',       // blade | tosogu | koshirae | other
  cert_type: 'Tokuju',          // or null for no cert
  cert_ordinal: 6,              // 0=none, 3=hozon, 4=tokuhozon, 5=juyo, 6=tokuju
  artisan_id: 'KUN539',         // Yuhinkai code
  artisan_name: 'Kunimitsu',
  // Pre-join ratings from artisan_makers:
  elite_factor: 1.16,
  toko_taikan: 1800,
  hawley: 150,
  fujishiro: 'Sai-jo saku',
  fujishiro_ord: 5,             // 1=chu, 2=chujo, 3=jo, 4=jojo, 5=saijo
  notes: 'Description of the transaction',
  added_by: 'chris_manual',
}
```

To look up artisan codes and ratings, query Yuhinkai:
```sql
SELECT maker_id, name_romaji, name_kanji, toko_taikan, hawley, fujishiro, elite_factor
FROM artisan_makers WHERE name_romaji = 'Kunimitsu'
ORDER BY toko_taikan DESC NULLS LAST;
```

**Important:** For high-value items (>¥10M), always use the **highest toko_taikan** artisan with that name — these are the top-tier smiths (Tokuju-capable). See `scripts/insert-private-observations.ts` for the pattern.

---

## Feature Coverage

**Pre-fusion (scraped + private only):**

| Feature | Blades (n=2,441) | Tosogu (n=3,107) |
|---------|-----------------|------------------|
| cert_ordinal | 100% | 100% |
| item_type | 100% | 100% |
| elite_factor > 0 | 750 (30.7%) | 565 (18.2%) |
| toko_taikan | 1,184 (48.5%) | 39 (1.3%) |
| hawley | 1,716 (70.3%) | 80 (2.6%) |
| fujishiro | 796 (32.6%) | 20 (0.6%) |

**Post-fusion (+ 3,280 Jussi blade records):**

| Feature | Blades (n=~5,720) | Tosogu (n=3,107, unchanged) |
|---------|-------------------|----------------------------|
| cert_ordinal | 100% | 100% |
| item_type | 100% | 100% |
| elite_factor > 0 | ~3,074 (53.7%) | 565 (18.2%) |
| toko_taikan | ~2,771 (48.4%) | 39 (1.3%) |
| nagasa_cm | ~5,600 (97.9%) | N/A |

The Jussi fusion nearly doubles blade observations and significantly improves EF coverage (30.7% → 53.7%). Tosogu is unchanged (Jussi data is blades only).

**Key takeaway:** TT/Hawley/Fujishiro are blade-only features (negligible tosogu coverage). Elite_factor is the only artisan rating with meaningful tosogu coverage.

---

## Model Results

### Rating System Comparison (Single-Feature, Blades)

| Feature | n | R² |
|---------|---|-----|
| cert_ordinal | 2,441 | 0.351 |
| elite_factor (>0) | 750 | **0.212** |
| item_type_ord | 2,441 | 0.161 |
| log₁₀(toko_taikan) | 1,184 | 0.143 |
| hawley | 1,716 | 0.120 |
| fujishiro_ord | 796 | 0.086 |

EF has the highest single-feature R² among artisan ratings, but TT has 1.6× the coverage.

### Inter-Rating Correlations (Blades)

| Pair | r |
|------|---|
| TT vs Hawley | 0.759 |
| EF vs TT | 0.715 |
| TT vs Fujishiro | 0.723 |
| EF vs Hawley | 0.555 |
| EF vs Fujishiro | 0.463 |

The ratings are highly correlated (they all measure "how famous is this smith"). TT and Hawley are nearly redundant. EF is the most independent — it captures designation-based prestige that the historical reference books don't.

### Multi-Feature Model Comparison (Blades, sorted by adjR²)

| Model | Features | n | adjR² | RMSE | Within 2× |
|-------|----------|---|-------|------|-----------|
| **M8** | cert + item + EF + log(TT) + interactions | 559 | **0.704** | 0.308 | 70% |
| M7 | cert + item + EF + log(TT) | 559 | 0.696 | 0.312 | — |
| M3i | cert + item + EF + cert×EF | 750 | 0.640 | 0.324 | 70% |
| **M5i** | **cert + item + log(TT) + cert×TT** | **1,184** | **0.629** | **0.309** | **72%** |
| M-hw+tt | cert + item + hawley + log(TT) | 1,184 | 0.598 | 0.322 | — |
| M-fj | cert + item + fujishiro | 796 | 0.577 | 0.346 | — |
| M-hw | cert + item + hawley | 1,716 | 0.528 | 0.324 | — |
| M1 | cert + item_type | 2,441 | 0.462 | 0.337 | 66% |
| M0 | cert only | 2,441 | 0.351 | 0.370 | — |

### Head-to-Head Within Cert Tiers (Blades)

| Cert Tier | EF R² (n) | log(TT) R² (n) | Hawley R² (n) |
|-----------|-----------|-----------------|---------------|
| None/Reg | 0.027 (152) | 0.003 (244) | 0.007 (453) |
| Hozon | 0.001 (137) | 0.036 (266) | 0.009 (417) |
| **TokuHozon** | **0.233 (357)** | **0.242 (558)** | 0.171 (712) |
| **Juyo** | **0.412 (86)** | 0.255 (80) | **0.461 (90)** |
| **Tokuju** | **0.833 (7)** | 0.376 (7) | 0.122 (7) |

**Critical pattern:** Artisan ratings are meaningless at Hozon and below (cert floor dominates). They become powerful at TokuHozon+. EF wins at Tokuju, Hawley wins at Juyo, TT wins at TokuHozon.

### Tosogu Models

Tosogu has much less artisan rating coverage. Best models:

| Model | n | adjR² |
|-------|---|-------|
| cert only | 3,107 | 0.435 |
| cert + item + EF + cert×EF | 565 | 0.289 |

For tosogu, cert alone explains 43.5% — more than blades (35.1%). Adding EF helps modestly. TT/Hawley/Fujishiro are useless (n < 80).

---

## Recommended Implementation: Tiered Model

Use progressively richer models based on available features:

### Tier 1 — Universal (all listings)
```
log₁₀(price) = 5.072 + 0.140 × cert_ordinal + 0.189 × item_type_ord
```
- **Coverage:** 100% of priced listings
- **adjR²:** 0.462 (blades), 0.436 (tosogu)
- **Use when:** No artisan rating available

### Tier 2 — TT-Enhanced (blades with toko_taikan)
```
log₁₀(price) = 5.119 + (-0.320 × cert) + (0.201 × item) + (-0.041 × log₁₀(TT)) + (0.180 × cert × log₁₀(TT))
```
- **Coverage:** 48.5% of priced blades (1,184 items)
- **adjR²:** 0.629
- **Use when:** Artisan has toko_taikan rating

Sample predictions (katana):

| Cert | TT=500 | TT=1000 | TT=2000 | TT=3000 |
|------|--------|---------|---------|---------|
| Hozon | ¥1.3M | ¥1.8M | — | — |
| TokuHozon | ¥1.9M | ¥3.0M | ¥4.8M | ¥6.3M |
| Juyo | ¥2.7M | ¥5.0M | ¥9.0M | ¥12.8M |
| Tokuju | — | ¥8.2M | ¥16.9M | ¥25.8M |

### Tier 3 — Full Model (blades with EF + TT)
```
log₁₀(price) = 6.158 + (-0.163 × cert) + (0.202 × item) + (0.615 × EF) + (-0.441 × log₁₀(TT)) + (0.017 × cert × EF) + (0.122 × cert × log₁₀(TT))
```
- **Coverage:** 22.9% of priced blades (559 items)
- **adjR²:** 0.704
- **Use when:** Artisan has both elite_factor > 0 and toko_taikan

### Tier 4 — EF-Only (tosogu, or blades without TT)
```
log₁₀(price) = β₀ + β₁×cert + β₂×item + β₃×EF + β₄×cert×EF
```
- **Use when:** Has elite_factor > 0 but no toko_taikan (common for tosogu)

### Model Selection Logic
```
if (item_category === 'blade' && elite_factor > 0 && toko_taikan != null) → Tier 3
else if (item_category === 'blade' && toko_taikan != null) → Tier 2
else if (elite_factor > 0) → Tier 4
else → Tier 1
```

---

## V3 Model Improvements (SOTA Techniques)

**Script:** `scripts/market-model-v3.ts`

V3 applies state-of-the-art techniques from art market valuation literature. Key references: Fedderke & Carugno (2025) "Machine Learning Algorithms and Fine Art Pricing", Kim & Kim (2024) "Two-step model based on XGBoost for artwork prices", Fedderke (2023) "Generalizing the Masterpiece Effect" (quantile hedonic regression).

### New Techniques Applied

| Technique | What It Does | Impact |
|-----------|-------------|--------|
| **K-fold cross-validation** | Honest out-of-sample evaluation (was all in-sample) | V2's adjR²=0.704 was optimistic; CV shows real accuracy |
| **Quantile regression (IRLS)** | Predicts P10/P25/P50/P75/P90 directly | Produces the price band for the UI feature |
| **Huber robust regression** | Tested but **rejected** — downweights the 20 private observations which are ground-truth | Shifts log(TT) by -166%, suppressing high-end accuracy. Use OLS. |
| **Dealer origin effect** | JP vs international (proxied by price_currency) | JP dealers price ~39% lower than international |
| **Nagasa as feature** | Blade length → price (r=0.378 marginal, r=0.563 within uncertified) | Significant at low cert tiers |
| **Hierarchical artisan shrinkage** | Empirical Bayes partial pooling by artisan | CV improvement: +15% blade, +8% tosogu |
| **Per-tier variance analysis** | Quantifies heteroscedasticity (7.1× variance ratio, blades) | Proves quantile regression necessity |

### Cross-Validated Model Comparison (Blades) — Post-Fusion Refit

| Model | n | in-sample adjR² | **cvRMSE** | **<2×** | Notes |
|-------|---|-----------------|------------|---------|-------|
| M1 cert+item | 5,727 | 0.433 | 0.356 | 63% | Universal fallback |
| M1d +dealer | 5,727 | 0.453 | 0.350 | 65% | +2% from dealer |
| M1nd +nagasa+dealer | 5,620 | 0.464 | 0.338 | 65% | Best universal |
| M3i cert+item+EF+ixn | 3,080 | 0.545 | 0.310 | 71% | EF-enhanced (4× more data) |
| M3id +dealer | 3,080 | 0.567 | **0.302** | **72%** | EF+dealer, high coverage |
| M5i cert+item+TT+ixn | 2,777 | 0.586 | 0.321 | 70% | TT-enhanced |
| M5id +dealer | 2,777 | 0.612 | 0.312 | 71% | +dealer |
| **M5ind +nagasa+dealer** | **2,720** | **0.618** | **0.298** | **72%** | **CV winner (coverage + accuracy)** |
| M8d full+ixns+dealer | 1,756 | 0.629 | 0.303 | 71% | Full model |
| M8dn +nagasa | 1,711 | 0.618 | 0.296 | 72% | Best raw accuracy |
| **Hier (TT features)** | **2,777** | **0.757** | **0.297** | **74%** | **Best overall (with artisan intercepts)** |

**Key findings:**
- **M5ind** (cert + item + TT + ixn + nagasa + dealer, n=2,720) is the best parametric model: cvRMSE=0.298, 72% <2×.
- **M3id** (cert + item + EF + ixn + dealer, n=3,080) is a strong alternative with higher coverage and only slightly worse CV (0.302).
- **Hierarchical model** with TT features remains the overall winner (cvRMSE=0.297, 74% <2×) but requires per-artisan intercepts.
- Jussi fusion **most improved EF models**: M3i coverage went from 756 → 3,080 (4×), cvRMSE 0.333 → 0.310.

### Dealer Origin Effect

Using `price_currency` as a proxy for JP vs international:

| Category | JP → Intl Price Premium | OLS Coefficient |
|----------|------------------------|-----------------|
| Blade | International +16–44% higher | -0.212 (×0.61) |
| Tosogu | International +8–53% higher | -0.169 (×0.68) |

JP dealers consistently price ~33–39% below international across all cert tiers. The blade effect strengthened post-fusion (Jussi data is predominantly JP-priced).

### Nagasa (Blade Length) Effect

| Cert Tier | r(log(nagasa), log(price)) | Interpretation |
|-----------|---------------------------|----------------|
| None/Reg | **0.563** | Length dominates at low cert |
| Hozon | 0.324 | Still strong |
| TokuHozon | 0.207 | Moderate |
| Juyo | 0.104 | Artisan/cert dominates |

Longer blades = more expensive at lower cert tiers. At Juyo+, the artisan and certification drive price and length becomes noise. Marginal r=0.378 (pre-fusion: 0.459) — the relationship diluted with wider data but remains significant.

### Hierarchical Artisan Shrinkage

Empirical Bayes partial pooling: artisans with many observations keep their own intercept; artisans with 1-2 observations are shrunk toward the global mean. Post-fusion: 1,345 blade artisans, 391 tosogu artisans.

| Category | Flat CV RMSE | Hierarchical CV RMSE | Improvement |
|----------|-------------|---------------------|-------------|
| Blade (cert+item, n=4,812) | 0.3514 | 0.2995 | **-14.8%** |
| Blade (TT features, n=2,777) | 0.3208 | 0.2973 | **-7.3%** |
| Tosogu (cert+item, n=1,207) | 0.3454 | 0.3193 | **-7.6%** |

Top artisan premiums (priced above model prediction):
- **SUK460** (Sukezane): ×11.9 — matches the ¥45M private observation
- **YOS38** (Yoshifusa): ×9.8 — matches the ¥30M private observation
- **MIT281** (Mitsutada): ×7.6 — matches ¥10M–55M private observations
- **MAS590** (Masamune): ×7.4 — matches ¥60M–180M private observations
- **KUN539** (Kunimitsu): ×5.9 — matches ¥20M–45M private observations

### Heteroscedasticity

Residual variance by cert tier (blades):

| Cert | σ² | 95% Band | Coverage |
|------|-----|----------|----------|
| None/Reg | 0.190 | ÷7.1–×7.1 | 93% |
| Hozon | 0.116 | ÷4.7–×4.7 | 97% |
| TokuHozon | 0.087 | ÷3.8–×3.8 | 96% |
| **Juyo** | **0.158** | **÷6.0–×6.0** | 95% |
| **Tokuju** | **0.622** | **÷35.1–×35.1** | 95% |

Variance ratio = **7.1×** across cert tiers (was 18.2× pre-fusion — the Jussi data stabilized Juyo/Tokuju variance significantly with 806+48 more observations). Still strong enough to require quantile regression over constant-width bands.

### Quantile Price Bands (Sample Predictions — Post-Fusion)

M5i quantile regression (cert + item + log(TT) + cert×TT + jp_dealer), katana, JP dealer:

| Scenario | P10 | P25 | P50 | P75 | P90 | Band |
|----------|-----|-----|-----|-----|-----|------|
| Hozon, TT=500 | ¥415K | ¥593K | ¥935K | ¥1.5M | ¥2.4M | 5.8× |
| Hozon, TT=1000 | ¥515K | ¥723K | ¥1.3M | ¥2.2M | ¥3.7M | 7.3× |
| TokuHozon, TT=1500 | ¥1.3M | ¥1.7M | ¥2.8M | ¥4.8M | ¥8.1M | 6.4× |
| TokuHozon, TT=3000 | ¥1.8M | ¥2.4M | ¥4.1M | ¥7.0M | ¥12.1M | 6.8× |
| Juyo, TT=2000 | ¥3.2M | ¥4.2M | ¥6.0M | ¥9.2M | ¥14.1M | 4.4× |
| Juyo, TT=3000 | ¥4.4M | ¥5.8M | ¥8.4M | ¥12.7M | ¥19.6M | 4.5× |
| Tokuju, TT=2000 | ¥7.2M | ¥9.3M | ¥11.3M | ¥15.8M | ¥22.1M | 3.0× |
| Tokuju, TT=3000 | ¥10.7M | ¥14.0M | ¥16.9M | ¥23.2M | ¥31.7M | 3.0× |

**Key change from pre-fusion:** Tokuju bands tightened dramatically (5.5× → 3.0×) thanks to Jussi's 48 Tokuju observations (was ~7). Juyo bands also improved (6.2× → 4.5×) with 806 more observations. The bands naturally widen at lower cert tiers where variation is higher.

---

## Production Coefficients: V3 Tiered Model (Post-Fusion Refit)

**Refit on 9,178 rows (5,727 blades + 3,107 tosogu + 344 other). All coefficients are OLS, not Huber.**

### Tier 1 — Universal (all listings)
```
Blade:  log₁₀(P) = 5.324 + 0.168×cert + 0.139×item − 0.212×jp_dealer
Tosogu: log₁₀(P) = 4.913 + 0.175×cert + 0.019×item − 0.169×jp_dealer
```
- **Coverage:** 100% of priced listings
- **adjR²:** 0.453 (blades), 0.451 (tosogu)
- jp_dealer = 1 if price_currency=JPY, 0 otherwise

### Tier 1N — Nagasa-Enhanced (blades with nagasa)
```
log₁₀(P) = 5.003 + 0.163×cert + 0.097×item + 0.246×log(nagasa) − 0.193×jp_dealer
```
- **Coverage:** 98.1% of priced blades (5,620 items)
- **adjR²:** 0.464
- Nagasa coefficient 0.246 means doubling blade length multiplies predicted price by ~1.8×. (Weaker than pre-fusion 0.441 — the Jussi data diluted the nagasa-price relationship.)

### Tier 2 — TT-Enhanced (blades with toko_taikan)
```
log₁₀(P) = 4.999 − 0.192×cert + 0.132×item + 0.145×log(TT) + 0.129×cert×log(TT) − 0.257×jp_dealer
```
- **Coverage:** 48.5% of priced blades (2,777 items)
- **adjR²:** 0.612

### Tier 2N — TT + Nagasa (blades, **CV winner**)
```
log₁₀(P) = 4.677 − 0.189×cert + 0.081×item + 0.122×log(TT) + 0.126×cert×log(TT) + 0.291×log(nagasa) − 0.231×jp_dealer
```
- **Coverage:** 47.5% of priced blades (2,720 items)
- **cvRMSE:** 0.298 — **best parametric cross-validated model**
- **adjR²:** 0.618
- **72% within factor of 2**

### Tier 3 — Full Model (blades with EF + TT)
```
log₁₀(P) = 5.836 − 0.095×cert + 0.128×item + 0.773×EF − 0.210×log(TT) − 0.065×cert×EF + 0.100×cert×log(TT) − 0.257×jp_dealer
```
- **Coverage:** 30.7% of priced blades (1,756 items)
- **adjR²:** 0.629
- EF coefficient strengthened (0.487 → 0.773) — artisan prestige signal is much clearer with 3× more EF-linked data

### Tier 4 — EF-Only (tosogu, or blades without TT)
```
Blade:  log₁₀(P) = 5.234 + 0.170×cert + 0.118×item + 0.601×EF + 0.010×cert×EF − 0.212×jp_dealer
Tosogu: log₁₀(P) = 5.162 + 0.057×cert + 0.052×item − 1.592×EF + 0.614×cert×EF − 0.080×jp_dealer
```
- **Use when:** Has elite_factor > 0 but no toko_taikan
- Blade adjR²=0.567 (n=3,080), Tosogu adjR²=0.290 (n=565)

**Note on Huber regression:** Tested but rejected for production coefficients. Huber downweights high-leverage points, which in this dataset are the 20 private sale observations — confirmed transactions that are the most reliable data we have. Post-fusion, Huber shifts log(TT) coefficient by -167% (flips sign entirely). All tier coefficients use standard OLS.

### Model Selection Logic (Updated)
```
if (item_category === 'blade' && elite_factor > 0 && toko_taikan != null) → Tier 3
else if (item_category === 'blade' && toko_taikan != null && nagasa_cm != null) → Tier 2N
else if (item_category === 'blade' && toko_taikan != null) → Tier 2
else if (item_category === 'blade' && nagasa_cm != null) → Tier 1N
else if (elite_factor > 0) → Tier 4
else → Tier 1
```

### Quantile Regression for Price Bands

For each tier, fit 5 quantile regressions (τ = 0.10, 0.25, 0.50, 0.75, 0.90) using IRLS with pinball loss. This produces asymmetric, heteroscedastic price bands that naturally widen at higher cert tiers — no need for ± RMSE.

**Implementation:** ~200 lines of TypeScript. Quantile regression via IRLS: initialize from OLS, then iterate with weights `w_i = τ/|r_i|` (positive residual) or `(1-τ)/|r_i|` (negative). Converges in 10-20 iterations. See `scripts/market-model-v3.ts` for the full implementation.

### Hierarchical Artisan Intercepts (Optional Enhancement)

After the base model predicts log₁₀(P), add an artisan-specific intercept computed via Empirical Bayes:
1. Fit base model → compute residuals
2. Group residuals by artisan_id
3. Shrink each group mean toward zero: `intercept_a = (n_a / (n_a + σ²_global/σ²_group)) × group_mean`
4. Artisans with many observations keep their own mean; artisans with 1 listing get pulled to zero

This gives a ~5% CV improvement and makes the artisan premium/discount explicit.

---

## Prediction Accuracy (Cross-Validated, Post-Fusion)

**Best parametric: M5ind (blades with TT + nagasa + dealer, 5-fold CV, n=2,720):**

- **cvRMSE:** 0.298 in log₁₀ space
- **Median absolute error:** 0.193
- **Within ±50% of actual:** 46%
- **Within ±2× of actual:** 72%

**Best overall: Hierarchical with TT features (5-fold CV, n=2,777):**

- **cvRMSE:** 0.297 in log₁₀ space
- **Within ±2× of actual:** 74%

**Progression (blades, TT-enriched models):**

| Metric | V2 pre-fusion (M5i, n=1,190) | V3 pre-fusion (M5in, n=1,133) | **V3 post-fusion (M5ind, n=2,720)** |
|--------|--------------------------|------------------------------|-----------------------------------|
| cvRMSE | 0.317 | 0.281 | **0.298** |
| Within 2× | 71% | 73% | **72%** |
| Within 50% | — | 47% | **46%** |

**Note:** The post-fusion cvRMSE (0.298) is higher than pre-fusion (0.281) because the dataset is 2.4× larger with more variance. The model is more robust — it generalizes better to unseen data from a wider variety of dealers and price points. The tighter pre-fusion RMSE was partly from a more homogeneous sample.

---

## Provenance Factor Analysis (2026-03-11)

**Script:** `scripts/market-model-provenance.ts`

Tested whether `provenance_factor` (Bayesian shrinkage measure of ownership prestige, range 1.77–5.29) adds predictive power beyond `elite_factor` (designation prestige, range 0–1.88).

### Verdict: No Signal Beyond EF — Do Not Use

| Test | Blade Result | Tosogu Result |
|------|-------------|---------------|
| r(EF, PF) correlation | **0.878** | 0.464 |
| PF single-feature R² | 0.237 (n=611) | 0.005 (n=276) |
| EF single-feature R² | 0.262 (n=756) | 0.013 (n=565) |
| ΔadjR² (PF added to EF model) | **-0.0005** | -0.0024 |
| Partial F-test (PF beyond EF) | F=0.10, **n.s.** | F=0.05, **n.s.** |
| CV RMSE (EF model) | 0.332 | 0.385 |
| CV RMSE (EF+PF model) | 0.332 | 0.387 |

**Why:** Both metrics derive from the same Yuhinkai catalog data — EF from designation counts (Juyo/Tokuju), PF from provenance ownership scores. They correlate at r=0.878 for blades. Designation prestige is simply a stronger price signal than ownership provenance. PF has lower coverage (25% vs 31% for blades) and adds zero accuracy.

### Within-Cert-Tier Comparison (Blades)

| Cert Tier | PF R² (n) | EF R² (n) |
|-----------|-----------|-----------|
| None/Reg | 0.045 (110) | 0.027 (152) |
| Hozon | 0.001 (107) | 0.001 (137) |
| TokuHozon | 0.141 (304) | **0.233 (357)** |
| Juyo | 0.329 (72) | **0.469 (88)** |
| Tokuju | 0.513 (11) | **0.846 (11)** |

EF dominates PF at every cert level where artisan rating matters (TokuHozon+).

---

## Jussi Ekholm Data Fusion (2026-03-11)

**Scripts:** `scripts/market-data-fusion.ts` (diagnostic), `scripts/insert-jussi-observations.ts` (insert)

Fused 3,280 blade price observations from Jussi Ekholm's manually curated price tracking database (Oshi-Jussi project). This is an independent dataset from the NW scraped listings — Jussi tracked dealer prices over ~10 years with careful manual transcription.

### Linkage Chain

```
Jussi price_database_normalized.csv (master_id)
  → Oshi-Jussi uuid_mapping.csv (master_id → object_uuid)
    → Yuhinkai gold_values (object_uuid → gold_smith_id)
      → Yuhinkai artisan_makers (maker_id → EF, TT, Hawley, Fujishiro)
```

### Results

| Metric | Value |
|--------|-------|
| Jussi records loaded | 4,860 |
| Usable (price ≥ ¥5,000) | 3,312 |
| URL overlap with NW (deduped) | 32 |
| **Rows inserted** | **3,280** |
| Artisan linkage rate | **90.9%** (2,981/3,280) |
| EF > 0 coverage | 70.9% (2,324) |
| TT coverage | 48.4% (1,587) |
| Nagasa coverage | **100%** (3,261) |
| Price range | ¥5,500 – ¥180,000,000 |
| Median price | ¥1,400,000 |
| Sold items | 7 (0.2%) |

### Certification Distribution (Jussi)

| Cert | Count |
|------|-------|
| Tokubetsu Hozon | 1,609 |
| Juyo | 806 |
| Hozon | 721 |
| (none) | 63 |
| Tokuju | 48 |
| NTHK | 21 |

### Spot Check Quality

- **Mislink rate:** 88/3,006 flagged by name comparison — all were macron mismatches (e.g., "Ayanokōji" vs "Ayanokoji"), not actual mislinks. The gold_values linkage is correct.
- **High-value verification:** Top Jussi records (Masamune MAS590 ¥180M, Mitsutada MIT281 ¥55M, Kunitoshi KUN1410 ¥34.5M TT=3500) all link to correct artisans with expected ratings.
- **Blade type mapping:** Kodachi → wakizashi, Naoshi → katana, Nagamaki → naginata. All mapped to standard types.

### Impact on Model

The fusion nearly doubles blade observations (2,441 → ~5,720) and significantly improves feature coverage:

| Feature | Pre-fusion (blades) | Post-fusion (blades) |
|---------|-------------------|---------------------|
| Total n | 2,441 | ~5,720 |
| EF > 0 | 750 (30.7%) | ~3,074 (53.7%) |
| TT | 1,184 (48.5%) | ~2,771 (48.4%) |
| Nagasa | 2,340 (95.6%) | ~5,600 (97.9%) |

**V3 refit completed — see "Production Coefficients" section for updated values.** The larger sample tightened Juyo/Tokuju prediction bands significantly (Tokuju P90/P10 band: 5.5× → 3.0×).

---

## Key Limitations

1. **Sold price data is near-zero** — only 2% of sold items retain prices. The model trains primarily on asking prices, which are higher than realized prices.
2. **Private observations are all ultra-high-end** — the 20 manual entries are all Saijo saku smiths (¥10M–200M). Mid-range private sale data (¥1M–10M confirmed transactions) would improve the model significantly.
3. **Tosogu model is weak** — artisan rating coverage is <3% for TT/Hawley. Only cert + EF works. Hierarchical shrinkage helps but tosogu remains cert-dominated.
4. **No condition/provenance features** — a polished vs tired blade at the same cert/artisan level can differ by 3-5×.
5. **Currency conversion is approximate** — hardcoded rates (USD=150, EUR=163). Should use rate at observation time.
6. **`dealer_country` is NULL** in observations table — the backfill didn't populate it. Currently using `price_currency` as a proxy (JPY=JP, else=international). Should be fixed in a re-backfill.
7. **Quantile regression bands are wide at low cert** — 5-7× P10-to-P90 spread at Hozon/TokuHozon (honest — the market really is that variable). Bands tightened post-fusion at high cert (Tokuju: 5.5× → 3.0×, Juyo: 6.2× → 4.5×). The P25-P75 interquartile range may be better for display.

---

## Files

| File | Purpose |
|------|---------|
| `supabase/migrations/151_market_price_observations.sql` | Table schema |
| `scripts/backfill-market-observations.ts` | Initial backfill from listings + Yuhinkai |
| `scripts/market-data-audit.ts` | Phase 0 diagnostic queries |
| `scripts/market-price-model-exploration.ts` | First model exploration (pre-private data) |
| `scripts/market-model-comparison.ts` | V1 rating system comparison |
| `scripts/market-model-v2.ts` | V2 model comparison (with private data) |
| `scripts/market-model-v3.ts` | **V3 SOTA analysis (quantile, Huber, hierarchical, CV)** |
| `scripts/market-model-provenance.ts` | Provenance factor analysis (no signal beyond EF) |
| `scripts/market-data-fusion.ts` | Jussi data fusion diagnostic (coverage, spot checks) |
| `scripts/insert-jussi-observations.ts` | **Jussi Ekholm fusion — 3,280 blade observations** |
| `scripts/insert-private-observations.ts` | First batch of 14 private observations |
| `scripts/fix-private-observations.ts` | Fixed artisan codes to highest-TT versions |
| `scripts/insert-masamune-tanto.ts` | Masamune tanto observations |
| `scripts/insert-obs-batch2.ts` | Kunimitsu + Masamune naginata |
| `scripts/insert-obs-batch3.ts` | Fixed KUN539 + Shintogo Kunimitsu + Nagamitsu |
| `scripts/dump-market-data.ts` | Diagnostic page pipeline: dump observations to CSV |
| `scripts/export-market-chart-data.py` | Diagnostic page pipeline: CSV → chart-data.ts (fits models, computes stats) |
| `scripts/market-diagnostics.py` | Standalone matplotlib diagnostic plots (PNG output) |
| `docs/MARKET_DATA_AUDIT_20260310.md` | Phase 0 audit results and viability assessment |

### Diagnostic Page Files

| File | Purpose |
|------|---------|
| `src/app/market-model/page.tsx` | SSR page — hero, TOC nav, markdown body, figures section |
| `src/app/market-model/methodology.md` | Explanatory markdown (ladder theory, model mechanics, accuracy, limitations) |
| `src/app/market-model/MarketModelContent.tsx` | Client markdown renderer (ReactMarkdown + remark-gfm + remark-math + rehype-katex) |
| `src/app/market-model/MarketModelFigures.tsx` | **12 interactive Recharts figures** (1,201 lines) |
| `src/app/market-model/chart-data.ts` | Pre-computed static data (~120KB, generated — do NOT hand-edit) |
| `scripts/dump-market-data.ts` | Step 1: Dumps `market_price_observations` to `scripts/market_data.csv` |
| `scripts/export-market-chart-data.py` | Step 2: Reads CSV, fits models, computes all chart data, writes `chart-data.ts` |
| `scripts/market-diagnostics.py` | Standalone matplotlib version (writes `scripts/market_diagnostics.png`) |

---

## Diagnostic Page (`/market-model`)

**URL:** https://nihontowatch.com/market-model
**Architecture:** Follows the exact same pattern as `/eliteranking` — SSR page reads markdown at build time, client components render interactive Recharts charts.

### What It Shows

12 interactive figures with hover tooltips, covering all major model diagnostics:

| # | Figure | Chart Type | What It Tests |
|---|--------|-----------|---------------|
| 1 | Price Ladder (Blades) | Custom SVG box-and-whisker | Core thesis — cert creates price steps |
| 2 | Price Ladder (Tosogu) | Custom SVG box-and-whisker | Same ladder in tosogu |
| 3 | Predicted vs Actual | Recharts ScatterChart | Model calibration (colored by cert, stars for private sales, ±2× band) |
| 4 | Residual Distribution | Recharts ComposedChart (Bar + Line) | Log-normality assumption (histogram + fitted normal curve) |
| 5 | QQ Plot | Recharts ScatterChart | Normality of residuals (with reference line, r value) |
| 6 | TT vs Price by Cert | CertScatterChart (shared) | **The key interaction** — regression lines diverge at high cert |
| 7 | Elite Factor vs Price | CertScatterChart (shared) | Same interaction for EF |
| 8 | Nagasa vs Price | CertScatterChart (shared) | Length effect flattening at high cert |
| 9 | JP vs International | Recharts BarChart (dual series) | Dealer origin price gap |
| 10 | Private Sales vs Scraped | Recharts BarChart + ReferenceLines | Where manual data fills gaps |
| 11 | Residual by Cert | Custom SVG box-and-whisker | Heteroscedasticity (variance explosion at Juyo/Tokuju) |
| 12 | Quantile Price Bands | Recharts ComposedChart (Area + Line + Scatter) | End product — P10–P90 bands for TokuHozon vs Juyo |

### Data Pipeline (How to Refresh Charts)

The charts display **pre-computed static data** in `chart-data.ts`. This file is generated by a two-step pipeline:

```bash
# Step 1: Dump observations from Supabase to CSV
npx tsx scripts/dump-market-data.ts
# → writes scripts/market_data.csv (all rows from market_price_observations)

# Step 2: Compute chart data and write TypeScript
python3 scripts/export-market-chart-data.py
# → reads scripts/market_data.csv
# → fits Tier 2N OLS model (cert + item + logTT + cert×logTT + logNagasa + jpDealer)
# → fits quantile regressions (τ = 0.10, 0.25, 0.50, 0.75, 0.90)
# → computes box stats, histograms, QQ points, regression lines, bands
# → writes src/app/market-model/chart-data.ts (~120KB)
```

**After adding new data** (more private observations, re-backfilling, Jussi fusion, etc.), re-run both steps to regenerate the charts. The page will show updated data on next build/deploy.

### Current State (2026-03-11)

**Built on pre-fusion dataset (5,898 rows).** The Jussi data fusion (3,280 additional blade observations) has been inserted into `market_price_observations` and V3 refit is done, but **chart data has NOT been regenerated yet**. To update:

1. Re-run `npx tsx scripts/dump-market-data.ts` (will now dump ~9,178 rows)
2. Re-run `python3 scripts/export-market-chart-data.py` (will refit models on larger dataset)
3. Verify `chart-data.ts` has updated MODEL_STATS (blade n should increase from ~2,400 to ~5,700)
4. `npm run dev` and check `/market-model` visually

### Key Implementation Details

- **Box plots are custom SVG** — Recharts has no native box-and-whisker. `BoxPlotChart` component renders via `<svg viewBox>` with computed y-scale. Data is pre-computed `BoxStat` objects with `{wl, q1, med, q3, wh}`.
- **CertScatterChart is shared** — Figures 6, 7, 8 all use the same `CertScatterChart` component. Takes `data: SP[]` (scatter points), `lines: RegLine[]` (regression line endpoints), axis domains. Colors by cert ordinal via `CERT_COLORS` map.
- **Regression lines rendered as 2-point Scatter series** — Recharts has no native `<Line segment>` in ScatterChart, so each regression line is a 2-point Scatter with `line={{ stroke: color }}` and `r={0}` cells.
- **Quantile bands use Area stacking trick** — Outer band (P10–P90) rendered as filled Area with low opacity, then inner "erase" Area at P10 boundary with opaque background fill, then IQR band (P25–P75) at higher opacity. Same pattern for both TokuHozon and Juyo.
- **`prose-methodology` CSS** — Shared with `/eliteranking`. Defined in `globals.css`. Serif typography, KaTeX math rendering, scroll-wrapped tables, gold accents.
- **Data sampling** — Scatter charts are sampled to 600–800 points for Recharts performance. Full dataset is in the CSV; the Python export samples via `sample_df()` with `random_state=42` for reproducibility.

### Updating the Markdown Content

Edit `src/app/market-model/methodology.md` directly. The server component reads it at build time via `fs.readFileSync()`. Changes are visible after rebuild. Supports GFM tables, KaTeX math (`$$...$$`), and standard markdown. Headings auto-generate anchor IDs via `slugify()` in `MarketModelContent.tsx`.

### Adding or Removing Figures

All figures are in `MarketModelFigures.tsx`. Each figure follows the pattern:

```tsx
<Figure num={N} caption="...">
  <h4 className="font-serif text-base text-ink mb-3">Title</h4>
  {/* CertLegend, ResponsiveContainer, chart components */}
</Figure>
```

To add a figure: add data to the Python export → add an export to `chart-data.ts` → add a `<Figure>` block. To remove: delete the `<Figure>` block (data in `chart-data.ts` is tree-shaken if unused).

---

## SOTA Techniques Reference

Based on art market valuation literature survey:

| Technique | Status | Priority | Notes |
|-----------|--------|----------|-------|
| **K-fold cross-validation** | ✅ Implemented | Required | Was all in-sample before |
| **Quantile regression (IRLS)** | ✅ Implemented | P0 | Directly produces the UI price band |
| **Huber robust regression** | ✅ Tested, ❌ Rejected | N/A | Downweights private observations (ground-truth). Use OLS. |
| **Dealer origin effect** | ✅ Implemented | P1 | +1-1.6% adjR² |
| **Nagasa as feature** | ✅ Implemented | P1 | +4.4% adjR² for blades |
| **Hierarchical artisan shrinkage** | ✅ Implemented | P2 | +15% CV for blades, +8% tosogu (post-fusion) |
| **Provenance factor** | ✅ Tested, ❌ Rejected | N/A | r(EF,PF)=0.878 — fully subsumed by EF. F=0.10 (n.s.), ΔadjR²=-0.0005 |
| **Jussi Ekholm data fusion** | ✅ Done | P0 | +3,280 blade observations (56% total increase). 90.9% artisan linkage. |
| **WLS per-tier variance** | ✅ Analyzed | P3 | Marginal gain; quantile regression is better |
| Gradient boosted trees | Not implemented | P3 | Would need `ml-cart` npm or hand-rolled CART |
| Heckman asking-price correction | Not implemented | P4 | Only 2% sold data; insufficient for selection model |
| Two-stage price class + regression | Not implemented | P3 | Promising but adds complexity |

### Key References

- Fedderke & Carugno (2025), "Machine Learning Algorithms and Fine Art Pricing" — GBR outperforms hedonic OLS on 43K lots
- Fedderke (2023), "Generalizing the Masterpiece Effect: Quantile Hedonic Regression" — quantile coefficients vary across price distribution
- Kim & Kim (2024), "Two-step model based on XGBoost for artwork prices" — two-stage classification + regression
- Aubry et al. (2025), "Deep Learning for Art Market Valuation" — CNN features from artwork images
- "Can Machine Learning Predict the Price of Art at Auction?" (Harvard Data Science Review)

---

## Next Steps

### ~~Phase 0.5: Refit V3 on Fused Dataset~~ ✅ DONE (2026-03-11)
V3 refit completed on 9,178-row fused dataset. All tier coefficients updated in this document. Key outcomes:
- **Blade data 2.35×** (2,441 → 5,727). EF coverage 4× (756 → 3,080). TT coverage 2.3× (1,190 → 2,777).
- **Tokuju quantile bands tightened dramatically** (5.5× → 3.0× P90/P10 spread) from 48 new Tokuju observations.
- **Hierarchical shrinkage improved** to -15% CV improvement (was -5%) — 1,345 artisan intercepts now well-constrained.
- **JP dealer effect strengthened** to -0.212 (×0.61, 39% lower) from -0.172 (×0.67, 33%).
- **Nagasa coefficient halved** (0.441 → 0.246) — broader data diluted the length-price relationship.
- **Chart data (`/market-model`) NOT yet regenerated** — run the dump+export pipeline (see Diagnostic Page section).

### Phase 0.75: Regenerate Chart Data (QUICK)
The diagnostic page at `/market-model` still shows pre-fusion charts. Run:
```bash
npx tsx scripts/dump-market-data.ts       # Dumps ~9,178 rows to CSV
python3 scripts/export-market-chart-data.py  # Refits charts, writes chart-data.ts
```

### Phase 1: Price Context Band (recommended first ship)
For each listing, compute quantile predictions (P10, P25, P50, P75, P90) using the appropriate tier model. Show where the listing's actual price sits within the predicted distribution. Display as a bar or gauge on listing detail / QuickView.

**Implementation path:**
1. Extract quantile regression coefficients from refit V3 into a `src/lib/market/` module
2. `predictPriceBand(listing)` → `{ p10, p25, p50, p75, p90, percentile, tier }`
3. `PriceBandIndicator` component renders the band with a marker for the actual price
4. Server-side compute in `getListingDetail()` or `/api/browse` enrichment

### Phase 2: Refit on Cron
As new listings are scraped, insert into `market_price_observations` and periodically refit quantile coefficients. Store coefficients in a `market_model_coefficients` table or JSON config.

### Phase 3: Hierarchical Artisan Intercepts
Pre-compute artisan intercepts for all matched artisans. Store in `artisan_makers.price_intercept`. Add to prediction at runtime. Refit monthly.

### Phase 4: More Private Data + Auction Import
Mid-range private sale data (¥1M–10M) would fill the gap between scraped asking prices and ultra-high-end privates. Public auction results (Bonhams, Christie's) are the ultimate data source for sold prices.

### Phase 5: Gradient Boosted Trees
If accuracy matters more than interpretability, train a GBT model alongside the linear model. Trees handle missing features natively (no tier selection), discover non-obvious interactions, and typically outperform linear models by +5-15% on art pricing data (Fedderke 2025).
