# Paywall Design

## Thesis

**Gate speed, not access. Gate insight, not inventory.**

Everyone sees every item. Paying gives you time advantage and decision-making tools. The more you spend on swords, the more those advantages are worth — and the more you'll naturally encounter the gates that unlock them.

The features self-select the customer. The customer self-triages into the right tier. No tricks. Just math so obvious the upgrade sells itself.

---

## How Self-Selection Works

### The collector spending $3K/year

Browses Hozon blades. Favorites a few wakizashi. Sees the lock card: "12 new items this week." Doesn't care — the items they want sit for weeks. Maybe upgrades to Pro eventually for alerts on TokuHo tantos. $25/mo. Fair.

They never click artist stats. Never request a setsumei. Never set a Juyo alert. **They never see the Collector paywall.** It doesn't exist in their universe.

### The collector spending $80K/year

Searches Juyo katana by specific smiths. Clicks an artist profile — hits the Collector gate on certification stats. Requests a setsumei translation — hits the gate again. Sets a saved search for Juyo by Osafune school — gets Pro-level alerts (delayed for Juyo items). Sees a Juyo they wanted sell before their alert arrived.

The math: one missed Juyo = $20K-$80K opportunity cost. $99/mo = $1,188/year. **They'd pay ten times that to never miss a listing again.** They upgrade to Collector not because we convinced them, but because not upgrading is obviously more expensive.

### The collector spending $300K/year

Already a Collector. Knows every smith's Juyo rate. Gets 15-minute alerts on every Tokubetsu Juyo listing. But the best swords — the ones worth $150K+ — never hit the public sites. They're sold through relationships.

This collector doesn't need a paywall. They need an invitation. Inner Circle: private listings, LINE access to advisors, a community of peers who share deal flow. $249/mo. Application-based. No paywall modal — a dedicated page.

---

## Three Gating Axes

Each axis naturally correlates with collector spending level. Together they create a pricing surface where every collector lands on the tier that matches their value captured.

### Axis 1: Time (the strongest lever)

A fairly-priced Juyo katana sells in hours. A $3K Hozon wakizashi sits for weeks. The time advantage you get from paying directly correlates with the value of what you're buying.

| Tier | What you see | What this means |
|------|-------------|----------------|
| Free | Everything, **7 days late** | Full catalog, but the best deals are gone. Fine for learning and browsing. |
| Pro | Everything, **instantly** | 7-day head start. First mover on every new listing across 44 dealers. |
| Collector | Everything instantly + **15-min Juyo/Tokuju alerts** | The competitive edge. You know about a new Juyo before anyone outside the dealer's shop. |

**Why 7 days, not 72h:**
- 72h is barely noticeable — most inventory sits for weeks
- 7 days means the fast-moving items (underpriced Juyo, rare tosogu) are sold before free users see them
- The items that remain after 7 days are still a full, useful catalog for browsing and learning
- Risk of pushing free users to dealer sites is mitigated: checking 44 sites individually is painful — that's why they came to NihontoWatch

### Axis 2: Insight (the natural segmenter)

These features are worthless at $3K/year and essential at $80K/year. No one needs to be told which tier to pick — their behavior tells us.

| Feature | Who needs it | Who doesn't | Tier |
|---------|-------------|-------------|------|
| Artist certification stats | Evaluating a $80K Juyo | Browsing Hozon | Collector |
| Setsumei translations | Buying papered swords ($5K+) | Buying unpapered | Collector |
| Blade form & mei analysis | Comparing smiths at $50K+ | Casual browsing | Collector |
| Provenance (denrai, lineage) | Verifying $100K+ pedigree | Not at this level | Collector |

A beginner never clicks artist stats because they don't know what elite factor means. A Juyo collector clicks it on every sword. **The gate IS the segmentation.**

### Axis 3: Alert Priority (the self-triage mechanism)

This is where collectors honestly identify their own value level:

| Tier | Alert speed | For which items |
|------|------------|-----------------|
| Free | No alerts | — |
| Pro | 15-min alerts | All certs **except** Juyo & Tokuju |
| Collector | 15-min alerts | **Everything including Juyo & Tokuju** |

**Why this self-triages perfectly:**

A TokuHo collector ($3K-$15K per sword) doesn't need 15-minute Juyo alerts — they're not buying Juyo. Pro alerts are fine. $25/mo.

A Juyo collector ($20K-$200K per sword) knows that a good Juyo at a fair price sells the same day. A 15-minute alert is the difference between acquiring and missing. One missed piece costs more than a decade of Collector subscription. $99/mo is a rounding error on their spending.

They're not being tricked. The cost of NOT upgrading is so obviously larger than the subscription that the decision makes itself. That's value-based pricing.

---

## The Lock Card

Free users see ONE aggregated card at the top of browse results. Not per-item locks — those clutter the grid and feel punitive.

### For free users (browsing)

```
┌─────────────────────────────────────────────┐
│                                             │
│   12 new items listed this week             │
│                                             │
│   Pro members are seeing these now          │
│                                             │
│   [ See them now ]                          │
│                                             │
└─────────────────────────────────────────────┘
```

- Dynamic count (updates daily)
- One card, top of results, above the first listing
- Matches app design (cream/ink, not a flashy banner)
- CTA opens Pro paywall
- The items aren't hidden forever — they appear after 7 days
- The card disappears for Pro+ users

### For Pro users (browsing Juyo/Tokuju filters)

```
┌─────────────────────────────────────────────┐
│                                             │
│   Get 15-min alerts for Juyo listings       │
│                                             │
│   Never miss a new Juyo at a fair price     │
│                                             │
│   [ Upgrade to Collector ]                  │
│                                             │
└─────────────────────────────────────────────┘
```

- Only shows when filtering by Juyo or Tokuju cert types
- Contextual — appears when the user is demonstrating Juyo interest
- Disappears for Collector+ users

### Why one card works

| Per-item locks | One card |
|----------------|----------|
| 47 locks staring at you | One gentle indicator |
| Feels punitive | Feels informative |
| Clutters the grid | Clean browse experience |
| Users get angry | Users get curious |
| "I can't use this site" | "I'm missing 12 items" |

---

## Tier Structure

### Free — Browse everything (7-day delay)

- Browse all listings (7 days after listing)
- Full filters and search
- Favorites
- Currency conversion
- Lock card shows count of delayed items

### Pro ($25/mo) — See everything first

- **All items instantly** (7-day advantage)
- AI inquiry emails (10% tax-free export hack)
- Saved searches & 15-min alerts (all certs except Juyo/Tokuju)
- CSV exports

**Value prop**: one tax-free inquiry email on a $300 tsuba pays for a year of Pro. The 7-day advantage means you see deals before 90% of the market.

### Collector ($99/mo) — The competitive edge

- Everything in Pro
- **15-min alerts for Juyo & Tokuju** (the killer feature)
- Artist certification stats & rankings
- Setsumei translations
- Blade form & signature analysis
- Full provenance data (denrai, lineage)

**Value prop**: missing one fairly-priced Juyo because your alert was slow costs more than a decade of Collector. $1,188/year is 1-2% of a serious collector's annual spend.

### Inner Circle ($249/mo) — Invite-only

- Everything in Collector
- Private dealer listings (the best swords never go public)
- LINE with Hoshi ($500/hr advisor for $249/mo)
- Exclusive collector community (deal flow from peers)

**Not a paywall.** Application or invitation. Dedicated page. These collectors know what they want.

---

## Paywall Screens

### Pro Paywall (free user hits gate)

```
┌─────────────────────────────┐
│                             │
│            Pro              │
│                             │
│  ✓  See all items instantly │
│  ✓  AI inquiry emails       │
│  ✓  Saved searches & alerts │
│  ✓  CSV exports             │
│                             │
│          $25/mo             │
│                             │
│  ┌─────────────────────┐    │
│  │      Continue        │    │
│  └─────────────────────┘    │
│                             │
│  No commitment, cancel      │
│  anytime                    │
│                             │
│        Not now              │
│                             │
└─────────────────────────────┘
```

"See all items instantly" — implies you're missing things right now. Because you are.

### Collector Paywall (Pro user hits gate)

```
┌─────────────────────────────┐
│                             │
│          Collector          │
│                             │
│  ✓  Priority Juyo alerts    │
│  ✓  Artist stats & rankings │
│  ✓  Setsumei translations   │
│  ✓  Blade form analysis     │
│                             │
│          $99/mo             │
│                             │
│  ┌─────────────────────┐    │
│  │      Continue        │    │
│  └─────────────────────┘    │
│                             │
│  No commitment, cancel      │
│  anytime                    │
│                             │
│        Not now              │
│                             │
└─────────────────────────────┘
```

"Priority Juyo alerts" is bullet #1. That's the feature that makes the value math undeniable. If you're looking at Juyo items and you know your alerts are delayed — you already know you need this.

---

## Design Rules (Parra / Superwall)

1. **No verbage** — bullets are 2-4 words. No sentences, no descriptions.
2. **Simple plan naming** — "Pro" or "Collector". One word. No app name prefix.
3. **"No commitment, cancel anytime"** — below CTA. Always. Conversion bump on every paywall.
4. **"Continue" not "Subscribe"** — soft CTA. Forward momentum, not a transaction.
5. **CTA is the only colored element** — everything else neutral.
6. **Big button** — full-width, ~4rem+ height.
7. **Match the app** — cream/ink palette, serif headings. Native look wins.
8. **One price per paywall** — Pro shows $25/mo. Collector shows $99/mo. Never both.

---

## Feature-to-Tier Mapping

| Feature | Tier | Internal code | Gate trigger |
|---------|------|--------------|-------------|
| `fresh_data` | Pro | `enthusiast` | Lock card in browse |
| `inquiry_emails` | Pro | `enthusiast` | Clicking "Inquire" |
| `saved_searches` | Pro | `enthusiast` | Clicking "Save search" |
| `search_alerts` | Pro | `enthusiast` | Enabling alert |
| `export_data` | Pro | `enthusiast` | Clicking export |
| `priority_juyo_alerts` | Collector | `collector` | Enabling Juyo/Tokuju alert |
| `artist_stats` | Collector | `collector` | Viewing artist profile stats |
| `setsumei_translation` | Collector | `collector` | Requesting setsumei |
| `blade_analysis` | Collector | `collector` | Viewing form/mei analysis |
| `provenance_data` | Collector | `collector` | Viewing denrai/lineage |
| `private_listings` | Inner Circle | `inner_circle` | Application page |
| `line_access` | Inner Circle | `inner_circle` | Application page |
| `yuhinkai_discord` | Inner Circle | `inner_circle` | Application page |

---

## Implementation

### Code changes

1. Add `collector` tier to `SubscriptionTier` type
2. Display names: `enthusiast` → "Pro", `collector` → "Collector"
3. Move `setsumei_translation`, `artist_stats` to `collector` in `FEATURE_MIN_TIER`
4. Add features: `priority_juyo_alerts`, `blade_analysis`, `provenance_data`
5. Data delay: 72h → 7 days
6. New `DelayedItemsCard` component for browse grid (lock card)
7. Alert splitting: cron checks subscriber tier, skips Juyo/Tokuju for Pro-only users
8. Stripe: new price IDs for Collector ($99/mo, $999/year)
9. `PaywallModal`: hardcoded bullet lists per tier
10. Inner Circle: separate `/inner-circle` page with application form

### PaywallModal simplification

Strip: sparkle icon, feature title + paragraph, "Requires [Tier]" badge, billing toggle, annual math, dynamic feature lists, "Upgrade to [Tier]", "Maybe later"

Keep: animations, swipe-to-dismiss, escape/backdrop dismiss, scroll lock, portal rendering, LoginModal, `checkout()` → Stripe

### Mobile
Full-screen bottom sheet, drag handle, content centered, CTA near bottom with safe area, zero scroll.

### Desktop
Centered modal, max-width ~400px, same content.

---

## A/B Tests (once baseline is live)

| Test | Hypothesis |
|------|-----------|
| 3 bullets vs 4 | Fewer = less cognitive load |
| Bullet order | Lead with priority alerts or instant access? |
| Lock card position | Top of results vs inline at position 3 |
| Lock card copy | "12 new items" vs "12 items you haven't seen" |
| 5-day vs 7-day delay | Sweet spot for urgency vs retention |
| $79 vs $99 Collector | Price sensitivity |
| Dark bg for Collector paywall | Premium contrast = different feel |
| "Continue" vs chevron arrow | Button styling |
| Alert speed messaging | "15-minute" vs "Instant" vs "Priority" |

---

## Sources

- **Jonathan Parra** (Superwall lead designer, 4,500+ paywalls) — Consumer Club podcast
- [5 Paywall Patterns Used By Million-Dollar Apps](https://superwall.com/blog/5-paywall-patterns-used-by-million-dollar-apps/)
- [Superwall Best Practices & Experiments](https://superwall.com/blog/superwall-best-practices-winning-paywall-strategies-and-experiments-to/)
- [4 Lessons from Indie App Teardown](https://superwall.com/blog/4-lessons-learned-from-an-indie-app-paywall-teardown)
- [20 iOS Paywalls in Production](https://superwall.com/blog/20-ios-paywalls-in-production/)
