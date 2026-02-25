'use client';

import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ─── Heading ID generation for anchor links ─────────────────────────── */

function slugify(node: React.ReactNode): string {
  if (typeof node === 'string') return node.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (Array.isArray(node)) return node.map(slugify).filter(Boolean).join('-');
  return '';
}

/* ─── Custom components ──────────────────────────────────────────────── */

const components: Components = {
  // h2 with auto-generated IDs for anchor links
  h2: ({ children }) => <h2 id={slugify(children)}>{children}</h2>,
  // Wrap tables in a scrollable container for mobile
  table: ({ children }) => (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table>{children}</table>
    </div>
  ),
};

/* ─── Content (from oshi-v2/docs/ARTIST_RANKING_METHODOLOGY.md) ──────── */

const CONTENT = `Two Bayesian metrics underpin the Yuhinkai artisan ranking system. The **elite factor** measures the quality of an artisan's designated works — how consistently the NBTHK elevated them to the highest tiers. The **provenance factor** measures the prestige of an artisan's ownership history — whose collections held their works across centuries. Together they capture two distinct dimensions of stature: what the modern designation record says about an artisan's craft, and what the historical provenance record says about how their work was valued in its own time.

Both metrics share a common statistical architecture: Bayesian models that express ranking as a *lower credible bound* rather than a point estimate. This means an artisan's score reflects not just their observed rate or average, but how much evidence supports it. Small samples produce wide uncertainty intervals and low scores; large samples produce narrow intervals and scores that converge to the true underlying value. Uncertainty itself becomes the penalty for thin data.

---

## Part I: The Elite Factor

### The Problem

How do you rank a swordsmith who has one Tokubetsu-Juyo blade against one who has seventeen? On the surface, the first smith has a 100% elite rate; the second, perhaps 20%. But no serious scholar would place the unknown smith above Masamune on the strength of a single data point.

This is the **small-sample problem**, and it appears throughout the NBTHK designation record. Of the roughly 13,000 artisans in our index, many have only one or two designated works. A handful have hundreds. Any ranking system must handle both extremes gracefully, rewarding genuine excellence while refusing to be fooled by statistical flukes.

### What Counts as "Elite"

The elite factor measures the proportion of an artisan's designated works that achieved the highest tiers of recognition:

| Designation | Japanese | Status |
|---|---|---|
| Kokuho | National Treasure (国宝) | Elite |
| Tokubetsu-Juyo | Special Important (特別重要刀剣) | Elite |
| Juyo-Bunkazai | Important Cultural Property (重要文化財) | Elite |
| Juyo-Bijutsuhin | Important Art Object (重要美術品) | Elite |
| Gyobutsu | Imperial Collection (御物) | Elite\\* |
| Juyo-Token | Important Sword (重要刀剣) | Standard |

\\*Gyobutsu is excluded from the elite count for artisans active after 1392 (Muromachi period onward). From the Muromachi through Edo periods, swords entered the Imperial Collection primarily as tributary gifts from daimyo and shogunal households — a mark of the giver's political relationship to the throne, not an independent judgment of the blade's quality. Including these items would inflate elite rates for later artisans based on court diplomacy rather than NBTHK-caliber merit.

The raw inputs are simply two integers: **elite count** (*e*) and **total designated works** (*n*).

### Prior Art: Brockbank's Pass Factor

The concept of measuring artisan stature through designation ratios originates with Darcy Brockbank, whose **pass factor** offered a pioneering quantitative lens on the NBTHK record. Brockbank's insight was straightforward: if a smith's works are repeatedly elevated from Juyo to Tokubetsu-Juyo, that pattern reveals something about the smith's quality that raw Juyo counts alone cannot capture.

The pass factor was computed as a simple ratio:

\`\`\`
pass_factor = elite_designations / juyo_designations
\`\`\`

This was a significant conceptual advance. Earlier rating systems — Fujishiro's ordinal rankings in *Nihon Toko Jiten*, the *Toko Taikan* editions of Dr. Tokuno, Hawley's numerical grades — assessed artisan stature through expert judgment, encoding scholarly consensus into fixed ratings. Brockbank's pass factor took a fundamentally different approach: rather than asking experts to *assign* a quality rating, it asked what the designation record itself *reveals*. The NBTHK's repeated decisions to elevate (or not elevate) an artisan's works constitute a form of revealed preference — an empirical signal that accumulates over decades of independent panel judgments.

The elite factor builds directly on Brockbank's foundation. It preserves his core insight — that the *rate* of elite designation is more informative than the *count* — while addressing the limitation that emerges when the idea is applied at scale across the full artisan index.

### Where the Raw Ratio Breaks Down

A smith with 1 Tokuju out of 1 total scores a perfect 1.000 — higher than Masamune, higher than Tomonari. Smoothing variants like the Laplace estimator (*(e+1)/(n+2)*) dampen the extremes but still overweight small samples: a 1/1 artisan scores 0.667, still above most of the greatest smiths in history.

The fundamental issue is that all point estimates collapse uncertainty into a single number without accounting for how *confident* we should be in that estimate. What we need is a way to preserve Brockbank's ratio for artisans with substantial records while honestly expressing our ignorance about artisans with thin ones.

### The Bayesian Framework

Bayesian inference offers an elegant solution. Rather than estimating a single "elite rate," we model our *entire state of belief* about an artisan's true quality as a probability distribution. We then extract a conservative summary of that distribution — one that explicitly penalizes uncertainty.

**The Beta-Binomial model.** We model each artisan's true elite rate *θ* as a draw from a Beta distribution. Given the observed data, Bayes' theorem gives us the posterior:

\`\`\`
Prior:      θ ~ Beta(α₀, β₀)
Likelihood: e | θ ~ Binomial(n, θ)
Posterior:  θ | e, n ~ Beta(α₀ + e, β₀ + n - e)
\`\`\`

The Beta distribution is the *conjugate prior* for binomial data, meaning the posterior has the same functional form as the prior. This makes the math clean and the computation exact.

**Choosing the prior: Beta(1, 9).** The prior encodes our belief about an artisan's elite rate *before* seeing any data:

- Prior mean of 1/10 = 0.10, reflecting the base rate across all artisans (roughly 10% of designated works achieve elite status)
- Mildly skeptical — it takes real evidence to push an artisan's score above the baseline
- Total weight of 10 pseudocounts, equivalent to having already observed 1 elite work out of 10 — enough to regularize small samples without overwhelming large ones

After observing *e* elite works out of *n* total, the posterior becomes:

\`\`\`
θ | data ~ Beta(1 + e, 9 + n - e)
\`\`\`

For Masamune (59 elite, 93 total), the posterior is Beta(60, 43) — a tight peak near 0.58. For an unknown smith with 1/1, it is Beta(2, 9) — a wide, uncertain smear.

**The lower credible bound.** Rather than report the posterior mean, we extract the **5th percentile** — the lower bound of a one-sided 95% credible interval. This answers:

> *What elite rate can we be 95% confident this artisan exceeds?*

For a Beta(*a*, *b*) distribution:

\`\`\`
mean         = a / (a + b)
stddev       = sqrt( a × b / ((a + b)² × (a + b + 1)) )
elite_factor = max(0, mean − 1.645 × stddev)
\`\`\`

The 1.645 factor corresponds to the 5th percentile of a standard normal distribution. The normal approximation to the Beta quantile is accurate when both *a* ≥ 1 and *b* ≥ 1, which is guaranteed by our prior.

### Worked Examples

**Tomonari: 29 elite out of 30 total**

\`\`\`
Posterior: Beta(30, 10)
Mean:      30 / 40 = 0.7500
Stddev:    sqrt(30 × 10 / (1600 × 41)) = 0.0677
Lower 95%: 0.7500 − 1.645 × 0.0677 = 0.6388
\`\`\`

Tomonari's extraordinary record — virtually every designated work achieving elite status — survives scrutiny. With 30 observations, the posterior is tight, and the lower bound remains high.

**Masamune: 59 elite out of 93 total**

\`\`\`
Posterior: Beta(60, 43)
Mean:      60 / 103 = 0.5825
Stddev:    sqrt(60 × 43 / (10609 × 104)) = 0.0484
Lower 95%: 0.5825 − 1.645 × 0.0484 = 0.5030
\`\`\`

Masamune ranks fifth among swordsmiths — reflecting his dominant but not singular position in the record, where his prolific output dilutes his rate relative to smaller but more concentrated portfolios like Tomonari's.

**An unknown smith: 1 elite out of 1 total**

\`\`\`
Posterior: Beta(2, 9)
Mean:      2 / 11 = 0.1818
Stddev:    sqrt(2 × 9 / (121 × 12)) = 0.1109
Lower 95%: 0.1818 − 1.645 × 0.1109 = −0.0007 → max(0, ...) = 0.0000
\`\`\`

One data point tells us almost nothing. The posterior is so wide that its lower bound touches zero.

### Properties

The ranking is **self-correcting**: as more works are designated, the posterior narrows and converges to the true elite rate. It is **monotonic**: adding an elite work always increases the score; adding a non-elite work always decreases it. It exhibits **scale-appropriate skepticism**: 3/3 scores 0.1265 (heavily penalized), while 30/30 scores 0.6388 (only slightly penalized). And it is **robust to the long tail** — no binning, no thresholds, just the mathematics of posterior width across the full range of sample sizes.

---

## Part II: The Provenance Factor

### A Different Question

The elite factor asks what modern experts think of an artisan's work. The provenance factor asks a different question: *whose hands did that work pass through?*

A blade that descended through the Tokugawa shogunate, the Maeda lords of Kaga, and the Imperial Collection tells a different story than one with no recorded provenance. The provenance factor attempts to quantify that story — to measure how consistently an artisan's works attracted the most distinguished collectors across the centuries.

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

**Hierarchy and inheritance.** Owners are normalized through a canonical name system that maps raw provenance strings to standardized forms. Individual family members inherit the prestige score of their parent group: "Tokugawa Iemitsu" inherits the Tokugawa Family score of 9 unless explicitly overridden.

**Non-provenance filtering.** Not all entries in provenance chains represent ownership. Narrative fragments, publication references, and certification records are tagged as non-provenance and excluded from scoring entirely. Only actual collector or institutional ownership counts.

### Where the Weighted Average Breaks Down

The challenge for provenance scoring parallels the one for elite factor: sample size. An artisan with three items, all from the Imperial Collection, produces a weighted average of 10.0 — the maximum possible score — on the strength of three observations. Meanwhile, Masamune's 205 provenance observations, spanning the full range from Imperial to Named Collector, produce an average of about 5.5. The three-item artisan appears to have more distinguished provenance than Masamune. The data says otherwise: it says we don't have enough information to know.

### The Bayesian Framework (Normal Model)

Provenance scores are continuous (ranging from 2.0 to 10.0), not binary. This calls for a **Normal model** rather than the Beta-Binomial used for elite factor. The architecture is the same — prior belief, posterior given data, lower credible bound — but the distributional machinery differs.

**The prior.** We use *C* = 20 pseudoobservations, each valued at the prior mean *m* = 2.0 (the "Named Collector" baseline). This prior is deliberately conservative: it assumes, absent evidence, that an artisan's provenance is unremarkable. Evidence to the contrary must accumulate before the score moves meaningfully above the baseline.

**The posterior.** Given *n* real observations with scores *s₁, s₂, ..., sₙ*:

\`\`\`
total_n    = C + n                                (pseudoobservations + real)
total_mean = (C × m + Σ sᵢ) / total_n            (weighted posterior mean)
total_var  = (C × m² + Σ sᵢ²) / total_n − total_mean²   (posterior variance)
\`\`\`

The pseudoobservations contribute to both mean and variance. This provides a form of regularization: an artisan whose real scores are close to the prior mean of 2.0 will have their variance pulled *down* (the pseudoobservations agree with the data), while an artisan with extreme scores will have their variance pulled *up* (the pseudoobservations disagree).

**The lower credible bound.** As with elite factor, we extract the 5th percentile:

\`\`\`
SE                 = sqrt(total_var / total_n)
provenance_factor  = max(0, total_mean − 1.645 × SE)
\`\`\`

### Worked Examples

**Yoshimitsu: 133 provenance observations, apex 10.0**

Yoshimitsu's works appear consistently in the highest-tier collections — Imperial, Tokugawa, and the premier daimyo. With 133 observations, the posterior is tight:

\`\`\`
total_n    = 20 + 133 = 153
total_mean = (20 × 2.0 + 783.5) / 153 = 5.38
SE         ≈ small
Lower 95%: 5.21
\`\`\`

The lower bound barely departs from the posterior mean. 133 observations establish the pattern with high confidence.

**A small-sample artisan: 3 observations, all score 10.0**

\`\`\`
total_n    = 20 + 3 = 23
total_mean = (20 × 2.0 + 30.0) / 23 = 3.04
SE         ≈ large
Lower 95%: ~2.33
\`\`\`

Despite three perfect-score observations, the posterior is wide. The 20 pseudoobservations at 2.0 anchor the mean, and the wide variance interval pushes the lower bound further down. Three data points cannot overcome the prior's skepticism.

**A single-observation artisan: 1 observation, score 10.0**

\`\`\`
total_n    = 20 + 1 = 21
total_mean = (20 × 2.0 + 10.0) / 21 = 2.38
Lower 95%: ~1.77
\`\`\`

The floor. A single imperial-provenance observation barely lifts the score above baseline. This is exactly right: one observation tells us almost nothing about whether an artisan's works *consistently* attracted distinguished collectors.

### The Distribution in Practice

Of 687 artisans with provenance data:

| Range | Count | Cumulative |
|------:|------:|-----------:|
| ≥ 5.0 | 3 | Top 0.4% |
| 4.0–4.99 | 9 | Top 1.7% |
| 3.5–3.99 | 8 | Top 2.9% |
| 3.0–3.49 | 16 | Top 5.2% |
| 2.5–2.99 | 48 | Top 12.2% |
| 2.0–2.49 | 272 | Top 51.8% |
| 1.5–1.99 | 331 | 100% |

The distribution is heavily concentrated near the prior mean of 2.0, with a long right tail. This is expected: most artisans' works appear in ordinary or modestly distinguished collections. The handful of artisans above 4.0 represent the truly exceptional — those whose works were collected by the Imperial Family, the Tokugawa, and the greatest daimyo houses *across many observations*.

---

## Part III: Current Rankings

### Swordsmiths: Top 10 by Elite Factor

| Rank | Artisan | Elite | Total | Elite Factor | Provenance Factor |
|-----:|---------|------:|------:|------------:|------------------:|
| 1 | Tomonari | 29 | 30 | 0.6388 | 4.13 |
| 2 | Yoshimitsu | 41 | 55 | 0.5493 | 5.21 |
| 3 | Mitsutada | 43 | 61 | 0.5256 | 4.19 |
| 4 | Masatsune | 19 | 21 | 0.5060 | 2.70 |
| 5 | Masamune | 59 | 93 | 0.5030 | 5.17 |
| 6 | Sukezane | 31 | 44 | 0.4836 | 3.72 |
| 7 | Sa | 45 | 79 | 0.4302 | 4.51 |
| 8 | Kuniyoshi | 30 | 51 | 0.4038 | 2.47 |
| 9 | Kanehira | 21 | 32 | 0.3985 | 3.16 |
| 10 | Nagamitsu | 115 | 250 | 0.3955 | 4.64 |

The elite factor top 10 reads as a roll call of the Kamakura golden age. Every artisan in the list worked between the late Heian and early Nanbokucho periods, when the sword arts reached their zenith. Tomonari's extraordinary 97% elite rate (29 of 30) earns him the top position, while Nagamitsu's massive corpus of 250 works — the most prolific in the elite tier — ranks tenth despite 115 elite designations, because his 46% rate is diluted by his sheer output.

Note that the two metrics diverge in interesting ways: Masamune ranks 5th by elite factor but 2nd by provenance factor, reflecting the historical reality that his works were the most collected swords in Japanese history. Tomonari ranks 1st by elite factor but 10th by provenance — his artistic supremacy in the NBTHK record does not translate into an equally dominant provenance trail.

### Swordsmiths: Top 10 by Provenance Factor

| Rank | Artisan | Prov. Factor | Obs. | Apex | Elite Factor |
|-----:|---------|------------:|-----:|-----:|------------:|
| 1 | Yoshimitsu | 5.21 | 133 | 10.0 | 0.5493 |
| 2 | Masamune | 5.17 | 205 | 10.0 | 0.5030 |
| 3 | Kunimitsu | 5.09 | 89 | 10.0 | 0.2618 |
| 4 | Sadamune | 4.98 | 98 | 9.0 | 0.3646 |
| 5 | Nagamitsu | 4.64 | 132 | 10.0 | 0.3955 |
| 6 | Sa | 4.51 | 86 | 10.0 | 0.4302 |
| 7 | Kunitoshi | 4.42 | 105 | 10.0 | 0.2793 |
| 8 | Kanemitsu | 4.39 | 105 | 10.0 | 0.2567 |
| 9 | Mitsutada | 4.19 | 54 | 10.0 | 0.5256 |
| 10 | Tomonari | 4.13 | 33 | 10.0 | 0.6388 |

The provenance ranking surfaces a different dimension of stature. Yoshimitsu leads — his tantō, prized by the highest collectors for centuries, appear across more distinguished provenance chains than any other artisan. Masamune follows closely at 5.17, with the largest observation count (205) in the index. An apex of 10.0 means at least one work reached the Imperial Collection.

Kunimitsu at #3 (elite factor rank: unranked in top 10) is an instructive case. His elite factor of 0.2618 reflects a modest 81/256 elite rate. But his provenance factor of 5.09 reveals that his works were collected at the highest levels — the elite factor measures NBTHK assessment, while provenance captures centuries of aristocratic esteem. The two metrics answer different questions about the same artisan.

### Tosogu Artists: Top 10 by Elite Factor

| Rank | Artisan | Elite | Total | Elite Factor | Provenance Factor |
|-----:|---------|------:|------:|------------:|------------------:|
| 1 | Somin | 25 | 51 | 0.3229 | 2.15 |
| 2 | Kaneie | 20 | 42 | 0.2930 | 2.36 |
| 3 | Yasuchika | 28 | 76 | 0.2538 | 2.01 |
| 4 | Joi | 7 | 12 | 0.1986 | 2.03 |
| 5 | Myoju | 8 | 22 | 0.1525 | 2.00 |
| 6 | Natsuo | 14 | 75 | 0.1088 | 1.97 |
| 7 | Toshinaga | 6 | 23 | 0.0968 | 1.84 |
| 8 | Matashichi | 7 | 52 | 0.0596 | 2.22 |
| 9 | Goto Yujo | 6 | 41 | 0.0588 | 2.37 |
| 10 | Goto Ichijo | 9 | 79 | 0.0576 | 2.51 |

Tosogu elite factors are substantially lower than swords, reflecting the NBTHK's historically stricter elevation standards for fittings. Somin (Yokoya school founder) leads at 0.3229 — lower than the 30th-ranked swordsmith. This is a domain difference, not a quality judgment, and is why percentiles are computed *within* each domain rather than across them.

### Tosogu Artists: Top 10 by Provenance Factor

| Rank | Artisan | Prov. Factor | Obs. | Apex | Elite Factor |
|-----:|---------|------------:|-----:|-----:|------------:|
| 1 | Goto Sojo | 2.65 | 15 | 9.0 | 0.0000 |
| 2 | Goto Ichijo | 2.51 | 17 | 10.0 | 0.0576 |
| 3 | Goto Eijo | 2.48 | 8 | 9.0 | 0.0062 |
| 4 | Goto Yujo | 2.37 | 12 | 9.0 | 0.0588 |
| 5 | Kaneie | 2.36 | 14 | 8.0 | 0.2930 |
| 6 | Goto Joshin | 2.31 | 8 | 8.0 | 0.0408 |
| 7 | Goto Kenjo | 2.27 | 8 | 8.0 | 0.0150 |
| 8 | Goto Kojo | 2.25 | 6 | 8.0 | 0.0000 |
| 9 | Matashichi | 2.22 | 6 | 8.0 | 0.0596 |
| 10 | Goto Tokujo | 2.20 | 7 | 6.0 | 0.0000 |

The Goto family dominates tosogu provenance: seven of the top ten positions belong to Goto lineage members. This reflects historical reality — the Goto family served as official metalwork artists to the Ashikaga and Tokugawa shogunates for over three centuries, and their works passed through the most distinguished collections as a matter of course. The provenance factor captures this dynastic pattern.

Note the elite-provenance divergence here: Goto Sojo ranks #1 by provenance but has an elite factor of 0.0000 (zero elite designations). His works were prized by shoguns and daimyo, but the NBTHK has not elevated them to the highest designation tiers. The two metrics reveal genuinely different things.

### Schools: Top 5 by Elite Factor

| Rank | School | Elite | Total | Elite Factor | Provenance Factor |
|-----:|--------|------:|------:|------------:|------------------:|
| 1 | Ichimonji | 70 | 220 | 0.2587 | 4.50 |
| 2 | Momoyama Period | 11 | 31 | 0.1772 | 2.40 |
| 3 | Nanbokucho Period | 8 | 19 | 0.1714 | 2.01 |
| 4 | Osafune | 5 | 9 | 0.1448 | 2.15 |
| 5 | Soshu | 5 | 10 | 0.1355 | 2.11 |

School-level attributions ("attributed to the Ichimonji school" rather than a specific smith) carry their own elite factors. Ichimonji dominates with 70 elite works — these are blades too fine to be anonymous but too uncertain to attribute to a specific Ichimonji smith.

---

## Part IV: How the Two Metrics Relate

The elite factor and provenance factor are **independent measures**. They are not combined into a single composite score, and they are not derived from each other. This independence is by design: an artisan can rank highly on one and poorly on the other, and both readings are informative.

**When they agree:** The greatest artisans tend to rank highly on both metrics. Yoshimitsu, Masamune, Mitsutada, and Sa all appear in both top-10 lists for swords. This convergence is expected — the finest swordsmiths both received elite designations and attracted the most distinguished collectors.

**When they disagree:** The disagreements are where the system reveals the most interesting insights:

- **High elite, low provenance.** Masatsune ranks 4th by elite factor (19/21 = 90% elite rate) but has only 12 provenance observations. His works are magnificent by NBTHK standards but have a thinner documented ownership trail.

- **Low elite, high provenance.** Kunimitsu ranks outside the elite top-10 (0.2618) but 3rd by provenance (5.09, 89 observations). His works were treasured by the most powerful families for centuries, even though his NBTHK elite rate is moderate. This can reflect genuine historical taste: Kamakura-period collectors may have valued different qualities than modern NBTHK panels.

- **Zero elite, high provenance.** Goto Sojo has zero elite designations but the highest provenance factor among tosogu artists. His works were collected by shoguns — but the NBTHK has not elevated them to Tokubetsu-Juyo or higher.

These divergences are features, not bugs. A single combined score would obscure exactly the distinctions that make the ranking system informative.

### Percentile Computation

Both metrics support percentile ranking, computed at query time within each domain:

- **Swordsmiths** are ranked against other swordsmiths
- **Tosogu artists** are ranked against other tosogu artists

This prevents the domain-level differences (tosogu elite factors are structurally lower than sword elite factors) from distorting relative rankings. A tosogu artist at the 90th percentile of their domain has achieved something comparable to a swordsmith at the 90th percentile of theirs, even though the raw numbers differ.

---

## Part V: Statistical Notes

### Why Two Different Models

Elite factor uses a **Beta-Binomial** model because the underlying data is binary: each work either achieved elite designation or it did not. The Beta distribution is the conjugate prior for binomial data, making the posterior computation exact.

Provenance factor uses a **Normal model** because the underlying data is continuous: each provenance observation carries a prestige score between 2.0 and 10.0. The pseudoobservation approach (adding *C* = 20 observations at the prior mean *m* = 2.0) provides Bayesian regularization while allowing variance to be estimated from the data.

Both models extract the 5th percentile (lower bound of a one-sided 95% credible interval) using the same normal approximation: \`max(0, mean − 1.645 × SE)\`. The 1.645 factor is the z-score for the 5th percentile of the standard normal distribution.

### Why Include Pseudoobservations in Variance

For the provenance factor, the *C* = 20 pseudoobservations contribute to the variance calculation as well as the mean. This is more than a mathematical convenience — it provides a specific form of regularization. An artisan whose real scores are near the prior mean of 2.0 will have their variance *reduced* by the pseudoobservations (they agree with the data). An artisan with extreme scores (all 10.0) will have their variance *increased* (the pseudoobservations disagree). This causes the lower bound to drop more aggressively for artisans whose extreme scores conflict with the prior — exactly the behavior we want for small samples with suspiciously high averages.

### Convergence

Both metrics converge to their underlying true values as sample size increases. For elite factor, the lower credible bound approaches the raw elite rate. For provenance factor, it approaches the unweighted average prestige score. With enough data, the prior becomes irrelevant — the evidence speaks for itself. The Bayesian machinery matters most at the margins, where data is thin and uncertainty is high.

### Statistical Lineage

The Beta-Binomial model for elite factor has antecedents in Evan Miller's 2009 formulation for ranking product reviews and the Wilson score interval for binomial proportions. The shrinkage estimator for provenance factor follows the empirical Bayes tradition of James and Stein (1961), with the pseudoobservation approach providing a concrete prior structure. The specific application to artisan ranking in the Japanese sword designation record builds on Darcy Brockbank's pioneering work quantifying NBTHK designation patterns, extending it with Bayesian uncertainty quantification.

---

## Appendix: Implementation Reference

| Component | Elite Factor | Provenance Factor |
|-----------|-------------|-------------------|
| **Model** | Beta-Binomial | Normal with pseudoobservations |
| **Prior** | Beta(1, 9) | C=20 obs at m=2.0 |
| **Helper function** | \`beta_lower_95(a, b)\` | \`shrinkage_lower_95(n, Σs, Σs², C, m)\` |
| **Batch function** | \`compute_maker_statistics()\` | \`compute_provenance_factor()\` |
| **Per-code function** | \`recompute_artisan_stats(codes)\` | \`recompute_provenance_factor(codes)\` |
| **Tables** | artisan_makers, artisan_schools | artisan_makers, artisan_schools |
| **Column type** | NUMERIC(5,4) | NUMERIC(4,2) |
| **Value range** | 0.0000–0.6388 | 1.77–5.21 |
| **Population** | 13,463 makers + 206 schools | 687 with data |
`;

/* ─── Component ──────────────────────────────────────────────────────── */

export function EliteRankingContent() {
  return (
    <article className="prose-methodology">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {CONTENT}
      </ReactMarkdown>
    </article>
  );
}
