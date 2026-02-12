# Paywall Strategy — Conceptual Design

**Status:** Conceptual brainstorm (not implemented)
**Last Updated:** 2026-02-10

---

## Core Thesis

**"Gate speed, not access. Gate insight, not inventory."**

The paywall should be invisible until a collector's behavior reveals their spending tier. What you click on, what you search for, what you want alerts on — these actions naturally expose whether you're a ¥500K buyer or a ¥50M buyer. The subscription tiers map to spending levels, and the features gated at each tier only matter at that spending level.

A casual browser never hits a wall. A Juyo hunter only hits walls that a Juyo hunter cares about.

### The Framing Principle

**Never frame tiers as spending limits. Frame them as depth of intelligence.**

The more seriously you collect, the more you need — not because you spend more, but because your questions get harder. A casual browser needs to see what's for sale. An active collector needs to stay current. A serious collector needs to see what others miss. An elite collector needs to see it first.

The tiers map to this naturally:

```
Free:         "Browse the market"
Pro:          "Stay current"
Collector:    "See what others miss"
Inner Circle: "See it first"
```

This means:
- **Never say "budget"**, "price limit", "spending range", or "collecting range" in user-facing copy
- **Never show a price cap as a number** — the user should not see "¥5M limit" anywhere
- The price cap is a real mechanism but an invisible one — the user experiences it as "Collector offers deeper market intelligence" not "Pro has a ceiling"
- The "You Missed It" message says **"3 additional matches found"** not "3 items above your budget"
- Upgrade prompts frame the next tier as **richer capability** not **higher access**

The feeling should be: "I've gotten deeper into collecting and now I need tools that match where I am." Not: "I need to pay more to see expensive things."

---

## The Spending Hierarchy in Nihonto

The hobby has a natural ladder:

| Collector Level | Typical Purchase | Behavior on Site |
|---|---|---|
| **Curious browser** | Nothing / ¥100K-500K | Browses, reads, saves favorites |
| **Active collector** | ¥500K-5M | Saves searches, sends inquiries, monitors new inventory |
| **Serious collector** | ¥5M-20M | Hunts certified pieces, evaluates smith pedigree, reads setsumei |
| **Elite collector** | ¥20M-200M+ | Targets Juyo/TJ by specific smiths, needs first-mover advantage, buys "capable of" arbitrage |

The tiers should map to this ladder, and the gates should only trigger when behavior reveals which rung you're on.

---

## How Actions Reveal Spending Tier

| Action on Site | What It Reveals | Natural Tier |
|---|---|---|
| Browse, filter, favorite | "I'm interested" | Free |
| Save a search | "I'm actively monitoring the market" | Pro |
| Send inquiry email | "I'm ready to buy" | Pro |
| Frustrated by 7-day delay | "I missed a piece I wanted" | Pro |
| Click Juyo/TJ items repeatedly | "I buy at the Juyo level" | Collector |
| Read setsumei preview, want more | "I evaluate NBTHK certification descriptions" | Collector |
| Look at artist Juyo/TJ record | "I'm researching smith pedigree before buying" | Collector |
| Want alert when Juyo-capable smith appears at lower cert | "I do certification arbitrage" | Collector |
| Want to see off-market inventory | "I've exhausted public inventory" | Inner Circle |
| Want 15-min head start over Collector tier | "I compete for the rarest pieces" | Inner Circle |

---

## Tier Design

### Free ($0)
**Full catalog access.** Every listing, every filter, every dealer. No restrictions on what you can see (except the 7-day delay). This is critical — we want eyeballs, SEO traffic, and market dominance. Free users are future paying users.

**What free users experience:**
- Browse all listings (7 days delayed)
- Full filters, search, favorites, currency conversion
- Artist directory with names, eras, provinces, schools (reference data)
- See the **Delayed Items Card** (conversion tool, see below)

### Pro ($25/mo) — "Stay Current"
**For collectors who are actively buying.** You've moved past browsing — you're monitoring the market, reaching out to dealers, and you can't afford to see things a week late.

**Features:**
- Fresh data (no 7-day delay)
- Alerts on saved searches
- AI inquiry email drafts
- Data exports

**Internal mechanism:** Alerts are price-capped at ~¥5M. The user never sees this number. They experience Pro as "alerts on new listings matching your search." The cap is invisible — items above it simply aren't matched. The user doesn't know what they're not seeing, and for a buyer in the ¥500K-5M range, nothing important is missing.

**Why this works:** $25/mo is noise on a ¥1M purchase. The features match what an active collector actually needs. The cap is irrelevant at this stage because the user isn't shopping above it — and if they start to, the "additional matches" retrospective naturally nudges them toward Collector.

### Collector ($99/mo) — "See What Others Miss"
**For serious collectors whose questions have gotten harder.** You're not just monitoring — you're evaluating smith pedigree, reading certification descriptions, and looking for pieces with upside potential.

**Features:**
- Everything in Pro
- **Deeper alert intelligence** — matches that Pro doesn't surface (uncapped price, "Ask" items from elite makers, "capable of" signals)
- **"Capable of" alerts** — alerted when a Juyo-capable smith's work appears below Juyo, or TJ-capable below TJ. The arbitrage signal.
- Setsumei translations (NBTHK certification descriptions — only exist on Juyo+ items)
- Full artist analytics (elite factor, blade form stats, mei analysis, lineage)
- **"Watch this smith"** — get alerted for any item by a specific smith, any dealer
- Days on market indicator
- Full "capable of" context on artist profiles (the analytical layer behind the free certification pyramid)

**User-facing framing:** "Collector sees deeper — unlisted-price items, smith pedigree signals, certification upside." Never: "Collector has no price limit." The value is intelligence depth, not access breadth.

**Why this works:** Every feature here becomes relevant when collecting gets serious. Setsumei only exist on Juyo+ items. "Capable of" signals are arbitrage that only matters at the Juyo level. Artist analytics inform decisions where the stakes are ¥5M+. $99/mo pays for itself on a single transaction the user wouldn't have found without the intelligence.

### Inner Circle ($249/mo) — "See It First" — APPLICATION MODEL
**For collectors who compete for the rarest pieces.** At this level, you're not just seeing opportunities — you need to see them before other serious collectors do. And you need dealers to take you seriously.

**Application-based, not open purchase.** Brief application: "What do you collect? What's your collecting history? What are you looking for?" The filter is what makes the credential valuable — dealers trust the room because not everyone can walk in.

**Features:**
- Everything in Collector
- **Time priority on alerts** — Inner Circle gets alerts before Collector tier
- **Private dealer offerings** — pre-market, estate, and withdrawal-price items shared with credentialed audience
- **Credentialed inquiry signature** — inquiry emails carry "NihontoWatch Inner Circle" verification that dealers learn to trust
- **Community participation** — interact with peers and dealers in a verified space
- Yuhinkai Discord / dedicated channel
- Direct LINE support

**User-facing framing:** "First access to the most significant pieces." Not a software upgrade — a seat at the table.

**The credential flywheel:**
```
Serious collectors apply and join (credentialed audience)
    → Dealers trust the audience → share pre-market inventory
    → Better inventory → more serious collectors apply
    → Larger credentialed audience → dealers share even more
    → Platform becomes the room where deals happen
```

**Why this is a club, not a subscription:** Nobody cancels their membership at the club where the best dealers know them by name. Features can be copied. The credentialed network can't.

---

## The Price Cap Debate

### The Concept

Your paid tier sets a ceiling on the price of items you get alerted about. Items above your cap? You simply miss them. You can still find them by browsing — the alert is the premium service, and the cap scopes that service.

| Tier | Alert Price Cap | "Ask" Items | Rationale |
|---|---|---|---|
| Pro ($25) | ¥5M (~$35K) | Excluded | Covers the active collector range |
| Collector ($99) | No cap | Included | Juyo/TJ routinely ¥10M-100M+ |
| Inner Circle ($249) | No cap + time priority | Included | Same items, earlier delivery |

### Why It's Fair

1. **Proportional value.** The alert on a ¥50M piece is worth incomparably more than the alert on a ¥800K piece. Charging more for higher-value information is honest.

2. **Self-sorting.** You only need to upgrade when you're shopping above your cap. A ¥2M buyer never feels the ¥5M ceiling. The paywall only triggers when your behavior says you've graduated to the next spending level.

3. **How the real world works.** Auction houses give their best clients first look. Real estate agents tier their service by price range. Dealers themselves hide prices to pre-qualify serious buyers. The cap mirrors existing norms in high-value markets.

4. **The subscription cost is always tiny relative to the purchase.** Nobody spending ¥15M on a Juyo blinks at $99/mo. The price cap ensures the subscription is proportional to what you're buying.

### Why It Might Be Unfair / Risky

1. **"Ask" items are ambiguous.** Many high-value items have no listed price. If we exclude all "Ask" items from Pro alerts, we're cutting out a significant category — and not all "Ask" items are expensive. Some dealers default to "Ask" for everything, even ¥500K pieces. But: "Ask" on a Juyo-capable smith is almost always high-value, and that's the combination that matters most.

2. **The aspiration ladder gets cut.** A Pro user who discovers a ¥12M piece through an alert might fall in love and stretch their budget. That moment drives upgrades organically. With a hard cap, that discovery never happens through alerts (though it can still happen through browsing).

3. **"We saw a match and didn't tell you."** If the user discovers post-hoc that a perfect search match existed above their cap, trust erodes. The difference between "fair" and "unfair" is entirely about whether the cap is communicated transparently upfront.

4. **Arbitrary threshold pain.** A Pro user who misses a ¥5.1M item that matched their search will feel cheated. Any hard line creates edge cases.

### The "Ask" Problem and Resolution

"Ask" / "Price on request" items are the sharpest problem for price caps. They have no listed price, so where do they fall?

**Proposed resolution:** Treat "Ask" items as above any Pro cap. Rationale:
- Dealers hide prices on expensive/significant pieces — "Ask" is itself a signal of high value
- The "Ask" + Juyo-capable combination is the strongest signal in the dataset — these are elite-level items
- Pro users browsing at the ¥1-5M level are rarely inquiring on unlisted-price items anyway
- This gives Collector tier a clean exclusive: all "Ask" items from capable makers in alerts

**Edge case:** Some dealers use "Ask" for everything regardless of price. For these dealers, the "Ask" exclusion from Pro alerts may unfairly block routine items. Possible mitigation: only exclude "Ask" from Pro alerts when the item is from a Juyo/TJ-capable maker. "Ask" items from makers without Juyo designations pass through to Pro alerts normally.

### Alternatives Considered

**Soft cap (time-based, not visibility-based):**
- Pro gets all items in daily digest regardless of price, but instant/15-min alerts only for items under ¥5M
- Collector gets instant alerts on everything
- Avoids the "we didn't tell you" problem — you still get told, just slower
- But undermines the urgency value of Collector tier (if Pro gets everything in daily digest anyway, what are they paying for?)

**Cert-based splitting (no price cap):**
- Pro: daily digest, all certs, all prices
- Collector: instant for Juyo/TJ, daily for others
- Cleanest, no "Ask" ambiguity
- But: a ¥500K Juyo tanto and a ¥50M Juyo katana get the same Collector treatment. Doesn't differentiate within the Juyo tier.
- Also: a ¥8M TokuHo piece is high-value but not Juyo cert. Under cert-based, Pro gets it in daily digest like any other non-Juyo item.

**Hybrid (cert + price):**
- Pro: daily digest for everything + instant for non-Juyo items under ¥5M
- Collector: instant for Juyo/TJ at any price + instant for everything above ¥5M + "capable of" signals
- Inner Circle: everything, earliest
- Most precise but most complex to explain. Users won't understand a two-axis gating model.

### Current Lean

**Hard price cap, invisible to user.** The cap is real (¥5M for Pro) but the user never sees a number. They experience it as: "Collector offers deeper market intelligence" — more matches, more signals, more insight. The upgrade prompt says "3 additional matches found" not "3 items above your budget."

The "Ask" exclusion for Pro (on Juyo/TJ-capable makers) fits naturally because Collector's framing is "see what others miss" — unlisted-price items from elite makers are exactly the kind of hidden opportunity that Collector promises to surface.

**User-facing language:**
- Pro: "Alerts on new listings matching your search"
- Collector: "Deeper alerts — unlisted-price items, smith pedigree signals, certification upside opportunities"
- The word "budget" never appears. The word "limit" never appears. The word "cap" never appears.

**Internal language (code comments, docs):** Use "price cap" freely. It's the mechanism. But it never leaks into UI copy.

---

## Conversion Tools

### 1. Delayed Items Card (Free → Pro)

A card inserted into the browse grid for free users that shows what they're missing due to the 7-day delay.

**Concept:**
```
┌─────────────────────────────────┐
│                                 │
│     12 new items this week      │
│                                 │
│  2 Juyo · 1 Tokubetsu Juyo     │
│  4 Tokubetsu Hozon · 5 other   │
│                                 │
│  You'll see these in 3-7 days.  │
│                                 │
│  [ See new listings first ]     │
│                                 │
│  Pro members get instant access │
│                                 │
└─────────────────────────────────┘
```

**Why this works:**
- The count is concrete — not "you're missing things" but "you're missing **12 things**"
- The cert breakdown is the twist — "2 Juyo" hits differently than just a number. A Juyo collector knows those items could be gone by the time the delay lifts.
- "You'll see these in 3-7 days" is honest — not hiding, just delaying
- The CTA is a benefit — "See new listings first" not "pay us money"

**Placement:** Position ~5 in the browse grid. Early enough to notice, not so early it feels like an ad. Styled to match listing cards but visually distinct (different background, no image).

**Data:** Server counts items with `first_seen_at` within last 7 days, grouped by cert_type. Light query. Cert breakdown shows Juyo/TJ first, aggregates the rest. If user has active filters, only count items matching those filters.

### 2. "Additional Matches" Retrospective (Pro → Collector)

After the monthly cycle, show Pro users that Collector's deeper intelligence found additional matches they didn't receive.

**Concept:** In the saved search management UI or in a monthly email:

```
Your saved search "Juyo katana, Bizen school"

  8 alerts delivered this month
  3 additional matches found with Collector intelligence

  Collector members see deeper — unlisted-price items,
  smith pedigree signals, and certification upside.
```

**Why this framing works:**
- "Additional matches found" — not "items above your budget." Implies Collector has better matching, not that Pro has a ceiling.
- "Collector intelligence" — frames the upgrade as gaining capability, not removing a restriction.
- No price mentioned, no cap mentioned, no spending level implied.
- The user's natural reaction: "What were those 3 additional matches? I want to see them." That curiosity is the conversion moment.
- It's retrospective — no time pressure, no withholding feeling in the moment.

**What it actually is:** Those 3 matches were above the ¥5M price cap or were "Ask" items from Juyo/TJ-capable makers. But the user never knows that's the filter. They just know Collector finds more.

### 3. "Sold Before You Saw It" Counter (Free → Pro)

For free users: when items they would have seen (matching their browsing patterns) sell during the 7-day delay window, show a subtle indicator.

**Concept:** On the DataDelayBanner or Delayed Items Card:

```
3 items sold before your delay window ended this week.
```

**Why this works:**
- It turns the theoretical cost of the delay into a concrete loss
- "Sold" is final — you can't just wait and see it later
- Creates urgency without being dishonest

### 4. Clean Browse Grid — No Badges, No Blurs

**Decision: no "capable of" badges on listing cards.** The browse grid stays clean for everyone. No blurs, no lock icons, no conversion elements on cards. The browse experience is the product — it's how we become the default first stop. Cluttering it with gated badges undermines that.

"Capable of" intelligence surfaces in two places only:
- **Artist profile pages** (behind Collector gate) — the user clicks an artisan name on a card, lands on the profile, and encounters the analytical layer naturally
- **Collector alert emails** — "TokuHo by a smith with 47 Juyo designations"

The artisan name on every listing card is already clickable and links to `/artists/[slug]`. That's the funnel. Users follow their own curiosity to the artist profile, see the certification pyramid for free (the hook), scroll to the analytics (gated), and hit the Collector boundary through their own exploration.

### 5. Artist Profile as Conversion Surface (Free/Pro → Collector)

The artist profile page (`/artists/[slug]`) is a natural conversion moment. Someone navigating to a specific smith's profile is doing research that signals serious intent.

**Free layer (always visible):**
- Smith name, era, province, school affiliation
- Certification pyramid (Juyo/TJ/Kokuho counts) — this is the hook. Impressive, makes you want more.
- "N items for sale" count linking to browse

**Collector layer (gated):**
- Elite factor and ranking
- Blade form statistics (nagasa/sori averages, common forms)
- Mei/signature analysis
- Teacher-student lineage
- "Capable of" indicator on the smith's listed items
- "Watch this smith" button

**The conversion moment:** User arrives at an artist profile, sees the pyramid showing 25 Juyo designations. Scrolls down to see blade form stats — gated. They want to know whether this smith's typical nagasa matches the piece they're considering. That's a Collector moment.

---

## Feature Concepts (Detailed)

### "Watch This Smith" (Collector)

Separate from saved searches. A collector focused on a specific smith wants a simple trigger: "Alert me whenever anything by this smith appears, on any dealer."

**UX:**
- On the artist profile page, Collector users see a "Watch" button
- Clicking creates a persistent watch — system cross-references new listings' `artisan_id` against watched smiths
- Alert delivered at Collector cadence (instant for Juyo+, daily for others)
- Managed in the same UI as saved searches

**Why Collector-tier:**
- Watching a specific smith is expert behavior
- The value scales with the smith's prestige
- Leverages the artisan matching pipeline already built

**Interesting edge case:** What if a Pro user can "Watch" a smith but only gets alerted on items under their price cap? This creates a natural upgrade path — "You're watching Osafune Kanemitsu. 2 items by this smith exceeded your alert budget this month."

### "Capable Of" Concept

Our unique competitive advantage. No other service cross-references real-time dealer inventory with Yuhinkai certification records.

**Definition:**
- A smith is **Juyo-capable** if they have >= 1 existing Juyo designation in the Yuhinkai database
- A smith is **TJ-capable** if they have >= 1 existing Tokubetsu Juyo designation
- A smith is **Bunkazai-capable** if they have Kokuho/Jubun/Jubi/Gyobutsu designations

**The arbitrage opportunity:**
1. TokuHo piece by a Juyo-capable smith appears at ¥3M
2. Collector buys it, submits to next Juyo shinsa
3. It passes → now worth ¥10M+
4. The smith's track record (our data) is what made this opportunity visible

**Product surfaces:**
- **Alert trigger:** "New listing: Tokubetsu Hozon by Osafune Nagamitsu (47 Juyo, 5 TJ). Listed at ¥2,800,000."
- **Browse badge:** Subtle indicator on listing cards (Collector sees data, others see blurred or nothing)
- **Artist profile:** Full certification pyramid, elite factor, historical record (already built, needs gating)

**Alert text for "capable of" items could include:**
- Smith's Juyo/TJ record
- Current cert level vs. capability gap
- Price if listed

### Days on Market (Collector)

Show how long an item has been listed (from `first_seen_at`).

**Why it matters:**
- Juyo piece listed 7 days ago at ¥15M = fair market, moving fast
- Juyo piece listed 180 days ago at ¥15M = overpriced or negotiable
- Casual collectors don't negotiate; serious collectors always do
- Combined with "capable of" — a TokuHo by a Juyo-capable smith that's been sitting 6 months? That's a negotiation target.

---

## Alert System Architecture (Conceptual)

### Alert Routing by Tier

| Signal | Pro ($25) | Collector ($99) | Inner Circle ($249) |
|---|---|---|---|
| Match under price cap | Daily digest | Instant | Instant (first) |
| Match above price cap | **Missed** | Instant | Instant (first) |
| "Ask" from Juyo/TJ-capable maker | **Missed** | Instant | Instant (first) |
| "Capable of" signal | **Not available** | Instant | Instant (first) |
| "Watch this smith" match | N/A (Collector feature) | Instant | Instant (first) |

### The "Capable Of" Alert Pipeline

```
New listing scraped by Oshi-scrapper
    ↓
artisan_matcher identifies smith → artisan_id
    ↓
Look up smith in Yuhinkai: juyo_count, tokuju_count
    ↓
Compare item cert (e.g. Tokubetsu Hozon) vs smith capability (e.g. 15 Juyo)
    ↓
If cert < capability → flag as "capable of" opportunity
    ↓
Check price: above Pro cap or "Ask"? → Collector+ only
Check price: below Pro cap with listed price? → Pro daily + Collector instant
    ↓
Match against saved searches / smith watches
    ↓
Route alert by tier:
  → Inner Circle: immediate
  → Collector: 15-min batch
  → Pro: daily digest (if under cap)
```

Pipeline pieces already built:
- Artisan matcher runs on every scraped listing
- Yuhinkai data has juyo_count, tokuju_count per smith
- Saved search matcher runs every 15 minutes (cron)
- Email delivery via SendGrid

Missing pieces:
- "Capable of" comparison logic in the alert pipeline
- Price cap filtering in saved search matcher
- Tier-based alert routing (currently all users get same cadence)
- "Watch this smith" data model and matching
- "You missed it" retrospective reporting

---

## The Tier as Credential

The subscription isn't just "pay for features." It's a trust signal to Japanese dealers.

### The Problem We Solve

Japanese elite dealers are cautious about foreign buyers:
- Language barrier (our inquiry emails help)
- Trust — "Is this foreigner serious or a tire kicker?"
- Cultural protocol — dealers feel responsibility for where important blades end up
- Access — the best inventory never reaches the public website

A Western collector emailing a Japanese dealer has no way to signal seriousness. Our platform can vouch for them.

### Credentialed Inquiries

When a Collector+ member sends an inquiry through our platform, the email includes a verified sender signature:
- Not "this person pays us $99/month"
- More like: "Inquiry via NihontoWatch Collector" — a trust mark
- Over time, dealers learn that credentialed inquiries are worth responding to
- Inquiry response rate goes up → feature becomes more valuable → tier becomes more worth paying for

For Inner Circle, the credential is strongest: "NihontoWatch Inner Circle — verified collector." That's a white-glove introduction.

### Private Dealer Offers

Once dealers trust the credentialed audience:
- **Pre-market items** — listed on our platform before the dealer's public site
- **Estate pieces** — items dealers want to move quietly
- **Withdrawal-price items** — been sitting, offered to network at reduced price before auction
- The dealer doesn't need to build a CRM — our tiered audience IS their qualified buyer list

### Community Layer

**What the community is NOT:** A general forum (NMB exists), a social network, a place for beginners.

**What the community IS:**
- A credentialed space where every participant is verified serious
- A channel where dealers can reach qualified buyers directly
- Market intelligence that doesn't exist anywhere else (shinsa results, valuations, pre-market)
- A network effect that makes the platform defensible

**Tiered access:**
- **Collector:** Community read access — absorb market intelligence, see discussions. Can't post (keeps signal-to-noise high).
- **Inner Circle:** Full participation — post, discuss, message peers and dealers. Strongest credential.
- **Dealer tier:** Verified dealer presence — post private offers, respond to inquiries, share market context.

---

## The Paywall Modal (Superwall Pattern)

When a user hits a gate, the paywall follows Superwall/Parra principles.

### Rules
1. **No verbage** — Bullets are 2-4 words each. No sentences.
2. **Simple plan naming** — "Pro", "Collector". One word.
3. **"No commitment, cancel anytime"** — Below CTA. Always.
4. **"Continue" not "Subscribe"** — Soft CTA, not transactional.
5. **CTA is the only colored element** — Everything else neutral.
6. **Big button** — Full-width, ~4rem/65pt minimum height.
7. **Match the app's design** — Same fonts, colors, feel as rest of site.
8. **One price, no toggles** — Show monthly price. No billing period toggle.

### Paywall Bullets (2-4 words each, benefits not features)

**Pro paywall:**
- New listings first
- AI inquiry emails
- Saved search alerts
- Data exports

**Collector paywall:**
- Setsumei translations
- Artist stats & analysis
- Priority Juyo alerts
- Blade form insights

### Anti-Patterns (what we must NOT do)
- Feature comparison tables
- Long feature descriptions
- Multiple tiers visible at once
- Billing period toggle
- "Upgrade to [Tier]" CTA
- Small CTA button

### Current PaywallModal Gaps (from code review)

The existing `PaywallModal.tsx` violates several rules:
- Has a **billing period toggle** (monthly/annual) — rule 8
- CTA says **"Upgrade to Pro"** — should be "Continue" per rule 4
- Button is **py-3 (~48px)** — under the 65pt/4rem minimum per rule 6
- Has a **"Requires [Tier]" badge** — unnecessary verbage
- **SparkleIcon with amber gradient** — CTA should be only colored element per rule 5
- Uses **`TIER_INFO` features** for bullets, NOT `PAYWALL_BULLETS` — the 2-4 word bullets we defined are dead code
- Shows a **"Feature Message"** paragraph — no verbage per rule 1

---

## Conversion Flow Summary

```
Free user browses (full catalog, 7 days delayed)
    │
    │── Sees Delayed Items Card ("12 new items, 2 Juyo") → Pro paywall
    │── Sees "3 sold before your delay ended" → Pro paywall
    │── Saves a search → Pro paywall
    │── Clicks "Inquire" → Pro paywall
    │
Pro user actively monitors
    │
    │── Misses items above ¥5M cap → "2 items exceeded your alert budget" → Collector paywall
    │── Misses "Ask" items from capable makers → Collector paywall
    │── Reads setsumei preview, wants full → Collector paywall
    │── Views artist profile, analytics gated → Collector paywall
    │── Sees blurred "capable of" badge → Collector paywall
    │
Collector user hunts Juyo
    │
    │── Wants time priority over other Collectors → Inner Circle
    │── Wants off-market inventory → Inner Circle
    │── Wants community (Discord/LINE) → Inner Circle
    └── (Aspiration/invitation tier, not paywall-driven)
```

---

## Open Questions

1. **Price cap threshold:** ¥5M is a starting point. Needs validation against actual price distribution in the database. What % of listings fall above ¥5M? If it's 5%, the cap is well-placed. If it's 20%, maybe ¥8M or ¥10M is better. The cap should be set so that the vast majority of Pro-level buyers never notice it's there.

2. **"Ask" item handling for non-capable makers:** If a dealer uses "Ask" for everything (even ¥500K items), excluding all "Ask" from Pro alerts is too broad. Proposed: only exclude "Ask" from Pro when the item is from a Juyo/TJ-capable maker. Non-capable "Ask" items pass through to Pro normally. This way the cap only bites on items that genuinely signal elite-level significance.

3. **Artist profile gating granularity:** Certification pyramid free (it's the hook) vs. analytics gated (blade form, mei, elite factor, lineage). The pyramid is impressive and makes people want more — keeping it free is the teaser. The analytics are what you need when you're actually evaluating a purchase. That's the natural Collector moment.

4. **RESOLVED: No badges on browse cards.** The artist name click → profile page is the natural funnel to Collector. No blurs, no badges, no clutter on the browse grid.

5. **Inner Circle acquisition model:** Paywall-triggered or invitation-only? Elite collectors may respond better to exclusivity ("apply to join") than to a price tag. The framing "See it first" works better as aspiration than as a gate.

6. **"Watch this smith" for Pro users?** Interesting edge case. If Pro can watch a smith but only gets alerted on matches within the invisible cap, the "additional matches" retrospective becomes: "2 additional items by Kanemitsu found with Collector intelligence." This is a powerful, natural upgrade nudge that frames Collector as deeper matching — not "you hit your limit."

7. **Delayed Items Card — cert breakdown:** Showing "2 Juyo this week" to free users reveals what's behind the delay. This is powerful FOMO for Juyo collectors. No real downside — aggregate cert counts don't reveal specific items or dealers. The information is: "something significant is there and you can't see it yet."

8. **Daily digest timing:** Currently 8am UTC. Japanese dealers update in JST business hours. Western collectors are sleeping during JST morning. Should digest timing be configurable or optimized? Probably not a launch priority but worth A/B testing.

9. **"Sold before you saw it" — tone:** Showing free users that items sold during their delay is powerful. Framing matters: "3 items matching your interests sold this week" is factual. "You missed 3 items!" is pushy. Use the former. Let the user draw their own conclusion.

10. **The cap should never be discoverable.** If a user can figure out the exact threshold by testing (listing items at different prices in saved searches), the illusion breaks. The cap should be approximate/fuzzy — maybe ¥4.5M-5.5M with some randomness — so it feels like "Collector has deeper matching" rather than "Pro has a ¥5M cutoff." This is important for the framing to hold.

---

## References

- Superwall/Parra paywall design principles (see `/paywall` skill)
- Yuhinkai database: 12,447 smiths + 1,119 tosogu makers with certification records
- Current subscription types: `src/types/subscription.ts`
- Current alert system: `src/app/api/cron/process-saved-searches/route.ts`
- Artisan matcher: `Oshi-scrapper/artisan_matcher/`
- Elite factor computation: `oshi-v2` SQL functions

---

*Conceptual strategy document. Not implementation spec.*
