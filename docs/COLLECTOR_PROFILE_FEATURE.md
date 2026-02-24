# Collector Profile & Yuhinkai Membership

## Status: Design — Ready for Implementation

**Date:** 2026-02-23
**Goal:** Build collector profiles that surface taste data internally, and a prestigious admin-curated membership program (Yuhinkai / 優品会) whose members can attach a meishi-style card to dealer inquiries.

---

## The Problem

Nihontowatch has ~1,500-2,000 active collectors globally and ~50 dealers. Today, when a collector inquires about a piece (via our AI inquiry email feature or directly), the dealer has zero context. They don't know if this is a serious buyer with a 30-piece collection or a casual browser. Meanwhile, collectors browse passively -- most never set up alerts, which means they miss new inventory and we miss the engagement loop that keeps them coming back.

We need a system that:
1. Gives dealers trust signals about who is inquiring
2. Gives collectors a reason to declare their interests explicitly
3. Converts passive browsers into active alert subscribers
4. Creates aggregate demand data that becomes a B2B product for dealers

---

## Two-Layer Architecture

### Layer 1: Collector Profile (all authenticated users)

Every authenticated user can fill out their profile on `/profile`. Photo, country, collecting since, budget bracket, strategy, philosophy, alerts, artist favorites. This data exists for **internal use** -- it feeds taste derivation, populates the alert builder, and enriches the platform's understanding of demand.

A collector profile alone does **not** produce a card, badge, or any external-facing prestige. It's a settings page.

### Layer 2: Yuhinkai Membership (admin-granted)

An admin grants Yuhinkai (優品会) membership to select collectors. This is a curated, prestigious status -- not a self-service badge. Once granted, the collector gets:

- The **meishi card** preview on their profile page
- The **"Attach Yuhinkai card"** checkbox in the inquiry modal
- The card **appended to inquiry emails** when they opt in
- A subtle **優品会** indicator in any dealer-facing context

The admin controls who gets in. No self-service application, no automated criteria. The admin knows who the serious collectors are -- maybe they've exchanged emails, maybe they've seen the user's inquiry history, maybe they know them from the community. It's a human judgment call.

**Why not self-service?** If anyone who uploads a photo and sets a country is "Yuhinkai," the name means nothing. Admin curation makes the card a genuine trust signal -- dealers know that NihontoWatch has vetted this person, not just that they filled out a form.

---

## Core Principles

### Privacy-First

This is a community of 1,500 people. Many know each other from sword shows, NMB, the Token Kai circuit. Privacy is non-negotiable.

- Collector profiles are **dealer-facing only** -- never shown to other collectors
- No public profile pages, no social features, no "who favorited this"
- Collection details are never shared -- only size and focus areas
- Budget shown as bracket, never exact figures
- Alerts shown to dealers only in aggregate ("14 collectors seeking Juyo tsuba"), never individually
- Collectors control what is shared via privacy toggles
- The meishi is attached to inquiries **only** by the collector's explicit choice

### Dealer-Facing Only

The collector profile exists to serve dealers. Two surfaces:

1. **Yuhinkai Meishi** -- attached to AI inquiry emails when the Yuhinkai member opts in. Shows the dealer who they're talking to.
2. **Aggregate Demand Dashboard** -- anonymized demand signals in dealer analytics (Phase 3). Shows dealers what the market wants.

---

## Yuhinkai (優品会)

### The Name

**優品** (yūhin) -- fine/excellent works. **会** (kai) -- society, association.

"Society of Fine Works." The `-kai` suffix is how real nihonto organizations name themselves: Token Kai (刀剣会), Nihon Bijutsu Token Hozon Kyokai (日本美術刀剣保存協会). A dealer seeing 優品会 on a meishi doesn't think "website user" -- they think "member of a collecting society."

### Ranks

Phase 1 ships with a single rank: **会員** (kaiin / Member). The database stores a `rank` field to accommodate future expansion.

| Rank | Japanese | Romanized | Meaning | Phase |
|------|----------|-----------|---------|-------|
| Member | 会員 | Kaiin | Member | Phase 1 |
| Full Member | 正会員 | Sei-kaiin | Regular/full member | Future |
| Distinguished | 特別会員 | Tokubetsu Kaiin | Special member | Future |
| Honorary | 名誉会員 | Meiyo Kaiin | Honorary member | Future |

Rank criteria for future tiers are undefined -- they'll be designed based on real usage patterns after Phase 1 ships. For now, everyone granted membership is 会員.

### Admin Management

A simple admin UI for granting/revoking membership:

```
Users with profiles:

Christopher H.  ·  Tokyo  ·  3 alerts  ·  12 collection items
  Yuhinkai: [ON]  ·  会員  ·  christopher.h@yuhinkai.com  ·  Granted 2026-02-15

Jane S.  ·  California  ·  1 alert  ·  0 collection items
  Yuhinkai: [OFF]  ·  [Grant membership]
```

Lives on `/admin/yuhinkai` or as a section on the existing `/admin` page. Toggle switch, rank selector (Phase 1: always 会員), email handle assignment, done.

### Yuhinkai Email Identity

Each Yuhinkai member is assigned a `@yuhinkai.com` email address (e.g., `christopher.h@yuhinkai.com`). This is the most tangible benefit of membership and the strongest trust signal to dealers.

**What the email address does:**

1. **Outbound inquiries are sent from this address.** When a Yuhinkai member sends an inquiry via the AI email feature, the email is dispatched by our servers (SendGrid) with the `From:` address set to their Yuhinkai email. The dealer sees `christopher.h@yuhinkai.com` in their inbox -- not `randomcollector99@gmail.com`.

2. **Replies go to the collector's real email.** The `Reply-To:` header is set to the collector's actual email address. When the dealer hits reply, it goes directly to the collector's personal inbox. We don't mediate the conversation.

3. **The address appears on the meishi.** It functions as a contact line on the business card, reinforcing the organizational affiliation.

**Why this matters:**

An inquiry arriving from `christopher.h@yuhinkai.com` tells the dealer three things before they even read the email:
- This person is a vetted member of a collecting society (not a random internet user)
- The platform vouches for them (the email comes from an organizational domain)
- They're serious enough to have been granted membership

This changes the inquiry flow from "copy and paste into your own email client" to "preview and send from the platform." That's a significant UX upgrade -- the collector clicks one button instead of switching apps.

**Technical requirements:**
- Own the `yuhinkai.com` domain (or use a subdomain like `yuhinkai.nihontowatch.com`)
- DNS records: SPF, DKIM, DMARC for the sending domain
- SendGrid sender authentication (same process as existing `notifications@nihontowatch.com`)
- Each member assigned a unique handle when admin grants membership

**What this unlocks beyond prestige:**
- We know the email was actually sent (today we don't -- the collector might copy and never send)
- `inquiry_history` becomes definitive, not fire-and-forget
- Delivery/bounce tracking
- Future: inbound forwarding so dealers can reply to `@yuhinkai.com` and it reaches the collector (Phase 2)

**Handle assignment:**
- Admin assigns the handle when granting Yuhinkai membership (e.g., `christopher.h`, `tanaka.k`)
- Stored in `collector_profiles.yuhinkai_email_handle`
- Full address constructed as `{handle}@yuhinkai.com`
- Handle must be unique, lowercase, alphanumeric + dots

**Email sending flow:**

```
Yuhinkai member clicks "Send Inquiry"
  → POST /api/inquiry/send
  → Generate email body (existing AI pipeline)
  → Append meishi text block after 敬具
  → SendGrid send:
      From: christopher.h@yuhinkai.com
      Reply-To: collector.real.email@gmail.com
      To: dealer-contact@aoijapan.com
      Subject: 重要刀剣 備前国長船兼光について
      Body: [AI-generated inquiry + meishi]
  → INSERT inquiry_history (definitive -- we know it was sent)
  → Return success to client
```

**Domain warm-up:** Send volume is naturally low (dozens of inquiries per week across all members, not thousands). Standard domain warm-up + proper DKIM/DMARC should establish good deliverability quickly. The niche B2B nature of the emails (Japanese sword inquiry to a dealer) means very low spam complaint risk.

---

## The Yuhinkai Meishi (名刺)

The primary product surface. When a Yuhinkai member sends an inquiry via the AI email draft feature, the dealer receives a meishi-style card appended to the message.

### Design Philosophy

A Japanese business card (名刺 / meishi) isn't just contact info -- it's a ritual object. The exchange establishes who you are, your position, your organization, your seriousness. The Yuhinkai meishi follows meishi conventions:

- **Horizontal rectangle**, roughly 91x55mm proportions (~1.65:1 aspect ratio)
- **Clean, flat layout** -- no gradients, no shadows, no rounded corners
- **One accent color** -- our gold (`#b8860b`) as the Yuhinkai brand mark
- **Middot separators (·)** instead of commas or line breaks -- compact, scannable. Japanese cards use `·` (中黒) naturally
- **Label-value rows** with left-aligned labels -- reads like a spec sheet, the way dealers scan sword specs
- **Philosophy truncated to one line** on the card (full text on profile page)
- **No buttons, no links, no calls to action** -- a meishi is a statement, not an interface

### Card Layout

**JA rendering:**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  優品会                                          │
│  会員                                            │
│                                                 │
│  Christopher H.                                 │
│  christopher.h@yuhinkai.com                     │
│  東京 · 収集歴 2008年より                          │
│                                                 │
│  ─────────────────────────────────────────────   │
│                                                 │
│  関心    古刀 · 刀 · 備前伝 · 重要刀剣以上          │
│  注目    兼光 · 長光                               │
│  収集    12点 · 本格収集                           │
│                                                 │
│  「備前伝の最高峰を追い求めています」                  │
│                                                 │
│  アラート 3件 · 2024年入会                         │
│                                                 │
└─────────────────────────────────────────────────┘
```

**EN rendering:**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Yuhinkai                                       │
│  Member                                         │
│                                                 │
│  Christopher H.                                 │
│  christopher.h@yuhinkai.com                     │
│  Tokyo, Japan · Collecting since 2008           │
│                                                 │
│  ─────────────────────────────────────────────   │
│                                                 │
│  Focus     Koto · Katana · Bizen · Juyo+        │
│  Follows   Kanemitsu · Nagamitsu                │
│  Collection  12 items · Serious collector       │
│                                                 │
│  "I seek the finest examples of Bizen-den work" │
│                                                 │
│  3 active alerts · Joined 2024                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### What Each Field Tells the Dealer

| Field | Trust Signal |
|-------|-------------|
| **優品会 / Yuhinkai** | "This person was vetted by NihontoWatch -- curated membership" |
| **会員 / Member** | Rank within the society |
| **Name** | Real person, not anonymous |
| **@yuhinkai.com email** | "Organizational email -- this inquiry came from a vetted address, not a throwaway" |
| **Location** | Shipping logistics, timezone, cultural context |
| **Collecting since** | "They have Y years of experience" (self-reported) |
| **Focus (関心)** | "Their interests match what I'm selling" (derived from alerts) |
| **Follows (注目)** | "They know and follow specific smiths -- knowledgeable" |
| **Collection (収集)** | "They already own N pieces -- serious collector" + budget bracket |
| **Philosophy** | Free-text taste signal, demonstrates knowledge level |
| **Alert count** | "They are actively hunting -- high buying intent" |
| **Joined (入会)** | Platform tenure |

### Rendering Surfaces

The meishi appears in three places:

**1. Profile page preview** (Yuhinkai members only) -- Rendered as a styled `<div>` with meishi proportions. Toggle between EN/JA. Fields update live as the collector edits their profile. Grayed-out fields for anything not yet filled in.

**2. Inquiry modal** -- Small preview of the card below the "Attach Yuhinkai card" checkbox. Shows which version (JA/EN) will be attached based on the inquiry language.

**3. Inquiry email** -- Sent from the collector's `@yuhinkai.com` address via SendGrid. The meishi is appended after 敬具 (formal closing) as a plain-text block:

```
───────────────────────────────────
優品会 会員

Christopher H.
christopher.h@yuhinkai.com
東京 · 収集歴 2008年より

関心　　古刀 · 刀 · 備前伝 · 重要刀剣以上
注目　　兼光 · 長光
収集　　12点 · 本格収集

「備前伝の最高峰を追い求めています」

アラート 3件 · 2024年入会
───────────────────────────────────
```

Plain text for Phase 1 because Japanese business emails are traditionally plain text. The HTML meishi lives on the profile page and inquiry modal where we control rendering. HTML email upgrade is a Phase 2 option.

The email itself arrives from `christopher.h@yuhinkai.com` with `Reply-To:` set to the collector's personal email. The dealer sees the organizational address in their inbox, and replies go directly to the collector.

### Attachment Control

- **Only Yuhinkai members** see the attachment option
- **Default: off.** Card is not attached unless collector explicitly checks the box
- Toggle per inquiry: "Attach your Yuhinkai card?" (checkbox in AI inquiry UI)
- Global setting: "Always attach my Yuhinkai card" (in profile privacy settings)
- Collectors can preview exactly what the dealer will see before sending

### Non-Members

Non-Yuhinkai collectors who send inquiries get the AI-generated email as today -- no card, no prompt to "complete your profile," no mention of Yuhinkai. The feature is invisible to non-members.

---

## Profile Data Model

### Identity

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `photo_url` | TEXT | `profiles.avatar_url` | Already exists in DB, no UI to set it yet. Reuse this column. |
| `display_name` | TEXT | `profiles.display_name` | Already exists. |
| `location_city` | TEXT | `collector_profiles` | Free text, not geocoded |
| `location_country` | TEXT | `collector_profiles` | ISO 3166-1 alpha-2 |
| `collecting_since` | INTEGER | `collector_profiles` | Year (e.g., 2008). Self-reported. |

### Enrichment (optional, shown on meishi)

| Field | Type | Notes |
|-------|------|-------|
| `budget_brackets` | TEXT[] | ['study', 'mid', 'serious', 'museum']. Multiple allowed. |
| `collecting_strategy` | TEXT | focused_depth / broad_survey / study / investment / mixed |
| `collecting_philosophy` | TEXT | Free text, 500 char max. Truncated to 1 line on meishi. |

### Taste Profile (DERIVED, not stored)

The taste profile (focus areas, eras, schools, types, certifications) is **derived at read time** from the collector's active alerts (`saved_searches`) and artist favorites (`user_favorite_artists`). See "Taste Profile Derivation" section below.

This is the core architectural decision: alerts are the source of truth for taste, not a byproduct.

### Budget Brackets

| Bracket | Label (EN) | Label (JA) | Range |
|---------|-----------|-----------|-------|
| `study` | Study pieces | 研究用 | Under $5,000 |
| `mid` | Mid-range | 中価格帯 | $5,000 -- $25,000 |
| `serious` | Serious collector | 本格収集 | $25,000 -- $100,000 |
| `museum` | Museum grade | 美術館級 | $100,000+ |

Multiple brackets can be selected (a collector buying Juyo katana at $50K may also collect study tsuba at $500).

### Privacy Settings

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `card_attach_default` | BOOLEAN | false | Auto-attach meishi to inquiries |
| `share_collection_size` | BOOLEAN | true | Show item count on meishi |
| `share_budget` | BOOLEAN | false | Show budget bracket on meishi |
| `share_alerts_count` | BOOLEAN | true | Show number of active alerts |
| `share_favorite_artists` | BOOLEAN | true | Show followed artists on meishi |

---

## Profile Page Redesign (`/profile`)

### Current State

Basic account settings: display name (inline edit), email, member since, account type, quick links, cookie prefs, data export, privacy policy, sign out, delete account. ~460 lines, one file, no collector-specific fields.

### Redesigned Page

Same card-based layout and visual language (white cards, `bg-cream`, `font-serif` headings). Adds new sections between the existing profile card and quick links. All sections available to all authenticated users. Yuhinkai-specific sections only visible to members.

#### Section 1: Profile Card (modified)

- Avatar becomes a **tappable photo upload zone**. Client-side resize (reuse logic from `ImageUploadZone`), upload to `profile-images` Supabase Storage bucket, save URL to `profiles.avatar_url`
- Circular crop preview, 80x80 mobile, 96x96 desktop
- Below display name: **country picker** (ISO 3166 dropdown) and **"Collecting since" year picker** (optional, 1960-current)
- Existing fields preserved: display name edit, email, member since, admin badge

#### Section 2: Yuhinkai Meishi Preview (members only)

Only visible to Yuhinkai members. Rendered card preview showing exactly what dealers see. Toggle between EN/JA. Fields update live as the collector edits their profile. Grayed-out fields for anything not yet filled in, with hints ("Add your collecting philosophy to show this").

#### Section 3: Alert Builder

Expandable section with 4 structured paths for creating alerts. Available to all users (alerts are independently useful regardless of Yuhinkai status).

**Path A -- Artist search:** Text input with autocomplete via existing `/api/artisan/search`. Type "Kane" -> Kanemitsu, Kanesada, etc. Tap -> creates `saved_search` with `artisanCode` filter, `notification_frequency: 'daily'`.

**Path B -- Type picker:** Row of item type buttons (Katana, Wakizashi, Tanto, etc.). Tap -> collapsible refinements (era, cert, price). Confirm -> creates saved search.

**Path C -- School picker:** Gokaden-grouped accordion (Bizen-den, Soshu-den, Yamashiro-den, Yamato-den, Mino-den, Other). Each shows notable smiths. Tap school -> optional refinements -> creates saved search with `artisanCode: NS-*`.

**Path D -- Browse link:** "Or browse listings and save a search as an alert" -> opens `/browse`.

Below the paths: list of the collector's active alerts (from `saved_searches` where `notification_frequency != 'none'`). Each shows summary, frequency toggle (instant/daily/weekly), delete button. Existing saved searches from browse appear here too -- same table.

#### Section 4: Enrichment

Optional fields for all users:

- **Budget brackets** -- Row of 4 tappable cards: Study, Mid, Serious, Museum. Multi-select. Shows JPY equivalents when currency is JPY.
- **Collecting strategy** -- Radio group: Focused depth, Broad survey, Study collection, Investment, Mixed.
- **Philosophy** -- Free text area, 500 char max.

#### Section 5: Privacy Settings (Yuhinkai members only)

Toggle switches controlling what appears on the meishi:

| Toggle | Default | Effect |
|--------|---------|--------|
| Always attach card to inquiries | Off | Auto-check "Attach Yuhinkai card" in inquiry modal |
| Show collection size | On | Item count on meishi |
| Show budget bracket | Off | Budget line on meishi |
| Show active alert count | On | Alert count on meishi |
| Show followed artists | On | Followed artists on meishi |

Each toggle updates the meishi preview (Section 2) in real time.

#### Existing Sections (kept, moved down)

- **Quick Links** -- unchanged
- **Privacy & Data** -- unchanged (cookie prefs, data export, privacy policy)
- **Account Actions** -- unchanged (sign out, delete account)

### Component Breakdown

| Component | What it does |
|-----------|-------------|
| `src/app/profile/page.tsx` | Thin shell, fetches collector profile data, renders client component |
| `src/app/profile/ProfilePageClient.tsx` | Main layout, state management, orchestrates sections |
| `src/components/profile/PhotoUpload.tsx` | Circular photo picker with resize + upload |
| `src/components/profile/YuhinMeishi.tsx` | Meishi card renderer (EN/JA), used in preview + inquiry modal |
| `src/components/profile/AlertBuilder.tsx` | 4-path alert creation + active alert list |
| `src/components/profile/EnrichmentForm.tsx` | Budget, strategy, philosophy fields |
| `src/components/profile/PrivacyToggles.tsx` | Card visibility toggles (Yuhinkai members only) |

Existing sections (quick links, privacy & data, account actions) stay inline in `ProfilePageClient.tsx`.

### Data Flow

```
ProfilePageClient loads:
  1. profiles (existing) — display_name, email, avatar_url, created_at
  2. collector_profiles (new) — country, collecting_since, budget, strategy,
     philosophy, privacy toggles, yuhinkai_member, yuhinkai_rank
  3. saved_searches (existing) — active alerts for alert list + taste derivation
  4. user_favorite_artists (new) — followed artists for meishi
  5. user_collection_items count (existing) — collection size for meishi

All fetched on mount via GET /api/collector-profile.

Mutations:
  - Photo upload → POST /api/collector-profile/photo → Supabase Storage + profiles.avatar_url
  - Profile fields → PUT /api/collector-profile → collector_profiles row
  - Alerts → POST/DELETE /api/saved-searches (existing)
  - Artist favorites → managed on /artists/[slug] pages, displayed read-only here
```

---

## Alert Builder

### Core Insight: Alerts ARE the Profile

Instead of collecting taste preferences as checkboxes and then generating alerts from them, **we flip it**. The collector builds alerts directly, and those alerts collectively define their taste profile. The profile is *derived from* the alerts, not the other way around.

This solves three problems:
1. No combinatorial explosion -- each alert is a single concept, not a cross-product
2. No impedance mismatch -- collectors express what they actually want
3. Alerts are guaranteed -- they're the primary artifact, not a byproduct

### The Design Problem

Collectors don't think in grids. They think in *concepts*:

- "Bizen katana" (school x type, no era)
- "Anything by Kanemitsu" (artist only)
- "Juyo tsuba" (cert x type, no school)
- "Koto blades under $10K" (era x budget, no school)
- "Soshu-den" (school only)

Each concept has a different shape. The builder offers three structured entry paths plus a browse fallback.

### Structured Paths (Phase 1)

**Path A: "I follow specific artists"**

Autocomplete search backed by `/api/artisan/search` (already exists). Type "Kane" -> see Kanemitsu, Kanesada, Kanemoto, etc. Each result shows school, era, province, elite factor, Juyo count. Tap to create an artist alert.

The alert is simple: `artisanCode={code}`, no other filters. Any new listing attributed to this artist triggers it. Volume is naturally low (a few per year), so no narrowing needed.

**Path B: "I collect a type of piece"**

Visual grid: Katana, Wakizashi, Tanto, Tachi, Naginata/Yari, Tsuba, Other Fittings, Koshirae/Armor. Tap one.

Then: **optional narrowing** -- shown as collapsible refinements, not required:
- Era: Koto / Shinto / Shinshinto / Gendai / Any
- Certification: Any / Hozon+ / Tokuho+ / Juyo+ / Tokuju+
- Price range: text inputs with currency toggle

The collector adds only the constraints they care about. "Katana" alone is a valid alert. "Katana + Koto + Juyo+" is a more specific one. All are fine.

-> Creates one saved search alert with the selected filters.

**Path C: "I follow a school/tradition"**

List grouped by the gokaden:
- Bizen-den (Osafune, Ichimonji, Kozori...)
- Soshu-den (Kamakura, Masamune lineage...)
- Yamashiro-den (Awataguchi, Rai, Nobukuni...)
- Yamato-den (Tegai, Senjuin, Taima...)
- Mino-den (Seki, Kanemoto, Muramasa...)
- Other / Provincial schools

Each school shows notable smiths and Juyo count inline. Tap a school to start an alert.

Then: same optional narrowing as Path B (type, cert, price).

-> Creates one saved search alert with `artisanCode={NS-code}` (school code) + optional filters.

**Path D: "Save from browse"**

Link: "Or browse listings and save a search as an alert"

Opens the main browse page. Collector applies filters as usual, then saves the search with notifications enabled.

### Example Session

A collector who focuses on Bizen-den and collects tsuba on the side might build:

```
Your alerts:

1. Kanemitsu (artist)                      [instant v] [x]
   Any new listing by Kanemitsu

2. Bizen school - Katana - Juyo+           [daily v]   [x]
   Bizen-den katana, Juyo or higher

3. Tsuba - Under 300,000 JPY              [daily v]   [x]
   Any tsuba under 300,000 JPY

[+ Add another alert]
```

### Notification Frequency

Each alert has its own frequency toggle: instant / daily / weekly.

Smart defaults:
- **Artist alerts** -> instant (very low volume, very high signal)
- **Narrow alerts** (3+ filters) -> daily
- **Broad alerts** (1-2 filters) -> daily or weekly

Collector can override any default.

### NL Parser (Phase 2)

In Phase 2, a text input is added above the structured paths: "Type what you're looking for." The NL parser (extending `semanticQueryParser.ts` + artisan name resolution + LLM fallback) converts free-text into structured alerts. Structured paths remain as fallback.

---

## Artist Interests: Alerts vs. Favorites

Artists surface in two distinct ways, serving different purposes.

### Artist Alerts (via Alert Builder)

Created anytime via the alert builder. Collector types an artist name, the parser resolves it to an artisan code via `/api/artisan/search`, and creates a saved search with `artisanCode={code}`. Reuses existing saved search infrastructure.

- **High intent signal** for dealers: "This collector is actively hunting this smith's work"
- Volume is naturally low (a few listings per year per artist)
- Creates a saved_search row like any other alert

### Artist Favorites (via `/artists/[slug]` Follow Button)

A lighter-weight "follow" action on artist profile pages. Not an alert -- no notifications. Signals admiration, knowledge, taste.

- **Taste signal** for dealers: "This collector knows and appreciates this smith"
- Shown on Yuhinkai meishi as "注目: 兼光 · 長光" / "Follows: Kanemitsu · Nagamitsu"
- No spam risk -- it's a display-only signal

A collector might favorite Masamune (aspiration -- they'll never afford one but it signals Soshu-den expertise) while having an alert for Kanemitsu (intent -- they're actively buying). Both are valuable, different things.

### Data Model

```sql
-- Artist favorites (follow/unfollow, display-only)
CREATE TABLE user_favorite_artists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  artisan_id  TEXT NOT NULL,   -- Yuhinkai code (e.g., "MAS590")
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, artisan_id)
);

-- Artist alerts are just saved_searches with artisanCode filter
-- No separate table needed
```

### School Codes vs. Individual Codes

The Yuhinkai artisan database uses `NS-*` codes for schools (e.g., `NS-Omo` for Omori, `NS-Got` for Goto) and individual codes for makers (e.g., `GOT031` for Goto Ichijo). This distinction matters for alert matching:

- **School alert** (`artisanCode: 'NS-Omo'`): at match time, `expandArtisanCodes('NS-Omo')` resolves to all individual Omori-school makers via `artisan_school_members`. Any listing attributed to any member triggers the alert.
- **Artist alert** (`artisanCode: 'GOT031'`): matches only Goto Ichijo specifically.

---

## Taste Profile Derivation (Alerts -> Profile)

The taste dimensions on the Yuhinkai meishi are **derived at read time** from the collector's alerts and artist favorites -- not stored as separate fields.

### Why Derived, Not Stored

1. **No combinatorial explosion** -- 2 eras x 3 types x 2 schools = 12 alerts, most useless
2. **No shape mismatch** -- collectors think in concepts, not grid coordinates
3. **No drift** -- stored preferences go stale. Alerts are living, maintained things.

### Derivation Algorithm

```typescript
function deriveTasteProfile(
  alerts: SavedSearch[],
  favoriteArtists: string[]   // Yuhinkai artisan codes
): DerivedTasteProfile {
  const periods = new Set<string>();
  const schools = new Set<string>();   // NS-* school codes
  const types = new Set<string>();
  const certs = new Set<string>();
  const artists = new Set<string>();   // Individual artisan codes
  const followedArtists = new Set<string>(favoriteArtists);

  for (const alert of alerts) {
    const c = alert.search_criteria;
    if (c.itemTypes) c.itemTypes.forEach(t => types.add(t));
    if (c.certifications) c.certifications.forEach(cert => certs.add(cert));
    if (c.period) c.period.forEach(p => periods.add(p));

    if (c.artisanCode) {
      if (c.artisanCode.startsWith('NS-')) {
        schools.add(c.artisanCode);    // School-level interest
      } else {
        artists.add(c.artisanCode);    // Individual artist interest
      }
    }
  }

  return { periods, schools, types, certs, artists, followedArtists };
}
```

Schools here are NS-* codes, resolved to display names via `getArtisan(code)` at render time.

### Compact Summary Formatter

The meishi "Focus" line is a middot-separated summary:

```
関心　　古刀 · 刀 · 備前伝 · 重要刀剣以上
Focus   Koto · Katana · Bizen · Juyo+
```

Generated by `formatTasteSummary(taste, locale)` -- not a sentence, just a compact list of the most salient dimensions.

### Demand Specificity

```typescript
function getDemandSpecificity(alerts: SavedSearch[]): 'focused' | 'selective' | 'broad' {
  const avgFilters = alerts.reduce((sum, a) => {
    const c = a.search_criteria;
    let count = 0;
    if (c.itemTypes?.length) count++;
    if (c.certifications?.length) count++;
    if (c.schools?.length) count++;
    if (c.period?.length) count++;
    if (c.artisanCode) count++;
    if (c.minPrice || c.maxPrice) count++;
    if (c.signatureStatuses?.length) count++;
    return sum + count;
  }, 0) / alerts.length;

  if (avgFilters >= 3) return 'focused';
  if (avgFilters >= 2) return 'selective';
  return 'broad';
}
```

### Budget Brackets (Not Derived)

Budget bracket stays in the profile table, not derived from alerts. Alert price filters are per-alert and might differ ("tsuba under 300K JPY" vs. "katana over 3M JPY"), but budget bracket is a holistic self-description. It answers "what kind of buyer is this?" not "what price range is this specific alert?"

---

## Demand Profile: Gap Analysis vs. SOTA

Our plan covers explicit taste signals well (alerts, favorites, philosophy). Compared to SOTA platforms, these are the gaps we plan to close in Phases 2-3.

### Gap 1: Per-Inquiry Relevance (Phase 2)

**The problem:** The meishi is static -- same card regardless of what piece the collector is asking about.

**The fix:** At card generation time, run the listing's attributes against the collector's alerts and highlight matches:

```
関心    古刀 · 刀 · 備前伝 · 重要刀剣以上
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        アラート2件がこの出品に該当します
```

Turns the card from "here's who I am" into "here's why I'm a serious buyer for this specific piece."

### Gap 2: Inquiry History (Phase 2)

**The problem:** Each inquiry looks like a first-time contact.

**Existing data:** `inquiry_history` table already tracks `user_id`, `listing_id`, `dealer_id`, `created_at` on every AI inquiry send. No new table needed.

**The fix:** Show dealer-specific context on the meishi:

```
この刀剣商への問い合わせ: 3件目 (直近: 2026年1月)
Previously inquired: 3 listings from this dealer (most recent: Jan 2026)
```

### Gap 3: Time-in-Market (Phase 2)

**Our advantage:** We have `saved_searches.created_at`. A collector who set a "Juyo Bizen katana" alert 8 months ago and still hasn't bought one is telling the dealer: "I'm very selective, but I'm still actively looking."

**The fix:** For matching alerts, show duration:

```
備前刀（重要刀剣以上）を8ヶ月間探索中
Seeking Bizen katana (Juyo+) for 8 months
```

### Gap 4: Collection Composition (Phase 2)

**The fix:** When generating the card for a specific inquiry, show relevant collection context:

```
収集    12点（備前刀5振）
Collection  12 items (5 Bizen blades)
```

Privacy note: shows category counts, never individual items. Controlled by `share_collection_size` toggle.

### Gap 5: Proactive Dealer Notifications (Phase 3)

When a new listing matches N+ collector alerts, email the dealer:

```
"Your new listing 'Juyo Bizen Katana by Kanemitsu' matches
alerts from 8 Yuhinkai collectors."
```

Requires dealer accounts (Phase 3+).

---

## Database Schema

### New: `collector_profiles` table

```sql
CREATE TABLE collector_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  -- Identity
  location_city    TEXT,
  location_country TEXT,           -- ISO 3166-1 alpha-2
  collecting_since INTEGER,        -- Year, e.g., 2008

  -- Enrichment (optional, shown on meishi)
  budget_brackets       TEXT[],    -- ['study', 'mid', 'serious', 'museum']
  collecting_strategy   TEXT,      -- 'focused_depth', 'broad_survey', 'study', 'investment', 'mixed'
  collecting_philosophy TEXT,      -- Free text, max 500 chars

  -- Yuhinkai membership (admin-controlled)
  yuhinkai_member       BOOLEAN DEFAULT false,
  yuhinkai_rank         TEXT DEFAULT 'kaiin',  -- 'kaiin', future: 'seikaiin', 'tokubetsu_kaiin', 'meiyo_kaiin'
  yuhinkai_email_handle TEXT UNIQUE,            -- e.g., 'christopher.h' → christopher.h@yuhinkai.com
  yuhinkai_granted_at   TIMESTAMPTZ,
  yuhinkai_granted_by   UUID REFERENCES profiles(id),

  -- Privacy settings (Yuhinkai members only -- controls meishi content)
  card_attach_default    BOOLEAN DEFAULT false,
  share_collection_size  BOOLEAN DEFAULT true,
  share_budget           BOOLEAN DEFAULT false,
  share_alerts_count     BOOLEAN DEFAULT true,
  share_favorite_artists BOOLEAN DEFAULT true,

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- NOTE: Photo stored in profiles.avatar_url (already exists).
-- NOTE: No taste profile columns -- derived at read time from saved_searches + user_favorite_artists.
-- NOTE: No is_identity_complete / badge tracking -- membership is admin-granted, not criteria-based.
```

### New: `user_favorite_artists` table

```sql
CREATE TABLE user_favorite_artists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  artisan_id  TEXT NOT NULL,   -- Yuhinkai artisan code
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, artisan_id)
);
```

### Existing: `inquiry_history` table (no changes)

Already tracks `user_id`, `listing_id`, `dealer_id`, `intent`, `buyer_country`, `created_at`. Populated on every AI inquiry send. Enables "Previously inquired: N listings from this dealer" on the meishi (Phase 2).

### RLS Policies

```sql
-- collector_profiles: users can read/update own, admins can update any (for Yuhinkai grants)
ALTER TABLE collector_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON collector_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins manage Yuhinkai membership" ON collector_profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- user_favorite_artists: users can CRUD own
ALTER TABLE user_favorite_artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorites" ON user_favorite_artists
  FOR ALL USING (auth.uid() = user_id);
```

---

## Inquiry Integration

### Yuhinkai Member Flow (server-side send)

The inquiry flow changes fundamentally for Yuhinkai members: instead of "copy and paste into your email client," it becomes "preview and send from the platform."

1. Member opens InquiryModal from listing detail / QuickView
2. AI generates email as today (Japanese business format)
3. Below the email preview: checkbox "Attach your Yuhinkai card" (checked if `card_attach_default` is true)
4. Small meishi preview below checkbox
5. Member reviews the complete email (body + meishi) in a preview pane
6. **"Send from yuhinkai.com" button** -- single click sends the email
7. `POST /api/inquiry/send`:
   - SendGrid dispatches the email:
     - `From: {handle}@yuhinkai.com`
     - `Reply-To: {collector's real email}`
     - `To: {dealer contact email}`
     - Body: AI-generated inquiry + meishi text block (if opted in)
   - `INSERT inquiry_history` with definitive send confirmation
   - Return success to client
8. InquiryModal shows "Sent" confirmation with dealer name

**Why server-side send is better:**
- One-click send vs. multi-step copy-paste-switch-apps
- Email arrives from a prestigious `@yuhinkai.com` address
- We have proof of delivery (SendGrid delivery status)
- `inquiry_history` is definitive (today it's fire-and-forget -- we log the generation but not the actual send)

**Fallback:** If the collector prefers to send from their own email (some may want the email in their sent folder), a "Copy to clipboard" option remains available alongside the send button.

### Non-Member Flow

Unchanged from today. AI generates the email, collector copies it, sends from their own email client. No card option, no Yuhinkai mention, no server-side send.

---

## Interaction with Existing Features

### Saved Searches -> Alerts

Existing saved searches with `notification_frequency != 'none'` are already alerts. The alert builder creates *new* alerts via structured paths. Both coexist -- they're all just rows in `saved_searches`.

### Listing Favorites -> Watchlist

Listing favorites (watchlist) remain separate from artist favorites. Different intent:

- **Listing favorite**: "I'm interested in this specific item" -> price drop alerts
- **Artist favorite**: "I follow this smith's work" -> taste signal on meishi

### Collection -> Profile Signal

The `/collection` feature enriches the meishi:

- Collection size shown on card (if privacy setting allows)
- Collection content is never shared, but counts by type/school can appear (Phase 2)

---

## Implementation Phases

### Phase 1: Profile + Alerts + Yuhinkai Meishi

End-to-end value delivery: admin grants Yuhinkai membership, collector fills out profile, attaches meishi to inquiry, dealer sees the card.

**Database (1 migration, 2 new tables):**
- `collector_profiles` -- identity + enrichment + Yuhinkai membership + privacy settings
- `user_favorite_artists` -- artist follow/unfollow
- RLS policies for both
- Migration: `supabase/migrations/085_collector_profiles.sql`

**API routes (2 new):**
- `GET/PUT /api/collector-profile` -- read/update collector profile
- `POST /api/collector-profile/photo` -- photo upload to Supabase Storage
- `GET/POST/DELETE /api/artist-favorites` -- follow/unfollow artists

**Profile page redesign (`/profile`):**
- Photo upload, country picker, collecting since
- Alert builder (4 structured paths)
- Enrichment (budget, strategy, philosophy)
- Yuhinkai meishi preview (members only)
- Privacy toggles (members only)
- Existing sections preserved (quick links, data export, sign out, delete)

**Artist favorites:**
- Follow/unfollow button on `/artists/[slug]` pages
- "Followed Artists" section on profile page
- Stored in `user_favorite_artists`

**Taste profile derivation:**
- `src/lib/profile/tasteProfile.ts` -- `deriveTasteProfile()`, `getDemandSpecificity()`, `formatTasteSummary()`
- Used to populate 関心/Focus and 注目/Follows lines on the meishi

**Yuhinkai meishi:**
- `src/components/profile/YuhinMeishi.tsx` -- meishi card renderer (EN + JA)
- `src/lib/profile/meishiText.ts` -- plain-text renderer for email embedding
- Preview on profile page (members only)
- Preview in inquiry modal (members only)

**Inquiry integration (server-side send for members):**
- `POST /api/inquiry/send` -- new endpoint that sends via SendGrid from `@yuhinkai.com`
- "Attach Yuhinkai card" checkbox + "Send from yuhinkai.com" button in InquiryModal (members only)
- Meishi text appended to AI inquiry email body
- `inquiry_history` INSERT with definitive send confirmation
- Non-members keep existing copy-paste flow unchanged

**Admin Yuhinkai management:**
- `/admin/yuhinkai` page or section on `/admin`
- List users with profiles, toggle membership on/off
- Assign email handle (e.g., `christopher.h`) when granting membership
- Set rank (Phase 1: always 会員)

**Email infrastructure:**
- Domain: acquire `yuhinkai.com` (or configure subdomain `yuhinkai.nihontowatch.com`)
- DNS: SPF, DKIM, DMARC records for the sending domain
- SendGrid: sender authentication for `@yuhinkai.com` domain
- Domain warm-up (low volume -- dozens of emails/week)

**Localization:**
- All new UI strings in `en.json` / `ja.json`
- Meishi renders in locale matching the inquiry language
- Budget brackets show JPY/USD based on currency preference

**NOT in Phase 1:**
- NL parser for alert creation (Phase 2)
- Per-inquiry dynamic meishi fields (Phase 2)
- Aggregate demand dashboard (Phase 3)
- Proactive dealer notifications (Phase 3)
- Rank system beyond 会員 (future)

### Phase 2: Context-Aware Meishi + NL Parser + Inbound Forwarding

Once Phase 1 is live and we have data on profile completion and inquiry patterns:

- NL parser for alert creation (extend `semanticQueryParser.ts` + artisan search + LLM fallback)
- Per-inquiry alert matching ("アラート2件がこの出品に該当します")
- Time-in-market signal ("備前刀を8ヶ月間探索中")
- Dealer inquiry history on meishi ("この刀剣商への問い合わせ: 3件目")
- Collection composition relevance ("備前刀5振")
- HTML meishi in email (upgrade from plain text)
- **Inbound email forwarding**: emails sent to `{handle}@yuhinkai.com` forward to the collector's real email (via Cloudflare Email Routing or similar). Dealers can reply to the Yuhinkai address and it reaches the collector without exposing their personal email.

### Phase 3: Dealer Demand Tools

Once collector base has 200+ profiled collectors:

- Aggregate demand dashboard in dealer analytics
- Gap analysis ("collectors want X, you have 0")
- Proactive email notifications when new listing matches N+ alerts
- Demand trends over time

---

## Implementation Chunks (Phase 1 Build Order)

| # | Chunk | Dependencies | Key Files |
|---|-------|-------------|-----------|
| 1 | Database migration | None | `supabase/migrations/085_collector_profiles.sql` |
| 2 | API routes | Chunk 1 | `src/app/api/collector-profile/route.ts`, `src/app/api/artist-favorites/route.ts` |
| 3 | Profile page redesign | Chunk 2 | `src/app/profile/ProfilePageClient.tsx`, `src/components/profile/*` |
| 4 | Artist favorites | Chunk 2 | `src/components/artisan/FollowButton.tsx`, modify `ArtistProfileBar.tsx` |
| 5 | Alert builder | Chunk 2 | `src/components/profile/AlertBuilder.tsx` |
| 6 | Admin Yuhinkai management | Chunk 2 | `/admin/yuhinkai` page |
| 7 | Taste derivation + meishi | Chunks 3-6 | `src/lib/profile/tasteProfile.ts`, `src/components/profile/YuhinMeishi.tsx` |
| 8 | Email infrastructure | Domain acquired | DNS records, SendGrid sender auth for `@yuhinkai.com` |
| 9 | Inquiry integration | Chunks 7-8 | `src/app/api/inquiry/send/route.ts`, modify `InquiryModal.tsx`, `src/lib/profile/meishiText.ts` |

Chunks 3, 4, 5, 6 can be built in parallel after Chunk 2. Chunk 8 (email infra) is a setup task that can run in parallel with everything -- it's DNS records and SendGrid config, not code.

---

## Open Questions

1. **Photo on meishi?** Traditional meishi don't have photos. A small circular photo in the top-right corner adds "real person" trust signal but breaks meishi convention. Current decision: no photo on the meishi itself. Photo lives in the NihontoWatch system (profile page). Revisit if dealers request it.

2. **Photo moderation** -- Do we need to verify photos are real faces? At our scale (hundreds, not millions), manual review by the same admin granting Yuhinkai membership may suffice.

3. **Dealer trust in self-reported data** -- Collectors self-report "collecting since" and budget bracket. Should we show only machine-verifiable fields on the meishi (collection count, alert count, join date)? Current decision: show all fields, trust social pressure + admin curation.

4. **Existing alerts migration** -- Collectors who already have saved searches with notifications: their alerts automatically appear in the taste derivation. No migration needed -- the system reads from `saved_searches` at render time.

5. **Tosogu school vocabulary** -- Alert builder Path C needs tosogu schools (Goto, Omori, Nara, Yokoya, Hamano, Ishiguro, etc.) in addition to sword schools. Finite and well-known list.

6. **Yuhinkai membership criteria** -- Currently pure admin discretion. Should we document informal guidelines for admins? E.g., "has been active for 3+ months, has made inquiries, has collection items." Or keep it fully discretionary.

7. **Domain acquisition** -- Need to acquire `yuhinkai.com` (preferred) or use a subdomain like `yuhinkai.nihontowatch.com`. The standalone domain is more prestigious but requires purchase + DNS setup. The subdomain is free and immediate but less impressive on a meishi. Check availability of `yuhinkai.com`, `.jp`, `.io`.

8. **Email handle format** -- `firstname.lastinitial` (e.g., `christopher.h`) is natural and compact. But with ~50-100 members, collisions are unlikely. Should we allow custom handles (e.g., `bizen-collector`) or keep it name-based for formality? Name-based matches meishi conventions.

9. **Spam/abuse** -- Server-side sending means we're responsible for deliverability. A member sending inappropriate emails reflects on the `@yuhinkai.com` domain. Admin curation is the primary safeguard (only vetted members can send), but should we add rate limiting (e.g., max 5 inquiries/day) or content review?

---

## Research Context

### Platforms Studied

| Platform | Model | Key Takeaway |
|----------|-------|-------------|
| **Artsy** | Dual-sided profiles: collector manages, gallery sees on inquiry. Alerts = demand signal. | Gold standard. Our meishi + demand dashboard directly inspired by this. |
| **Discogs** | Wantlist + collection = identity. Sellers see demand aggregates. | Want list with priority tiers. Collection-as-signal. |
| **Heritage Auctions** | Catalog-driven want list with auto-matching. | Structured catalog matching -- nihonto vocabulary enables this. |
| **1stDibs** | Identity verification for high-value transactions. | Verified buyer badge creates dealer trust. Our Yuhinkai membership is the elevated version. |
| **Chrono24** | Authentication of items, not profiling of buyers. | Less relevant for our model. |
| **MyArtBroker** | Specialist-mediated matching, private portfolio. | White-glove concierge model. Relevant for our scale. |
| **NMB (Nihonto Message Board)** | Forum reputation via post history. No structured profiles. | Our opportunity: structured profiles + curated membership where NMB has none. |

### Key Insight

The nihonto market's structured vocabulary (era, school, smith, certification, type) makes it **uniquely well-suited** for a catalog/attribute-driven taste profile. Most collectible markets lack this level of taxonomy. We exploit this through the alert builder, which lets collectors express interest at whatever granularity feels natural -- from "all katana" to "Kanemitsu specifically" -- and the system captures it as structured data.

The Yuhinkai brand elevates this from "website feature" to "collecting society membership" -- a framing that resonates with the Japanese dealer ecosystem where organizational affiliation carries real weight.
