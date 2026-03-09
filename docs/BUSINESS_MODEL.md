# Nihontowatch Business Model

*Supersedes: PRO_TIER_STRATEGY.md (Jan 2025), PAYWALL_STRATEGY.md*
*Created: 2026-03-09*

---

## Thesis

Two revenue streams, both relationship-based:

1. **Elite collectors** pay $1,500/year for discretion, prestige, and early access
2. **Dealers** pay $3,000/year for their storefront and listing control

Everything else is free. The free experience must be genuinely excellent — it's what creates the audience that makes both paid tiers valuable.

---

## Revenue Model

### Year 1: Memberships only ($225K)

| Stream | Price | Target | Year 1 Revenue |
|--------|-------|--------|----------------|
| Inner Circle (collectors) | $1,500/year | 50 members | $75,000 |
| Dealer Storefront | $3,000/year | 50 dealers | $150,000 |
| **Total** | | | **$225,000** |

Year 1 is clean: memberships only, no commission. Attract the elite first, build the network, prove the value. No payment processing complexity, no dispute handling, no cross-border invoicing friction.

This is not a SaaS funnel. It's a club + marketplace. Sales are personal invitations and dealer relationships, not landing pages.

### Year 2+: Commission layer (when volume justifies it)

Once private offers exist and volume is proven, add **5% commission on private offer sales** brokered through the platform. Only on sales the platform directly facilitated — never on scraped listings where the buyer clicks through to the dealer's own site.

**Precedent:** Yahoo Japan Auctions (ヤフオク) charges a flat 10% on all sales. Japanese dealers already accept platform commission. At 5% on brokered-only sales, the rate is half of Yahoo and only applies when the platform created the match.

**Potential at scale:** 50 dealers × 4 private sales/month × avg ¥5M × 5% = ~$400K/year. At that volume the commission becomes the primary revenue stream and memberships are the entry fee. But this requires proven private offer volume — don't build the infrastructure until the data says it's worth it.

**Target ceiling:** ~$1M ARR ($225K memberships + $400K+ commission + growth in member count).

---

## Stream 1: Inner Circle ($1,500/year)

### Who

~50 elite collectors worldwide. You know them by name. They buy Juyo, Tokubetsu Juyo, Juyo Bijutsuhin. Annual spend on nihonto: $50K–$500K+.

### What they're paying for

**Not features. Discretion, access, and status.**

The $1,500 price IS the product. It signals seriousness to dealers, filters the community to peers, and creates a credential that travels outside the platform.

### The 48-hour window

Inner Circle members see new inventory 48 hours before it goes public. This is the single most valuable feature.

The nihonto market moves slowly enough that 48 hours is genuinely useful (unlike sneakers where 5 minutes matters), but fast enough that serious collectors miss pieces without it. It's the Goldilocks delay for this asset class.

**The discretion play:** When an Inner Circle member buys a piece and marks "I Own This" within the 48-hour window, the listing is removed entirely. It never appears in public browse. To the outside world, the item never existed.

This solves a real problem: elite collectors don't want others to know what they paid, what they're acquiring, or even that something was available. The discretion IS the luxury.

**The social proof loop:** Other collectors notice when pieces sell before they appear publicly. "How did he get that Sadamune? It wasn't even listed yet." Word spreads. That's the best marketing for the next cohort.

### Inner Circle features

| Feature | Details |
|---------|---------|
| 48h early access | See all new inventory before public browse |
| Stealth acquisition | "I Own This" within 48h → listing never goes public |
| Collection showcase | Curated public gallery page (opt-in) |
| Unlimited Yuhinkai lookup | Full NBTHK catalog search for their items |
| Full enrichment | Provenance network, AI descriptions, smith analytics |
| Insurance PDF export | Professional documentation for insurers |
| Dealer introductions | Brokered connections to Japanese dealers |
| Community | Private Discord/LINE group — verified peers only |
| Market intelligence | Quarterly report built from aggregate platform data |
| Verified Collector badge | Visible on all platform activity |
| Personal onboarding | You help them catalog their first 10 items |
| Annual event | Collector dinner (virtual or Tokyo/NYC) |

### Application model

Inner Circle is application-based, not open purchase. The credential's value depends on exclusivity.

Brief application: "What do you collect? What's your collecting history? What are you looking for?" Not gatekeeping for its own sake — the existence of a filter is what signals curation. The rejection rate doesn't need to be high.

### Why the items matter

The 50 Inner Circle members own the best items in the hobby. When they showcase their collections (opt-in), the platform displays Juyo, Tokubetsu Juyo, Juyo Bijutsuhin pieces that people come to nihontowatch specifically to see. Their collections ARE the content.

On artist pages: "In the collection of [name]" with attribution. "4 items in verified private collections" for those who keep it private — visible count, invisible owners.

---

## Stream 2: Dealer Storefront ($3,000/year)

### Who

52 active dealers (39 Japanese, 13 international). Target: 50 paying dealers.

### What they're paying for

A managed presence on the platform that reaches the most engaged collector audience in the market.

### Dealer features

| Feature | Details |
|---------|---------|
| **Admin over scraped listings** | Edit any field on their own scraped listings — titles, descriptions, prices, images, specs. Full ownership of how their inventory appears. |
| **Hide scraped listings** | Remove any listing they don't want publicly visible. No public history, no trace. Dealers control what's shown. |
| **Private offers to elite collectors** | Browse the Inner Circle member list, hand-pick recipients for private offers. Targeted, not broadcast. |
| Storefront page | `/dealers/[slug]` — logo, banner, bio, inventory, featured items |
| Analytics dashboard | Views, clicks, favorites, impressions, conversion tracking |
| Competitive intelligence | How their listings perform vs. market average |
| Featured placement | Highlighted in browse results and dealer directory |
| Inner Circle exposure | Their inventory shown to 48h-early-access members |
| Lead insights | Anonymized demand signals (what collectors are searching for) |
| Inquiry management | View and respond to collector inquiries from the platform |
| Profile customization | Full brand control: colors, specializations, policies, photos |
| Inventory management | Create/edit listings, video upload, catalog prefill from Yuhinkai |

### Dealer value proposition

"Your inventory is already on nihontowatch (we scrape it). Pay $3,000/year and you get full admin control over your listings, analytics, and direct access to 50 elite collectors who spend $50K–$500K annually."

The key insight: dealers are already on the platform whether they pay or not. The free version is read-only — we scrape and display. The paid tier gives them **control**: edit listings, hide what they don't want shown, hand-pick elite collectors for private offers, and see who's looking at what.

**Listing admin** is the strongest hook. Dealers care deeply about how their inventory is presented. A scraped listing might have a bad title, missing specs, or an item they'd rather not have publicly indexed. Today they can't do anything about it. For $3,000/year they own it.

**Hide listings** solves a real pain point. Some dealers don't want sold items visible (competitive intel for other dealers). Some have items they want to sell quietly. Some just have scraped junk they want cleaned up. One click to remove — no public trace, no history.

**Private offers to specific collectors** is the premium play. Dealers can browse Inner Circle members, see their collection profiles (what they collect, what schools/eras they favor), and send targeted private offers to the 3-5 collectors most likely to buy. This is the dealer equivalent of the collector's 48h window — access to a curated, verified audience.

### Infrastructure already built

Most of the dealer infrastructure exists:
- Dealer profile settings (`/dealer/profile`) with auto-save, completeness scoring
- Dealer preview (`/dealer/preview`) with reusable `DealerProfileView`
- Listing creation form with Yuhinkai catalog prefill (13 fields)
- Video upload (Bunny.net Stream, TUS, HLS)
- Analytics tracking (impressions, clicks, dwell time, favorites)
- Analytics dashboard (`/admin/dealers/[id]`) — needs self-serve access

What's missing: dealer self-serve login, Stripe integration, public storefront pages.

---

## The Free Tier

### Everything free, forever

| Feature | Available |
|---------|-----------|
| Browse all listings | Yes (48h delayed vs Inner Circle) |
| All filters and search | Yes |
| Listing detail with images | Yes |
| Currency conversion | Yes |
| Favorites | Unlimited |
| Saved searches + alerts | Yes |
| Inquiry email drafts | Yes |
| Setsumei translations | Yes |
| Artist directory + profiles | Yes |
| Dark mode | Yes |
| **Collection manager** | **Yes — completely free** |

### Why collection is free

The collection feature is a data acquisition engine, not a product to gate.

**Value of collection data:**

1. **Provenance graph** — Nobody tracks nihonto ownership chains. NBTHK records certification, not who owns what. Collectors voluntarily logging ownership builds a provenance database that is unprecedented and irreplaceable.

2. **Demand signal** — What collectors actually buy reveals true market preferences. "38 collectors own Bizen school works, 4 own Mino" tells dealers what to stock. Aggregate anonymized taste data is B2B gold.

3. **Taste clustering** — "Collectors who own Sadamune also own Kanemitsu" enables personalized alerts and recommendations.

4. **Real transaction prices** — If collectors log what they paid, you get actual sale prices (not asking prices). The nihonto market is completely opaque on pricing.

5. **Market sizing** — First authoritative answer to "how many active collectors exist and what's the total market capitalization."

6. **Free SEO content** — Every cataloged item with photos is indexable content created voluntarily with rich metadata.

**The data is worth more than any subscription fee.** Give the feature away. The data flywheel makes everything else more valuable — better alerts, better artist pages, better dealer analytics, better market reports.

### Free collection features

- Catalog unlimited items (private by default)
- Image upload
- Video upload
- Yuhinkai catalog lookup (3/month, unlimited for Inner Circle)
- Artisan matching + basic enrichment
- "I Own This" one-click import from browse
- All JSONB sections (koshirae, provenance, sayagaki, etc.)

### What Inner Circle adds to collection

- Public showcase page (`nihontowatch.com/collectors/[username]`)
- Full enrichment (provenance network, AI descriptions, smith analytics)
- Unlimited Yuhinkai catalog lookup
- Insurance PDF export
- Items appear on artist pages with attribution
- Stealth acquisition (48h window removal)

The free collection creates the adoption base. Inner Circle adds prestige and display. The contrast between "private inventory tool" and "museum-quality showcase" is the conversion trigger.

---

## Pricing Psychology

### Why $1,500 works for collectors

- A serious collector spends $50K–$500K/year. $1,500 is 0.3%–3% of annual spend.
- The 48h early access pays for itself with a single acquisition that would have sold before public listing.
- The price filters for seriousness — tire kickers don't apply.
- It's membership dues, not a subscription. Clubs are stickier than SaaS.

### Why $3,000 works for dealers

- Average dealer has $500K–$5M in inventory on the platform.
- $3,000/year = $250/month for analytics, storefront, and access to 40 high-spend collectors.
- A single sale attributed to the platform covers the annual fee multiple times over.
- Dealers are already on the platform (scraped). Paying gives them control, not visibility.

### What NOT to do

- No monthly billing option for Inner Circle. Annual only. Commitment signals seriousness.
- No tiered collector pricing. One price. Everyone in the room is equal.
- No discounts, no trials, no coupons. The price IS the filter.
- Dealer pricing can be monthly ($300/mo) or annual ($3,000) — dealers expect monthly SaaS billing.

---

## Conversion Dynamics

### Inner Circle acquisition

This is a **sales motion**, not a funnel. Personal invitations from you to collectors you know.

Reinforcing dynamics:
1. Inner Circle members occasionally buy items before they appear publicly
2. Other collectors notice — "how did he get that?"
3. Word spreads in the small community
4. New collectors inquire about membership
5. Existing members refer peers (social proof)

### Dealer acquisition

Two approaches:
1. **Japanese dealers**: Personal relationship. Show them their analytics. "Here's how many people viewed your inventory last month. Want to control how you appear?"
2. **International dealers**: Email with analytics PDF. "You had 2,400 listing views this month. Your Juyo wakizashi was favorited 18 times. Want a storefront?"

### Free → Inner Circle pipeline

The free collection feature is the top of the funnel:
1. Collector uses "I Own This" on a few listings
2. Gets artisan matching, basic enrichment — "wow, my sword's smith has 47 Juyo designations"
3. Sees "3 items in verified private collections" on artist pages — what's that?
4. Notices a piece sold before it appeared — who's seeing it early?
5. Learns about Inner Circle through the community or word of mouth
6. Applies

The collection isn't marketed as an Inner Circle funnel. It's genuinely useful on its own. The conversion happens through curiosity and social proof, not upgrade prompts.

---

## Operational Reality

### Inner Circle is high-touch

50 clients at $1,500 means each one expects attention.

Budget per member: ~5 hours/year
- Onboarding call: 1 hour
- Quarterly check-ins: 2 hours
- Ad-hoc dealer introductions: 1 hour
- Community management (shared): 1 hour

Total: ~250 hours/year for 50 members. Roughly 10% of a full-time year. Manageable, but non-trivial. This is a services business disguised as software.

### Dealer storefront is low-touch

Once set up, dealer storefronts are self-serve:
- Profile editing: auto-save, no support needed
- Analytics: dashboard is self-explanatory
- Listing management: form + catalog prefill handles it
- Support: email-based, expected volume is low

Setup assistance: 1-2 hours per dealer for initial onboarding.

---

## Technical Implementation (Collection-Specific)

### 48-hour window

Infrastructure exists. `DATA_DELAY_MS` in `server.ts` gates data freshness. Changes needed:

1. Inner Circle members: delay = 0 (see everything immediately)
2. All other users: delay = 48h (was 7 days)
3. Browse API: filter by `first_seen_at` based on user tier

### Stealth acquisition

When Inner Circle member marks "I Own This" on a listing within the 48h window:

1. Item moves to their `collection_items` with full data
2. Listing gets `admin_hidden = true` (or deleted from browse)
3. No trace in public browse, search, alerts, or SEO
4. Dealer analytics still count the view/sale (private)

Key: must suppress from ALL query paths — browse API, cron jobs, alerts, SEO sitemap, artist pages. Use RLS or the existing `admin_hidden` guard (already applied in 18+ locations post-dealer-leak incident).

### Collection showcase (opt-in public profile)

New page: `/collectors/[username]`
- Curated selection of collection items (collector chooses which to display)
- Each item shows on artist pages as "In the collection of [name]"
- Private items contribute to anonymous counts only

---

## Metrics

### Year 1 targets

| Metric | Target |
|--------|--------|
| Inner Circle members | 50 |
| Paying dealers | 50 |
| ARR | $225,000 |
| Free registered users | 2,000 |
| Collection items cataloged | 5,000 |
| Inner Circle retention | 90%+ |

### Leading indicators

- Collection items added per week (adoption)
- "I Own This" clicks per week (engagement)
- 48h-window acquisitions per month (Inner Circle value delivered)
- Dealer storefront pageviews (dealer value delivered)
- Artist page "in private collections" count (social proof strength)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Elite collectors won't pay $1,500 | The 48h window must deliver real acquisitions. Track and prove it. |
| Security concerns (public collection = theft risk) | Private by default. Public showcase is opt-in. Never pressure. |
| Dealers resist $3,000/year | Show analytics first. "Your inventory had 8,000 views last month." |
| High-touch burns out | Systematize: templated onboarding, quarterly group calls not 1:1, community self-serves. |
| 48h window kills dealer goodwill | Dealers benefit too — their best items sell faster to qualified buyers. Frame as premium placement. |
| Collection feature adoption is low | "I Own This" one-click import is the wedge. Zero friction. |
| Free users feel second-class | The 48h delay is invisible (you don't know what you're not seeing). Free experience must remain excellent. |

---

## Relationship to Existing Docs

This document supersedes:
- `docs/PRO_TIER_STRATEGY.md` — Old 4-tier SaaS model ($25/$99/$249)
- `docs/PAYWALL_STRATEGY.md` — Paywall design patterns
- `docs/PAYWALL_CORE_CONCEPTS.md` — Core concepts (still valid philosophically, but pricing model changed)

Key shifts:
- 4 tiers → 2 revenue streams (collectors + dealers)
- $25–$249 SaaS pricing → $1,500 club + $3,000 storefront
- Feature gating → access + discretion gating
- Funnel optimization → relationship selling
- Collection as paid feature → collection as free data engine
