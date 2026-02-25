'use client';

import ReactMarkdown, { Components } from 'react-markdown';

/* ─── Custom components: only what CSS can't handle alone ──────────────── */

const components: Components = {
  // Wrap tables in a scrollable container for mobile
  table: ({ children }) => (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table>{children}</table>
    </div>
  ),
};

/* ─── Markdown content (adapted from docs/ELITE_FACTOR_METHODOLOGY.md) ── */

const CONTENT = `## The Problem

How do you rank a swordsmith who has one Tokubetsu-Jūyō blade against one who has seventeen? On the surface, the first smith has a 100% elite rate; the second, perhaps 20%. But no serious scholar would place the unknown smith above Kotetsu on the strength of a single data point.

This is the **small-sample problem**, and it appears throughout the NBTHK designation record. Of the roughly 13,000 artisans in our index, many have only one or two designated works. A handful have hundreds. Any ranking system must handle both extremes gracefully, rewarding genuine excellence while refusing to be fooled by statistical flukes.

## What Counts as "Elite"

The elite factor measures the proportion of an artisan's designated works that achieved the highest tiers of recognition. We define **elite designations** as:

| Designation | Japanese | Weight |
|---|---|---|
| Kokuhō | National Treasure | Elite |
| Tokubetsu-Jūyō | Special Important | Elite |
| Jūyō-Bunkazai | Important Cultural Property | Elite |
| Jūyō-Bijutsuhin | Important Art Object | Elite |
| Gyobutsu | Imperial Collection | Elite\\* |
| Jūyō-Tōken | Important Sword | Standard |

\\*Gyobutsu is excluded from the elite count for artisans active after 1392 (Muromachi period onward), where Imperial Collection status more often reflects political provenance than NBTHK-assessed quality.

The raw inputs are simply two integers: **elite count** (*e*) and **total designated works** (*n*).

## Prior Art: Brockbank's Pass Factor

The concept of measuring artisan stature through designation ratios originates with Darcy Brockbank, whose **pass factor** offered a pioneering quantitative lens on the NBTHK record. Brockbank's insight was straightforward: if a smith's works are repeatedly elevated from Jūyō to Tokubetsu-Jūyō, that pattern reveals something about the smith's quality that raw Jūyō counts alone cannot capture.

The pass factor was computed as a simple ratio:

\`\`\`
pass_factor = elite_designations / juyo_designations
\`\`\`

This was a significant conceptual advance. Before Brockbank, discussions of artisan stature were purely qualitative — one either "knew" that Masamune was great or one didn't. The pass factor made the argument empirical. It asked: *what does the designation record itself tell us about who the NBTHK consistently elevates?*

The elite factor builds directly on Brockbank's foundation. It preserves his core insight — that the *rate* of elite designation is more informative than the *count* — while addressing two limitations that emerge when the idea is applied at scale across the full artisan index.

## Where the Raw Ratio Breaks Down

### The small-sample problem

Brockbank's pass factor works beautifully for well-documented smiths. For Masamune, with dozens of designated works, the ratio is stable and meaningful. But the NBTHK record contains roughly 13,000 artisans, and most have only one or two designated works. A smith with 1 Tokubetsu-Jūyō out of 1 total scores a perfect 1.000 — higher than Masamune, higher than Tomonari, higher than anyone. This is not a flaw in Brockbank's reasoning; it is a consequence of applying any ratio to a dataset with extreme variance in sample size.

### Raw count: *e*

The opposite approach — ranking by raw elite count — rewards prolific artisans regardless of quality. Nagamitsu, with 115 elite works out of 250, would dominate the rankings despite a 46% elite rate. Meanwhile, Tomonari's extraordinary 97% rate (29 out of 30) would be invisible.

### The Laplace estimator: *(e + 1) / (n + 2)*

Adding pseudocounts (a technique dating to Laplace in the 18th century) helps with the zero-division problem but still overestimates small samples. A 1/1 artisan scores 0.667, placing them above most of the greatest smiths in history.

The fundamental issue is that all point estimates — whether the raw ratio or a smoothed version — collapse uncertainty into a single number without accounting for how *confident* we should be in that estimate. What we need is a way to preserve Brockbank's ratio for artisans with substantial records while honestly expressing our ignorance about artisans with thin ones.

## The Bayesian Framework

Bayesian inference offers an elegant solution. Rather than estimating a single "elite rate," we model our *entire state of belief* about an artisan's true quality as a probability distribution. We then extract a conservative summary of that distribution — one that explicitly penalizes uncertainty.

### The Beta-Binomial Model

We model each artisan's true elite rate *θ* as a draw from a Beta distribution. Given the observed data, Bayes' theorem gives us the **posterior distribution**:

\`\`\`
Prior:      θ ~ Beta(α₀, β₀)
Likelihood: e | θ ~ Binomial(n, θ)
Posterior:  θ | e, n ~ Beta(α₀ + e, β₀ + n − e)
\`\`\`

The Beta distribution is the *conjugate prior* for binomial data, meaning the posterior has the same functional form as the prior. This makes the math clean and the computation exact.

### Choosing the Prior: Beta(1, 9)

The prior encodes our belief about an artisan's elite rate *before* seeing any data. We use **Beta(1, 9)**, which:

- Has a prior mean of 1/10 = 0.10, reflecting the base rate across all artisans (roughly 10% of designated works achieve elite status)
- Is mildly skeptical — it takes real evidence to push an artisan's score above the baseline
- Has a total weight of 10 pseudocounts, equivalent to having already observed 1 elite work out of 10 total — enough to regularize small samples without overwhelming large ones

After observing *e* elite works out of *n* total, the posterior becomes:

\`\`\`
θ | data ~ Beta(1 + e, 9 + n − e)
\`\`\`

For Masamune (59 elite, 93 total), the posterior is Beta(60, 43). For an unknown smith with 1/1, it is Beta(2, 9). The shapes of these distributions tell the full story: Masamune's is a tight peak near 0.58, while the 1/1 smith's is a wide, uncertain smear.

### The Lower Credible Bound

Rather than report the posterior mean (which is just another point estimate), we extract the **5th percentile** of the posterior — the lower bound of a one-sided 95% credible interval. This answers the question:

> *"What elite rate can we be 95% confident this artisan exceeds?"*

This is the key insight. For well-documented artisans, the posterior is narrow and the lower bound sits close to the mean. For poorly-documented artisans, the posterior is wide and the lower bound drops toward zero. **Uncertainty itself becomes the penalty.**

### Computing the Bound

For a Beta(*a*, *b*) distribution:

\`\`\`
mean   = a / (a + b)
stddev = √( a · b / ((a + b)² · (a + b + 1)) )

elite_factor = max(0, mean − 1.645 · stddev)
\`\`\`

The factor 1.645 corresponds to the 5th percentile of a standard normal distribution. This normal approximation to the Beta quantile is accurate when both *a* ≥ 1 and *b* ≥ 1, which is guaranteed by our prior (the smallest possible values are *a* = 1+0 = 1 and *b* = 9+0 = 9, for a zero-item artisan).

## Worked Examples

### Tomonari: 29 elite out of 30 total

\`\`\`
Posterior: Beta(30, 10)
Mean:      30 / 40 = 0.7500
Stddev:    √(30 · 10 / (1600 · 41)) = 0.0677
Lower 95%: 0.7500 − 1.645 × 0.0677 = 0.6388
\`\`\`

Tomonari's extraordinary record — virtually every designated work achieving elite status — survives scrutiny. With 30 observations, the posterior is tight, and the lower bound remains high.

### Masamune: 59 elite out of 93 total

\`\`\`
Posterior: Beta(60, 43)
Mean:      60 / 103 = 0.5825
Stddev:    √(60 · 43 / (10609 · 104)) = 0.0484
Lower 95%: 0.5825 − 1.645 × 0.0484 = 0.5030
\`\`\`

Masamune ranks fifth among swordsmiths — reflecting his dominant but not singular position in the designation record, where his prolific output dilutes his rate relative to smaller but more concentrated portfolios.

### Kotetsu: 17 elite out of 75 total

\`\`\`
Posterior: Beta(18, 67)
Mean:      18 / 85 = 0.2118
Stddev:    √(18 · 67 / (7225 · 86)) = 0.0441
Lower 95%: 0.2118 − 1.645 × 0.0441 = 0.1393
\`\`\`

A large body of Jūyō work anchors Kotetsu's score. His 17 elite pieces out of 75 give a reliable estimate.

### An unknown smith: 1 elite out of 1 total

\`\`\`
Posterior: Beta(2, 9)
Mean:      2 / 11 = 0.1818
Stddev:    √(2 · 9 / (121 · 12)) = 0.1109
Lower 95%: 0.1818 − 1.645 × 0.1109 = −0.0007 → max(0, …) = 0.0000
\`\`\`

One data point tells us almost nothing. The posterior is so wide that its lower bound touches zero. The model correctly refuses to rank this artisan above anyone with a substantial track record.

## Results

### Swordsmiths (Top 15)

| Rank | Artisan | Elite | Total | Elite Factor |
|------|---------|-------|-------|-------------|
| 1 | Tomonari | 29 | 30 | 0.6388 |
| 2 | Yoshimitsu | 41 | 55 | 0.5493 |
| 3 | Mitsutada | 43 | 61 | 0.5256 |
| 4 | Masatsune | 19 | 21 | 0.5060 |
| 5 | Masamune | 59 | 93 | 0.5030 |
| 6 | Sukezane | 31 | 44 | 0.4836 |
| 7 | Sa | 45 | 79 | 0.4302 |
| 8 | Kuniyoshi | 30 | 51 | 0.4038 |
| 9 | Kanehira | 21 | 32 | 0.3985 |
| 10 | Nagamitsu | 115 | 250 | 0.3955 |
| 11 | Yoshifusa | 29 | 51 | 0.3874 |
| 12 | Moriie | 19 | 30 | 0.3715 |
| 13 | Yukihira | 22 | 37 | 0.3707 |
| 14 | Kunitsuna | 14 | 19 | 0.3672 |
| 15 | Sadamune | 44 | 91 | 0.3646 |

### Tosogu Artists (Top 10)

| Rank | Artisan | Elite | Total | Elite Factor |
|------|---------|-------|-------|-------------|
| 1 | Sōmin | 25 | 51 | 0.3229 |
| 2 | Kaneie | 20 | 42 | 0.2930 |
| 3 | Yasuchika | 28 | 76 | 0.2538 |
| 4 | Jōi | 7 | 12 | 0.1986 |
| 5 | Myōju | 8 | 22 | 0.1525 |
| 6 | Natsuo | 14 | 75 | 0.1088 |
| 7 | Toshinaga | 6 | 23 | 0.0968 |
| 8 | Matashichi | 7 | 52 | 0.0596 |
| 9 | Gotō Yūjō | 6 | 41 | 0.0588 |
| 10 | Gotō Ichijō | 9 | 79 | 0.0576 |

## Properties of the Ranking

### Self-correcting with evidence

As more works are designated, the posterior narrows and the score converges to the true elite rate. A 1/1 artisan who later gains 9 more Jūyō works (0 elite) will see their score remain at zero. One who gains 9 more elite works will rise dramatically. The model responds to evidence, not to the accident of when we first encountered the data.

### Monotonic in both elite count and elite rate

Holding the total constant, adding an elite work always increases the score. Holding the elite count constant, adding a non-elite work always decreases it. There are no paradoxical reversals.

### Scale-appropriate skepticism

The penalty for small samples is not a fixed deduction but an emergent property of Bayesian uncertainty. An artisan with 3 elite out of 3 total (score: 0.1265) is penalized heavily; one with 30 elite out of 30 (score: 0.6388) is penalized only slightly. The model recognizes that thirty observations establish a pattern while three do not.

### Robust to the long tail

The NBTHK designation record follows a heavy-tailed distribution: a few artisans have hundreds of works, most have fewer than five. The lower credible bound handles this gracefully. It does not need to bin artisans by sample size or apply ad hoc thresholds — the mathematics handles the full continuum.

## From Pass Factor to Elite Factor

The elite factor is, at its core, Brockbank's pass factor run through a Bayesian confidence filter. For artisans with large bodies of work, the two measures converge — the lower credible bound approaches the raw ratio as evidence accumulates. The difference is entirely in the treatment of uncertainty. Where the pass factor gives every artisan's ratio equal weight regardless of sample size, the elite factor asks how much of that ratio we can *trust*.

This is not a repudiation of Brockbank's approach but its natural extension. The pass factor answered the right question — *what proportion of an artisan's works achieve elite status?* — and the elite factor answers the follow-up: *how confident are we in that proportion?*

## Statistical Lineage

The Beta-Binomial model has been used for ranking problems since at least the mid-20th century, and lower credible bounds appear in fields ranging from pharmaceutical quality control to online recommendation systems (notably Evan Miller's 2009 formulation for ranking product reviews, and the Wilson score interval for binomial proportions). The specific application to artisan ranking in the Japanese sword designation record builds on Darcy Brockbank's pioneering work quantifying NBTHK designation patterns, extending it with Bayesian uncertainty quantification to handle the full range of sample sizes present in the artisan index.

The prior Beta(1, 9) was selected by calibration against the empirical base rate of elite designations across the full NBTHK record, and validated by expert review of the resulting rankings against scholarly consensus on artisan stature.
`;

/* ─── Component ──────────────────────────────────────────────────────── */

export function EliteRankingContent() {
  return (
    <article className="prose-methodology">
      <ReactMarkdown components={components}>{CONTENT}</ReactMarkdown>
    </article>
  );
}
