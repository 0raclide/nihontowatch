# Dealer Portal MVP — Sokendo Build Spec

> **Status:** Phase 1 BUILT + Inventory Table BUILT — unified into `/vault`
> **Last updated:** 2026-03-15
> **Vision doc:** `docs/DEALER_PORTAL_PRODUCT.md`

---

## Context

Sokendo (創建堂) is the first dealer. They have no website — all stock is unlisted. A contact at Sokendo will use their phone browser to upload listings and receive inquiries via LINE.

**The loop:**
```
Open /dealer → see listings → tap [+] → photos → Nihonto/Tosogu →
type → cert → artisan (optional) → price → Publish

Collector sees listing → taps Inquire → Sokendo gets LINE notification
```

---

## Testing Gate

Dealer-uploaded listings are invisible to collectors until launch.

**Mechanism:** Feature flag `NEXT_PUBLIC_DEALER_LISTINGS_LIVE`

```
NEXT_PUBLIC_DEALER_LISTINGS_LIVE=false  (testing phase)
  → /dealer page: friend sees their listings ✓
  → /browse page: collectors see nothing from Sokendo
  → /listing/[id]: 404 for dealer-source listings

NEXT_PUBLIC_DEALER_LISTINGS_LIVE=true   (launch)
  → Everything visible
```

Browse API adds `WHERE source != 'dealer'` when flag is false. The `/dealer` page queries by `dealer_id` directly, unaffected by the flag.

---

## Auth Flow

No new auth system. Sokendo's contact gets a regular NihontoWatch account.

```sql
-- Admin sets up the dealer account (one-time SQL):
UPDATE profiles
SET subscription_tier = 'dealer',
    dealer_id = {sokendo_dealer_id}
WHERE email = 'friend@example.com';
```

Middleware detects `dealer` tier → `/dealer` route accessible → all queries scoped to `profiles.dealer_id`.

---

## Database Changes

### 1. Add `dealer_id` to profiles

```sql
ALTER TABLE profiles ADD COLUMN dealer_id INTEGER REFERENCES dealers(id);
```

Links a user account to a dealer. NULL for non-dealer users. Multiple staff can share the same `dealer_id`.

### 2. Add `source` to listings

```sql
ALTER TABLE listings ADD COLUMN source TEXT DEFAULT 'scraper';
-- Values: 'scraper' (default, all existing) | 'dealer' (uploaded via portal)
```

Distinguishes scraper-crawled from dealer-uploaded listings. Used by the testing gate and `is_initial_import` logic (dealer uploads are never initial imports).

### 3. Create `inquiries` table

```sql
CREATE TABLE inquiries (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  dealer_id INTEGER NOT NULL REFERENCES dealers(id),
  collector_id UUID NOT NULL REFERENCES auth.users(id),
  collector_name TEXT,
  collector_tier TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Create `dealer-images` storage bucket

Clone of `collection-images`. Public read, authenticated write scoped to dealer role.

---

## API Routes

### `/api/dealer/listings` — GET, POST

**GET** — List dealer's own listings.
```
Query: dealer_id from profile
Returns: listings[] with dealer_id = profile.dealer_id
Filters: status (available/sold/withdrawn/draft)
```

**POST** — Create new listing.
```
Body: {
  item_type, item_category ('nihonto' | 'tosogu'),
  cert_type, price_value, price_currency, title, title_ja,
  artisan_id, artisan_display_name,
  smith, school, tosogu_maker, tosogu_school,
  era, province, images, notes
}
Sets: source = 'dealer', dealer_id, is_available = true,
      is_initial_import = false, first_seen_at = NOW()
Returns: { id, ...listing }
```

### `/api/dealer/listings/[id]` — PATCH, DELETE

**PATCH** — Update listing (price, status, photos, etc.).
```
Auth: verify listing.dealer_id = profile.dealer_id
Body: partial listing fields
Special: status changes (mark sold, withdraw, relist)
```

**DELETE** — Remove draft listing.
```
Auth: verify ownership
Only allowed for draft/withdrawn listings
```

### `/api/dealer/images` — POST, DELETE

**POST** — Upload image to `dealer-images` bucket.
```
Clone of /api/collection/images
Resize to 2048px max, 85% JPEG quality
Returns: public URL
```

**DELETE** — Remove image from bucket.

### `/api/dealer/inquiries` — GET (dealer), POST (collector)

**GET** — List inquiries for dealer's listings.
```
Auth: dealer tier, scoped to dealer_id
Returns: inquiries[] with collector info
```

**POST** — Collector sends inquiry.
```
Auth: any authenticated user
Body: { listing_id, message }
Side effects:
  1. Insert into inquiries table
  2. POST to LINE Notify (dealer's token)
  3. Send backup email
```

---

## Pages

### `/dealer` — Dealer Home

Auth-gated: redirect to `/browse?login=dealer` if not authenticated or not dealer tier.

**Layout:**
```
┌─────────────────────────────────┐
│ ☰  Sokendo            [+]      │
├─────────────────────────────────┤
│                                 │
│ ● Available (4)  ○ Sold (2)    │
│   ○ Drafts (1)  ○ All          │
│                                 │
│ ┌───────────┐ ┌───────────┐    │
│ │ ListingCard│ │ ListingCard│    │
│ └───────────┘ └───────────┘    │
│ ┌───────────┐ ┌───────────┐    │
│ │ ListingCard│ │ ListingCard│    │
│ └───────────┘ └───────────┘    │
│                                 │
│              [＋]               │
└─────────────────────────────────┘
```

**Components:**
- `ListingGrid` with `preMappedItems` (dealer listings mapped to `DisplayItem[]`)
- `ListingCard` — zero modifications
- Status filter tabs (Available / Sold / Drafts / All)
- FAB → navigates to `/dealer/new`
- Card tap → QuickView with dealer action slots

**QuickView dealer slots (new):**
- `DealerActionBar`: [Edit] [Mark Sold] [Withdraw] buttons
- `DealerCTA`: hidden (no "Visit Dealer" for own listings)
- Inline stats: view count + save count (simple number from existing tracking)

### `/dealer/new` — Add Listing

Mobile-first single scrollable form. See listing flow below.

**Components reused:**
- `ImageUploadZone` from collection — queue mode for new listings
- `ArtisanSearchPanel` from admin — with `domain` prop from category selection
- Cert pills — local state version (not `CertPillRow` which auto-saves via API)

**Components new:**
- `DealerListingForm` — the form itself
- `CategorySelector` — Nihonto/Tosogu toggle
- `TypePills` — item type selector (changes based on category)
- `CertPills` — cert type selector (local state, not API-backed)
- Auto-title display (reactive to form state)
- Sticky publish button

---

## The Listing Form Flow

### Field Order

```
Photos → Category (Nihonto/Tosogu) → Type → Cert → Artisan → Title → Price → [Notes] → Publish
```

### Field Details

| Field | Type | Required | Sticky | Source |
|---|---|---|---|---|
| Photos | Image upload | Yes (min 1) | No | Camera / gallery |
| Category | Toggle: Nihonto / Tosogu | Yes | Yes (remembers last) | New component |
| Type | Pills (6-7 options per category) | Yes | Yes (remembers last) | New component |
| Cert | Pills: Tokuju / Juyo / TokuHo / Hozon / None | Yes | No | New component |
| Artisan | Search + select | No | No | Reuse `ArtisanSearchPanel` |
| Title | Text (auto-generated, editable) | Yes | No | Auto from cert+type+artisan |
| Price | Numeric + "Ask" checkbox | Yes | No | `inputMode="numeric"` |
| Notes | Textarea (collapsed) | No | No | Plain text |

### Category → Type Mapping

**Nihonto (刀剣):**
- Katana, Wakizashi, Tanto, Tachi, Naginata, Yari, Other

**Tosogu (刀装具):**
- Tsuba, Fuchi-Kashira, Menuki, Kozuka, Kogai, Other

### Category → Artisan Search Scope

- Nihonto → `ArtisanSearchPanel domain="smith"` → searches `domain IN ('sword', 'both')`
- Tosogu → `ArtisanSearchPanel domain="tosogu"` → searches `domain IN ('tosogu', 'both')`

Uses existing `getDomainFilter()` in the artisan search API.

### Auto-Title Engine

Pattern: `{cert} {type} — {artisan}`

| State | Generated Title |
|---|---|
| Cert: Juyo | "Juyo" |
| + Type: Katana | "Juyo Katana" |
| + Artisan: Kanemitsu | "Juyo Katana — Kanemitsu" |
| No cert, Type: Tsuba | "Tsuba" |
| + Artisan: Nobuie | "Tsuba — Nobuie" |

Also generates `title_ja`: `{cert_ja} {type_ja} — {artisan_kanji}`
e.g., "重要刀剣 刀 — 兼光"

### Artisan Auto-Fill

When an artisan is selected from search results, auto-populate:

| Source (from Yuhinkai) | Target (listing field) |
|---|---|
| `maker_id` | `artisan_id` |
| `name_romaji` | `artisan_display_name` |
| `name_kanji` via display name logic | Title suffix |
| `era_text` | `era` |
| `province_text` | `province` |
| `legacy_school_text` | `school` (nihonto) or `tosogu_school` (tosogu) |
| Romaji name | `smith` (nihonto) or `tosogu_maker` (tosogu) |
| `designation_factor` | `elite_factor` (for featured score) |

Uses `getAttributionName()` / `getAttributionSchool()` path routing.

### Sticky Memory (localStorage)

Key: `nihontowatch-dealer-last-category` → `'nihonto' | 'tosogu'`
Key: `nihontowatch-dealer-last-type` → `'katana' | 'tsuba' | ...`

On "Add Another": reset photos, cert, artisan, title, price, notes. Pre-select category + type from localStorage.

### After Publish

```
✓ Listed

[Add Another]           ← Resets form, keeps sticky fields
[Back to My Listings]   ← Navigate to /dealer
```

"Add Another" is the primary CTA (larger, filled button). The friend is batch-listing.

---

## Inquiry System

### Collector Side

On Sokendo's listings, the QuickView shows "Inquire" as the primary CTA (replacing "Visit Dealer" which has no target for Sokendo).

```
┌─────────────────────────────────┐
│  Inquire about:                 │
│  Juyo Katana — Kanemitsu        │
│                                 │
│  ┌─────────────────────────┐   │
│  │ こちらの作品について、   │   │
│  │ 詳しくお伺いしたく      │   │
│  │ 存じます。              │   │
│  └─────────────────────────┘   │
│                                 │
│  Your profile will be shared:   │
│  Christopher H. · Collector     │
│  Member since 2024              │
│                                 │
│  [Send Inquiry]                 │
└─────────────────────────────────┘
```

Auth required. Pre-populated with polite JP opening (locale-aware). Collector sees what dealer will see about them.

### LINE Notification

```
POST https://notify-api.line.me/api/notify
Authorization: Bearer {dealer_line_token}
Content-Type: application/x-www-form-urlencoded

message=
新しいお問い合わせ
作品: Juyo Katana — Kanemitsu
送信者: Christopher H. (Collector)
メッセージ: こちらの作品について...

https://nihontowatch.com/dealer/inquiries/123
```

LINE token stored in `dealers` table: `ALTER TABLE dealers ADD COLUMN line_notify_token TEXT;`

Backup email also sent via SendGrid (existing infrastructure).

### Dealer Side

For MVP, the dealer reads inquiries via:
1. LINE notification (immediate)
2. The link in the notification → simple inquiry detail page at `/dealer/inquiries/[id]`
3. No threaded replies in-app for MVP — dealer responds via LINE/email/phone

The inquiry detail page shows:
- Listing thumbnail + title
- Collector's message
- Collector's profile context (tier, member since)
- Mark as read button

---

## Component Map

### Reuse As-Is (zero changes)

| Component | Location |
|---|---|
| `ListingCard` | `src/components/browse/ListingCard.tsx` |
| `ListingGrid` | `src/components/browse/ListingGrid.tsx` |
| `ImageUploadZone` | `src/components/collection/ImageUploadZone.tsx` |
| `ArtisanSearchPanel` | `src/components/admin/ArtisanSearchPanel.tsx` |
| `FeedbackModalShell` | `src/components/feedback/FeedbackModalShell.tsx` |
| `listingToDisplayItem` mapper pattern | `src/lib/displayItem.ts` |

### Extend (small additions)

| Component | Change |
|---|---|
| QuickView slot system | Add `source: 'dealer'` branch |
| Browse API | Add testing gate filter (`source != 'dealer'` when flag off) |
| `DisplayItem` type | Add `dealer?` extension if needed |
| Middleware | Allow `/dealer` routes for dealer-tier users |

### Build New

| Component | Description |
|---|---|
| `/dealer/page.tsx` + `DealerPageClient.tsx` | Dealer home — listing grid with status tabs + FAB |
| `/dealer/new/page.tsx` + `DealerNewListingClient.tsx` | Add listing form |
| `/dealer/inquiries/[id]/page.tsx` | Inquiry detail view |
| `DealerActionBar.tsx` | QuickView slot: Edit / Sold / Withdraw |
| `DealerListingForm.tsx` | The add/edit form component |
| `CategorySelector.tsx` | Nihonto/Tosogu toggle |
| `TypePills.tsx` | Item type pill selector |
| `CertPills.tsx` | Cert type pill selector (local state) |
| `InquiryModal.tsx` | Collector-facing inquiry form |
| `dealerListingToDisplayItem()` | Mapper utility |
| `generateListingTitle()` | Auto-title utility |
| LINE Notify helper | `src/lib/notifications/line.ts` |

---

## Build Order

### Phase 1: Dealer can see + add listings (no public visibility) — DONE

1. ✅ DB migration: `dealer_id` on profiles, `source` on listings (migration 097)
2. ✅ Storage: `dealer-images` bucket
3. ✅ API: `/api/dealer/listings` (GET + POST)
4. ✅ API: `/api/dealer/images` (POST + DELETE) + 6 section image APIs
5. ✅ Page: `/dealer` with ListingGrid (now superseded by `/vault` unified page)
6. ✅ Page: `/dealer/new` with listing form
7. ✅ Mapper: `dealerListingToDisplayItem()`
8. ✅ Utility: `generateListingTitle()`
9. ✅ QuickView: dealer action slots (Edit / Sold / Withdraw / Promote / Delist)
10. ✅ API: `/api/dealer/listings/[id]` (PATCH for status changes + DELETE)

### Phase 1.5: Inventory Table + Unified Vault — DONE (2026-03-15)

11. ✅ `DealerInventoryTable` — sortable, data-dense table for dealer tabs in `/vault`
12. ✅ `DealerInventoryRow` — portal-based status menu, completeness bar, inline price, age coloring
13. ✅ `computeListingCompleteness()` — 9-field weighted scoring (100 points)
14. ✅ `ListForSaleModal` — INVENTORY→AVAILABLE transition with price + DealerIntelligence
15. ✅ `CollectionPageClient` integration — dealer tabs, optimistic status/price handlers, per-tab view
16. ✅ Per-tab view preferences — separate localStorage keys for collection vs dealer

**See:** `docs/SESSION_20260315_DEALER_INVENTORY_TABLE.md` for full details.

### Phase 2: Collectors can inquire (still behind feature flag)

17. DB migration: `inquiries` table, `line_notify_token` on dealers
18. API: `/api/dealer/inquiries` (GET + POST)
19. Component: `InquiryModal` (collector side)
20. LINE Notify: `src/lib/notifications/line.ts`
21. Page: `/dealer/inquiries/[id]` (dealer reads inquiry)
22. QuickView: "Inquire" CTA for dealer-source listings

### Phase 3: Go live

23. Browse API: remove `source != 'dealer'` filter
24. Set `NEXT_PUBLIC_DEALER_LISTINGS_LIVE=true`
25. Featured score cron: include dealer listings
26. Smart crop cron: include dealer listings

---

## Files to Create

```
src/
  app/
    dealer/
      page.tsx                          # Auth gate + server component
      DealerPageClient.tsx              # Listing grid + status tabs + FAB
      new/
        page.tsx                        # Auth gate
        DealerNewListingClient.tsx      # Listing form
      inquiries/
        [id]/
          page.tsx                      # Inquiry detail
    api/
      dealer/
        listings/
          route.ts                      # GET + POST
          [id]/
            route.ts                    # PATCH + DELETE
        images/
          route.ts                      # POST + DELETE
        inquiries/
          route.ts                      # GET (dealer) + POST (collector)
  components/
    dealer/
      DealerListingForm.tsx             # The add/edit form
      CategorySelector.tsx              # Nihonto / Tosogu toggle
      TypePills.tsx                     # Item type pills
      CertPills.tsx                     # Cert pills (local state)
      DealerActionBar.tsx               # QuickView slot
      InquiryModal.tsx                  # Collector inquiry form
  lib/
    dealer/
      displayItem.ts                    # dealerListingToDisplayItem()
      titleGenerator.ts                 # generateListingTitle()
    notifications/
      line.ts                           # LINE Notify POST helper

supabase/
  migrations/
    XXX_dealer_portal.sql               # dealer_id, source, inquiries table
```

---

## Key Rules

1. **Dealer-uploaded listings set `is_initial_import = false`** — they are genuine new items, not bulk imports (Critical Rule #12).
2. **Dealer-uploaded listings set `source = 'dealer'`** — distinguished from scraper data.
3. **All dealer APIs use service role key** for writes (anon key is read-only).
4. **All dealer APIs verify `profile.dealer_id` matches** the listing's `dealer_id` — ownership check on every mutation.
5. **Feature flag gates public visibility** — `NEXT_PUBLIC_DEALER_LISTINGS_LIVE` controls browse API filtering.
6. **Images upload to `dealer-images` bucket** — separate from `collection-images`.
7. **CertPills is local state only** — unlike `CertPillRow` which auto-saves via API. The cert is saved when the full listing is published.
8. **Artisan field routing**: Nihonto → writes to `smith`/`school`. Tosogu → writes to `tosogu_maker`/`tosogu_school`. Uses `getAttributionName()`/`getAttributionSchool()` path.
