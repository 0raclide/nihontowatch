Two Bayesian metrics underpin the Yuhinkai artisan ranking system. The **elite factor** measures the depth and breadth of an artisan's designation record across all six tiers — from Kokuho and Tokubetsu Juyo down to Juyo — weighting each designation by its rarity and extracting a conservative lower credible bound that penalizes thin evidence. The **provenance factor** measures the prestige of an artisan's documented ownership history, applying a shrinkage estimator that anchors small samples toward baseline while allowing distinguished provenance trails to emerge with sufficient evidence.

The two metrics are computed over approximately 34,100 catalog records from seven source publications — spanning the NBTHK's Juyo and Tokubetsu Juyo zufu, government cultural property designations, the Imperial Collection, and the Jussi Ekholm koto research database — representing 25,472 unique physical objects. They are independent by design. An artisan may rank highly on one measure and modestly on the other, and the divergences are often the most revealing readings in the system.

*This is a working paper. Both the methodology and the underlying data curation are active and ongoing — rankings, counts, and methods described here are subject to revision as the dataset grows and the models are refined.*

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

### Provenance Normalization

Provenance records — documenting who owned each object across centuries — arrive in varied formats depending on the source publication. A unified extraction library normalizes all variants into flat lists of owner names.

Raw owner names are inconsistent: the same collector may appear as "Tokugawa," "Tokugawa Family," "The Tokugawa," or "Former Tokugawa Collection." A canonical name table (nearly 2,000 mapping rules covering approximately 1,700 distinct collector names) maps raw patterns to standardized forms and groups subsidiary names under parent entities:

> "Tokugawa Mitsukuni" → *Tokugawa Mitsukuni* → parent: *Tokugawa Family*
> "Owari Tokugawa" → *Owari Tokugawa* → parent: *Tokugawa Family*

This normalization is critical for the provenance factor. Without it, the same collector's holdings would be fragmented across spelling variants, understating the true pattern of distinguished ownership.

Approximately 13% of the 25,472 physical objects have documented provenance. The provenance factor (Part II) scores only those items whose owners fall within the top four prestige tiers.

### Artisan Linking

Each catalog record names its artisan as free text — "Masamune," "Den Masamune," "伝 正宗" — with no canonical identifier. The artisan matching pipeline links these text attributions to a curated directory of approximately 13,500 individual artisans and 206 school-level attributions (used when items are attributed to a tradition rather than a named individual).

The production pipeline uses a three-stage approach: profile matching (comparing the item's attribution text, school, province, era, and kanji against all known artisan profiles), verification of ambiguous matches, and sibling consensus (checking whether multiple records describing the same physical object agree on attribution). The overall match rate is 96.6% — 99.0% for swords, 93.6% for tosogu fittings.

Artisan linking makes the elite factor and provenance factor possible. Without it, items could not be aggregated by maker to compute per-artisan statistics.

### Deduplication

A single physical sword may have catalog entries from multiple publications. A blade by Nagamitsu, for instance, might appear in the Juyo zufu, the Tokuju zufu, and the Jussi Ekholm database — three records for one object. These sibling records are resolved into 25,472 unique physical objects. For each object, the best available data from all siblings is synthesized — preferring the highest-designation source for attribution but drawing measurements from any sibling that provides them.

For ranking purposes, each physical object counts once regardless of how many catalog records describe it. This prevents double-counting that would inflate statistics for frequently published masterworks.

---

## Part I: The Elite Factor

### The Problem

How do you rank a swordsmith who has one Tokubetsu-Juyo blade against one who has fifty Juyo? Raw designation counts favor prolific artisans regardless of quality. Simple ratios of elite to total designations overweight small samples — a smith with 1 Tokuju out of 1 total scores a perfect 100%, higher than Masamune, higher than Tomonari. And a binary split between "elite" and "standard" ignores the graded hierarchy of the designation system entirely: a Kokuho represents something far rarer than a Tokubetsu-Juyo, yet both would count equally under a simple binary model. Meanwhile, tosogu makers with dozens of Juyo designations — representing decades of NBTHK panel recognition — would score zero simply because their works were not elevated to Tokubetsu-Juyo.

This is the small-sample problem compounded by the information-loss problem, and both appear throughout the NBTHK designation record. Of the approximately 13,500 artisans in our index, many have only one or two designated works. A handful have hundreds. Any ranking system must handle both extremes gracefully, rewarding genuine excellence while refusing to be fooled by statistical flukes — and it must distinguish between different grades of excellence when the data supports that distinction.

### Designation Tiers and Weights

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

Each of an artisan's $n$ designated works contributes **one observation**: the weight of its highest designation tier. A blade that achieved both Juyo and Tokubetsu-Juyo contributes the Tokuju weight (2.57), not both. This parallels the provenance factor (Part II), where each item contributes its highest-prestige owner.

**The Gyobutsu discount.** Gyobutsu is excluded for artisans active after 1392 (Muromachi period onward). For pre-Nanbokucho smiths like Tomonari or Nagamitsu, whose works entered the Imperial Collection before the modern designation system existed, Gyobutsu status is a genuine mark of historical esteem. For later artisans, it more often reflects Edo-period political collecting — gifts to the shogunate or imperial household — rather than an independent quality judgment. The discount prevents this confound from inflating scores for post-1392 artisans.

### Prior Art: Brockbank's Pass Factor

The concept of measuring artisan stature through designation ratios originates with Darcy Brockbank, whose **pass factor** offered a pioneering quantitative lens on the NBTHK record. Brockbank's insight was straightforward: if a smith's works are repeatedly elevated from Juyo to Tokubetsu-Juyo, that pattern reveals something about the smith's quality that raw Juyo counts alone cannot capture. The pass factor was computed as:

$$\text{pass factor} = \frac{\text{elite designations}}{\text{juyo designations}}$$

Earlier rating systems — Fujishiro's ordinal rankings in *Nihon Toko Jiten*, the *Toko Taikan* editions of Dr. Tokuno, Hawley's numerical grades — assessed artisan stature through expert judgment, encoding scholarly consensus into fixed ratings. Brockbank's pass factor took a fundamentally different approach: rather than asking experts to *assign* a quality rating, it asked what the designation record itself *reveals*. The NBTHK's repeated decisions to elevate (or not elevate) an artisan's works constitute a form of revealed preference — an empirical signal that accumulates over decades of independent panel judgments.

The elite factor builds directly on Brockbank's foundation. It preserves his core insight — that the *pattern* of designation is more informative than the *count* — while addressing two limitations that emerge when the idea is applied at scale: the small-sample problem (which Brockbank acknowledged but could not fully resolve with point estimates) and the information-loss problem (the binary elite/standard split discards the graded structure of the designation hierarchy).

### Where Simple Metrics Break Down

A smith with 1 Tokuju out of 1 total scores a perfect 1.000 on a raw ratio — higher than Masamune, higher than Tomonari. Smoothing variants like the Laplace estimator $(e+1)/(n+2)$ dampen the extremes but still overweight small samples: a 1/1 artisan scores 0.667, still above most of the greatest smiths in history.

Beyond the small-sample problem, a binary elite/standard split loses information. A tosogu maker with 48 Juyo designations and no Tokubetsu-Juyo receives the same score as an unknown artisan with zero designations: both score 0. Yet 48 Juyo designations represent a substantial body of recognized work — the NBTHK panel has affirmed this maker's quality dozens of times. A binary metric is blind to this signal.

What we need is a scoring system that (1) uses the full graded hierarchy of designations, weighting rare achievements appropriately, and (2) honestly expresses our uncertainty about artisans with thin records.

### The Bayesian Framework

The elite factor uses a **shrinkage estimator** — the same Bayesian framework used for the provenance factor (Part II) — adapted with a skeptical prior that anchors unknown artisans at zero.

**The observation unit.** Each of an artisan's $n$ designated works contributes a score $s_i$ — the IDF weight of its highest designation tier. A Kokuho blade contributes 5.08; a Juyo blade contributes 0.24.

**The prior.** We introduce $C = 10$ pseudoobservations, each valued at the prior mean $m = 0$. This prior is deliberately skeptical: absent evidence, we assume an artisan's designation record contributes nothing. Evidence to the contrary must accumulate before the score moves meaningfully above zero.

**The posterior.** Given $n$ items with scores $s_1, s_2, \ldots, s_n$, we pool them with the $C$ pseudoobservations. Since $m = 0$, the pseudoobservations simplify the computation:

$$N = C + n = 10 + n$$

$$\bar{x} = \frac{\displaystyle\sum_{i=1}^{n} s_i}{N}$$

$$V = \frac{\displaystyle\sum_{i=1}^{n} s_i^2}{N} \;-\; \bar{x}^{\,2}$$

The pseudoobservations anchor the mean toward zero (diluting the observed data with 10 zero-valued phantom items) and contribute to the variance — creating disagreement when the observed scores are high, which widens the uncertainty interval.

**The lower credible bound.** As with the provenance factor, we extract the 5th percentile:

$$\text{SE} = \sqrt{\frac{V}{N}}$$

$$\text{elite factor} = \max\!\Big(0,\;\; \bar{x} - 1.645 \cdot \text{SE}\Big)$$

The coefficient 1.645 is the 5th-percentile $z$-score of the standard normal distribution.

### Worked Examples

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

Tomonari's extraordinary record — 30 designated works, nearly all at the highest tiers including Kokuho and Tokubetsu-Juyo — produces an elite factor of **1.88**, the highest of any swordsmith. His concentrated portfolio of masterworks, each carrying high IDF weight, pushes the mean far above zero, and with 30 observations the posterior is tight enough that the lower bound remains close to the mean.

Masamune's 93 designated works — including 59 at elite tiers — produce an elite factor of approximately **1.67**. His prolific output includes many Juyo-level works (weight 0.24) alongside his elite designations, diluting his weighted average relative to Tomonari's more concentrated portfolio. But the sheer volume of evidence makes the estimate highly reliable.

### Properties

The ranking is **self-correcting**: as more works are designated, the posterior narrows and converges to the artisan's true weighted designation rate. It is **tier-sensitive**: a Kokuho designation contributes 21× more than a Juyo, matching the intuition that a National Treasure represents something categorically different. It exhibits **scale-appropriate skepticism**: a single designation of any tier scores 0.00, while large bodies of work converge to their true weighted rate. It is **domain-fair**: tosogu makers with substantial Juyo records now receive non-zero scores, reflecting their genuine standing in the designation record rather than being penalized for the structural rarity of tosogu elite designations. And it uses the **same Bayesian machinery** as the provenance factor — shrinkage toward a conservative prior, lower credible bound — making the two metrics directly comparable in their statistical properties.

---

## Part II: The Provenance Factor

### A Different Question

The elite factor asks what modern experts think of an artisan's work. The provenance factor asks a different question: *whose hands did that work pass through?*

A blade that descended through the Tokugawa shogunate, the Maeda lords of Kaga, and the Imperial Collection tells a different story than one with no recorded provenance. The provenance factor quantifies that story — measuring how consistently an artisan's works attracted the most distinguished collectors across the centuries.

### The Prestige Hierarchy

Not all provenance is equal. A sword held by the Imperial Family carries more historical weight than one held by a regional merchant. The provenance factor assigns each documented owner a prestige score based on their position in the historical hierarchy of Japanese sword collecting:

| Tier | Score | Description | Examples |
|------|------:|-------------|----------|
| Imperial | 10 | The Imperial Family | Imperial Household |
| Shogunal | 9 | Ruling shogunates | Tokugawa, Ashikaga, Toyotomi |
| Premier Daimyo | 8 | Domains exceeding 500,000 koku; Gosanke and Gosankyo | Maeda (Kaga), Shimazu (Satsuma), Owari Tokugawa |
| Major Daimyo | 6 | Domains of 200,000–499,000 koku | Kuroda (Fukuoka), Mori (Choshu), Nabeshima (Saga) |
| Other Daimyo | 4 | Smaller domains and minor daimyo | Sakai, Honda, Ogasawara |
| Zaibatsu | 3.5 | Major merchant houses and industrial families | Iwasaki (Mitsubishi), Mitsui, Sumitomo |
| Institutions | 3 | Museums, shrines, temple collections | Seikado Bunko, Nezu Museum, Kasuga Taisha |
| Named Collectors | 2 | All other documented owners | Default for known collectors without an explicit tier |

The tiering reflects the historical structure of Japanese sword patronage. The Imperial Family and shoguns sat at the apex of a society in which swords were instruments of authority and cultural legitimacy. Great swords were political objects — gifts between lords, marks of favor, symbols of lineage. The provenance record captures this: when an artisan's works consistently appear in the collections of the most powerful families, it is evidence of sustained esteem across centuries.

**Hierarchy and inheritance.** Owners are normalized through a canonical name system that maps raw provenance strings to standardized forms. Individual family members inherit the prestige score of their parent group — "Tokugawa Iemitsu" inherits the Tokugawa Family score of 9 unless explicitly overridden.

**Non-provenance filtering.** Not all entries in provenance chains represent ownership. Narrative fragments ("Formerly in the collection of..."), publication references, and certification records are classified as non-provenance and excluded from scoring entirely. Only actual collector or institutional ownership counts.

### The Observation Unit: Item-Level Max

Each item contributes **one observation**: the prestige score of its **highest-ranking owner**. A sword that passed through the Maeda lords (8), a regional merchant (2), and the Imperial Collection (10) contributes a single observation of 10 — the Imperial score. This parallels elite factor, which uses one observation per item (highest designation).

Why item-level max, not per-owner? The alternative — creating one observation per documented owner — inflates provenance for artisans whose famous items have long, well-documented chains. Yoshimitsu's 40 provenance items generate 133 per-owner observations (3.3 owners per item on average), while Kunimitsu's 59 provenance items generate only 89 (1.5 per item). Under per-owner scoring, chain documentation thoroughness becomes a confound. Under item-level max scoring, a sword reaching the Imperial Collection is equally remarkable whether documented through 2 or 12 hands.

### Where the Weighted Average Breaks Down

The challenge for provenance scoring parallels the one for elite factor: sample size. An artisan with three items, all from the Imperial Collection, produces an item-level max average of 10.0 — the maximum possible score — on the strength of three observations. Meanwhile, Masamune's 68 provenance items, spanning the full range from Imperial to Named Collector, produce a raw average near 7.0. The three-item artisan appears to have more distinguished provenance than Masamune. The data says otherwise: it says we don't have enough information to know.

### The Bayesian Framework (Normal Model)

Provenance scores are continuous (ranging from 2.0 to 10.0), not binary. This calls for a **Normal model** rather than the Beta-Binomial used for elite factor. The architecture is the same — prior belief, posterior given data, lower credible bound — but the distributional machinery differs.

**The prior.** We introduce $C = 20$ pseudoobservations, each valued at the prior mean $m = 2.0$ (the "Named Collector" baseline). This prior is deliberately conservative: it assumes, absent evidence, that an artisan's provenance is unremarkable. Evidence to the contrary must accumulate before the score moves meaningfully above the baseline.

**The posterior.** Given $n$ items with item-level max scores $s_1, s_2, \ldots, s_n$ (each $s_i$ = highest-prestige owner of item $i$), we pool them with the $C$ pseudoobservations and compute the posterior mean and variance of the augmented sample:

$$N = C + n$$

$$\bar{x} = \frac{C \cdot m + \displaystyle\sum_{i=1}^{n} s_i}{N}$$

$$V = \frac{C \cdot m^2 + \displaystyle\sum_{i=1}^{n} s_i^2}{N} \;-\; \bar{x}^{\,2}$$

The pseudoobservations contribute to both mean and variance. This provides regularization: an artisan whose real scores are close to the prior mean of 2.0 will have their variance *reduced* by the pseudoobservations (they agree with the data), while an artisan with extreme scores will have their variance *increased* (the pseudoobservations disagree with the data).

**The lower credible bound.** As with the elite factor, we extract the 5th percentile:

$$\text{SE} = \sqrt{\frac{V}{N}}$$

$$\text{provenance factor} = \max\!\Big(0,\;\; \bar{x} - 1.645 \cdot \text{SE}\Big)$$

### Worked Examples

**Three items, all with Imperial highest owner (score 10.0)**

An artisan with three items, each having the Imperial Family as its highest-ranking owner:

$$n = 3, \quad \sum s_i = 30, \quad \sum s_i^2 = 300$$

$$N = 20 + 3 = 23$$

$$\bar{x} = \frac{20 \times 2.0 + 30}{23} = \frac{70}{23} = 3.0435$$

$$V = \frac{20 \times 4.0 + 300}{23} - 3.0435^2 = 16.5217 - 9.2629 = 7.2588$$

$$\text{SE} = \sqrt{\frac{7.2588}{23}} = 0.5618$$

$$\text{provenance factor} = 3.0435 - 1.645 \times 0.5618 = \mathbf{2.12}$$

Despite three perfect-score observations, the 20 pseudoobservations at 2.0 anchor the mean below the midpoint, and the wide variance interval — driven by the conflict between the prior (2.0) and the data (10.0) — pushes the lower bound down to 2.12. Three data points cannot overcome the prior's skepticism.

**One item, Imperial highest owner (score 10.0)**

$$n = 1, \quad \sum s_i = 10, \quad \sum s_i^2 = 100$$

$$N = 21, \quad \bar{x} = \frac{50}{21} = 2.3810$$

$$V = \frac{180}{21} - 2.3810^2 = 8.5714 - 5.6692 = 2.9022$$

$$\text{SE} = \sqrt{\frac{2.9022}{21}} = 0.3718$$

$$\text{provenance factor} = 2.3810 - 1.645 \times 0.3718 = \mathbf{1.77}$$

The floor of the system. A single item with imperial provenance barely lifts the score above baseline. One observation tells us almost nothing about whether an artisan's works *consistently* attracted distinguished collectors.

**Masamune: 68 items with provenance, apex 10.0**

Masamune's works appear consistently in the highest-tier collections — Imperial, Tokugawa, and the premier daimyo. With $n = 68$ items (each contributing its highest-prestige owner) pooled with $C = 20$ pseudoobservations, we have $N = 88$. The posterior mean sits near 5.6, and the standard error — proportional to $1/\sqrt{N}$ — is small enough that the lower bound barely departs from the mean:

$$\text{provenance factor} = \mathbf{5.29}$$

At 88 total observations, the prior contributes only 23% of the weight. The evidence overwhelms the skepticism.

### The Distribution in Practice

Of 686 artisans with provenance data:

| Range | Count | Cumulative |
|------:|------:|-----------:|
| $\geq$ 5.0 | 2 | Top 0.3% |
| 4.0–4.99 | 6 | Top 1.2% |
| 3.5–3.99 | 8 | Top 2.3% |
| 3.0–3.49 | 10 | Top 3.8% |
| 2.5–2.99 | 39 | Top 9.5% |
| 2.0–2.49 | 256 | Top 46.8% |
| 1.5–1.99 | 365 | 100% |

The distribution is heavily concentrated near the prior mean of 2.0, with a long right tail. Most artisans' works appear in ordinary or modestly distinguished collections. The handful above 4.0 represent the truly exceptional — those whose works were collected by the Imperial Family, the Tokugawa, and the greatest daimyo houses *across many items*.

---

## Part III: Current Rankings

*The elite factor values shown below reflect the current weighted designation model. The "Elite" and "Total" columns show the count of elite-tier designations (Tokuju+) and total designated works — these are factual inputs, not the score itself, since the score now incorporates all six tiers weighted by rarity. Rankings and values are computed from the live corpus and may shift as records are added. Current values are available in the [artist directory](/artists).*

### Swordsmiths: Top 10 by Elite Factor

| Rank | Artisan | Elite | Total | Elite Factor | Provenance Factor |
|-----:|---------|------:|------:|------------:|------------------:|
| 1 | Tomonari | 29 | 30 | 1.88 | 3.59 |
| 2 | Yoshimitsu | 41 | 55 | — | 4.53 |
| 3 | Mitsutada | 43 | 61 | — | 3.75 |
| 4 | Masatsune | 19 | 21 | — | 2.36 |
| 5 | Masamune | 59 | 93 | 1.67 | 5.29 |
| 6 | Sukezane | 31 | 44 | — | 3.41 |
| 7 | Sa | 45 | 79 | — | 4.41 |
| 8 | Kuniyoshi | 30 | 51 | — | 2.34 |
| 9 | Kanehira | 21 | 32 | — | 3.05 |
| 10 | Nagamitsu | 115 | 250 | — | 4.59 |

The elite factor top 10 reads as a roll call of the Kamakura golden age. Every artisan in the list worked between the late Heian and early Nanbokucho periods. Tomonari's concentrated portfolio of masterworks — including Kokuho and Tokubetsu-Juyo, each carrying high IDF weight — earns him the top position at 1.88. Nagamitsu's massive corpus of 250 works ranks lower despite 115 elite designations, because his many Juyo-level works (weight 0.24 each) dilute his weighted average.

The two metrics diverge in instructive ways: Masamune ranks 5th by elite factor but 1st by provenance factor, reflecting the historical reality that his works were the most collected swords in Japanese history. Tomonari ranks 1st by elite factor but 14th by provenance — his artistic supremacy in the NBTHK record does not translate into an equally dominant provenance trail.

### Swordsmiths: Top 10 by Provenance Factor

| Rank | Artisan | Prov. Factor | Items | Apex |
|-----:|---------|------------:|------:|-----:|
| 1 | Masamune | 5.29 | 68 | 10.0 |
| 2 | Kunimitsu | 5.15 | 59 | 10.0 |
| 3 | Sadamune | 4.78 | 43 | 9.0 |
| 4 | Kanemitsu | 4.63 | 67 | 10.0 |
| 5 | Nagamitsu | 4.59 | 83 | 10.0 |
| 6 | Yoshimitsu | 4.53 | 40 | 10.0 |
| 7 | Sa | 4.41 | 39 | 10.0 |
| 8 | Kunitoshi | 4.22 | 71 | 10.0 |
| 9 | Kunimitsu (Soshu) | 3.88 | 32 | 10.0 |
| 10 | Mitsutada | 3.75 | 34 | 10.0 |

The provenance ranking surfaces a different dimension of stature. Masamune leads at 5.29, with the largest item count (68 items with documented provenance) in the index. An apex of 10.0 means at least one work reached the Imperial Collection.

Kunimitsu at #2 is an instructive case. His elite factor places him outside the elite top 10, reflecting a modest rate of elite-tier elevation. But his provenance factor of 5.15 reveals that his works were collected at the highest levels. The elite factor measures the breadth and depth of designation; provenance captures centuries of aristocratic esteem. The two metrics answer different questions about the same artisan.

Yoshimitsu's shift from #1 to #6 is the most significant change from item-level scoring. Under per-owner scoring, his 40 provenance items generated 133 observations (3.3 owners per item) — long, well-documented chains inflated his score. Under item-level max, each item contributes once regardless of chain length, and the same 40 items yield a score of 4.53. His provenance is still exceptional, but no longer artificially inflated by documentation thoroughness.

### Tosogu Artists: Top 10 by Elite Factor

| Rank | Artisan | Elite | Total | Elite Factor | Provenance Factor |
|-----:|---------|------:|------:|------------:|------------------:|
| 1 | Somin | 25 | 51 | ~0.97 | 2.15 |
| 2 | Kaneie | 20 | 42 | — | 2.38 |
| 3 | Yasuchika | 28 | 76 | ~0.70 | 2.01 |
| 4 | Joi | 7 | 12 | — | 1.99 |
| 5 | Myoju | 8 | 22 | — | 2.00 |
| 6 | Natsuo | 14 | 75 | — | 1.97 |
| 7 | Toshinaga | 6 | 23 | — | 1.84 |
| 8 | Matashichi | 7 | 52 | — | 2.24 |
| 9 | Goto Yujo | 6 | 41 | — | 2.39 |
| 10 | Goto Ichijo | 9 | 79 | — | 2.56 |

With the weighted designation model, tosogu artists receive substantially higher elite factors than under the previous binary model — reflecting credit for their Juyo designations in addition to any elite-tier work. Somin (Yokoya school founder) leads at approximately 0.97, benefiting from both his 25 elite designations and 26 Juyo works. The gap between sword and tosogu scores remains — reflecting the NBTHK's historically lower volume of tosogu designations — but tosogu makers with substantial bodies of recognized work now receive scores proportional to their standing. Percentiles are still computed *within* each domain rather than across them.

### Tosogu Artists: Top 10 by Provenance Factor

| Rank | Artisan | Prov. Factor | Items | Apex |
|-----:|---------|------------:|------:|-----:|
| 1 | Goto Sojo | 2.67 | 13 | 9.0 |
| 2 | Goto Ichijo | 2.56 | 14 | 10.0 |
| 3 | Goto Eijo | 2.48 | 8 | 9.0 |
| 4 | Goto Yujo | 2.39 | 11 | 9.0 |
| 5 | Kaneie | 2.38 | 13 | 8.0 |
| 6 | Goto Joshin | 2.32 | 7 | 8.0 |
| 7 | Goto Kenjo | 2.27 | 8 | 8.0 |
| 8 | Goto Kojo | 2.25 | 6 | 8.0 |
| 9 | Matashichi | 2.24 | 5 | 8.0 |
| 10 | Goto Tokujo | 2.21 | 6 | 6.0 |

The Goto family dominates tosogu provenance: eight of the top ten positions belong to Goto lineage members. This reflects historical reality — the Goto family served as official metalwork artists to the Ashikaga and Tokugawa shogunates for over three centuries, and their works passed through the most distinguished collections as a matter of course.

Goto Sojo ranks #1 by provenance despite having no elite-tier designations. His works were prized by shoguns and daimyo, yet the NBTHK has not elevated them to Tokubetsu-Juyo or higher. Under the weighted model, his Juyo designations earn him a non-zero elite factor, but his provenance remains the more distinctive metric. The two measures reveal genuinely different things.

---

## Part IV: How the Two Metrics Relate

The elite factor and provenance factor are **independent measures**. They are not combined into a composite score, and they are not derived from each other. This independence is by design: an artisan can rank highly on one and poorly on the other, and both readings are informative.

**When they agree.** The greatest artisans tend to rank highly on both metrics. Masamune, Yoshimitsu, Nagamitsu, and Sa all appear in both sword top-10 lists. This convergence is expected — the finest swordsmiths both received elite designations and attracted the most distinguished collectors.

**When they disagree.** The disagreements are where the system reveals its most interesting insights:

- **High elite, low provenance.** Masatsune ranks 4th by elite factor (19 of 21 works at elite tier) but has only modest provenance data and a factor of 2.36. His works are magnificent by NBTHK standards but have a thinner documented ownership trail.

- **Low elite, high provenance.** Kunimitsu ranks outside the elite top 10 but 2nd by provenance (5.15, 59 items). His works were treasured by the most powerful families for centuries, even though his designation profile is more modest. Kamakura-period collectors may have valued different qualities than modern NBTHK panels.

- **Low elite, high provenance (tosogu).** Goto Sojo has zero elite-tier designations but the highest provenance factor among tosogu artists. His works were collected by shoguns — but the NBTHK has not elevated them to Tokubetsu-Juyo or higher.

These divergences are features, not bugs. A single combined score would obscure exactly the distinctions that make the ranking system informative. Figures 1–4 (below) visualize this relationship separately for swordsmiths and tosogu artists.

### Percentile Computation

Both metrics support percentile ranking, computed at query time within each domain:

- **Swordsmiths** are ranked against other swordsmiths
- **Tosogu artists** are ranked against other tosogu artists

This prevents domain-level structural differences (tosogu elite factors are inherently lower than sword elite factors) from distorting relative rankings. A tosogu artist at the 90th percentile of their domain has achieved something comparable to a swordsmith at the 90th percentile of theirs, even though the raw numbers differ.

---

## Part V: Statistical Notes

### A Unified Bayesian Framework

Both the elite factor and provenance factor now use the **same shrinkage estimator** — a Normal model with pseudoobservations. The elite factor uses $C = 10$ pseudoobservations at $m = 0$ (skeptical prior: unknown artisans assumed to have zero designation value). The provenance factor uses $C = 20$ at $m = 2.0$ (anchored at the "Named Collector" baseline).

Both models extract the 5th percentile — the lower bound of a one-sided 95% credible interval — using the normal approximation $\max(0,\; \mu - 1.645\,\sigma)$.

### Why Include Pseudoobservations in Variance

For both metrics, the pseudoobservations contribute to the variance calculation as well as the mean. This is more than a mathematical convenience — it provides a specific form of regularization. An artisan whose real scores are near the prior mean will have their variance *reduced* (the pseudoobservations agree with the data). An artisan with extreme scores will have their variance *increased* (the pseudoobservations disagree). This causes the lower bound to drop more aggressively for artisans whose extreme scores conflict with the prior — exactly the behavior we want for small samples with suspiciously high averages. For the elite factor, a single Kokuho blade (score 5.08) clashes dramatically with the 10 phantom observations at 0, inflating variance and pushing the lower bound down.

### Convergence

Both metrics converge to their underlying true values as sample size increases. For elite factor, the lower credible bound approaches the artisan's true weighted designation average as $n \to \infty$. For provenance factor, it approaches the unweighted average prestige score. With enough data, the prior becomes irrelevant — the evidence speaks for itself. The Bayesian machinery matters most at the margins, where data is thin and uncertainty is high.

### Statistical Lineage

The shrinkage estimator used for both metrics follows the empirical Bayes tradition of James and Stein (1961), with the pseudoobservation approach providing a concrete prior structure. The IDF weighting for elite factor draws on the information-theoretic concept of self-information (Shannon, 1948) — rarer events carry more information, formalized as $\ln(N/n_i)$. The specific application to artisan ranking in the Japanese sword designation record builds on Darcy Brockbank's pioneering work quantifying NBTHK designation patterns, extending it with Bayesian uncertainty quantification and tier-sensitive weighting.

---

## Appendix: Implementation Reference

| Component | Elite Factor | Provenance Factor |
|-----------|-------------|-------------------|
| **Model** | Normal with pseudoobservations (IDF-weighted) | Normal with pseudoobservations |
| **Prior** | $C = 10$ at $m = 0$ | $C = 20$ at $m = 2.0$ |
| **Tier weights** | $w_i = \ln(N / n_i)$ (self-information) | Fixed prestige hierarchy (2–10) |
| **Helper function** | `shrinkage_lower_95(n, Σs, Σs², C, m)` | `shrinkage_lower_95(n, Σs, Σs², C, m)` |
| **Batch function** | `compute_designation_factors()` | `compute_provenance_factor()` |
| **Per-code function** | `recompute_artisan_stats(codes)` | `recompute_provenance_factor(codes)` |
| **Tables** | artisan_makers, artisan_schools | artisan_makers, artisan_schools |
| **Column** | `designation_factor` (aliased to `elite_factor`) | `provenance_factor` |
| **Column type** | NUMERIC(4,2) | NUMERIC(4,2) |
| **Observation unit** | Per item: IDF weight of highest designation | Per item: highest-prestige owner |
| **Value range** | 0.00–1.88 | 1.77–5.29 |
| **Population** | 12,356 swordsmiths + 1,107 tosogu artists | 686 artists with provenance data |
| **Migration** | 435 (computation), 436 (elite_factor alias) | 424, 427 |
