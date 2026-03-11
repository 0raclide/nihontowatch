## The Core Insight: Ladder Theory

Japanese sword certification creates price "ladders" — discrete steps where the paper level sets a price floor, and artisan prestige differentiates within each tier. The data confirms this strongly:

| Cert Tier | Blade Median | Tosogu Median | n (Blades) |
|-----------|-------------|---------------|-----------|
| None/Reg | ~¥430K | ~¥65K | 919 |
| Hozon | ~¥580K | ~¥180K | 1,333 |
| Tokubetsu Hozon | ~¥1.2M | ~¥350K | 2,438 |
| Juyo | ~¥4.0M | ~¥5.5M | 920 |
| Tokubetsu Juyo | ~¥18.5M | — | 59 |

Each step on the cert ladder roughly doubles or triples the price. The jump from Tokubetsu Hozon to Juyo (~3×) is the largest in the system — Juyo certification is the single most powerful price signal in the nihonto market.

## How the Model Works

The model predicts price as a function of **certification level**, **item type**, **artisan rating** (Toko Taikan and/or Elite Factor), **blade length** (nagasa), and **dealer origin** (Japanese vs international).

All prices are modeled in **log₁₀ space** — a natural fit because price distributions are right-skewed (a few ultra-expensive items alongside many affordable ones). In log space, the ladder steps become approximately linear, and multiplicative price effects become additive.

### The Key Interaction: Cert × Artisan

Artisan prestige has **near-zero predictive power** at Hozon and below — at these lower cert tiers, the paper level dominates and artisan reputation barely moves the price. But at Tokubetsu Hozon and above, artisan rating becomes increasingly powerful.

This is the cert × artisan **interaction effect**: the slope of "artisan rating vs price" steepens with each cert tier. A master smith's work commands a premium, but only when the paper level is high enough to signal authenticity to the market.

### Tiered Model Selection

Not every listing has every feature. The model uses progressively richer tiers depending on what data is available:

| Tier | Features | Coverage | adj R² |
|------|----------|----------|--------|
| **1** — Universal | cert + item type + dealer | 100% | 0.453 |
| **1N** — +Nagasa | + blade length | 98.1% of blades | 0.464 |
| **2N** — +TT (CV Winner) | + Toko Taikan + interactions | 47.5% of blades | 0.618 |
| **3** — Full | + Elite Factor + interactions | 30.7% of blades | 0.629 |
| **4** — EF-Only | cert + item + EF (tosogu/no TT) | EF > 0 subset | varies |

The **Tier 2N** model (cert + item + log(TT) + cert×TT + log(nagasa) + dealer origin) is the **cross-validated winner** — best out-of-sample accuracy at cvRMSE = 0.298, covering 47.5% of priced blades.

## Data Sources

**9,178 observations** from three sources:

- **Scraped (5,878)**: Asking prices from 52 active dealers, joined with artisan ratings from the Yuhinkai database. All priced, non-hidden listings with price ≥ ¥5,000.

- **Jussi Ekholm (3,280)**: Manually curated blade price tracking from an independent collector database spanning ~10 years. Covers katana, tachi, wakizashi, tanto, naginata, ken, and yari. 90.9% artisan linkage rate to the Yuhinkai database, with 100% nagasa coverage. This data nearly doubled blade observations and significantly improved feature coverage at higher certification tiers (806 additional Juyo, 48 Tokuju).

- **Private sale (20)**: Manually entered confirmed transactions and asking prices for ultra-high-end items (¥10M–200M). These fill a critical gap — dealers strip prices on sale, so only 2% of sold items retain pricing data. Without these 20 observations, the model would have almost no training signal above ¥10M.

### Artisan Rating Coverage

| Feature | Blades (n≈5,670) | Tosogu (n≈3,090) |
|---------|-----------------|------------------|
| cert_ordinal | 100% | 100% |
| Elite Factor > 0 | 53.7% | 18.2% |
| Toko Taikan | 48.4% | 1.3% |
| Nagasa | 97.9% | N/A |

The Jussi fusion nearly doubled blade observations and boosted Elite Factor coverage from 30.7% to 53.7%. Toko Taikan and Hawley remain blade-only features (negligible tosogu coverage). Elite Factor is the only artisan rating with meaningful coverage across both categories.

## Model Accuracy

**Tier 2N** (blades with Toko Taikan + nagasa + dealer origin, 5-fold cross-validated):

- **adj R² = 0.618** — the model explains ~62% of log-price variance
- **cvRMSE = 0.298** in log₁₀ space
- **72% of predictions** fall within a factor of 2× of the actual price
- **46% of predictions** fall within ±50% of the actual price
- **Median absolute error** = 0.193 → predictions within ~56% of actual for half of items

These are **cross-validated** (out-of-sample) metrics — the model has never seen the test data during training. In-sample R² is higher, but cross-validated metrics are the honest measure. The post-fusion cvRMSE (0.298) is slightly higher than the pre-fusion value (0.281) because the dataset is 2.4× larger with more variance — the model is more robust and generalizes better to unseen data.

## Dealer Origin Effect

Japanese dealers consistently price **~33–39% lower** than international dealers, controlling for cert level, artisan, and item type. This likely reflects:
- Lower overhead costs in Japan
- Domestic market competition
- International dealers adding margin for shipping, insurance, and import
- Selection bias (international dealers may preferentially stock higher-quality pieces)

The model captures this via a binary `jp_dealer` indicator (proxied by price currency = JPY). The effect strengthened post-fusion (coefficient −0.212, meaning JP prices are ×0.61 of international) because the Jussi data is predominantly JP-dealer priced.

## Nagasa (Blade Length) Effect

Longer blades command higher prices — but the effect is **cert-dependent**:

| Cert Tier | Correlation (log-nagasa vs log-price) |
|-----------|--------------------------------------|
| None/Reg | **0.563** — length dominates |
| Hozon | 0.324 — strong |
| Tokubetsu Hozon | 0.207 — moderate |
| Juyo | 0.104 — artisan/cert dominates |

At lower cert tiers, blade length is the best single predictor. At Juyo and above, the artisan's reputation and paper level overwhelm physical dimensions. The nagasa effect diluted somewhat post-fusion (marginal r = 0.378, was 0.459) with the broader dataset.

## Heteroscedasticity (Why Confidence Intervals Must Widen)

The variance of pricing errors is **not constant** across cert tiers:

| Cert Tier | Residual σ² | 95% Band Width |
|-----------|-----------|----------------|
| None/Reg | 0.190 | ×7.1 |
| Hozon | 0.116 | ×4.7 |
| TokuHozon | 0.087 | ×3.8 |
| Juyo | 0.158 | ×6.0 |
| Tokuju | 0.622 | ×35.1 |

The variance ratio is **7.1×** across cert tiers (down from 18× pre-fusion — the Jussi data stabilized Juyo and Tokuju variance significantly with hundreds more observations). Still strong enough to require quantile regression over constant-width bands.

**Quantile regression** solves this naturally — it predicts the P10, P25, P50, P75, and P90 price levels directly, producing asymmetric bands that automatically widen at higher cert tiers. Post-fusion, Tokuju quantile bands tightened dramatically (P90/P10 spread: 5.5× → 3.0×) and Juyo improved from 6.2× to 4.5×.

## Key Limitations

1. **Mostly asking prices** — only 2% of sold items retain prices, so the model trains primarily on asking prices (which run higher than realized transaction prices).

2. **Private data is ultra-high-end only** — the 20 manual entries are all Saijo saku smiths at ¥10M–200M. Mid-range confirmed sale data (¥1M–10M) would meaningfully improve calibration.

3. **Tosogu model is weaker** — artisan rating coverage is negligible for tosogu. Only cert + Elite Factor works; Toko Taikan/Hawley/Fujishiro are blade-only.

4. **No condition or provenance features** — a polished vs tired blade at the same cert/artisan level can differ by 3–5×. The model can't capture this.

5. **Currency conversion is approximate** — hardcoded rates (USD = ¥150, EUR = ¥163). Should use rates at observation time.
