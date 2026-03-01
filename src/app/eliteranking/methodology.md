The **elite factor** (designation factor) measures the depth and breadth of an artisan's designation record across all six tiers of Japan's cultural designation system — from Kokuho and Tokubetsu Juyo down to Juyo — weighting each designation by its rarity and extracting a conservative lower credible bound that penalizes thin evidence. It is the primary quantitative metric behind the Yuhinkai artisan ranking system.

The metric is computed over approximately 34,100 catalog records from seven source publications — spanning the NBTHK's Juyo and Tokubetsu Juyo zufu, government cultural property designations, the Imperial Collection, and the Jussi Ekholm koto research database — representing 25,472 unique physical objects.

*This is a working paper. Both the methodology and the underlying data curation are active and ongoing — rankings, counts, and methods described here are subject to revision as the dataset grows and the model is refined.*

---

## The Dataset

The ranking system operates on a corpus of digitized designation records from the official publications of Japan's cultural designation bodies. Understanding what data is available — and how it is structured, normalized, and deduplicated — is essential to interpreting the statistical metrics that follow.

### Source Publications

The dataset draws from seven source publications, each a multi-volume series of illustrated catalogs containing oshigata (blade rubbings), setsumei (expert appraisals), and structured measurements.

| Publication | Japanese | Designating Body | Records | Coverage |
|---|---|---|---|---|
| Juyo Token Nado Zufu | 重要刀剣等図譜 | NBTHK | 15,219 | 70 sessions (1958–present) |
| Tokubetsu Juyo Token Nado Zufu | 特別重要刀剣等図譜 | NBTHK | 1,346 | 27 sessions |
| Kokuho | 国宝 | Government of Japan | 122 | National Treasures |
| Juyo Bunkazai | 重要文化財 | Government of Japan | 911 | Important Cultural Properties |
| Gyobutsu | 御物 | Imperial Household Agency | 330 | Imperial Collection (2 vols.) |
| Juyo Bijutsuhin | 重要美術品 | Pre-war government | 1,089 | Pre-war designations (1933–1944) |
| Jussi Ekholm Koto Database | — | Private research | 15,095 | Koto-era swords |

These approximately 34,100 catalog records describe **25,472 unique physical objects** after deduplication (see § Deduplication below). The difference arises because a single sword may appear in multiple publications — a blade designated Juyo in 1975 and promoted to Tokubetsu Juyo in 1990 has entries in both the Juyo and Tokuju zufu. The Jussi Ekholm database, a comprehensive private research effort documenting koto-era swords with measurements and provenance, overlaps substantially with the NBTHK records for that period.

### What Each Record Contains

Each setsumei — the expert panel's written appraisal — provides a standardized set of structured fields alongside its narrative assessment:

- **Attribution** — artisan name, school, tradition, province, era
- **Physical description** — blade form (sugata), grain pattern (jihada), temper line (hamon), point (boshi), tang (nakago)
- **Measurements** — blade length (nagasa), curvature (sori), base width (motohaba), tip width (sakihaba)
- **Signature** — signed or unsigned, inscription text, attribution type (confirmed or *den*/伝)
- **Provenance** — former owners (denrai/伝来), named-sword titles (meito/名刀)

The structured fields were parsed from pre-structured source data produced during the original digitization of these publications. The narrative setsumei text — the panel's discursive assessment of quality, period, and authenticity — is stored separately and used for AI-generated artist descriptions but does not feed the statistical pipeline.

### Artisan Linking

Each catalog record names its artisan as free text — "Masamune," "Den Masamune," "伝 正宗" — with no canonical identifier. The artisan matching pipeline links these text attributions to a curated directory of approximately 13,500 individual artisans and 206 school-level attributions (used when items are attributed to a tradition rather than a named individual).

The production pipeline uses a three-stage approach: profile matching (comparing the item's attribution text, school, province, era, and kanji against all known artisan profiles), verification of ambiguous matches, and sibling consensus (checking whether multiple records describing the same physical object agree on attribution). The overall match rate is 96.6% — 99.0% for swords, 93.6% for tosogu fittings.

Artisan linking makes the elite factor possible. Without it, items could not be aggregated by maker to compute per-artisan statistics.

### Deduplication

A single physical sword may have catalog entries from multiple publications. A blade by Nagamitsu, for instance, might appear in the Juyo zufu, the Tokuju zufu, and the Jussi Ekholm database — three records for one object. These sibling records are resolved into 25,472 unique physical objects. For each object, the best available data from all siblings is synthesized — preferring the highest-designation source for attribution but drawing measurements from any sibling that provides them.

For ranking purposes, each physical object counts once regardless of how many catalog records describe it. This prevents double-counting that would inflate statistics for frequently published masterworks.

---

## The Problem

How do you rank a swordsmith who has one Tokubetsu-Juyo blade against one who has fifty Juyo? Raw designation counts favor prolific artisans regardless of quality. Simple ratios of elite to total designations overweight small samples — a smith with 1 Tokuju out of 1 total scores a perfect 100%, higher than Masamune, higher than Tomonari. And a binary split between "elite" and "standard" ignores the graded hierarchy of the designation system entirely: a Kokuho represents something far rarer than a Tokubetsu-Juyo, yet both would count equally under a simple binary model. Meanwhile, tosogu makers with dozens of Juyo designations — representing decades of NBTHK panel recognition — would score zero simply because their works were not elevated to Tokubetsu-Juyo.

This is the small-sample problem compounded by the information-loss problem, and both appear throughout the NBTHK designation record. Of the approximately 13,500 artisans in our index, many have only one or two designated works. A handful have hundreds. Any ranking system must handle both extremes gracefully, rewarding genuine excellence while refusing to be fooled by statistical flukes — and it must distinguish between different grades of excellence when the data supports that distinction.

---

## Designation Tiers and Weights

The elite factor scores every designation tier, weighted by its rarity in the corpus. The weight of each tier is its **self-information** — the natural logarithm of the inverse frequency:

$$w_i = \ln\!\Big(\frac{N}{n_i}\Big)$$

where $N$ is the total number of uniquely designated objects and $n_i$ is the number of objects whose highest designation is tier $i$. Rarer designations carry more information — achieving Kokuho tells you far more about an artisan than achieving Juyo, and the weights reflect this.

| Designation | Japanese | Objects | Weight |
|---|---|---:|---:|
| Kokuho | National Treasure (国宝) | ~107 | 5.08 |
| Gyobutsu | Imperial Collection (御物) | ~325 | 3.97 |
| Juyo-Bunkazai | Important Cultural Property (重要文化財) | ~788 | 3.08 |
| Juyo-Bijutsuhin | Important Art Object (重要美術品) | ~1,070 | 2.78 |
| Tokubetsu-Juyo | Special Important (特別重要刀剣) | ~1,325 | 2.57 |
| Juyo-Token | Important Sword (重要刀剣) | ~13,600 | 0.24 |

*Weights are computed dynamically from the current corpus and may shift as records are added.*

Each of an artisan's $n$ designated works contributes **one observation**: the weight of its highest designation tier. A blade that achieved both Juyo and Tokubetsu-Juyo contributes the Tokuju weight (2.57), not both.

**The Gyobutsu discount.** Gyobutsu is excluded for artisans active after 1392 (Muromachi period onward). For pre-Nanbokucho smiths like Tomonari or Nagamitsu, whose works entered the Imperial Collection before the modern designation system existed, Gyobutsu status is a genuine mark of historical esteem. For later artisans, it more often reflects Edo-period political collecting — gifts to the shogunate or imperial household — rather than an independent quality judgment. The discount prevents this confound from inflating scores for post-1392 artisans.

---

## Prior Art: Brockbank's Pass Factor

The concept of measuring artisan stature through designation ratios originates with Darcy Brockbank, whose **pass factor** offered a pioneering quantitative lens on the NBTHK record. Brockbank's insight was straightforward: if a smith's works are repeatedly elevated from Juyo to Tokubetsu-Juyo, that pattern reveals something about the smith's quality that raw Juyo counts alone cannot capture. The pass factor was computed as:

$$\text{pass factor} = \frac{\text{elite designations}}{\text{juyo designations}}$$

Earlier rating systems — Fujishiro's ordinal rankings in *Nihon Toko Jiten*, the *Toko Taikan* editions of Dr. Tokuno, Hawley's numerical grades — assessed artisan stature through expert judgment, encoding scholarly consensus into fixed ratings. Brockbank's pass factor took a fundamentally different approach: rather than asking experts to *assign* a quality rating, it asked what the designation record itself *reveals*. The NBTHK's repeated decisions to elevate (or not elevate) an artisan's works constitute a form of revealed preference — an empirical signal that accumulates over decades of independent panel judgments.

The elite factor builds directly on Brockbank's foundation. It preserves his core insight — that the *pattern* of designation is more informative than the *count* — while addressing two limitations that emerge when the idea is applied at scale: the small-sample problem (which Brockbank acknowledged but could not fully resolve with point estimates) and the information-loss problem (the binary elite/standard split discards the graded structure of the designation hierarchy).

### Where Simple Metrics Break Down

A smith with 1 Tokuju out of 1 total scores a perfect 1.000 on a raw ratio — higher than Masamune, higher than Tomonari. Smoothing variants like the Laplace estimator $(e+1)/(n+2)$ dampen the extremes but still overweight small samples: a 1/1 artisan scores 0.667, still above most of the greatest smiths in history.

Beyond the small-sample problem, a binary elite/standard split loses information. A tosogu maker with 48 Juyo designations and no Tokubetsu-Juyo receives the same score as an unknown artisan with zero designations: both score 0. Yet 48 Juyo designations represent a substantial body of recognized work — the NBTHK panel has affirmed this maker's quality dozens of times. A binary metric is blind to this signal.

What we need is a scoring system that (1) uses the full graded hierarchy of designations, weighting rare achievements appropriately, and (2) honestly expresses our uncertainty about artisans with thin records.

---

## The Bayesian Framework

The elite factor uses a **shrinkage estimator** — a Bayesian Normal model with pseudoobservations that anchors unknown artisans at zero and requires evidence to move the score upward.

**The observation unit.** Each of an artisan's $n$ designated works contributes a score $s_i$ — the IDF weight of its highest designation tier. A Kokuho blade contributes 5.08; a Juyo blade contributes 0.24.

**The prior.** We introduce $C = 10$ pseudoobservations, each valued at the prior mean $m = 0$. This prior is deliberately skeptical: absent evidence, we assume an artisan's designation record contributes nothing. Evidence to the contrary must accumulate before the score moves meaningfully above zero.

**The posterior.** Given $n$ items with scores $s_1, s_2, \ldots, s_n$, we pool them with the $C$ pseudoobservations. Since $m = 0$, the pseudoobservations simplify the computation:

$$N = C + n = 10 + n$$

$$\bar{x} = \frac{\displaystyle\sum_{i=1}^{n} s_i}{N}$$

$$V = \frac{\displaystyle\sum_{i=1}^{n} s_i^2}{N} \;-\; \bar{x}^{\,2}$$

The pseudoobservations anchor the mean toward zero (diluting the observed data with 10 zero-valued phantom items) and contribute to the variance — creating disagreement when the observed scores are high, which widens the uncertainty interval.

**The lower credible bound.** We extract the 5th percentile:

$$\text{SE} = \sqrt{\frac{V}{N}}$$

$$\text{elite factor} = \max\!\Big(0,\;\; \bar{x} - 1.645 \cdot \text{SE}\Big)$$

The coefficient 1.645 is the 5th-percentile $z$-score of the standard normal distribution.

---

## Worked Examples

**Five Tokubetsu-Juyo blades ($n = 5$)**

A smith with 5 Tokuju designations, each contributing $s_i = 2.57$:

$$\sum s_i = 12.85, \quad \sum s_i^2 = 33.02$$

$$N = 10 + 5 = 15$$

$$\bar{x} = \frac{12.85}{15} = 0.8567, \quad V = \frac{33.02}{15} - 0.8567^2 = 2.201 - 0.734 = 1.467$$

$$\text{SE} = \sqrt{\frac{1.467}{15}} = 0.3128$$

$$\text{elite factor} = 0.8567 - 1.645 \times 0.3128 = \mathbf{0.34}$$

Five Tokuju blades earn a score of 0.34 — meaningful but modest. The 10 pseudoobservations at zero still exert substantial pull, and the variance from mixing real scores (2.57) with phantom zeros widens the confidence interval.

**Twenty-five Juyo designations only ($n = 25$)**

A tosogu maker with 25 Juyo designations and no elite designations. Under a binary elite/standard model, this artisan would score exactly 0. Under the weighted model:

$$\sum s_i = 25 \times 0.24 = 6.00, \quad \sum s_i^2 = 25 \times 0.058 = 1.44$$

$$N = 35, \quad \bar{x} = \frac{6.00}{35} = 0.1714$$

$$V = \frac{1.44}{35} - 0.1714^2 = 0.0411 - 0.0294 = 0.0118$$

$$\text{SE} = \sqrt{\frac{0.0118}{35}} = 0.0183$$

$$\text{elite factor} = 0.1714 - 1.645 \times 0.0183 = \mathbf{0.14}$$

A score of 0.14 — no longer invisible. Twenty-five Juyo designations represent a substantial body of recognized work, and the model credits it. The low per-item weight (0.24) keeps the score appropriately modest, but the volume of evidence overwhelms the prior's skepticism.

**A single Juyo designation ($n = 1$)**

$$\sum s_i = 0.24, \quad \sum s_i^2 = 0.058$$

$$N = 11, \quad \bar{x} = 0.0218, \quad V = 0.0048$$

$$\text{SE} = \sqrt{\frac{0.0048}{11}} = 0.0209$$

$$\text{elite factor} = \max\!\big(0,\;\; 0.0218 - 1.645 \times 0.0209\big) = \max(0,\; {-0.013}) = \mathbf{0.00}$$

One data point tells us almost nothing. The prior overwhelms the single observation, the variance is wide, and the lower bound falls below zero. The floor clamp applies.

**Tomonari and Masamune**

Tomonari's extraordinary record — 36 designated works, nearly all at the highest tiers including Kokuho and Tokubetsu-Juyo — produces an elite factor of **1.88**, the highest of any swordsmith. His concentrated portfolio of masterworks, each carrying high IDF weight, pushes the mean far above zero, and with 36 observations the posterior is tight enough that the lower bound remains close to the mean.

Masamune's 95 designated works — including 61 at elite tiers — produce an elite factor of approximately **1.67**. His prolific output includes many Juyo-level works (weight 0.24) alongside his elite designations, diluting his weighted average relative to Tomonari's more concentrated portfolio. But the sheer volume of evidence makes the estimate highly reliable.

---

## Properties

The ranking is **self-correcting**: as more works are designated, the posterior narrows and converges to the artisan's true weighted designation rate. It is **tier-sensitive**: a Kokuho designation contributes 21× more than a Juyo, matching the intuition that a National Treasure represents something categorically different. It exhibits **scale-appropriate skepticism**: a single designation of any tier scores 0.00, while large bodies of work converge to their true weighted rate. And it is **domain-fair**: tosogu makers with substantial Juyo records receive non-zero scores, reflecting their genuine standing in the designation record rather than being penalized for the structural rarity of tosogu elite designations.

---

## Current Rankings

*The elite factor values shown below reflect the current weighted designation model. The "Elite" and "Total" columns show the count of elite-tier designations (Tokuju+) and total designated works — these are factual inputs, not the score itself, since the score now incorporates all six tiers weighted by rarity. Rankings and values are computed from the live corpus and may shift as records are added. Current values are available in the [artist directory](/artists).*

### Swordsmiths: Top 10 by Elite Factor

| Rank | Artisan | Elite | Total | Elite Factor |
|-----:|---------|------:|------:|------------:|
| 1 | Tomonari | 31 | 36 | 1.88 |
| 2 | Yoshimitsu | 42 | 56 | 1.78 |
| 3 | Masamune | 61 | 95 | 1.67 |
| 4 | Mitsutada | 43 | 61 | 1.61 |
| 5 | Masatsune | 18 | 20 | 1.46 |
| 6 | Sukezane | 31 | 43 | 1.43 |
| 7 | Sa | 43 | 75 | 1.33 |
| 8 | Nagamitsu | 114 | 249 | 1.31 |
| 9 | Yoshifusa | 28 | 50 | 1.26 |
| 10 | Kanehira | 22 | 33 | 1.21 |

The elite factor top 10 reads as a roll call of the Kamakura golden age. Every artisan in the list worked between the late Heian and early Nanbokucho periods. Tomonari's concentrated portfolio of masterworks — including Kokuho and Tokubetsu-Juyo, each carrying high IDF weight — earns him the top position at 1.88. Nagamitsu's massive corpus of 249 works ranks 8th despite 114 elite designations, because his many Juyo-level works (weight 0.24 each) dilute his weighted average.

### Tosogu Artists: Top 10 by Elite Factor

| Rank | Artisan | Elite | Total | Elite Factor |
|-----:|---------|------:|------:|------------:|
| 1 | Somin | 25 | 51 | 0.97 |
| 2 | Kaneie | 21 | 43 | 0.89 |
| 3 | Yasuchika | 23 | 71 | 0.70 |
| 4 | Joi | 7 | 12 | 0.49 |
| 5 | Myoju | 8 | 22 | 0.45 |
| 6 | Natsuo | 14 | 75 | 0.44 |
| 7 | Goto Ichijo | 11 | 81 | 0.37 |
| 8 | Toshinaga | 6 | 23 | 0.33 |
| 9 | Goto Joshin | 6 | 64 | 0.27 |
| 10 | Masayoshi | 5 | 32 | 0.26 |

With the weighted designation model, tosogu artists receive substantially higher elite factors than under a binary model — reflecting credit for their Juyo designations in addition to any elite-tier work. Somin (Yokoya school founder) leads at 0.97, benefiting from both his 25 elite designations and 26 Juyo works. The gap between sword and tosogu scores remains — reflecting the NBTHK's historically lower volume of tosogu designations — but tosogu makers with substantial bodies of recognized work now receive scores proportional to their standing.

---

## Correlation with Traditional Ratings

The designation factor is derived entirely from the NBTHK's modern designation record — a system that began in 1958 and accumulates evidence session by session. Traditional expert rating systems predate this process by decades. The most comprehensive is Dr. Tokuno's *Toko Taikan* (刀工大鑑), which assigns numerical ratings (approximately 200–3,500) based on scholarly assessment of artisan stature. A natural question is how well the data-driven designation factor agrees with these established expert ratings.

Figure 1 (below) plots the designation factor against the Toko Taikan rating for 412 swordsmiths who have both a non-zero designation factor and a Toko Taikan score. The positive correlation is clear: artisans rated highly by Dr. Tokuno tend to have strong designation records, and vice versa. Tomonari (3,500 / 1.88) and Yoshimitsu (3,000 / 1.78) anchor the upper-right corner of the distribution. The correlation validates the designation factor against an independent assessment tradition — the NBTHK panels and Dr. Tokuno arrived at broadly similar judgments through fundamentally different methods.

The divergences, however, are equally informative:

- **High Toko Taikan, modest designation factor.** Kunitsuna (TT 3,500, EF 1.01) and Kunitoshi (TT 3,500, EF 0.97) receive the highest possible Toko Taikan rating but rank below the elite factor top 10. Their traditional reputation exceeds what the modern designation record has confirmed — either because fewer of their works have survived to be designated, or because the NBTHK panels weight different qualities.

- **High designation factor, moderate Toko Taikan.** Masatsune (TT 1,500, EF 1.46) ranks 5th by elite factor but receives a mid-range Toko Taikan score. The NBTHK panels have elevated a very high proportion of his surviving works (18 of 20 at elite tier), but Dr. Tokuno's assessment — likely reflecting the smaller number of known works — places him in a lower tier.

- **Sa (TT 2,000, EF 1.33).** A smith whose large body of designated work produces a strong elite factor, but whose Toko Taikan rating (2,000) suggests traditional scholars placed him a notch below the very highest rank. The discrepancy may reflect the denomination-school attribution challenge — works attributed to "Sa" span multiple generations, and the aggregation of a school's output under a single name can inflate or deflate statistical measures depending on the mix.

These cases illustrate the complementary value of empirical and expert-judgment approaches to artisan assessment. Neither system is "right" — they measure different things. The Toko Taikan encodes holistic scholarly judgment formed over centuries of connoisseurship. The designation factor captures the revealed preferences of modern NBTHK panels through decades of independent designation decisions. Where they agree, we have strong convergent evidence of artisan stature. Where they diverge, we have an invitation to investigate what each system values differently.

---

## Correlation with Fujishiro Grades

Fujishiro's *Nihon Toko Jiten* (日本刀工辞典) assigns every major swordsmith an ordinal quality grade — from *Chu saku* (中作, average) through *Chu-jo saku* (中上作), *Jo saku* (上作), *Jo-jo saku* (上々作), to the highest rank, *Sai-jo saku* (最上作, supreme). Published originally in 1935–1937 and revised through the 1970s, the Fujishiro rankings represent one of the most widely cited traditional rating systems in Japanese sword studies. Unlike the Toko Taikan's continuous numerical scale, Fujishiro's five-grade system is an explicit ordinal judgment — each smith is placed in a rank by scholarly consensus.

Because the Fujishiro system predates the NBTHK designation program by two decades, and because the designation process is fundamentally different from a fixed expert rating, comparing the two reveals whether the accumulated weight of NBTHK panel decisions over 70 years aligns with the pre-war scholarly consensus.

Figures 2–5 (below) plot the designation factor against Fujishiro grade for 211 swordsmiths across four historical periods. Breaking the analysis by era is essential: the relationship between expert rating and designation factor is not uniform across periods. The NBTHK designation corpus is heavily weighted toward Kamakura-era works, and the survival and submission patterns differ markedly between periods.

### Heian Period (16 smiths)

The Heian sample is small but striking: 13 of 16 smiths hold the highest Fujishiro grade (*Sai-jo saku*), with the remaining 3 at *Jo-jo saku*. These are the founding figures of the Japanese sword tradition — Tomonari, Masatsune, Kanehira, Sanjo Munechika. The elite factor separates them more finely than Fujishiro's broad grade: Tomonari (1.88) and Masatsune (1.46) both hold *Sai-jo saku*, but the designation record reveals Tomonari's portfolio as substantially more concentrated at the highest tiers. Fujishiro places them in the same grade; the designation factor quantifies the difference.

### Kamakura Period (98 smiths)

The Kamakura period provides the richest dataset: 98 smiths spanning all five Fujishiro grades. The positive correlation is visible — *Sai-jo saku* smiths cluster at high elite factor values, and lower grades tend toward lower factors. But the overlap is substantial. Several *Jo-jo saku* smiths (the second-highest grade) achieve elite factors comparable to or exceeding some *Sai-jo saku* smiths. This partly reflects the reality that the NBTHK has designated far more Kamakura works than any other period, giving the designation factor a larger evidence base from which to discriminate.

### Nanbokucho Period (56 smiths)

The Nanbokucho era sits at the historical boundary between the classical and medieval traditions. The elite factor distribution is more compressed than the Kamakura period, with fewer extreme values. *Sai-jo saku* smiths from this era achieve lower elite factors than their Kamakura counterparts — a structural effect, since the Nanbokucho corpus is smaller and fewer works have been elevated to the highest designation tiers. The Fujishiro grades remain broadly predictive, but the signal is noisier.

### Muromachi Period (41 smiths)

The Muromachi dataset shows the weakest correlation. The distribution is compressed into a narrower elite factor range, and the overlap between grades is greater. Several *Jo saku* smiths achieve elite factors comparable to *Sai-jo saku* smiths of the same era. This reflects the Muromachi reality: a vast production period with fewer works surviving at the highest quality levels, and fewer submissions to the NBTHK's upper-tier designations. The Gyobutsu discount (excluding post-1392 Imperial Collection items) also depresses scores for late Muromachi smiths whose works entered the Imperial Collection for political rather than artistic reasons.

### What the Fujishiro Comparison Reveals

The Fujishiro correlation tells a different story from the Toko Taikan comparison. Where the Toko Taikan provides a continuous numerical scale that correlates smoothly with the elite factor, Fujishiro's ordinal grades create discrete bands within which the designation factor provides additional discrimination. A *Sai-jo saku* rating tells you that an artisan belongs to the highest traditional rank; the elite factor tells you *where* within that rank the designation record places them.

The era-specific analysis reveals that the relationship between traditional reputation and modern designation is historically contingent. For the Kamakura golden age, where the NBTHK has designated thousands of works, the two systems show strong agreement. For later periods with thinner designation records, the correlation weakens — not because the traditional ratings are wrong, but because the designation factor has less evidence to work with. The Bayesian prior's skepticism becomes more visible precisely where the data is thinnest.

---

## Statistical Notes

### Why Include Pseudoobservations in Variance

The pseudoobservations contribute to the variance calculation as well as the mean. This is more than a mathematical convenience — it provides a specific form of regularization. An artisan whose real scores are near the prior mean will have their variance *reduced* (the pseudoobservations agree with the data). An artisan with extreme scores will have their variance *increased* (the pseudoobservations disagree). This causes the lower bound to drop more aggressively for artisans whose extreme scores conflict with the prior — exactly the behavior we want for small samples with suspiciously high averages. A single Kokuho blade (score 5.08) clashes dramatically with the 10 phantom observations at 0, inflating variance and pushing the lower bound down.

### Convergence

The lower credible bound approaches the artisan's true weighted designation average as $n \to \infty$. With enough data, the prior becomes irrelevant — the evidence speaks for itself. The Bayesian machinery matters most at the margins, where data is thin and uncertainty is high.

### Statistical Lineage

The shrinkage estimator follows the empirical Bayes tradition of James and Stein (1961), with the pseudoobservation approach providing a concrete prior structure. The IDF weighting draws on the information-theoretic concept of self-information (Shannon, 1948) — rarer events carry more information, formalized as $\ln(N/n_i)$. The specific application to artisan ranking in the Japanese sword designation record builds on Darcy Brockbank's pioneering work quantifying NBTHK designation patterns, extending it with Bayesian uncertainty quantification and tier-sensitive weighting.

---

## Appendix: Implementation Reference

| Component | Value |
|-----------|-------|
| **Model** | Normal with pseudoobservations (IDF-weighted) |
| **Prior** | $C = 10$ at $m = 0$ |
| **Tier weights** | $w_i = \ln(N / n_i)$ (self-information) |
| **Helper function** | `shrinkage_lower_95(n, Σs, Σs², C, m)` |
| **Batch function** | `compute_designation_factors()` |
| **Per-code function** | `recompute_artisan_stats(codes)` |
| **Tables** | artisan_makers, artisan_schools |
| **Column** | `designation_factor` (aliased to `elite_factor`) |
| **Column type** | NUMERIC(4,2) |
| **Observation unit** | Per item: IDF weight of highest designation |
| **Value range** | 0.00–1.88 |
| **Population** | 12,453 swordsmiths + 1,119 tosogu artists |
| **Migration** | 435 (computation), 436 (elite_factor alias) |
