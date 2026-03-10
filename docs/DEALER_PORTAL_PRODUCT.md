# Dealer Portal — Product Document

> **Status:** Phase 1 shipped (behind feature flag). Unified collection architecture (dealer + collector) complete. See implementation status below.
> **Last updated:** 2026-03-10
> **Authors:** Christopher Hill, Claude

---

## Table of Contents

1. [Vision](#1-vision)
2. [Strategic Position](#2-strategic-position)
3. [Sokendo MVP — The First Dealer](#3-sokendo-mvp--the-first-dealer)
4. [Critical Function Hierarchy](#4-critical-function-hierarchy)
5. [The Optimized Listing Flow](#5-the-optimized-listing-flow)
6. [The Killer Feature: Yuhinkai Catalog Integration](#6-the-killer-feature-yuhinkai-catalog-integration)
7. [Dealer Onboarding](#7-dealer-onboarding)
8. [Listing Management](#8-listing-management)
9. [Messaging System](#9-messaging-system)
10. [Analytics Dashboard](#10-analytics-dashboard)
11. [Monetization Model](#11-monetization-model)
12. [Japanese Cultural Design Principles](#12-japanese-cultural-design-principles)
13. [Mobile Experience](#13-mobile-experience)
14. [Go-to-Market](#14-go-to-market)
15. [Phased Roadmap](#15-phased-roadmap)
16. [What We Already Have](#16-what-we-already-have)
17. [SOTA Patterns Stolen](#17-sota-patterns-stolen)
18. [Open Questions](#18-open-questions)

---

## 1. Vision

A dealer portal that lets nihonto dealers log in, manage their inventory, communicate with collectors, and access Yuhinkai certification data — all from a single interface.

**One-liner:** The Bloomberg Terminal for nihonto dealers.

**Core value propositions:**
- **For dealers:** Verified listings enriched with Yuhinkai data, collector engagement signals, market intelligence, and a direct communication channel with serious buyers.
- **For collectors:** Higher-quality data, faster listings, direct dealer communication, and trust signals (verified badges, response times).
- **For NihontoWatch:** Better data quality, dealer revenue stream, messaging lock-in, and the transition from scraper-dependent to dealer-powered.

---

## 2. Strategic Position

### The Phase Transition

We currently scrape 52 dealers' inventories. The dealer portal flips the relationship — instead of us crawling their sites, they push to us directly.

| Today (Scraper-First) | Tomorrow (Dealer-First) |
|---|---|
| We guess their data | They confirm their data |
| 24-48h scrape delay | Instant listing |
| Attribution inferred by ML | Attribution verified by dealer |
| Cert extracted from HTML | Cert linked to Yuhinkai record |
| No dealer-collector messaging | Direct threaded conversations |
| Dealers are passive subjects | Dealers are invested participants |

### What Makes Us Categorically Different

No other marketplace in this space has:

1. **Yuhinkai catalog integration** — 13,572 artisans, full NBTHK certification history, setsumei text, provenance records. One click auto-populates a listing with verified data.
2. **Complete market visibility** — We see ALL 52 dealers' inventories. Market comparables are real, not estimated.
3. **Collector intelligence** — We know who saves, views, clicks, and searches. Dealers get signals about buyer seriousness without us revealing identities.
4. **Artisan profile linkage** — Every listing auto-connects to a rich artisan profile with elite factor, cert pyramid, blade form analysis, and lineage.
5. **Bilingual reach** — Japanese dealers automatically reach English-speaking collectors worldwide via our translation pipeline.

---

## 3. Sokendo MVP — The First Dealer

### The Opportunity

Sokendo (創建堂) is the kingmaker dealer. They do NOT sell via their website — they're old school. But they have a significant amount of unlisted stock that is a headache to manage. A contact who works at Sokendo will be the first user, using the mobile browser app to upload listings and receive inquiries via LINE.

This changes everything about our MVP. We don't need the "claim your inventory" flow (Sokendo has zero scraped data). We don't need desktop optimization. We don't need analytics dashboards. We need exactly one thing: **a mobile listing tool that's faster than not using it.**

### What the Sokendo MVP Eliminates

| From Full Product Vision | Status |
|---|---|
| Inventory claim flow | **Cut.** No scraped data to claim. |
| Scraper coexistence logic | **Cut.** They have no website. |
| Desktop optimization | **Cut.** Phone browser is THE platform. |
| Analytics dashboard | **Cut for MVP.** They care about selling, not charts. |
| Market comparables | **Cut for MVP.** |
| Weekly digest | **Cut.** |
| CSV bulk import | **Cut.** |
| Custom dealer profile | **Cut.** Auto-generate from listings. |
| Complex onboarding wizard | **Cut.** The contact already knows the system. |
| Full messaging inbox with threads | **Cut for MVP.** LINE IS the inbox. |

### What We Actually Build

The complete product loop:

```
Sokendo staff's phone:
  1. Open browser → /dealer
  2. See my listings (grid)
  3. Tap [+] → add new item
  4. Take photos
  5. Nihonto or Tosogu?
  6. Select type (Katana, Tsuba, etc.)
  7. Pick cert type
  8. Search artisan (optional)
  9. Set price
  10. Publish

→ Collector sees listing on NihontoWatch
→ Collector taps "Inquire"
→ Sokendo gets LINE notification
→ Deal happens offline
```

### Screen 1: Dealer Home (`/dealer`)

Mobile grid of their listings. Same `ListingCard` we use in browse, filtered to this dealer. FAB to add new listing.

```
┌─────────────────────────────────┐
│ ☰  Sokendo            [+]      │
├─────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐    │
│ │           │ │           │    │
│ │  (photo)  │ │  (photo)  │    │
│ │           │ │           │    │
│ │ Juyo      │ │ Hozon     │    │
│ │ Kanemitsu │ │ Wakizashi │    │
│ │ ¥3,500,000│ │ ¥480,000  │    │
│ └───────────┘ └───────────┘    │
│ ┌───────────┐ ┌───────────┐    │
│ │           │ │           │    │
│ │  (photo)  │ │  (photo)  │    │
│ │           │ │           │    │
│ │ Tokuju    │ │ No cert   │    │
│ │ Sadamune  │ │ Tsuba     │    │
│ │ Ask       │ │ ¥120,000  │    │
│ └───────────┘ └───────────┘    │
│                                 │
│ ● Available (4)  ○ Sold (2)    │
│                                 │
│              [＋]               │  ← FAB
└─────────────────────────────────┘
```

Tap any card → QuickView mobile sheet (existing) with dealer controls: **Edit**, **Mark Sold**, **Withdraw**.

**Reuses:** `ListingCard`, `ListingGrid`, QuickView mobile sheet, mobile view toggle.
**New:** `/dealer` page, status filter tabs, FAB, dealer action buttons in QuickView.

### Screen 2: Add Listing (Detailed in [Section 5](#5-the-optimized-listing-flow))

Mobile-first form. Photos → Category → Type → Cert → Artisan → Price → Publish. Full UX spec in Section 5.

### Screen 3: QuickView with Dealer Controls

When the Sokendo staff taps one of their own listings, the existing QuickView mobile sheet opens with an extra dealer action row:

```
┌─────────────────────────────────┐
│ ━━━  (drag handle)              │
├─────────────────────────────────┤
│                                 │
│  [✏️ Edit] [Sold ✓] [Withdraw] │
│                                 │
│  ┌─────────────────────────┐   │
│  │       (sword photo)     │   │
│  └─────────────────────────┘   │
│                                 │
│  Juyo Token Katana              │
│  Kanemitsu (KAN042)             │
│  ¥3,500,000                     │
│                                 │
│  Nagasa: 71.8cm  Sori: 1.6cm   │
│  Era: Nanbokucho                │
│  School: Osafune                │
│                                 │
│  👁 47 views  ❤️ 3 saves       │  ← Minimal analytics inline
│                                 │
└─────────────────────────────────┘
```

**"Sold" is one tap.** No confirmation dialog. Undo available from the listing grid (toggle back to available). Speed matters — the staff just handed a sword to a buyer and is updating while wrapping the koshirae.

### The LINE Notification Flow

When a collector taps "Inquire" on a Sokendo listing:

```
Collector taps "Inquire" on NihontoWatch
         │
         ▼
Inquiry stored in DB (new `inquiries` table)
         │
         ├──→ LINE Notify webhook → Sokendo's LINE
         │    "新しいお問い合わせ: Juyo Katana - Kanemitsu
         │     From: Christopher H. (Collector tier)
         │     https://nihontowatch.com/dealer/inquiries/123"
         │
         └──→ Email (backup) → Sokendo's email
```

**MVP messaging is intentionally minimal:**
1. Collector writes a message and hits send
2. Message stored in DB
3. LINE notification fires with message text + link
4. Sokendo reads the message at the link
5. Sokendo replies via the NW page (or takes it to LINE/email/phone directly)

No full real-time messaging system needed for MVP. The value is the **initial connection**, not the ongoing thread.

**LINE Notify is trivial:** Single HTTP POST to `https://notify-api.line.me/api/notify` with a bearer token. The Sokendo contact generates a token from their LINE account, enters it in dealer settings, done.

### The Collector Side

On the browse page, Sokendo's listings appear like any other dealer's. But instead of "Visit Dealer" (goes nowhere — no website), the primary CTA is:

```
┌─────────────────────────────────┐
│  Sokendo 創建堂                 │
│  "Usually responds within 4h"   │
│                                 │
│  ┌─────────────────────────┐   │
│  │      💬 Inquire         │   │  ← Primary CTA
│  └─────────────────────────┘   │
│                                 │
│  Verified Dealer ✓              │
└─────────────────────────────────┘
```

The "Inquire" button opens a simple form:

```
┌─────────────────────────────────┐
│  Inquire about:                 │
│  Juyo Katana - Kanemitsu        │
│                                 │
│  ┌─────────────────────────┐   │
│  │ こちらの作品について、   │   │
│  │ 詳しくお伺いしたく      │   │
│  │ 存じます。              │   │
│  │                         │   │
│  │ (cursor)                │   │
│  └─────────────────────────┘   │
│                                 │
│  Your profile will be shared:   │
│  Christopher H. · Collector     │
│  Member since 2024 · 12 items   │
│                                 │
│  ┌─────────────────────────┐   │
│  │      Send Inquiry       │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

Pre-populated with a polite Japanese opening. Collector can edit or replace. Collector's profile context shown so they know what the dealer will see.

### The Complete Build List

| # | Component | New vs. Reuse | Effort |
|---|---|---|---|
| 1 | Dealer auth role + login | Extend existing auth | Small |
| 2 | `/dealer` page (listing grid) | Reuse `ListingCard` + `ListingGrid` | Small |
| 3 | Dealer listing API (CRUD) | New API routes | Medium |
| 4 | Add Listing form (mobile) | New page, reuse `ImageUploadZone`, `ArtisanSearchPanel`, `CertPillRow` | Medium |
| 5 | Auto-title generation | New utility | Small |
| 6 | QuickView dealer action bar | Extend existing QuickView | Small |
| 7 | `inquiries` table + API | New DB table + API route | Medium |
| 8 | "Inquire" button on listings | Replace/augment existing CTA | Small |
| 9 | Inquiry form (collector side) | New modal component | Small |
| 10 | LINE Notify integration | Single webhook POST | Small |
| 11 | Dealer settings page (LINE token) | New page | Small |
| 12 | `source` column on listings | New column: `'scraper'` vs `'dealer'` | Small |

**6 small, 4 medium, 0 large.** The heavy lifting is already done — ListingCard, QuickView, ImageUploadZone, ArtisanSearchPanel, CertPillRow all exist.

---

## 4. Critical Function Hierarchy

### Tier 0: Existential (Get any one wrong and the portal dies)

**1. Inquiry Inbox (LINE Notification)**
**2. Yuhinkai Catalog Lookup**
**3. Inventory Management + Status**

### Tier 1: Retention (Without these, dealers churn within 60 days)

**4. Notification Delivery (multi-channel: LINE + email)**
**5. Listing Creation with Photo Upload**
**6. Analytics (basic — inline view/save counts)**

### Tier 2: Growth (Drive upgrades and word-of-mouth)

**7. Market Comparables**
**8. Auto-Translate on Messages**
**9. Collector Context on Inquiries**

### Tier 3: Polish (Build when core is solid)

10. CSV bulk import/export
11. Custom dealer profiles
12. Weekly digest emails
13. API inventory sync
14. Competitor monitoring

### Why This Order

#### 1. Inquiry Inbox — THE Most Important Function

This is what makes a dealer open NihontoWatch every morning. Not analytics. Not listing management. **Inquiries are money sitting in a mailbox.**

Without it, the portal is a prettier admin panel with no reason to log in. With it, we're where deals start.

**Failure modes:**
- Dealer doesn't know they have an inquiry → collector waits, gives up, never uses messaging again
- Notification goes to spam → same but worse, dealer blames us
- Translation garbles a nuanced message → worse than no translation
- Collector sees "Usually responds within 72 hours" → never inquires

**The chicken-and-egg problem:** Collectors won't use messaging if dealers don't respond. Dealers won't check if collectors don't use it.

**Solution:** Launch messaging with a collector-facing UX change: replace "Visit Dealer" with a prominent "Inquire" button for participating dealers. Make it the default, frictionless action (one tap, pre-populated greeting, send). For the first 30 days, manually monitor response times and nudge dealers with unread inquiries.

**Success metric:** ≥50% of inquiries on participating dealers' listings go through NihontoWatch within 90 days.

#### 2. Yuhinkai Catalog Lookup — The Moat

This is what no competitor can replicate. Primary justification for the Professional tier.

Manual Juyo listing: research attribution, type measurements, write description. **20-30 minutes.** With Yuhinkai lookup: upload photos, search, link, set price. **60 seconds.**

**Failure modes:**
- Search returns too many results → dealer can't find the record, gives up
- Search returns nothing (cert not in DB) → needs graceful fallback to manual entry
- Linked data has errors → dealer's listing has wrong measurements, trust destroyed
- Lookup is slow (>3s) → dealer won't wait

**Success metric:** ≥80% of Juyo/Tokuju listings created by Professional+ dealers use Yuhinkai lookup within 60 days.

#### 3. Inventory Management + Status — The Daily Utility

A dealer sells a sword. They pull out their phone, swipe to mark sold. 5 seconds. If this is clunky, slow, or multi-tap, they forget to update, data goes stale, collectors contact about sold items, trust collapses.

**The hardest design decision: scraper vs. dealer conflict.** When scraper and dealer disagree on status:

**Recommendation: Dealer edits always win (Option C with nudge).** Once a dealer claims inventory, their edits are authoritative. Scraper continues but only generates notifications: "We noticed this item may no longer be on your website. Want to update?" Dealer can dismiss or act. Never auto-change a dealer-claimed listing.

For Sokendo MVP this is moot — they have no website, so no scraper conflict.

**Success metric:** ≥60% of invited dealers claim at least one listing within 14 days.

### The Dependency Chain

```
                    ┌──────────────────┐
                    │ 3. INVENTORY     │
                    │    MANAGEMENT    │◄── Must exist first.
                    │    + STATUS      │    No inventory = nothing
                    └────────┬─────────┘    to inquire about.
                             │
              ┌──────────────┼──────────────┐
              ▼                              ▼
   ┌──────────────────┐          ┌──────────────────┐
   │ 2. YUHINKAI      │          │ 1. INQUIRY       │
   │    CATALOG       │          │    INBOX          │◄── Highest value
   │    LOOKUP        │          │    (LINE)         │    but needs
   └──────────────────┘          └──────────────────┘    inventory first.
         │                              │
         │    Better listings           │    Revenue +
         │    drive more...             │    habit
         │                              │
         └──────────────┬───────────────┘
                        ▼
              ┌──────────────────┐
              │ RETENTION LOOP   │
              │ Better listings  │
              │ → More views     │
              │ → More inquiries │
              │ → Dealer logs in │
              │ → Updates status │
              │ → Better data    │
              │ → More trust     │
              │ → More collectors│
              │ → More inquiries │
              └──────────────────┘
```

**Build order:** Inventory Management → Listing Creation + Yuhinkai → Inquiry + LINE Notifications.

### Hidden Tier 0.5: Notification Delivery

Not a "feature" anyone lists in a spec, but if it fails, the inquiry inbox becomes invisible.

| Channel | Latency | Reliability | Dealer Effort |
|---|---|---|---|
| LINE Notify | Seconds | High in Japan | Passive (push) |
| Email | Minutes | High if not spam-filtered | Passive (push) |
| In-app badge | Instant | High but requires dealer to be on site | Active (pull) |

**For Japanese dealers, LINE is more reliable than email.** Most Japanese small business owners check LINE constantly. Email sits unread.

**Rule:** Every new inquiry triggers at least TWO notification channels. LINE + email. Belt and suspenders. A missed inquiry is unforgivable.

### What to Explicitly DEFER

| Feature | Why Defer |
|---|---|
| CSV bulk import | Power user feature. Manual listing covers 90% of use cases. |
| Custom dealer profiles | Vanity. Ship a basic auto-generated profile. |
| Weekly digest emails | Marketing, not product. Add once there's activity to report. |
| API inventory sync | Only the 3-4 most tech-savvy dealers need this. |
| Competitor monitoring | Culturally sensitive (uchi/soto). Needs careful design. |
| Market comparables | Needs enough transaction data. Half-baked comparables are worse than none. |
| Native mobile app | Responsive web is sufficient. |
| Closing fees | Need messaging volume data first. Launch flat fee only. |
| "Reserved" status | Adds complexity. Launch with simpler draft → listed → sold → withdrawn. |
| Canned response templates | Dealers copy-paste from their own notes. Pre-built feels impersonal. |

---

## 5. The Optimized Listing Flow

### Design Principles

The Sokendo contact will use this form dozens of times per session, listing 10-20 items in a sitting. The flow optimizes for **repetition**, not first-use onboarding.

**Target: 5 active decisions to publish. Under 60 seconds for an experienced user.**

### The Flow, Tap by Tap

```
[+] FAB tap
    │
    ▼
┌─ PHOTOS ─────────────────────────────┐
│                                       │
│  Camera opens directly                │
│  (not "choose camera or gallery")     │
│                                       │
│  Snap → snap → snap → Done           │
│                                       │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│  │ 1  │ │ 2  │ │ 3  │ │ +  │        │
│  └────┘ └────┘ └────┘ └────┘        │
│                                       │
│  Drag to reorder. First = thumbnail. │
└───────────────────────────────────────┘
    │
    ▼  Decision 1: Category
┌─ NIHONTO or TOSOGU ──────────────────┐
│                                       │
│  ┌──────────────┐ ┌──────────────┐   │
│  │     🗡️       │ │     ⚙️       │   │
│  │   Nihonto    │ │   Tosogu     │   │
│  │   刀剣       │ │   刀装具      │   │
│  └──────────────┘ └──────────────┘   │
│                                       │
│  Remembers last selection.            │
│  3 katanas in a row → Nihonto        │
│  pre-selected on next listing.       │
└───────────────────────────────────────┘
    │
    ▼  Decision 2: Type (pills animate in based on category)
┌─ TYPE ───────────────────────────────┐
│                                       │
│  If Nihonto:                          │
│  [Katana] [Wakizashi] [Tanto]        │
│  [Tachi]  [Naginata]  [Other]        │
│                                       │
│  If Tosogu:                           │
│  [Tsuba] [Fuchi-Kashira] [Menuki]    │
│  [Kozuka] [Kogai]  [Other]           │
│                                       │
│  Also remembers last selection.       │
└───────────────────────────────────────┘
    │
    ▼  Decision 3: Certification
┌─ CERT ───────────────────────────────┐
│                                       │
│  [Tokuju] [Juyo] [TokuHo]           │
│  [Hozon]  [None]                     │
│                                       │
│  One tap. Color fills in.            │
│  Tokuju = purple, Juyo = blue, etc.  │
│  Same cert color system as browse.   │
│  Does NOT remember last selection    │
│  (changes every item).               │
└───────────────────────────────────────┘
    │
    ▼  Decision 4: Artisan (optional)
┌─ ARTISAN ────────────────────────────┐
│                                       │
│  [🔍 Search artisan name...      ]   │
│                                       │
│  Type "Kane" →                        │
│  ┌─────────────────────────────┐     │
│  │ Kanemitsu  兼光  KAN042     │     │
│  │ Osafune · Nanbokucho · 0.87 │     │
│  ├─────────────────────────────┤     │
│  │ Kanesada  兼定  KAN108      │     │
│  │ Seki · Muromachi · 0.34     │     │
│  ├─────────────────────────────┤     │
│  │ Kaneuji  兼氏  KAN055       │     │
│  │ Shizu · Nanbokucho · 0.71   │     │
│  └─────────────────────────────┘     │
│                                       │
│  Tap result → auto-fills:            │
│  era, school, province, title        │
│                                       │
│  [Skip — no artisan match]           │
│                                       │
│  Search scope auto-filtered:          │
│  Nihonto → domain sword/both         │
│  Tosogu → domain tosogu/both         │
│  (Uses existing getDomainFilter())   │
└───────────────────────────────────────┘
    │
    ▼  Decision 5: Price
┌─ PRICE + TITLE ──────────────────────┐
│                                       │
│  Title (auto-generated, editable)     │
│  ┌─────────────────────────────────┐ │
│  │ Juyo Katana — Kanemitsu        │ │
│  └─────────────────────────────────┘ │
│  Builds live as you fill fields.     │
│                                       │
│  Price                                │
│  ┌──────────────┐                    │
│  │ ¥            │  ☐ Ask             │
│  └──────────────┘                    │
│  Numeric keyboard only.              │
│                                       │
│  Notes (optional, collapsed)          │
│  ▸ Add condition notes, details...   │
│                                       │
└───────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│  ┌──────────────────────────────┐   │
│  │       Publish Listing        │   │
│  └──────────────────────────────┘   │
│  [Save Draft]                        │
└──────────────────────────────────────┘
    │
    ▼  After publish:
┌──────────────────────────────────────┐
│  ✓ Listed                            │
│                                      │
│  ┌──────────────────────────────┐   │
│  │       Add Another            │   │  ← Critical for batch listing
│  └──────────────────────────────┘   │
│  [Back to My Listings]              │
└──────────────────────────────────────┘
```

### Why This Order: Photos → Category → Type → Cert → Artisan → Price

Each step narrows the next:

| Step | What it determines downstream |
|---|---|
| **Photos** | Nothing logically — but it's the physical action (point camera at sword), so it comes first |
| **Category** (Nihonto/Tosogu) | Determines which Type pills appear AND which artisan search domain |
| **Type** (Katana/Tsuba/...) | Feeds into auto-title |
| **Cert** (Juyo/Hozon/...) | Feeds into auto-title, determines cert color badge |
| **Artisan** (optional) | Auto-fills era, school, province, title suffix. Sets artisan badge + elite factor |
| **Price** | Last because everything else informs how the dealer thinks about pricing |

The category split at step 2 is critical because Nihonto and Tosogu have:
- Different type options
- Different artisan search scope (`getDomainFilter()` — already built)
- Different measurement fields (nagasa/sori vs height/width — deferred for MVP)
- Different field mapping (`smith`/`school` vs `tosogu_maker`/`tosogu_school` — handled by `getAttributionName()`/`getAttributionSchool()`)

### The "Sticky Memory" Pattern

The Sokendo contact is batch-listing: 8 katanas then 4 tsuba. The form remembers some fields:

| Field | Sticky? | Rationale |
|---|---|---|
| Category (Nihonto/Tosogu) | **Yes** | Batch sessions are usually same category |
| Type (Katana/Tanto/...) | **Yes** | Often listing multiple of same type |
| Cert | **No** | Changes per item. Don't assume. |
| Artisan | **No** | Changes per item |
| Price | **No** | Changes per item |

When "Add Another" is tapped: photos, cert, artisan, title, and price reset. Category and Type are pre-selected from the previous listing with a subtle highlight: "same as last time — tap to change."

**Result: For the second katana in a row, the flow is:**

```
[+] → snap photos → (Nihonto pre-selected ✓) → (Katana pre-selected ✓)
    → tap cert → maybe search artisan → enter price → Publish

3 decisions instead of 5. Under 40 seconds.
```

### Auto-Title Engine

Title builds live as the form fills in:

```
{cert} {type} — {artisan}
```

| Filled Fields | Generated Title |
|---|---|
| Cert: Juyo | "Juyo" |
| + Type: Katana | "Juyo Katana" |
| + Artisan: Kanemitsu | "Juyo Katana — Kanemitsu" |
| No cert + Type: Tsuba | "Tsuba" |
| + Artisan: Nobuie | "Tsuba — Nobuie" |
| Cert: Hozon + Type: Wakizashi, no artisan | "Hozon Wakizashi" |

Always visible and editable. In most cases the auto-generated title is exactly right.

For Japanese locale, both `title` and `title_ja` are generated:
```
EN: "Juyo Katana — Kanemitsu"
JA: "重要刀剣 刀 — 兼光"
```

The dealer doesn't think about localization.

### Photo UX

The `[+]` FAB opens camera directly via `<input type="file" accept="image/*" capture="environment">`. On iOS/Android this opens the camera — no dialog.

Gallery access is available as a secondary option (for photos taken earlier):

```
┌─ Photos ─────────────────────────────┐
│  ┌────┐ ┌────┐ ┌────┐               │
│  │ 📷 │ │ 📷 │ │    │               │
│  │    │ │    │ │ +  │               │
│  └────┘ └────┘ └────┘               │
│                                       │
│  [📸 Camera]  [🖼 Gallery]           │
│   (primary)     (secondary)           │
└───────────────────────────────────────┘
```

**Drag to reorder.** First photo = ListingCard thumbnail + smart crop source.

### Fields We Skip Entirely

| Field | Why Skip |
|---|---|
| Measurements (nagasa, sori) | Auto-filled from Yuhinkai if artisan/cert linked. Tedious on phone. |
| Era, school, province | Auto-filled from artisan selection. Never ask manually. |
| Mei type (signed/unsigned) | Not critical for initial listing. Defer. |
| Description/raw_page_text | Optional "Notes" field covers this. |
| Material (tosogu) | Defer. |
| Images JSONB / stored_images | System-managed, not user-facing. |

**Principle: If a field can be derived from another field, don't ask for it.** Artisan selection fills 5+ fields. Cert selection fills cert_type and cert_organization.

### Single Scrollable Page (Not a Wizard)

The form is one scrollable page, not a multi-step wizard. The contact will use this dozens of times — a wizard (Next → Next → Next) adds taps and feels slow for repeat use.

Sections below the current step are visually muted (lower opacity) until the preceding step is completed — gentle guidance without hard blocking. The user can always scroll back and change anything.

**Publish button is sticky** at the bottom of the viewport once minimum required fields (photo + category + type + cert + price) are filled. No scrolling to submit.

```
┌─────────────────────────────────┐
│ ←  New Listing                  │
├─────────────────────────────────┤
│                                 │
│  PHOTOS                        │  ← Active
│  [camera / gallery thumbnails] │
│                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                 │
│  CATEGORY                       │  ← Active
│  [Nihonto]  [Tosogu]           │
│                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                 │
│  TYPE                           │  ← Muted until category
│  [Katana] [Waki] [Tanto] ...   │
│                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                 │
│  CERTIFICATE                    │  ← Muted until type
│  [Tokuju] [Juyo] [TokuHo] ... │
│                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                 │
│  ARTISAN (optional)             │
│  [🔍 Search artisan name...]   │
│                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                 │
│  TITLE                          │
│  [auto-generated, editable]    │
│                                 │
│  PRICE                          │
│  [¥          ]    ☐ Ask         │
│                                 │
│  ▸ Notes (optional)             │
│                                 │
│  ┌─────────────────────────┐   │  ← Sticky when ready
│  │     Publish Listing     │   │
│  └─────────────────────────┘   │
│  [Save Draft]                   │
└─────────────────────────────────┘
```

---

## 6. The Killer Feature: Yuhinkai Catalog Integration

When a dealer adds a Juyo sword, the flow is:

```
1. Dealer uploads 4 photos
2. Selects certification type: Juyo
3. Searches: "Session 65, Item 12" — or — "Kanemitsu, Juyo"
4. System returns the EXACT Yuhinkai catalog record:
   ─────────────────────────────────────────
   Smith:        備前国長船兼光 (Bizen Osafune Kanemitsu)
   Artisan Code: KAN042
   Elite Factor: 0.87
   Measurements: 71.8cm nagasa, 1.6cm sori
   Setsumei:     [full NBTHK description text]
   Provenance:   5 prior ownership records
   ─────────────────────────────────────────
5. Dealer clicks [Link This Record]
6. Listing auto-populated with verified data
7. Dealer adds: price, condition notes, done.
```

**Time savings:** 30 seconds vs. 30 minutes of manual data entry per listing.

**Data quality:** Measurements, attribution, and certification verified against NBTHK records — not hand-typed by a busy dealer.

**No other platform on earth can do this.** Chrono24 has reference numbers for watches. We have the NBTHK's entire certification history.

### Listing Creation

See [Section 5: The Optimized Listing Flow](#5-the-optimized-listing-flow) for the full mobile-first listing creation UX spec, including the Nihonto/Tosogu category split, sticky memory pattern, auto-title engine, and photo UX.

---

## 7. Dealer Onboarding

### The Hook: "We Already Know You"

When a dealer first logs in, they don't see an empty dashboard. They see their existing inventory:

> "We found 347 of your listings already on NihontoWatch. Claim your inventory to take control of your data."

Pattern stolen from: Google My Business ("Claim your listing") + Chrono24 ("Auto-import from existing store").

### Onboarding Flow

```
Step 1: Dealer Verification
  ├── Domain verification (email to admin@dealerdomain.com)
  ├── OR manual admin approval (for dealers without domains)
  └── First 3 listings require admin review (quality gate)

Step 2: Claim Existing Inventory
  ├── Show scraped listings from their domain
  ├── Dealer reviews, corrects errors, confirms
  └── Frame as "verify and enhance" — NOT "we got it wrong"

Step 3: Set Up Profile
  ├── Dealer logo
  ├── Business description (JP + EN)
  ├── Contact preferences (message hours, languages)
  └── Specialties (swords, tosogu, koshirae, etc.)

Step 4: First Listing Wizard (simplified)
  ├── 5 fields: photo, title, type, cert, price
  ├── "Publish basic listing now, add details later"
  └── Unlocks full form after first successful listing
```

### Scraper Coexistence

When a dealer claims their inventory, the scraper doesn't stop. Instead:

- **Scraper continues** for availability/price monitoring and new item detection
- **Dealer edits are authoritative** — they override scraped data
- **Dealer-uploaded items** are marked `source: 'dealer'` (vs. `source: 'scraper'`)
- **Conflict resolution:** If the scraper detects a status change (e.g., item disappears from dealer site), notify the dealer rather than auto-changing status

This hybrid approach means dealers get value immediately (no cold-start) and we maintain data freshness even if a dealer stops logging in.

---

## 8. Listing Management

### Status Workflow

```
INTAKE → DRAFT → LISTED → RESERVED → SOLD
                    │                    │
                 WITHDRAWN           ARCHIVED
```

| Status | Visibility | Description |
|---|---|---|
| **Intake** | Dealer only | Private record. Dealer acquired item but isn't ready to list. |
| **Draft** | Dealer only | Adding photos, linking Yuhinkai, setting price. Auto-saves per field. |
| **Listed** | Public | Live on NihontoWatch. Visible in browse. |
| **Reserved** | Public (marked) | On hold for a specific buyer. Visible but marked "Reserved." |
| **Sold** | Public (marked) | Marked sold. Price hidden per sold-price-hiding policy. |
| **Withdrawn** | Dealer only | Removed from browse. Kept in dealer's archive. |
| **Archived** | Dealer only | Sold/withdrawn items move here after 30 days. |

### Inventory Management Features

- **Bulk status changes:** Select multiple items → mark as sold/withdrawn
- **Auto-save per field:** Every field change saves to draft with visible "Saved 2m ago" feedback
- **Draft expiration:** 60-day expiry on untouched drafts (notification at 45 days)
- **CSV import/export** (Premium tier): Download inventory as CSV, edit in Excel, re-upload with diff preview
- **Quick actions:** Swipe-to-mark-sold on mobile, one-click price adjustment
- **Status history log:** Full audit trail with timestamps

---

## 9. Messaging System

### Architecture: Listing-Anchored Threaded Conversations

Every conversation is tied to a specific listing. This gives dealers context and gives us attribution.

```
┌────────────────────────────────────────────┐
│ Inbox                            (3 new)   │
├────────────────────────────────────────────┤
│ 🔵 Christopher H. — Juyo Kanemitsu       │
│    "I've been looking for a Bizen..."      │
│    2 hours ago                             │
│                                            │
│ 🔵 Tanaka-san — Tokuju Sadamune          │
│    "運送方法について..."                    │
│    5 hours ago                             │
│                                            │
│    Mike R. — Hozon Wakizashi              │
│    "What's the condition of the..."        │
│    Yesterday                               │
└────────────────────────────────────────────┘
```

### Collector Context in Inquiry View

When a dealer opens an inquiry, they see enough to judge seriousness without revealing private data:

```
┌─ Inquiry from: Christopher H. ──────────────────┐
│                                                   │
│  Member since: 2024                               │
│  Tier: Collector                                  │
│  Collection: 12 items (7 Juyo, 2 Tokuju)         │
│  Previous purchases from you: 1 (2024)            │
│  Verified: ✓                                      │
│                                                   │
│  "I've been looking for a Bizen Kanemitsu         │
│   to complement my Nanbokucho collection.         │
│   Could you tell me more about the polish         │
│   condition and koshirae?"                         │
│                                                   │
│  [Reply]                                          │
└───────────────────────────────────────────────────┘
```

The collector's subscription tier functions as a credential — a signal of seriousness to the dealer. This aligns with our paywall strategy: "Tier as credential. Subscription signals seriousness to Japanese dealers."

### Key Messaging Features

| Feature | Detail |
|---|---|
| **Auto-translate** | JP dealer types Japanese, EN collector sees English (and vice versa). Uses existing `/api/translate` pipeline. |
| **Canned responses** | Dealer-customizable templates: "Thank you for your interest. This piece is..." |
| **Response time tracking** | Avg response time displayed on dealer profile as trust signal. |
| **Push notifications** | Email + in-app for new inquiries. Configurable by dealer. |
| **Read receipts** | Dealer sees when collector has read their message. |
| **Real-time delivery** | Supabase Realtime for live message updates. |

### What We Explicitly Do NOT Build

- **No "Make an Offer" button.** Negotiation happens naturally in conversation. Formalizing it is culturally inappropriate in the Japanese sword market (see [Section 12.6](#126-阿吽の呼吸-aun-no-kokyuu--unspoken-understanding)).
- **No "lead score" or "conversion funnel."** These concepts would be deeply off-putting to Japanese dealers who see themselves as custodians, not salespeople.
- **No automated follow-ups.** "You haven't responded in 24 hours!" pressure tactics destroy trust. Show response time metrics passively; never nag.

---

## 10. Analytics Dashboard

### Dealer Self-Serve View

We already track views, clicks, dwell time, favorites, and conversions via the existing dealer analytics infrastructure (`/admin/dealers/[id]`). The dealer portal repackages this as a self-serve dashboard.

```
┌─────────────────────────────────────────────────────┐
│ Your Performance This Week                          │
│                                                     │
│  👁 1,247 views     ❤️ 34 saves                    │
│  🖱 89 click-throughs   💬 7 inquiries              │
│                                                     │
│ Top Performers:                                     │
│  1. Juyo Kanemitsu Katana — 187 views              │
│  2. Tokuju Sadamune Tanto — 143 views              │
│  3. Hozon Tsuba (Nobuie) — 98 views               │
│                                                     │
│ Suggestions:                                        │
│  ⚡ 2 items have no photos — listings with 4+      │
│     photos get 3.2x more views                      │
│  ⚡ 1 inquiry unanswered for 18 hours              │
└─────────────────────────────────────────────────────┘
```

### Market Intelligence (Premium Tier Only)

```
┌─────────────────────────────────────────────────────┐
│ Market Comparables — Juyo Kanemitsu                │
│                                                     │
│  Your price:  ¥3,500,000                           │
│  3 similar items currently listed:                  │
│    Dealer A:  ¥3,200,000  (listed 12 days ago)     │
│    Dealer B:  ¥2,800,000  (listed 45 days ago)     │
│    Dealer C:  ¥4,100,000  (listed 3 days ago)      │
│                                                     │
│  Your position: Mid-range                           │
│                                                     │
│  💡 Items priced within 10% of market average      │
│     typically sell 2.1x faster                      │
└─────────────────────────────────────────────────────┘
```

### Design Rules for Analytics

1. **Show absolute metrics, NEVER relative rankings.** "Your listings received 230 views" — not "You're ranked #7 of 52 dealers." Rankings create face issues (see [Section 12.2](#122-面子-mentsu--face)).
2. **Market comparables are dealer-only.** Never expose pricing intelligence to collectors.
3. **Competitor monitoring is opt-in per dealer.** A dealer can say "don't include my prices in competitor comparisons."
4. **Seasonal context.** Dashboard should note natural dips: "Views are typically 20% lower in August" so dealers don't worry during Obon.
5. **Suggestions, not criticisms.** "2 items could benefit from more photos" — not "2 items are missing photos."

---

## 11. Monetization Model

### Why Flat Fee, Not Commission

| Factor | Flat Fee | Commission |
|---|---|---|
| **Payment processing** | We don't process transactions. Can't take a cut of what we don't handle. | Requires us to process payments or rely on self-reporting. |
| **Attribution** | N/A — dealer pays for access. | Unprovable. Collector finds sword on NW, Googles dealer, buys direct. |
| **Cultural fit** | Membership (会員制) feels like joining a guild (組合). Natural for Japanese business. | Commission (手数料) feels extractive (搾取的). Adversarial dynamic. |
| **Incentive alignment** | We're incentivized to make the platform good for ALL items. | We're incentivized to push high-priced items. |
| **Complexity** | One Stripe subscription. | Attribution tracking, disputes, per-transaction invoicing, refund handling. |

### Tiered Pricing

Prices in JPY (primary market is Japanese dealers). Accept payment in any currency via Stripe.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   STARTER              PROFESSIONAL            PREMIUM              │
│   Free                 ¥30,000/mo (~$200)      ¥75,000/mo (~$500)  │
│                                                                     │
│   "Get found"          "Sell smarter"           "Dominate"          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Starter (Free) — Get Them In The Door

The hook. Zero risk. Dealer signs up, sees their scraped inventory, claims it.

| Feature | |
|---|---|
| Claim scraped listings | See and correct what we've already indexed |
| Basic status management | Mark available / sold / withdrawn |
| 5 direct-upload listings | Add items not on their website |
| View count per item | Simple "X people viewed this" |
| NihontoWatch profile page | `/dealers/[slug]` with their inventory |

**Why free?** Claimed listings are BETTER DATA for us. The dealer corrects our scraper mistakes. We get verified attributions, accurate prices, correct status. The free tier is a data quality play disguised as generosity. Also creates giri (reciprocal obligation) — see [Section 12.4](#124-義理-giri--obligation-and-reciprocity).

#### Professional (¥30,000/mo) — The Sweet Spot

80% of revenue comes from this tier. Value prop: "Know what your collectors are thinking."

| Feature | |
|---|---|
| Everything in Starter | + |
| Unlimited direct-upload listings | No cap |
| Full analytics dashboard | Views, saves, clicks, dwell time, trends |
| Messaging inbox (unlimited) | Threaded conversations per listing |
| Yuhinkai cert lookup (10/mo) | Search by session/item → auto-populate listing |
| "Verified Dealer" badge | Trust signal on all listings |
| Response time badge | "Usually responds within 3 hours" |
| Auto-translate inquiries | JP↔EN on messages |
| Featured score boost | 1.15x multiplier on all their listings |
| Weekly digest email | Top items, new saves, open inquiries |

**¥30,000/month in context:**
- Yahoo Auctions Japan charges 8.8-10% per sale. A single ¥300K sword pays for 1 month.
- A weekend table at Tokyo Token Ichi costs more.
- 10 Yuhinkai lookups alone save hours of manual data entry.

#### Premium (¥75,000/mo) — Market Intelligence

For the top 10-15 dealers who are serious businesses. Value prop: "See the market before anyone else."

| Feature | |
|---|---|
| Everything in Professional | + |
| Unlimited Yuhinkai lookups | Full catalog access during listing creation |
| Market comparables | "Your price vs. 4 similar items currently listed" |
| Collector interest signals | "3 collectors with Juyo+ saved searches match this" |
| Competitor monitoring (opt-in) | "Dealer X just listed a Juyo Kanemitsu at ¥2.8M" |
| "Premium Dealer" badge | Enhanced trust signal + priority in search results |
| Featured score boost | 1.3x multiplier |
| Priority messaging | Dealer's messages surface first in collector inbox |
| API inventory sync | Push from their own system → NihontoWatch |
| Bulk operations | CSV import/export, batch status changes |
| Custom dealer profile | Logo, bio, specialties, show schedule |

### Revenue Projections

#### Phase 1 (Months 1-6): Flat Fee Only

| Tier | Dealers | Monthly | Annual |
|---|---|---|---|
| Starter (free) | 30 | $0 | $0 |
| Professional ($200) | 15 | $3,000 | $36,000 |
| Premium ($500) | 5 | $2,500 | $30,000 |
| **Total** | **50** | **$5,500** | **$66,000** |

#### Phase 2 (Months 6-12): Add Messaging-Attributed Closing Fees

Once the messaging system proves attribution, introduce flat per-transaction closing fees (not percentage-based — see rationale below):

| Item Price Range | Closing Fee |
|---|---|
| Under ¥100K | ¥0 (too small to bother) |
| ¥100K – ¥500K | ¥5,000 (~$33) |
| ¥500K – ¥2M | ¥15,000 (~$100) |
| ¥2M – ¥10M | ¥30,000 (~$200) |
| Over ¥10M | ¥50,000 (~$330) |

**Why flat fees, not percentage:**
1. No price disclosure required — we infer the range from the listing price.
2. Gets cheaper for big sales (¥15K on ¥1M = 1.5%; ¥30K on ¥5M = 0.6%). Dealers prefer this.
3. Only on messaging-attributed sales — if a collector buys through the dealer's site directly, no fee.

| Source | Monthly Est. |
|---|---|
| Subscriptions | $5,500 |
| Closing fees (est. 40 sales/mo × avg ¥15K) | ~$4,000 |
| **Total** | **~$9,500/mo ($114K/yr)** |

#### Phase 3 (Months 12+): Transactional Marketplace (Optional)

- "Buy Now" with escrow (Stripe Connect)
- 3-5% transaction fee on processed payments
- Buyer protection program
- Shipping integration, customs/duties calculator

Build this only when both sides demand it.

---

## 12. Japanese Cultural Design Principles

These are not optional guidelines. They are hard requirements. The nihonto dealer world is overwhelmingly Japanese, and cultural missteps will kill adoption.

### 12.1 The Dealer Is a Custodian, Not a Seller

Japanese sword dealers don't see themselves as operating in a "marketplace." They are **custodians** (管理者) of objects with 700 years of history. The dealer's job is to find the **right next owner** — not the highest bidder.

**Product implications:**
- Our messaging system frames inquiries as **introductions**, not leads.
- We show the collector's tier, collection, and history — signals of seriousness, not purchasing power.
- We never use words like "conversion," "funnel," or "lead" in dealer-facing UI.
- We never gamify sales ("Congratulations! You sold 5 items this month!").

### 12.2 面子 (Mentsu) — Face

**a) Pricing visibility is sensitive.** Market comparables showing a dealer is "12% above average" must be dealer-only, never public. If collectors see this, the dealer loses face.

**b) Never rank dealers.** Show absolute metrics ("your listings received 230 views"), not relative rankings ("you're #47 of 52"). Creating hierarchies that didn't exist before is destructive.

**c) Correcting data is delicate.** The "claim your listings" flow frames corrections as "verify and enhance" — never "we scraped your site and got it wrong."

**d) Price history is private.** Sold prices are already hidden from collectors (2026-03-02 change). Price drop history must also be dealer-only. A dealer who frequently drops prices doesn't want that pattern visible.

### 12.3 根回し (Nemawashi) — Consensus Building Before Action

Important decisions are socialized informally before any formal announcement.

**Go-to-market implication:**
- Personal email to each target dealer (in Japanese), months before launch.
- Frame as consultation: "We're considering building tools for dealers like you. Would you share your thoughts?"
- Incorporate their feedback. Let them feel ownership of the product.
- When we launch, they already know about it and feel consulted.
- Dealers who feel blindsided will resist on principle, even if the product is good.

### 12.4 義理 (Giri) — Obligation and Reciprocity

Japanese business relationships are built on mutual obligation.

**How this works for us:**
- The free Starter tier creates giri — we give dealers something valuable (claimed listings, verified data, visibility), and they feel an obligation to reciprocate.
- When we ask them to upgrade to Professional, it feels fair because we've already given.
- But giri cuts both ways: a paying dealer expects responsive, personal support in Japanese. Not a chatbot. Not a help desk. Human responses within hours.
- Breaking changes (new fees, feature removal) require extensive notice and explanation. Surprising a paying customer violates giri.

### 12.5 内と外 (Uchi to Soto) — Inside vs. Outside

The dealer world has its own in-group dynamics. Dealers know each other, attend the same shows, belong to the same associations.

**Product implications:**
- **Competitor monitoring must be opt-in per dealer.** A dealer should control whether their prices appear in another dealer's comparables.
- **The "Verified Dealer" badge creates a new uchi** — the NihontoWatch dealer network. Being inside signals something. But the badge must feel earned, not purchased. Verification requires confirmed identity, active inventory, and inquiry responsiveness.
- **Collector subscription tiers function as uchi markers.** A Collector-tier inquiry tells the dealer this person has been "accepted" — an implicit vouching.

### 12.6 阿吽の呼吸 (Aun no Kokyuu) — Unspoken Understanding

Japanese communication is high-context. What's NOT said matters as much as what is.

**Product implications:**

**a) Inquiry templates must not be prescriptive.** No "Ask about price" / "Make an offer" category buttons. Japanese dealers and collectors communicate with nuance. A formulaic message feels rude. Offer a text field with a polite default opening.

**b) Default message phrasing:**
```
EN: "I am interested in learning more about this piece."
JA: "こちらの作品について、詳しくお伺いしたく存じます。"
```
Not: "I want to buy this" / "これを購入したいです" — too direct.

**c) No "Make an Offer" button.** Offering below asking price is acceptable in some contexts but insulting in others. If negotiation happens, it happens naturally in the message thread. The platform must never formalize it.

### 12.7 季節感 (Kisetsukan) — Seasonal Awareness

Japanese business has strong seasonal rhythms:

| Season | Event | Implication |
|---|---|---|
| January | 初売り (Hatsuuri) — New Year sales | Some dealers do special pricing |
| March | 大刀剣市 (Dai Token Ichi) — Major Tokyo sword show | New acquisitions listed before/after |
| June | NBTHK Juyo shinsa results | New Juyo-certified items enter market |
| July-August | お盆 (Obon) — Many dealers close 1-2 weeks | Don't send engagement emails during this period |
| November | NBTHK Tokubetsu Juyo results | Highest-value new certifications |
| December | 年末 (Nenmatsu) — Year-end | Some dealers discount to clear inventory |

**Product implications:**
- Notification timing and digest content should respect these rhythms.
- Don't send "Your listings had low engagement" during Obon — the dealer is on vacation.
- Analytics dashboard should include seasonal context: "Views are typically 20% lower in August."

### 12.8 Formality and Documentation

Japanese business culture values formal documentation.

**Requirements:**
- **Terms of service** need a professional JP translation (not machine-translated). Reviewed by a Japanese business attorney.
- **Dealer agreement** should feel like a proper 契約書 (keiyakusho) — PDF-downloadable with clear terms, cancellation policy, and data handling provisions.
- **Invoices** must follow 請求書 format: proper tax breakdowns (消費税 10%), dealer's registered name, invoice number, date. Standard Stripe invoices may not meet Japanese accounting standards.
- **インボイス制度 (Invoice System):** Since October 2023, Japan requires qualified invoices (適格請求書) for consumption tax credit. If we charge Japanese dealers, we may need to register as a qualified invoicing business (適格請求書発行事業者) or dealers cannot claim the tax credit. This is a real friction point that requires legal guidance.

### 12.9 Privacy (個人情報保護法 / APPI)

Japan's Act on Protection of Personal Information is strict.

**Requirements:**
- Collector data shown to dealers (member since, collection size, purchase history) requires collector consent.
- Dealer analytics data — clear disclosure about what's tracked and why.
- Cross-border data transfer (Supabase is US-hosted) — needs proper disclosures.
- Right to deletion — Japanese users can request all data removed.
- Privacy settings should be prominent, not buried.

### 12.10 建前と本音 (Tatemae to Honne) — Public Face vs. True Feelings

A dealer will say "This is very interesting, I will consider it" (建前) when they actually mean "I have no intention of using this" (本音). Dealer feedback cannot be taken at face value.

**How to read actual intent:**

| What they say | What they mean |
|---|---|
| "We'll think about it" | Probably no |
| "This is difficult" (難しい) | Definitely no |
| "We're very busy right now" | Not interested |
| They start using the free tier without prompting | Real interest |
| They introduce you to another dealer | Strong endorsement |
| They give specific feature requests | They're invested |

**Product implication:** Measure behavior, not stated intent. Track free tier usage, listing claims, digest open rates, login frequency. Don't rely on surveys or feedback forms.

### 12.11 The Generational Divide

| Generation | Profile | Tech Comfort | What They Need |
|---|---|---|---|
| 70s+ | Traditional shop, 40 years in business | Low. Maybe uses email. | Phone support. Simple UI. Large text. |
| 50s-60s | Established dealer, has a website | Moderate. Uses Yahoo Auctions. | Clear instructions. Guided flows. |
| 30s-40s | Second-generation or new entrant | High. Instagram, online-native. | API access. Bulk tools. Speed. |

All three must be supported. The wizard-style listing flow serves the oldest generation. Bulk CSV import serves the youngest. The middle generation is the Professional tier sweet spot.

**Critical:** The oldest, most respected dealers are the kingmakers. If Aoi Art or Choshuya adopt the dealer portal, others follow. If they don't, it's uphill. Go-to-market should target respected dealers first, even though they're the hardest to onboard.

### 12.12 相応しい買い手 (Fusawashii Kaite) — The Worthy Buyer

Many serious Japanese dealers will refuse a sale to someone they don't trust to properly care for the piece. This is not hypothetical — it happens regularly.

**Product implication:** The messaging system must give dealers enough context to judge collector seriousness:
- Subscription tier (credential signal)
- Member tenure
- Collection size and composition (if collector opts in)
- Purchase history with this specific dealer
- Verified identity status

Frame this as "introductions" — the platform is vouching for the collector's seriousness, not generating leads.

---

## 13. Mobile Experience

Per Chrono24's success — dealers are at sword shows, visiting collectors, or in their shop. Core flows must work on mobile.

### Critical Mobile Flows

1. **Quick add:** Photo → auto-suggest type → price → publish (30 seconds)
2. **Mark sold:** Swipe or tap from inventory list
3. **Reply to inquiry:** Push notification → tap → respond
4. **Price adjustment:** Tap item → edit price → save
5. **Analytics glance:** Dashboard widget with today's numbers

### Approach: Responsive Web (Not Native App)

Start with a mobile-optimized responsive web portal. Lower development cost, faster iteration, no app store review delays. Consider PWA for push notifications and offline access.

Native app is a Phase 3 consideration, only if mobile usage justifies the investment.

---

## 14. Go-to-Market

### Strategy: Nemawashi-First

1. **Pre-launch (Month -3 to -1):** Personal outreach to 5 target dealers. In Japanese. Position as consultation, not sales pitch. Incorporate feedback.
2. **Private beta (Month 0):** Invite 5-8 dealers. Free access to Professional tier. Collect behavioral data and specific feature requests.
3. **Soft launch (Month 2):** Open Starter tier to all 52 scraped dealers. Personal email (in Japanese for JP dealers) with "claim your inventory" CTA.
4. **Public launch (Month 4):** Announce Professional and Premium tiers. Target conversion of engaged Starter users.

### Target Dealers for Private Beta

Select based on: respect in the community (kingmaker effect), tech comfort (likely to actually use it), inventory volume (enough data to make analytics meaningful), and mix of JP + international.

### Key Metric: Claimed Listings

The single most important launch metric is **how many dealers claim their scraped listings.** This indicates:
- They logged in (engagement)
- They reviewed their data (interest)
- They corrected mistakes (investment)
- They implicitly endorsed the platform (trust)

---

## 15. Phased Roadmap

### Phase 1: Foundation (Months 1-3) — ✅ BUILT (2026-03-03 → 2026-03-10)

| Component | Status | Notes |
|---|---|---|
| Dealer auth + role | ✅ Done | `verifyDealer()`, middleware protection, `isDealer`/`dealerId` in AuthContext |
| Listing CRUD | ✅ Done | Full CRUD via `/api/dealer/listings`. Status workflow: INVENTORY → AVAILABLE → SOLD/HOLD |
| Yuhinkai lookup | ✅ Done | `CatalogMatchPanel` — search + 13-field auto-prefill on card select |
| Photo upload | ✅ Done | `ImageUploadZone` + `dealer-images` Supabase bucket |
| Video upload | ✅ Done | Bunny.net Stream TUS uploads, HLS delivery, `item_videos` table |
| Dealer profile settings | ✅ Done | `/dealer/profile` — logo, banner, accent color, bilingual bios, specializations, auto-save |
| Dealer profile preview | ✅ Done | `/dealer/preview` — reusable `DealerProfileView` component |
| Rich metadata sections | ✅ Done | Sayagaki, hakogaki, koshirae, provenance, kiwame, kanto hibisho |
| Unified form (dealer + collector) | ✅ Done | `DealerListingForm` with `context` prop. Same form for both use cases |
| Collection / vault system | ✅ Done | Two-table architecture, promote/delist RPCs, `/vault` route |
| "I Own This" import | ✅ Done | Browse → prefill → collection add form. Source listing tracked |
| Tier gating | ✅ Done | `checkCollectionAccess()` on all 15 collection API routes |
| Inventory claim flow | ❌ Not started | Show scraped listings, let dealer verify/correct |
| Dealer go-live | ❌ Pending | Feature flag flip + first dealer account setup |

### Phase 2: Intelligence (Months 3-6)

| Component | Scope |
|---|---|
| Analytics dashboard | Self-serve view of existing tracking data |
| Messaging system | Listing-anchored threads, Supabase Realtime |
| Auto-translate | JP↔EN on messages via existing translate API |
| Weekly digest | Email summary of views, saves, inquiries |
| "Verified Dealer" badge | Trust signal on listings |
| Response time tracking | Metric on dealer profile |

### Phase 3: Market Intelligence (Months 6-12)

| Component | Scope |
|---|---|
| Market comparables | "Your price vs. similar items" |
| Collector interest signals | "N collectors watching this item" |
| Competitor monitoring (opt-in) | New listings from other dealers in your category |
| Closing fees | Flat per-transaction fee on messaging-attributed sales |
| API sync | Push from dealer's own inventory system |
| Bulk operations | CSV import/export, batch changes |

### Phase 4: Transactional (12+ months, conditional)

| Component | Scope |
|---|---|
| Buy Now + escrow | Stripe Connect integration |
| Transaction fees | 3-5% on processed payments |
| Buyer protection | Dispute resolution, returns |
| Shipping integration | International logistics, customs |

---

## 16. What We Already Have

> **Last updated:** 2026-03-10. Substantial infrastructure exists — the system has evolved from scraper-only to a unified dealer + collector platform.

### Pre-existing Infrastructure

| Component | Status | Location |
|---|---|---|
| Dealer auth tier | Built | `src/types/subscription.ts` |
| Inventory data (52 dealers) | Built | `listings` table in Supabase |
| Analytics tracking | Built | Views, clicks, dwell, favorites, impressions — `src/lib/tracking/` |
| Analytics dashboard (admin) | Built | `/admin/dealers/[id]` — needs self-serve repackaging |
| Analytics SQL RPCs | Built | `get_dealer_click_stats`, etc. (migration 072) |
| Yuhinkai catalog | Built | 13,572 artisans in `artisan_makers` + catalog records |
| Yuhinkai query functions | Built | `src/lib/supabase/yuhinkai.ts` |
| Translation API | Built | Bidirectional JP↔EN via `/api/translate` |
| Featured scoring | Built | Complete listings rank higher — `src/lib/featured/scoring.ts` |
| Artisan matching | Built | Auto-links to profiles — Oshi-scrapper pipeline |
| Image hosting | Built | Supabase Storage (`collection-images`, `dealer-images` buckets) |
| Image upload component | Built | `ImageUploadZone` from collection manager |
| Smart crop | Built | Auto focal point detection — cron + backfill |
| Dealer profile pages | Built | `/dealers/[slug]` with inventory |
| Sold price hiding | Built | Server-side stripping on all APIs |
| Dealer name localization | Built | `name_ja` column, `getDealerDisplayName()` |
| Stripe subscriptions | Built | Billing infrastructure for collector tiers |

### Built Since 2026-03-03 — Dealer Portal

| Component | Status | Location / Doc |
|---|---|---|
| Dealer listing CRUD | Built (behind flag) | `/api/dealer/listings` (GET/POST/PATCH/DELETE). `SESSION_20260303_DEALER_PORTAL_MVP.md` |
| Dealer listing form | Built | `DealerListingForm.tsx` — rich form with sayagaki, koshirae, provenance, kiwame, kanto hibisho, video, research notes |
| Yuhinkai catalog prefill | Built | `CatalogMatchPanel.tsx` — 13 fields auto-fill on card select. `SESSION_20260307_CATALOG_PREFILL_EXPANSION.md` |
| Dealer image upload | Built | `/api/dealer/images`, bucket `dealer-images` |
| Dealer video upload | Built | Bunny.net Stream TUS uploads, HLS delivery. `item_videos` table. `SESSION_20260308_VIDEO_SUPPORT.md` |
| Dealer QuickView slots | Built | `DealerCTA`, `DealerActionBar`, `DealerMobileCTA`, `DealerMobileHeaderActions` |
| Dealer profile settings | Built | `/dealer/profile` — logo, banner, accent color, bilingual bios, specializations. Auto-save. `SESSION_20260306_DEALER_PROFILE_SETTINGS.md` |
| Dealer profile preview | Built | `/dealer/preview` — reusable `DealerProfileView` component. `SESSION_20260306_DEALER_PREVIEW.md` |
| Dealer status workflow | Built | INVENTORY → AVAILABLE → SOLD/HOLD, with side effects |
| Dealer RLS + source guards | Built | `source='dealer'` filter on browse API, `getListingDetail`, cron. Migration 097-098 |
| Testing gate (feature flag) | Built | `NEXT_PUBLIC_DEALER_LISTINGS_LIVE` — 3 insertion points |
| Listing impression tracking | Built | Position-aware, viewport-based, deduped. `SESSION_20260306_LISTING_IMPRESSION_TRACKING.md` |

### Built Since 2026-03-09 — Unified Collection (Dealer + Collector)

| Component | Status | Location / Doc |
|---|---|---|
| Two-table architecture | Built | `collection_items` (private) + `listings` (public). Physical isolation. `DESIGN_UNIFIED_COLLECTION.md` |
| Promote / delist RPCs | Built | Atomic Postgres RPCs. Soft-delist preserves 6 FK tables. Migrations 128-130 |
| Collection API (CRUD) | Built | `/api/collection/items` + 6 image routes + video routes. Auth-only, tier-gated |
| Yuhinkai tier gating | Built | `checkCollectionAccess()` on all 15 collection API routes. `HANDOFF_YUHINKAI_TIER.md` |
| Unified form (both contexts) | Built | `DealerListingForm` with `context='listing'\|'collection'`. Same rich form for dealers and collectors |
| "I Own This" import | Built | BrowseCTA → sessionStorage prefill → `/vault/add` form pre-populated. 8 tests |
| Collection page (`/vault`) | Built | ListingGrid, filters, QuickView, dealer tabs (For Sale/On Hold/Sold). 301 redirect from `/collection` |
| DisplayItem adapter | Built | `collectionRowToDisplayItem()` — carries all JSONB sections. 160 tests |
| Collection QuickView | Built | 14 slot components, source-aware routing. `HANDOFF_DISPLAYITEM_COMPOSITION_SLOTS.md` |
| Promote to listing UI | Built | `PromoteToListingModal` — price prompt, dealer-tier only |
| Delist from sale UI | Built | "Remove from Sale" button, soft-delist preserves favorites/views/price history |
| AI curator notes | Built | Research notes + artist overview in prompt. `SESSION_20260309_CURATOR_NOTE_ENRICHMENT.md` |
| Showcase layout | Built | Hero image, scholar's note, `isShowcaseEligible()`. `SESSION_20260308_SHOWCASE_LAYOUT.md` |
| V1 dead code cleanup | Done | `CollectionFormContent`, `openCollectionAddForm`, folders API all deleted |

### Still Needs Building

| Component | Priority | Notes |
|---|---|---|
| Dealer go-live | High | Flip `NEXT_PUBLIC_DEALER_LISTINGS_LIVE=true`, create Sokendo account, QA |
| Messaging system | High | Supabase Realtime + inbox UI (schema ready in migration 097) |
| Dealer onboarding flow | Medium | Verification, profile setup, first listing wizard |
| "Claim your listings" flow | Medium | Migration from scraped → dealer-owned |
| Community visibility | Low | Collector/dealer visibility levels on collection items (Phase 6) |
| Collector profiles | Low | Profile pages for collectors (Phase 7) |
| Market comparables engine | Low | Cross-dealer price analysis (Phase 3 roadmap) |
| JP-formatted invoicing | Low | Proper 請求書 for Japanese accounting |
| Drop `user_collection_items` table | Low | V1 table, no code references remain |

---

## 17. SOTA Patterns Stolen

Research across 7+ luxury/collectibles marketplaces:

| Pattern | Source | Our Adaptation |
|---|---|---|
| "Claim your listing" onboarding | Google My Business | Show scraped inventory, let dealer verify and take control |
| Auto-import from existing store | Chrono24 | We already have their data — instant onboarding |
| Step-by-step guided submission | Catawiki | Wizard for first listing, full form after |
| Auto-save per field | GitLab Pajamas | Visible "Saved 2m ago" feedback, 60-day draft expiry |
| Response time badge | Amazon, 1stDibs | "Usually responds within 3 hours" on dealer profile |
| Listing-anchored messaging | Chrono24, 1stDibs | Every thread tied to a specific item |
| Price analysis / comparables | Chrono24, Reverb | "Your price vs. market average" — dealer-only |
| Mobile-first dealer tools | Chrono24 Dealer App | Responsive web portal, quick actions |
| Progressive disclosure | B2B SaaS best practice | Simple first listing, advanced mode unlocks later |
| Gallery membership model | Artsy | Flat fee, no commission, "join the network" |
| Expert review queue | Catawiki, Sotheby's | Admin review for first 3 listings from new dealers |
| Photo quality guidance | LiveAuctioneers | Checklist popup: "Include: full blade, mei, kissaki, flaws" |
| Draft management | eBay Seller Hub | Drafts page with filters, expiration warnings |

---

## 18. Open Questions

### Product

1. **Scraper coexistence:** When a dealer claims listings, do we keep scraping as fallback? (Recommendation: yes, dealer edits override, scraper catches new items and status changes.)
2. **Approval flow for new dealers:** Manual admin review, domain verification, or both? (Recommendation: domain email verification + admin approval for first 3 listings.)
3. **~~"Reserved" status~~:** ✅ Built as "On Hold" (`HOLD` status, `is_available=true`). Visible in browse with hold badge. Dealer-only tab in `/vault` page.
4. **Dealer-to-dealer messaging:** Some dealers buy from each other. Should the system support B2B? (Recommendation: defer to Phase 3. Same messaging system, different context.)

### Business

5. **Japanese tax registration:** Do we need to register as 適格請求書発行事業者 for the invoice system? Requires legal guidance.
6. **Free tier limits:** Is 5 direct-upload listings the right cap? Too low = frustrating; too high = no conversion pressure.
7. **Featured score boost multipliers:** 1.15x and 1.3x are initial estimates. Need to model impact on browse rankings to ensure paid dealers don't monopolize top positions.

### Cultural

8. **Support language:** Do we need a Japanese-speaking support person from day one, or can we use translated support initially? (Recommendation: Japanese-speaking support is non-negotiable for paying dealers.)
9. **Beta dealer selection:** Which 5 dealers to approach first? Need to balance: community respect, tech comfort, inventory volume, JP/international mix.
10. **Pricing sensitivity:** Is ¥30,000/mo the right price point for Japanese dealers? Needs market testing during beta. May need to be lower initially and increase after proving value.

---

*This document captures the brainstorm as of 2026-03-03. It will evolve as we move into design and development.*
