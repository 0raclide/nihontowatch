# Dealer Profile & Storefront Customization

> Design document for making the dealer page feel "owned" — logo, banner, bio, metadata, trust signals, and the public-facing storefront.

**Status:** Design
**Date:** 2026-03-06
**Related:** `docs/DEALER_PROFILE_RESEARCH.md` (SOTA research, 15+ marketplaces analyzed)

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Design Principles](#2-design-principles)
3. [Information Architecture](#3-information-architecture)
4. [Data Model](#4-data-model)
5. [Phase 1: Visual Identity & Metadata (MVP)](#5-phase-1-visual-identity--metadata-mvp)
6. [Phase 2: Public Storefront](#6-phase-2-public-storefront)
7. [Phase 3: Trust Signals & Badges](#7-phase-3-trust-signals--badges)
8. [Phase 4: Analytics & Engagement](#8-phase-4-analytics--engagement)
9. [Mobile Design](#9-mobile-design)
10. [Japanese Dealer Considerations](#10-japanese-dealer-considerations)
11. [File Inventory](#11-file-inventory)
12. [Open Questions](#12-open-questions)

---

## 1. Problem Statement

The dealer portal today is a **listing management back-office**. Three tabs, a grid of cards, an add button. There is zero shop identity — no logo, no banner, no bio, no personality. The public dealer page (`/dealers/[slug]`) shows a name, a flag, a domain link, and an inventory breakdown bar. Nothing more.

For a dealer paying $150/mo, the page needs to feel like *their* storefront — not a row in our database. When Sokendo (our first dealer partner) sends a collector to their NihontoWatch page, that collector should immediately understand: who this dealer is, what they specialize in, why they're trustworthy, and how to reach them.

**The goal:** Transform the dealer page from a back-office tool into a storefront that dealers are proud to share.

---

## 2. Design Principles

These are derived from SOTA research across 15+ marketplaces (1stDibs, Chrono24, Chairish, Artsy, Etsy, Rakuten). See `docs/DEALER_PROFILE_RESEARCH.md` for full analysis.

### 2.1 Controlled Customization

Allow visual identity (logo, banner, accent color) but maintain UX consistency. Dealers customize *within* the NihontoWatch design system — not outside it. No custom CSS, no arbitrary fonts, no layout breaking.

**Rationale:** Etsy Plus and Shopify both found this sweet spot. Full creative freedom (Rakuten model) leads to inconsistent quality. Zero customization (1stDibs model) makes dealers feel interchangeable.

### 2.2 Trust Through Transparency

Show what we can prove, not what dealers claim. Auto-generated metrics (listing count, cert distribution, response time) are more credible than self-reported badges.

**Rationale:** Chrono24's 90-day rolling badge system works because it reflects *current* behavior, not historical claims. The RealReal's "Authenticated by [Expert Name]" works because it's verifiable.

### 2.3 Bilingual By Design

Not "English with Japanese tacked on." Japanese dealers write bios in Japanese. International dealers write in English. Each gets displayed natively in the matching locale, with the other language available via toggle.

**Rationale:** Our existing i18n architecture already handles this pattern for listing titles/descriptions. Dealer profiles follow the same bidirectional model.

### 2.4 Mobile-First, Thumb-First

60%+ of marketplace traffic is mobile. The profile edit form, the public storefront, and the logo/banner upload must all work perfectly on a phone. Camera-to-upload for photos. Large tap targets. No tiny form fields.

### 2.5 Progressive Completeness

Don't require everything upfront. A dealer can launch with just a name and listings. The profile settings page shows a completeness indicator ("Your profile is 65% complete") that motivates filling in bio, logo, contact info over time.

**Rationale:** Saatchi Art and Etsy both use this pattern. It reduces onboarding friction while driving engagement.

---

## 3. Information Architecture

### 3.1 What the Dealer Sees (Private)

```
/dealer                          ← Listing management (exists today)
/dealer/new                      ← Add listing (exists today)
/dealer/edit/[id]                ← Edit listing (exists today)
/dealer/profile                  ← NEW: Profile settings (edit logo, banner, bio, contact)
```

The profile settings page is a new sibling route to the existing listing management. Accessible from the dealer sub-header (desktop) and bottom bar (mobile).

### 3.2 What Collectors See (Public)

```
/dealers/[slug]                  ← Enhanced public storefront
```

The existing public dealer page gets upgraded from "name + inventory bar" to a full storefront with banner, logo, bio, contact, trust signals, and listings.

### 3.3 Profile Settings Layout

The settings page follows a card-based layout (not a traditional form). Each section is an independent card that can be edited inline or expanded. This matches the pattern from `AdminEditView` where sections collapse by default.

```
┌──────────────────────────────────┐
│  PROFILE SETTINGS                │
│  ┌──────────────────────────────┐│
│  │  Visual Identity             ││
│  │  [Banner upload zone]        ││
│  │  [Logo upload zone]          ││
│  │  [Accent color picker]       ││
│  └──────────────────────────────┘│
│  ┌──────────────────────────────┐│
│  │  About Your Shop             ││
│  │  [Bio EN textarea]           ││
│  │  [Bio JA textarea]           ││
│  │  [Founded year]              ││
│  │  [Specializations]           ││
│  └──────────────────────────────┘│
│  ┌──────────────────────────────┐│
│  │  Contact & Location          ││
│  │  [Email] [Phone] [LINE ID]   ││
│  │  [Website] [Instagram]       ││
│  │  [Address] [Show on page?]   ││
│  └──────────────────────────────┘│
│  ┌──────────────────────────────┐│
│  │  Policies                    ││
│  │  [Ships international?]      ││
│  │  [Payment methods]           ││
│  │  [Return policy text]        ││
│  └──────────────────────────────┘│
│  ┌──────────────────────────────┐│
│  │  Credentials                 ││
│  │  [Memberships / associations]││
│  └──────────────────────────────┘│
│                                  │
│  Profile completeness: ████░░ 65%│
└──────────────────────────────────┘
```

---

## 4. Data Model

### 4.1 New Columns on `dealers` Table

We extend the existing `dealers` table rather than creating a separate `dealer_profiles` table. Rationale: the dealers table already has contact/policy columns (migration 033). A separate table adds JOIN complexity for no benefit — there's a 1:1 relationship.

```sql
-- =============================================================================
-- Migration: Dealer Profile Customization
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Visual Identity
-- ---------------------------------------------------------------------------
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#c4a35a';

COMMENT ON COLUMN dealers.logo_url IS 'Square logo image URL (Supabase Storage). Min 200x200, displayed at 80x80–120x120.';
COMMENT ON COLUMN dealers.banner_url IS 'Banner/cover image URL (Supabase Storage). 16:9 aspect ratio recommended, displayed full-width.';
COMMENT ON COLUMN dealers.accent_color IS 'Hex color for tinting buttons, headings, accent borders. Default is NihontoWatch gold.';

-- ---------------------------------------------------------------------------
-- Shop Story
-- ---------------------------------------------------------------------------
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS bio_en TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS bio_ja TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS founded_year INTEGER;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS shop_photo_url TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS specializations TEXT[] DEFAULT '{}';

COMMENT ON COLUMN dealers.bio_en IS 'Dealer bio/description in English. Plain text or light markdown. Max ~2000 chars recommended.';
COMMENT ON COLUMN dealers.bio_ja IS 'Dealer bio/description in Japanese. Plain text or light markdown.';
COMMENT ON COLUMN dealers.founded_year IS 'Year the business was established. Displayed as "Est. YYYY" or "創業 YYYY年".';
COMMENT ON COLUMN dealers.shop_photo_url IS 'Photo of physical storefront/showroom (Supabase Storage). Strong trust signal for JP dealers.';
COMMENT ON COLUMN dealers.specializations IS 'Dealer-curated specialty tags. Values: koto, shinto, shinshinto, gendaito, bizen, yamato, soshu, mino, yamashiro, tsuba, kodogu, armor, etc.';

-- ---------------------------------------------------------------------------
-- Contact (extends migration 033)
-- ---------------------------------------------------------------------------
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS line_id TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS facebook_url TEXT;

COMMENT ON COLUMN dealers.phone IS 'Public phone number for the shop.';
COMMENT ON COLUMN dealers.line_id IS 'LINE ID for direct messaging (essential for JP dealers). Distinct from line_notify_token (system notifications).';
COMMENT ON COLUMN dealers.instagram_url IS 'Instagram profile URL.';
COMMENT ON COLUMN dealers.facebook_url IS 'Facebook page URL.';

-- ---------------------------------------------------------------------------
-- Location
-- ---------------------------------------------------------------------------
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS address_visible BOOLEAN DEFAULT false;

COMMENT ON COLUMN dealers.address IS 'Full street address. Only displayed publicly when address_visible = true.';
COMMENT ON COLUMN dealers.city IS 'City name (e.g., "Ginza, Tokyo" / "銀座"). Used for public display even when full address is hidden.';
COMMENT ON COLUMN dealers.postal_code IS 'Postal/ZIP code.';
COMMENT ON COLUMN dealers.address_visible IS 'When true, full address shown on public page. When false, only city is shown.';

-- ---------------------------------------------------------------------------
-- Credentials & Memberships
-- ---------------------------------------------------------------------------
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS memberships TEXT[] DEFAULT '{}';
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS return_policy TEXT;

COMMENT ON COLUMN dealers.memberships IS 'Professional memberships/certifications. E.g., ["NBTHK", "全日本刀剣商業協同組合", "NTHK"]';
COMMENT ON COLUMN dealers.return_policy IS 'Return/exchange policy text (plain text). Shown on public page under Policies section.';
```

### 4.2 What Already Exists (Migration 033)

These columns are already on the `dealers` table but **not yet editable** by dealers or displayed on the public page:

| Column | Type | Purpose |
|--------|------|---------|
| `contact_email` | TEXT | Primary contact email |
| `contact_page_url` | TEXT | URL to dealer's contact page |
| `sales_policy_url` | TEXT | URL to sales/purchasing policy |
| `ships_international` | BOOLEAN | Ships overseas? |
| `accepts_wire_transfer` | BOOLEAN | Wire transfer accepted? |
| `accepts_paypal` | BOOLEAN | PayPal accepted? |
| `accepts_credit_card` | BOOLEAN | Credit card accepted? |
| `requires_deposit` | BOOLEAN | Deposit required? |
| `deposit_percentage` | NUMERIC(5,2) | Deposit % if required |
| `english_support` | BOOLEAN | Has English support? |

These columns are surfaced in the Profile Settings form (Policies section) and the public storefront without any schema changes.

### 4.3 What Already Exists (Migration 097)

| Column | Type | Purpose |
|--------|------|---------|
| `line_notify_token` | TEXT | LINE Notify token for system notifications (Phase 2 inquiries) |

Note: `line_notify_token` is for **automated notifications** (system → dealer). The new `line_id` column is for **public contact** (collector → dealer). Different purposes, both needed.

### 4.4 Storage

Profile images use the existing `dealer-images` bucket with a `profile/` subfolder:

```
dealer-images/
  {dealerId}/
    {listingId}/          ← Existing listing images
      {uuid}.jpg
    profile/              ← NEW: profile images
      logo/{uuid}.jpg     ← One file (latest = active)
      banner/{uuid}.jpg   ← One file (latest = active)
      shop/{uuid}.jpg     ← One file (latest = active)
```

**Why reuse `dealer-images`?** One fewer bucket to create/manage. The subfolder `profile/` provides clean separation. Ownership verification is the same pattern (`path.startsWith(\`${dealerId}/\`)`).

**Limits:**
- Logo: 1 image, max 2MB, min 200x200px recommended
- Banner: 1 image, max 5MB, 16:9 aspect ratio recommended
- Shop photo: 1 image, max 5MB

### 4.5 Profile Completeness Calculation

Computed at read time (not stored). Simple weighted checklist:

| Field | Weight | Notes |
|-------|--------|-------|
| `logo_url` | 15 | Highest visual impact |
| `banner_url` | 15 | Second-highest visual impact |
| `bio_en` OR `bio_ja` | 15 | At least one bio language |
| `bio_en` AND `bio_ja` | +5 | Bonus for bilingual |
| `contact_email` | 10 | Primary contact method |
| `phone` OR `line_id` | 10 | Secondary contact method |
| `founded_year` | 5 | Trust signal |
| `city` | 5 | Location context |
| `specializations` (non-empty) | 5 | Discovery signal |
| `ships_international` (non-null) | 5 | Policy clarity |
| Payment method (any non-null) | 5 | Policy clarity |
| `memberships` (non-empty) | 5 | Credential signal |
| **Total** | **100** | |

```typescript
function computeProfileCompleteness(dealer: DealerProfile): number {
  let score = 0;
  if (dealer.logo_url) score += 15;
  if (dealer.banner_url) score += 15;
  const hasBioEn = !!dealer.bio_en?.trim();
  const hasBioJa = !!dealer.bio_ja?.trim();
  if (hasBioEn || hasBioJa) score += 15;
  if (hasBioEn && hasBioJa) score += 5;
  if (dealer.contact_email) score += 10;
  if (dealer.phone || dealer.line_id) score += 10;
  if (dealer.founded_year) score += 5;
  if (dealer.city) score += 5;
  if (dealer.specializations?.length) score += 5;
  if (dealer.ships_international !== null) score += 5;
  if (dealer.accepts_wire_transfer || dealer.accepts_paypal || dealer.accepts_credit_card) score += 5;
  if (dealer.memberships?.length) score += 5;
  return score;
}
```

---

## 5. Phase 1: Visual Identity & Metadata (MVP)

**Goal:** A dealer can upload a logo and banner, write a bio, and fill in contact/location info. The profile settings page exists. The public page is not yet enhanced (that's Phase 2).

### 5.1 New Routes

#### `/dealer/profile` — Profile Settings Page

**Access:** Dealer auth required (same `verifyDealer()` pattern).

**Layout:** Single-column card-based form. Each section is a collapsible `<details>` element (same pattern as `FieldEditSection` in AdminEditView). All sections open by default on first visit (profile is empty); subsequent visits show collapsed sections with a summary line.

**Sections:**

1. **Visual Identity**
   - Banner upload zone (full-width, 16:9 aspect ratio preview, drag-drop or click)
   - Logo upload zone (circular crop preview, 120x120 display)
   - Accent color picker (6 presets + custom hex input)
     - Presets: Gold `#c4a35a` (default), Indigo `#4f46e5`, Crimson `#dc2626`, Forest `#16a34a`, Slate `#475569`, Charcoal `#1c1917`
   - Live preview strip showing how accent color renders on a button + heading

2. **About Your Shop**
   - Bio EN: `<textarea>` with character count (recommended max 2000). Placeholder: *"Tell collectors about your shop, your expertise, and what makes your inventory special."*
   - Bio JA: `<textarea>` with character count. Placeholder: *"お店の紹介、専門分野、コレクションの特徴をお書きください。"*
   - Founded year: Numeric input (4 digits). Rendered as "Est. {year}" / "創業 {year}年"
   - Specializations: Multi-select pill buttons. Available values:

     | Value | EN Label | JA Label |
     |-------|----------|----------|
     | `koto` | Koto Period | 古刀 |
     | `shinto` | Shinto Period | 新刀 |
     | `shinshinto` | Shinshinto Period | 新々刀 |
     | `gendaito` | Gendaito | 現代刀 |
     | `bizen` | Bizen-den | 備前伝 |
     | `yamato` | Yamato-den | 大和伝 |
     | `soshu` | Soshu-den | 相州伝 |
     | `mino` | Mino-den | 美濃伝 |
     | `yamashiro` | Yamashiro-den | 山城伝 |
     | `tsuba` | Tsuba & Kodogu | 鍔・小道具 |
     | `armor` | Armor & Helmets | 甲冑 |
     | `koshirae` | Koshirae | 拵 |

3. **Contact & Location**
   - Email: Text input (pre-filled from `contact_email` if set)
   - Phone: Text input
   - LINE ID: Text input (with LINE icon). Helper text: *"Collectors in Japan often prefer LINE for inquiries."*
   - Website: Text input (pre-filled from `domain` → `https://{domain}`)
   - Instagram: Text input (just handle, we prepend URL)
   - City: Text input. Placeholder: *"e.g., Ginza, Tokyo / 銀座"*
   - Full address: Text input (only shown when "Show address on page" is checked)
   - Show address toggle: Checkbox

4. **Policies**
   - Ships internationally: Yes/No/Not set toggle
   - Payment methods: Checkbox group (Wire transfer, PayPal, Credit card)
   - Deposit required: Yes/No toggle + percentage input (shown conditionally)
   - English support: Yes/No/Not set toggle
   - Return policy: `<textarea>` (plain text)

5. **Credentials**
   - Memberships: Freeform tag input (type + enter). Suggestions shown as pills: NBTHK, NTHK, 全日本刀剣商業協同組合, 日本美術刀剣保存協会
   - Shop photo: Single image upload (photo of physical store)

**Save behavior:** Auto-save with debounce (same pattern as dealer listing form draft). Visual confirmation: brief "Saved" toast after each field group saves. No single "Save All" button — each section saves independently on blur/change.

**Profile completeness:** Shown at the bottom of the page as a progress bar with percentage and a checklist of missing items. E.g., "Add a logo to help collectors recognize your shop."

#### `/api/dealer/profile` — Profile API

**GET:** Returns the dealer's profile data (all new + existing columns).
- Auth: `verifyDealer()`
- Query: `supabase.from('dealers').select('*').eq('id', dealerId).single()`
- Response includes computed `profileCompleteness` percentage

**PATCH:** Updates profile fields.
- Auth: `verifyDealer()`
- Allowlisted fields only (no `id`, `name`, `domain`, `is_active`, `created_at`, `earliest_listing_at`, `line_notify_token`)
- Validates:
  - `accent_color`: Must be valid hex (`/^#[0-9a-fA-F]{6}$/`)
  - `founded_year`: Must be between 1600 and current year
  - `specializations`: Must be from allowed values list
  - `deposit_percentage`: Must be 0-100 if provided
  - `instagram_url`: Normalized to full URL if just handle provided
- Uses service client (bypasses RLS — dealer writes to their own row)

#### `/api/dealer/profile/images` — Profile Image Upload

**POST:** Upload a profile image (logo, banner, or shop photo).
- Auth: `verifyDealer()`
- Form data: `file` (image) + `type` ("logo" | "banner" | "shop")
- Storage path: `{dealerId}/profile/{type}/{uuid}.{ext}`
- On success: Updates the corresponding column (`logo_url`, `banner_url`, or `shop_photo_url`)
- If a previous image exists for that type, the old file is deleted from storage (replace, not accumulate)
- Limits: logo 2MB, banner/shop 5MB
- Allowed types: `image/jpeg`, `image/png`, `image/webp`

**DELETE:** Remove a profile image.
- Auth: `verifyDealer()`
- Body: `{ type: "logo" | "banner" | "shop" }`
- Deletes from storage + nulls the DB column

### 5.2 Navigation Changes

**Desktop sub-header** (inside `DealerPageClient`'s sticky header area):
- Add a "Profile" link next to the "Add Listing" button
- Or: gear icon that links to `/dealer/profile`

**Mobile bottom bar** (`DealerBottomBar`):
- Add a profile/gear icon as a 4th item (left of the add button)
- Or: accessible from the dealer section in `MobileNavDrawer`

### 5.3 i18n Keys (New)

```json
{
  "dealer.profile": "Profile Settings",
  "dealer.profileJa": "プロフィール設定",
  "dealer.visualIdentity": "Visual Identity",
  "dealer.aboutYourShop": "About Your Shop",
  "dealer.contactLocation": "Contact & Location",
  "dealer.policies": "Policies",
  "dealer.credentials": "Credentials",
  "dealer.uploadLogo": "Upload Logo",
  "dealer.uploadBanner": "Upload Cover Image",
  "dealer.uploadShopPhoto": "Upload Shop Photo",
  "dealer.logoHelp": "Square image, min 200x200px. Displayed on your storefront and listing cards.",
  "dealer.bannerHelp": "16:9 recommended. Displayed as hero image on your storefront.",
  "dealer.accentColor": "Accent Color",
  "dealer.accentColorHelp": "Applied to buttons and headings on your public page.",
  "dealer.bioEn": "Description (English)",
  "dealer.bioJa": "紹介文 (日本語)",
  "dealer.bioEnPlaceholder": "Tell collectors about your shop, your expertise, and what makes your inventory special.",
  "dealer.bioJaPlaceholder": "お店の紹介、専門分野、コレクションの特徴をお書きください。",
  "dealer.foundedYear": "Year Established",
  "dealer.specializations": "Specializations",
  "dealer.email": "Email",
  "dealer.phoneNumber": "Phone",
  "dealer.lineId": "LINE ID",
  "dealer.lineIdHelp": "Collectors in Japan often prefer LINE for inquiries.",
  "dealer.website": "Website",
  "dealer.instagram": "Instagram",
  "dealer.cityLabel": "City",
  "dealer.cityPlaceholder": "e.g., Ginza, Tokyo",
  "dealer.addressLabel": "Full Address",
  "dealer.showAddressOnPage": "Show full address on public page",
  "dealer.shipsInternational": "Ships Internationally",
  "dealer.paymentMethods": "Payment Methods",
  "dealer.wireTransfer": "Wire Transfer",
  "dealer.depositRequired": "Deposit Required",
  "dealer.depositPercentage": "Deposit Percentage",
  "dealer.englishSupport": "English Support",
  "dealer.returnPolicy": "Return Policy",
  "dealer.membershipsCreds": "Memberships & Associations",
  "dealer.membershipsHelp": "Professional memberships and trade associations.",
  "dealer.profileCompleteness": "Profile Completeness",
  "dealer.addLogoPrompt": "Add a logo to help collectors recognize your shop.",
  "dealer.addBannerPrompt": "Add a cover image to personalize your storefront.",
  "dealer.addBioPrompt": "Write a description to tell collectors about your expertise.",
  "dealer.addContactPrompt": "Add contact information so collectors can reach you.",
  "dealer.saved": "Saved",
  "dealer.established": "Est. {year}",
  "dealer.establishedJa": "創業 {year}年"
}
```

---

## 6. Phase 2: Public Storefront

**Goal:** The public page at `/dealers/[slug]` displays the dealer's profile — banner, logo, bio, contact, trust signals, and listings.

### 6.1 Public Page Layout

The page transforms from today's minimal layout to a full storefront. The structure follows the Artsy/Chairish pattern: hero visual at top, identity overlay, content sections below.

```
┌─────────────────────────────────────────────┐
│                                             │
│            [BANNER IMAGE]                   │  Full-width, 16:9 aspect
│            (or gradient fallback)           │  aspect-[16/9] max-h-[280px]
│                                             │
│    ┌──────┐                                 │
│    │ LOGO │  Dealer Name  🇯🇵               │  Logo overlaps banner bottom
│    └──────┘  Est. 1978 · Ginza, Tokyo       │  by ~40px
│              ★ Koto · Bizen-den · Tsuba     │  Specialization pills
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  About                                      │  Bilingual bio (locale-aware)
│  "Our family has dealt in Bizen swords      │  with toggle for other language
│   since 1953. We specialize in..."          │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  Trust signal cards
│  │ 142      │  │ 23       │  │ Est.     │  │  (auto-generated)
│  │ Listings │  │ Juyo     │  │ 1978     │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  Contact                                    │  Rendered from dealer metadata
│  ✉ info@sokendo.jp                          │
│  📱 LINE: @sokendo                          │  LINE opens line.me deep link
│  🌐 sokendo.jp                              │  External link
│  📍 Ginza, Tokyo                            │  City always shown
│                                             │
│  Ships internationally · Wire · PayPal      │  Policy pills
│  Responds in Japanese / English             │  Language badge
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  Inventory                                  │  Existing breakdown bar
│  ████████░░ 142                             │  (carried forward from today)
│  [katana 47] [tsuba 31] [wakizashi 28] ...  │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [Browse All 142 Listings →]                │  Gold CTA button
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  Credentials                                │  Memberships, if any
│  NBTHK · 全日本刀剣商業協同組合              │
│                                             │
└─────────────────────────────────────────────┘
```

### 6.2 Banner Fallback

When no banner is uploaded, display a gradient using the dealer's accent color:

```css
background: linear-gradient(135deg, {accentColor}20, {accentColor}05);
```

This ensures the page has visual structure even with an incomplete profile. The gradient is subtle — it frames the logo and name without looking like a placeholder.

### 6.3 Logo Fallback

When no logo is uploaded, display the dealer's initials in a circle with the accent color background:

```
┌──────┐
│  銀  │   ← First character of name_ja (or first letter of English name)
└──────┘
```

### 6.4 Bio Display

- **JA locale:** Show `bio_ja` by default. If missing, show `bio_en`. Toggle: "English version available" / "英語版を表示"
- **EN locale:** Show `bio_en` by default. If missing, show `bio_ja`. Toggle: "日本語版を表示" / "Show Japanese version"
- **Neither:** Section hidden entirely.
- **Rendering:** Plain text with paragraph breaks. No markdown rendering (keep it simple for dealers who aren't technical). Preserve `\n\n` as paragraph breaks.

### 6.5 Trust Signal Cards

Auto-generated from existing data. Three cards in a horizontal row (mobile: stack or horizontal scroll):

| Card | Source | Display |
|------|--------|---------|
| **Active Listings** | `COUNT(*) WHERE dealer_id = X AND is_available` | "142 Listings" |
| **Top Certification** | Most frequent cert in inventory | "23 Juyo" (with cert color) |
| **Established** | `dealers.founded_year` | "Est. 1978" / "創業 1978年" |

If `founded_year` is null, the third card shows "On NihontoWatch since {year}" from `dealers.created_at`.

### 6.6 Contact Section

Only renders fields that have values. Each contact method is a clickable row:

| Field | Action |
|-------|--------|
| Email | `mailto:` link |
| Phone | `tel:` link |
| LINE ID | `https://line.me/ti/p/~{lineId}` deep link (opens LINE app) |
| Website | External link with `rel="noopener noreferrer nofollow"` |
| Instagram | External link to profile |
| Address | Google Maps link (when visible) |

### 6.7 Policy Pills

Rendered as small inline badges:

```
Ships Internationally · Wire Transfer · PayPal · Credit Card
国際発送可 · 銀行振込 · PayPal · クレジットカード
```

Only pills for policies with `true` values are shown. Unknown/null values are omitted (not "Unknown").

### 6.8 SEO Enhancements

The existing SEO (JSON-LD Organization, breadcrumbs, OG tags) is extended:

- **JSON-LD:** Add `description`, `logo`, `image` (banner), `address`, `telephone`, `foundingDate`
- **OG image:** Use banner if uploaded, else fall back to generated OG image
- **Meta description:** Include bio excerpt (first 160 chars) if available

### 6.9 Shop Photo

If `shop_photo_url` is set, display it in the About section or as a secondary visual alongside the bio. Small but meaningful — a real photo of a shop in Ginza carries enormous trust for collectors.

---

## 7. Phase 3: Trust Signals & Badges

**Goal:** Auto-generated badges that reflect current dealer performance. Inspired by Chrono24's rolling badge system.

### 7.1 Badge System

Badges are computed, not claimed. They use rolling windows to reward current behavior.

| Badge | Criteria | Icon | Display |
|-------|----------|------|---------|
| **Active Inventory** | 50+ available listings | Sword icon | "50+ Active Listings" |
| **Juyo Specialist** | 10+ Juyo/Tokuju items | Star icon | "Juyo Specialist" |
| **Koto Expert** | 60%+ of inventory is Koto era | Shield icon | "Koto Expert" |
| **Bilingual** | `english_support = true` AND `bio_ja` present | Globe icon | "日本語 / English" |
| **Established** | `founded_year` is 20+ years ago | Clock icon | "40+ Years" |
| **Fast Responder** | Median inquiry response < 24h (Phase 4, needs inquiry system) | Lightning icon | "Responds within 24h" |
| **Verified Location** | Admin has verified physical address | Checkmark icon | "Verified Location" |

Badges are displayed on:
1. The public storefront page (below name/specializations)
2. Listing cards in browse (small icon next to dealer name — future)

### 7.2 Badge Computation

Badges are computed at page render time from DB data. No separate badge table needed — they're derived from existing columns + inventory queries.

```typescript
interface DealerBadge {
  id: string;
  label: string;
  labelJa: string;
  icon: string;
  earned: boolean;
}

function computeBadges(dealer: DealerProfile, stats: DealerStats): DealerBadge[] {
  return [
    {
      id: 'active_inventory',
      label: '50+ Active Listings',
      labelJa: '50件以上出品中',
      icon: 'sword',
      earned: stats.activeListings >= 50,
    },
    // ... etc
  ].filter(b => b.earned);
}
```

### 7.3 Specialization Auto-Detection

In addition to dealer-curated specializations, we can auto-detect from inventory:

```sql
-- Top 3 item types by percentage
SELECT item_type, COUNT(*)::float / SUM(COUNT(*)) OVER () AS pct
FROM listings
WHERE dealer_id = $1 AND is_available = true
GROUP BY item_type
ORDER BY pct DESC
LIMIT 3;

-- Top era (>50% of inventory)
SELECT era, COUNT(*)::float / SUM(COUNT(*)) OVER () AS pct
FROM listings
WHERE dealer_id = $1 AND is_available = true AND era IS NOT NULL
GROUP BY era
HAVING COUNT(*)::float / SUM(COUNT(*)) OVER () > 0.5;
```

Auto-detected specializations are shown as lighter-colored pills alongside dealer-curated ones. Label: "Based on inventory" / "在庫に基づく".

---

## 8. Phase 4: Analytics & Engagement

### 8.1 Self-Serve Analytics Dashboard

**Route:** `/dealer/analytics`

NihontoWatch already tracks comprehensive dealer analytics (admin dashboard at `/admin/dealers/[id]`). Phase 4 creates a dealer-scoped version.

**API:** `/api/dealer/analytics`
- Auth: `verifyDealer()`
- Reuses existing RPC functions (`get_dealer_click_stats`, `get_dealer_dwell_stats`, etc.) scoped to the authenticated dealer's ID
- No new SQL RPCs needed — just auth wrapping

**Dashboard cards:**

| Metric | Source | Display |
|--------|--------|---------|
| Profile views | `listing_views` aggregated by dealer | Sparkline + total |
| Listing clicks (to your site) | `dealer_clicks` table | Sparkline + total |
| Favorites | `user_favorites` count | Total + trend |
| Avg. dwell time | `activity_events` (dwell) | "Collectors spend avg 45s on your listings" |
| Top listings | By views/favorites | Top 5 list with thumbnails |
| Inventory health | Stale listings (>90d, no views) | "12 listings haven't been viewed in 90 days" |

**Date range:** 7d / 30d / 90d toggle.

### 8.2 Follower System

Collectors can "follow" a dealer to get notified of new inventory.

**Schema:**
```sql
CREATE TABLE dealer_followers (
  id SERIAL PRIMARY KEY,
  dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dealer_id, user_id)
);
```

**Mechanics:**
- Follow button on public dealer page
- Follower count displayed on dealer profile
- New listing → email notification to followers (piggyback on existing saved-search alert cron)
- Dealer dashboard shows follower count + growth trend

### 8.3 Featured Listings

Dealers can pin 3-6 items to feature at the top of their public page.

**Schema option:** `featured_position INTEGER` column on `listings` (nullable, 1-6 for featured items). Only dealer-source listings can be featured. Dealer clears by setting to NULL.

**Alternative (simpler):** `featured_listing_ids INTEGER[]` column on `dealers`. Array of listing IDs in display order. Validated on read (filter out sold/deleted).

---

## 9. Mobile Design

### 9.1 Profile Settings (Mobile)

The card-based layout stacks naturally on mobile. Key considerations:

- **Image upload:** Large tap target (full-width upload zone). Camera icon for direct capture. Drag-drop not available on mobile — tap to open file picker or camera.
- **Accent color:** Presets shown as a row of colored circles (tap to select). Custom hex input available but secondary.
- **Textareas:** Full-width, minimum 4 rows visible. No horizontal scrolling.
- **Save feedback:** Bottom toast ("Saved" / "保存しました") — not inline, to avoid layout shift.
- **Completeness bar:** Sticky at bottom of screen while scrolling settings.

### 9.2 Public Storefront (Mobile)

- **Banner:** Full-width, `aspect-[16/9]`, max-height 200px on mobile (shorter than desktop 280px)
- **Logo:** 64x64 on mobile (80x80 desktop), positioned overlapping banner bottom edge
- **Trust signal cards:** Horizontal scroll row (not stacked)
- **Contact:** Each row is a tappable action (email opens mail app, LINE opens LINE, etc.)
- **Bio:** Collapsed to ~4 lines with "Read more" expand toggle
- **Inventory breakdown:** Same as today, works well on mobile already

### 9.3 Navigation

Add "Profile" entry to the dealer section in `MobileNavDrawer`:

```
My Listings      →  /dealer
Profile Settings →  /dealer/profile
```

On desktop, add a gear icon or "Profile" text link in the dealer sub-header bar.

---

## 10. Japanese Dealer Considerations

### 10.1 LINE is Primary Contact

For Japanese dealers and collectors, LINE is the dominant communication channel for high-value transactions. The LINE ID field should be:
- Prominent (not buried under "Other social links")
- Displayed with LINE's green branding
- Deep-linked to `line.me/ti/p/~{lineId}` for one-tap contact

### 10.2 Information Density

Japanese web culture favors more information, not less. The public storefront should allow:
- Longer bios without truncation (or higher truncation threshold for JA locale)
- More detailed policy text
- Rich credential display (multiple association names in kanji)

Don't force Western minimalism on Japanese dealers' pages.

### 10.3 Generational Expertise

"三代目" (3rd generation) or "Since 1953" carries enormous weight in Japanese business culture. The `founded_year` field becomes a trust signal in its own right:
- 20+ years: "Established dealer" badge
- 50+ years: Extra visual distinction

Display in JA locale uses Japanese era names when appropriate:
- 1978 → "創業 昭和53年" (optional — could be a future enhancement)

### 10.4 Shop Photos

Japanese antique shops have a physical presence that's part of their identity. A photo of the storefront (看板 = signboard, 店構え = shop facade) builds trust in ways that a logo alone cannot. The `shop_photo_url` field is more culturally significant for JP dealers than for international ones.

### 10.5 Membership Display

Japanese trade association names should be displayed in kanji, not romanized:
- "全日本刀剣商業協同組合" (not "All Japan Sword Dealers Cooperative")
- "日本美術刀剣保存協会" (not "NBTHK")

In EN locale, show both: "NBTHK (日本美術刀剣保存協会)"

---

## 11. File Inventory

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/1XX_dealer_profile.sql` | Schema changes (new columns) |
| `src/app/dealer/profile/page.tsx` | Profile settings page (server component wrapper) |
| `src/app/dealer/profile/DealerProfileClient.tsx` | Profile settings client component |
| `src/app/api/dealer/profile/route.ts` | GET + PATCH dealer profile |
| `src/app/api/dealer/profile/images/route.ts` | POST + DELETE profile images |
| `src/components/dealer/ProfileImageUpload.tsx` | Reusable image upload for logo/banner/shop (wraps ImageUploadZone pattern) |
| `src/components/dealer/AccentColorPicker.tsx` | Color preset row + custom hex |
| `src/components/dealer/SpecializationPills.tsx` | Multi-select specialization pills |
| `src/components/dealer/ProfileCompleteness.tsx` | Progress bar + missing-item prompts |
| `src/lib/dealer/profileCompleteness.ts` | `computeProfileCompleteness()` utility |
| `src/lib/dealer/badges.ts` | `computeBadges()` utility (Phase 3) |

### Modified Files

| File | Changes |
|------|---------|
| `src/app/dealers/[slug]/page.tsx` | Enhanced public storefront (Phase 2) |
| `src/app/dealer/DealerPageClient.tsx` | Add "Profile" navigation link |
| `src/components/dealer/DealerBottomBar.tsx` | Add profile icon (mobile) |
| `src/components/layout/MobileNavDrawer.tsx` | Add "Profile Settings" in dealer section |
| `src/i18n/locales/en.json` | ~50 new `dealer.*` keys |
| `src/i18n/locales/ja.json` | ~50 new `dealer.*` keys |
| `src/types/index.ts` | Extend `Dealer` type with new fields |
| `src/lib/seo/jsonLd.ts` | Enhanced `generateDealerJsonLd()` with logo, description, address |

---

## 12. Open Questions

### 12.1 Accent Color Scope

How far does the accent color reach?

- **Option A (conservative):** Only the dealer's own public page (`/dealers/[slug]`). Tints headings, buttons, and link hover states.
- **Option B (moderate):** Also tints listing cards when browsed with `?dealer=X` filter.
- **Option C (aggressive):** Also tints the dealer's private portal.

**Recommendation:** Start with Option A. It's the simplest and avoids color-clashing concerns in browse.

### 12.2 Bio Format

- **Plain text** (simpler, safer, easier to render)
- **Light markdown** (headers, bold, italic, lists — like artist AI descriptions)
- **Rich text editor** (TipTap/ProseMirror — most powerful but highest implementation cost)

**Recommendation:** Plain text with paragraph break preservation for Phase 1. Most dealers (especially Japanese) won't use markdown syntax. Upgrade to light markdown in Phase 2 if dealers request it.

### 12.3 Featured Listings (Phase 4 Detail)

Should featured listings be:
- **Dealer-pinned** (dealer chooses which items to highlight)
- **Auto-featured** (most-viewed or highest-scored items)
- **Both** (dealer pins override auto-selection)

**Recommendation:** Both. Dealer pins up to 6 items. If fewer than 6 pinned, auto-fill remaining slots with most-viewed items.

### 12.4 Profile Visibility During Phase 1

Profile settings exist in Phase 1, but the public page isn't enhanced until Phase 2. Should there be a "Preview" button that shows how the public page *will* look?

**Recommendation:** Yes. Add a "Preview your storefront" link in the profile settings page that shows a read-only preview of the enhanced public page layout. This motivates dealers to fill out their profile before the public page launches.

### 12.5 Dealer-Portal-Uploaded vs Scraped Listings

When `NEXT_PUBLIC_DEALER_LISTINGS_LIVE` flips to `true`, the public dealer page at `/dealers/[slug]` will show both scraped listings and dealer-uploaded listings. Should they be visually distinguished?

**Recommendation:** No. From a collector's perspective, a listing is a listing. The `source` column is an internal implementation detail. The public page should present a unified inventory regardless of source.

---

## Appendix A: SOTA Research Summary

Full research document: `docs/DEALER_PROFILE_RESEARCH.md`

**Key references that informed this design:**

| Platform | Key Insight | Applied To |
|----------|-------------|------------|
| **Chrono24** | 90-day rolling badges based on real metrics | Phase 3 badge system |
| **Chairish** | Banner + logo overlap creates instant ownership | Visual identity layout |
| **Etsy Plus** | Auto-generated color themes from uploaded images | Accent color picker |
| **Artsy** | "Context for collectors" gallery profiles | Bio + shop photo emphasis |
| **Rakuten** | Dense information architecture for JP market | JA locale considerations |
| **1stDibs** | Platform brand consistency with dealer identity | Controlled customization principle |
| **Saatchi Art** | "Show the person behind the shop" philosophy | Shop photo feature |
| **Ruby Lane** | Professional vetting creates inherent trust | Credential/membership display |
| **LiveAuctioneers** | Analytics dashboards drive dealer retention | Phase 4 self-serve analytics |

## Appendix B: Existing Dealer Page (Before/After)

### Before (Current)

```
Dealer Name 🇯🇵
domain.com ↗

┌─────────────────────┐
│ INVENTORY       142 │
│ ████████░░          │
│ [katana] [tsuba]... │
└─────────────────────┘

[Browse All 142 Listings →]
```

### After (Phase 2)

```
┌─────────────────────────────────┐
│         [BANNER IMAGE]          │
│    ┌────┐                       │
│    │LOGO│ Dealer Name 🇯🇵       │
│    └────┘ Est. 1978 · Ginza     │
│           ★ Koto · Bizen · Tsuba│
├─────────────────────────────────┤
│ About                           │
│ "Our family has dealt in..."    │
├─────────────────────────────────┤
│ [142 Listings] [23 Juyo] [1978]│
├─────────────────────────────────┤
│ Contact                         │
│ ✉ email  📱 LINE  🌐 web      │
│ Ships Intl · Wire · PayPal     │
├─────────────────────────────────┤
│ Inventory breakdown             │
│ ████████░░ 142                  │
│ [katana] [tsuba] [wakizashi]   │
├─────────────────────────────────┤
│ [Browse All 142 Listings →]     │
├─────────────────────────────────┤
│ NBTHK · 全日本刀剣商業協同組合  │
└─────────────────────────────────┘
```
