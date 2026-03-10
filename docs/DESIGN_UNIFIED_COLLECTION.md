# Unified Collection Architecture

> **Status:** Phases 1-5 DONE (2026-03-10). Phase 4 ~95% (remaining: verify nav links, end-to-end non-dealer test, paywall CTA fix). Phase 5 cleanup done: "I Own This" prefill wired, dead code removed (openCollectionAddForm, folders API). Remaining cleanup: drop `user_collection_items` table, remove `NEXT_PUBLIC_COLLECTION_ENABLED` env var.
> **Date:** 2026-03-10 (last updated)
> **Authors:** Chris + Claude
> **Replaces:** Collection Manager V1 (`/collection`), dealer "My Listings" naming

## Executive Summary

Unify the dealer portal and collection manager under a single **"Collection"** concept, using **two physically separated tables** for security. Private collection items live in a new `collection_items` table. Public for-sale listings live in the existing `listings` table. The form **writes to the item's current table** — `collection_items` for private items, `listings` for items already listed for sale. Publication actions ("List for Sale", future "Private Offer") are **separate actions taken on existing collection items**, not form submit variants. An explicit **"List for Sale"** action promotes an item from `collection_items` to `listings` via an **atomic Postgres RPC**. **Delisting uses a soft-transition** — the `listings` row is marked `DELISTED` (not deleted), preserving favorites, price history, views, and video associations. A stable **`item_uuid`** persists across all transitions, enabling permanent URLs and cross-table audit trails. All transitions are recorded in a `collection_events` audit log keyed by `item_uuid`. The rich dealer form (sayagaki, koshirae, provenance, kiwame, kanto hibisho, video) becomes THE cataloging form for all users. **Cataloging is free for all users.** "List for Sale" requires the Dealer tier. The current standalone collection manager (`/collection`, `user_collection_items` table, 7 thin components) is dropped without data migration.

### Why Two Tables?

The P0 dealer listing leak (2026-03-03) proved that single-table isolation via RLS is fragile:

- **18+ `.from('listings')` call sites** — browse API, 6 cron jobs, RPCs, SEO sitemap, search, alerts, favorites, artisan pages. Any one missing a filter = a leak.
- **Service role key bypasses RLS** — the scraper, every cron job, and every admin API uses service role. RLS provides zero protection for the most common access patterns.
- **Blast radius escalation** — leaking a dealer's test listing into alerts was embarrassing. Leaking a collector's private Juyo Masamune into Google is trust-destroying.

With two tables, a new developer adding a cron job that queries `listings` **physically cannot** leak private items — they're not there. Correct by construction, not by discipline.

### Why Soft-Delist?

Six tables FK to `listings.id` with CASCADE: `user_favorites`, `price_history`, `listing_views`, `listing_impressions`, `dealer_clicks`, `user_alerts`. A hard DELETE on delist destroys all of this data — a user's favorites silently disappear, price history is lost. (Note: `item_videos` uses `item_uuid` instead of `listings.id` FK, so videos survive DELETE — but the other 6 tables don't.)

Soft-delist (UPDATE to `status='DELISTED'`, `is_available=false`) preserves every FK relationship. The listing row stays as an inert ghost. Verified: every user-facing query (browse, SEO sitemap, saved search alerts, featured score cron) already filters by `is_available=true` or explicit status values — DELISTED items are invisible without any code changes. The ghost contains previously-public data (it was listed), so even a query that missed the filter would only reveal "this dealer had this item" — fundamentally different blast radius from leaking a never-listed private collection item.

---

## Motivation

### Problems with the current architecture

1. **Two parallel systems.** Dealer portal (`/dealer`, `listings` table, 30 components, 65KB form) and collection manager (`/collection`, `user_collection_items` table, 7 components, 23KB form) do similar things in completely different ways. Shared display infrastructure (DisplayItem, ListingCard, QuickView) papers over the gap, but the data models, APIs, and forms are entirely separate.

2. **The collection manager is weak.** No rich metadata sections (sayagaki, koshirae, provenance, kiwame, kanto hibisho). No video support. No intelligence overlays. No draft persistence. Collectors deserve the same quality cataloging experience that dealers get.

3. **No path from collecting to selling.** A collector who wants to sell a piece must re-enter everything in the dealer portal. There's no "promote this item to for-sale" action. This friction kills a natural conversion funnel.

4. **Dealers ARE collectors.** Most nihonto dealers maintain personal collections alongside business inventory. They currently need two separate systems for items that may move between states.

### What this design enables

- **One form, same quality for everyone.** The rich dealer form IS the collector form. No "lite" version. Collectors cataloging nihonto want full metadata — that's the entire point.
- **Natural upgrade funnel.** Free → Collector (catalog) → Dealer (sell). Each transition triggered by a life event, not marketing.
- **Visibility spectrum.** Private → Collectors → Dealers → Public. Each level signals increasing willingness to transact. (Collectors/Dealers visibility deferred to Phase 5+; Phase 1-4 uses private + public only.)
- **Bidirectional marketplace.** Collectors signal availability; dealers make targeted offers. Inverts the one-directional "dealers list, collectors browse" model.
- **Physical data isolation.** Private items and public listings live in separate tables. No RLS-only trust boundary for the most sensitive data.

---

## Core Concepts

### Mental Model

```
collection_items table               listings table
(your catalog — private)             (public marketplace)

 ┌──────────┐    "List for Sale"     ┌──────────┐
 │  Item A  │──── (promote RPC) ───▶│  uuid-aaa│ AVAILABLE
 │ uuid-aaa │     DELETE + INSERT    │  Item X  │ ← scraped
 └──────────┘                        │  Item Y  │ ← scraped
                                     └──────────┘
                  "Delist"                 │
 ┌──────────┐◀── (soft-delist RPC)──── uuid-aaa
 │  Item A  │    INSERT + UPDATE     ┌──────────┐
 │ uuid-aaa │    (mark DELISTED)     │  uuid-aaa│ DELISTED (ghost)
 └──────────┘                        │          │ preserves FKs:
 ┌──────────┐                        │          │ favorites, views,
 │  Item B  │                        │          │ price_history,
 │ uuid-bbb │                        │          │ videos
 └──────────┘                        └──────────┘

── "All Items" tab ──               ── "For Sale" / "Sold" tabs ──
```

**Key principles:**
- **`item_uuid`** is the stable identity. It survives every transition. Favorites, external links, behavioral tracking, and audit log all reference `item_uuid`, not table PKs.
- Items that have **never been listed** exist in `collection_items` only — physically absent from `listings`. Correct by construction.
- Items that **are or have been listed** have a row in `listings`. On delist, this row is marked `DELISTED` (not deleted) to preserve FK relationships (favorites, price history, views, videos).
- During the **DELISTED state**, the item exists in both tables: `collection_items` (the editable working copy) and `listings` (an inert ghost preserving behavioral data). This is a principled exception to single-table purity — data integrity over architectural idealism.
- **"List for Sale"** and **"Delist"** are **atomic Postgres RPC functions** — single transaction, rollback on failure.
- All transitions are logged in `collection_events` keyed by `item_uuid` (audit trail).

**State machine:**

| State | `collection_items` | `listings` | Visible in |
|-------|-------------------|------------|------------|
| Private (never listed) | 1 row | 0 rows | "All Items" tab |
| Listed | 0 rows | 1 row (AVAILABLE) | "For Sale" tab + public browse |
| On Hold | 0 rows | 1 row (HOLD, `is_available=true`) | "On Hold" tab + public browse (with hold badge) |
| Delisted | 1 row (editable) | 1 row (DELISTED ghost) | "All Items" tab |
| Sold | 0 rows | 1 row (SOLD) | "Sold" tab |

> **On Hold** is a dealer-side status marker, not a visibility change. The item remains publicly visible in browse — it signals to the dealer that the item is reserved or pending (e.g., a buyer expressed interest), but other buyers can still view and inquire. Think of it as a sticky note on the item visible only to the dealer. Browse queries filter on `is_available=true`, which remains true for HOLD items.

### Visibility Levels

| Level | Who sees it | Signal | Where it lives | Tier required | Phase |
|-------|-------------|--------|---------------|---------------|-------|
| `private` | Owner only | "I own this" | `collection_items` | Yuhinkai (or any paid tier) | 1-4 |
| `collectors` | Other collector+ users | "Look what I have" | `collection_items` | Yuhinkai+ | 5+ |
| `dealers` | Dealer-tier users | "I might sell for the right price" | `collection_items` | Yuhinkai+ | 5+ |
| `public` | Everyone (browse, SEO, alerts) | "I'm actively selling" | `listings` | Dealer | 1-4 |

**Phase 1-4 scope:** Only `private` and `public` are active. The `collectors` and `dealers` visibility levels exist in the schema (CHECK constraint) but are not exposed in the UI. This simplifies initial implementation while preserving the schema for future community features.

**Future behaviors (Phase 5+):**
- **`collectors`** — Community visibility. Other collectors can browse/admire. Enables collection sharing, prestige, knowledge exchange. No price displayed (not for sale).
- **`dealers`** — Soft listing. Dealers see the item and can send private inquiries/offers. Collector hasn't committed to a price. This is how high-end nihonto actually trades — signaling availability to the trade, not listing publicly.

### Tier Structure

| Tier | Internal name | Access | Price |
|------|---------------|--------|-------|
| **Free** | `free` | Browse, favorites, alerts, currency conversion | $0 |
| **Yuhinkai** | `yuhinkai` | Collection access (cataloging). Manually assigned, no Stripe pricing. | Free (manual) |
| **Pro** | `enthusiast` | Fresh data, AI inquiry emails, setsumei translations + collection access (rank ≥ yuhinkai) | $25/mo |
| **Collector** | `collector` | Pro + community visibility features (Phase 6+) + collection access | $99/mo |
| **Dealer** | `dealer` | Collector + **"List for Sale"**, dealer profile, analytics + collection access | $150/mo |
| **Inner Circle** | `inner_circle` | Everything + exclusivity + collection access | $249/mo |

> **Note (2026-03-10):** `yuhinkai` tier was added to gate collection access without requiring a paid subscription. All paid tiers (enthusiast/collector/inner_circle) also get collection access via rank-based comparison (rank ≥ yuhinkai=1). Only `free` (rank 0) is denied. Trial mode (`NEXT_PUBLIC_TRIAL_MODE=true`) bypasses all tier checks — currently ON.

**The conversion funnel:**
```
Browse (free) → Yuhinkai tier (manual grant or trial mode) → catalog unlimited items
                                                                      │
                                     "I want to sell this piece" ──────┘──→ Dealer
```

Collection access requires the **yuhinkai tier** (or any paid tier, or trial mode). The `yuhinkai` tier exists for users who need *only* collection access without paying for the full enthusiast feature set — it's manually assigned, not Stripe-purchasable. During trial mode (currently ON), all users can access collection freely. The only paywall moment beyond collection access is "List for Sale," which requires Dealer tier. This appears at the exact moment of intent: a collector has a specific piece they want to sell, maximum purchase intent.

---

## Data Model

### Stable Identity: `item_uuid`

Every user-created item gets an `item_uuid` (UUID) that **never changes**, regardless of which table the item currently lives in. This is the item's permanent identity.

```
item_uuid = "abc-123"

  collection_items (id=UUID-A, item_uuid="abc-123")
       │
       │  first promote → INSERT into listings, DELETE from collection_items
       ▼
  listings (id=98765, item_uuid="abc-123")      ← new listing_id
       │
       │  delist → INSERT into collection_items, UPDATE listings to DELISTED
       ▼
  collection_items (id=UUID-B, item_uuid="abc-123")
  listings (id=98765, item_uuid="abc-123", status='DELISTED')  ← ghost preserves FKs
       │
       │  re-promote → UPDATE listings back to AVAILABLE, DELETE from collection_items
       ▼
  listings (id=98765, item_uuid="abc-123")      ← SAME listing_id! FKs intact.
```

Note: the `collection_items` PK (UUID) changes on each delist. But `listings.id` (BIGINT) is stable across delist/re-promote cycles — all FK relationships (favorites, price_history, views, videos) survive. `item_uuid` stays constant across everything.

**What references `item_uuid`:**

| System | Currently references | Changes to |
|--------|---------------------|-----------|
| Favorites | `listing_id` (BIGINT) | `listing_id` (unchanged) — soft-delist preserves the `listings` row, so `listing_id` is stable across delist/re-promote cycles. No migration needed. |
| Listing detail URL | `/listing/[id]` (BIGINT) | `/listing/[item_uuid]` — permanent URL |
| Audit log | table-specific IDs | `item_uuid` — full history in one query |
| Behavioral tracking | `listing_id` | Keep `listing_id` — stable across delist/re-promote (soft-delist). Scraped items have no `item_uuid`. |
| Collection events | — | `item_uuid` — stable thread across all transitions |

**URL migration:** Existing listing detail URLs (`/listing/[id]`) use BIGINT IDs. For user-created items, the canonical URL becomes `/listing/[item_uuid]`. For scraped items, BIGINT URLs continue to work. During transition, `/listing/[bigint-id]` can redirect to `/listing/[item_uuid]` for promoted items.

### Two Tables, Shared Item Schema

The `collection_items` table mirrors the `listings` schema for all **item data fields** (title, specs, images, JSONB sections, artisan info). This means the same form component writes to both — it doesn't care which table is the backend.

The `listings` table gains **two nullable columns**: `owner_id` and `item_uuid`. Both are NULL for scraped items and do not affect any existing query, cron job, or API.

```
collection_items (private catalog)       listings (public marketplace)
┌──────────────────────────────┐        ┌────────────────────────────┐
│ id UUID (PK)                 │        │ id BIGINT (PK)             │
│ item_uuid UUID (UNIQUE, NN)  │        │ item_uuid UUID (UNIQUE)    │
│ owner_id (FK → auth.users)   │        │ owner_id UUID (FK)         │
│ visibility ('private')       │        │ url (UNIQUE)               │
│ source_listing_id (FK, opt)  │        │ dealer_id (FK → dealers)   │
│ personal_notes               │        │ source ('scraper'|'dealer')│
│ created_at, updated_at       │        │                            │
│                              │        │ is_available, is_sold      │
│ -- Item data (shared):       │        │ featured_score             │
│ title, description           │        │ first_seen_at              │
│ item_type, item_category     │        │ is_initial_import          │
│ price_value, price_currency  │        │ focal_x, focal_y           │
│ smith, school, province, era │        │ video_count                │
│ cert_type, cert_session      │        │                            │
│ images (JSONB)               │        │ -- Item data (same):       │
│ nagasa_cm, sori_cm, ...      │        │ title, description, ...    │
│ sayagaki (JSONB)             │        │ (all existing columns)     │
│ koshirae (JSONB)             │        │                            │
│ provenance (JSONB)           │        │                            │
│ kiwame (JSONB)               │        │                            │
│ kanto_hibisho (JSONB)        │        │                            │
│ artisan_id, artisan_conf...  │        │                            │
│ setsumei_en, setsumei_ja     │        │                            │
└──────────────────────────────┘        └────────────────────────────┘
        │                                        ▲
        │  promote_to_listing() ── atomic RPC ───┘
        └────────────────────────────────────────┘
        ▲                                        │
        │  delist_to_collection() ─ atomic RPC ──┘
        └────────────────────────────────────────┘
```

### Changes to `listings` Table

Two new nullable columns:

```sql
ALTER TABLE listings ADD COLUMN item_uuid UUID UNIQUE;
ALTER TABLE listings ADD COLUMN owner_id UUID REFERENCES auth.users(id);

CREATE INDEX idx_listings_item_uuid ON listings(item_uuid) WHERE item_uuid IS NOT NULL;
CREATE INDEX idx_listings_owner_id ON listings(owner_id) WHERE owner_id IS NOT NULL;
```

**`item_uuid`:**
- NULL for scraped listings (they don't participate in the collection system)
- SET when an item is promoted from collection via `promote_to_listing()`
- Enables stable favorites and URLs that survive promote/delist cycles
- UNIQUE constraint prevents duplicate promotions

**`owner_id`:**
- NULL for scraped listings (no owner — `dealer_id` identifies the source dealer)
- SET when an item is promoted from collection
- Used by "For Sale" / "On Hold" / "Sold" tabs: `listings WHERE owner_id = auth.uid()`
- NOT used by any existing query (browse, cron, SEO, etc.)

**`dealer_id` vs `owner_id`:** These identify different things. `dealer_id` = the business entity (Aoi Art, Seiyudo). `owner_id` = the person who created this item. For scraped listings, `dealer_id` is set (which dealer's site) but `owner_id` is NULL (no person created it). For promoted items, both are set. Multiple people could work for the same dealer; `owner_id` distinguishes whose collection item it was.

These are the **only** changes to `listings`. They're additive (nullable), don't affect existing data, and don't require RLS changes.

### `collection_items` Schema

```sql
CREATE TABLE collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'collectors', 'dealers')),

  -- Link to source listing (if imported via "I Own This")
  source_listing_id BIGINT REFERENCES listings(id) ON DELETE SET NULL,

  -- Personal notes (not visible to others, not copied on promote)
  personal_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- === Item data fields (shared schema with listings) ===
  title TEXT,
  description TEXT,
  item_type TEXT,
  item_category TEXT,
  price_value NUMERIC,
  price_currency TEXT,
  price_raw TEXT,
  smith TEXT,
  school TEXT,
  province TEXT,
  era TEXT,
  mei_type TEXT,
  tosogu_maker TEXT,
  tosogu_school TEXT,
  material TEXT,
  nagasa_cm NUMERIC,
  sori_cm NUMERIC,
  motohaba_cm NUMERIC,
  sakihaba_cm NUMERIC,
  kasane_cm NUMERIC,
  weight_g NUMERIC,
  height_cm NUMERIC,
  width_cm NUMERIC,
  cert_type TEXT,
  cert_session TEXT,
  cert_organization TEXT,
  images JSONB,
  artisan_id TEXT,
  artisan_confidence TEXT,
  artisan_method TEXT,
  artisan_candidates JSONB,

  -- Rich metadata sections (JSONB — same structure as listings)
  sayagaki JSONB,
  koshirae JSONB,
  provenance JSONB,
  kiwame JSONB,
  kanto_hibisho JSONB,
  setsumei_en TEXT,
  setsumei_ja TEXT
);

-- Indexes
CREATE INDEX idx_collection_items_owner ON collection_items(owner_id);
CREATE INDEX idx_collection_items_item_uuid ON collection_items(item_uuid);
CREATE INDEX idx_collection_items_visibility ON collection_items(visibility);
CREATE INDEX idx_collection_items_item_type ON collection_items(item_type);
```

**Note:** `visibility` only allows `'private'`, `'collectors'`, `'dealers'`. There is no `'public'` value — public items live in `listings`. Enforced at the schema level, making it impossible for a collection item to accidentally become public without going through `promote_to_listing()`.

### `collection_events` Audit Log

```sql
CREATE TABLE collection_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_uuid UUID NOT NULL,  -- stable identity — the thread across all transitions
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',           -- Item added to collection
    'updated',           -- Item edited in collection
    'promoted',          -- Moved from collection → listings (listed for sale)
    'delisted',          -- Moved from listings → collection (removed from sale)
    'sold',              -- Item marked as sold (in listings)
    'deleted'            -- Item deleted from collection
  )),
  -- Snapshot of key fields at event time (self-contained, no FK dependency)
  item_title TEXT,
  item_type TEXT,
  price_value NUMERIC,
  price_currency TEXT,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB  -- Additional context (e.g., delist reason, sale price, listing_id)
);

CREATE INDEX idx_collection_events_item_uuid ON collection_events(item_uuid);
CREATE INDEX idx_collection_events_owner ON collection_events(owner_id);
CREATE INDEX idx_collection_events_created ON collection_events(created_at);
```

The audit log is keyed by `item_uuid`. To see the full lifecycle of any item: `SELECT * FROM collection_events WHERE item_uuid = 'abc-123' ORDER BY created_at`. This returns the complete history regardless of which table the item currently lives in (or if it's been deleted).

### RLS Policies

```sql
-- collection_items: owner always has full access
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY collection_owner_all ON collection_items
  FOR ALL USING (owner_id = auth.uid());

-- Phase 5+ policies (created now, but no UI exposes these visibility levels yet):

CREATE POLICY collection_collector_read ON collection_items
  FOR SELECT USING (
    visibility = 'collectors'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.subscription_tier IN ('collector', 'dealer', 'inner_circle')
    )
  );

CREATE POLICY collection_dealer_read ON collection_items
  FOR SELECT USING (
    visibility = 'dealers'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.subscription_tier IN ('dealer')
    )
  );

-- collection_events: owner reads their own history
ALTER TABLE collection_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_owner_read ON collection_events
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY events_owner_insert ON collection_events
  FOR INSERT WITH CHECK (owner_id = auth.uid());
```

---

## Transit Functions (Postgres RPCs)

Transit between tables is implemented as **Postgres RPC functions** — not app-level orchestration. This guarantees atomicity: if any step fails, the entire transaction rolls back.

Three transit operations:

1. **First promote** — item has never been listed. INSERT into `listings`, DELETE from `collection_items`.
2. **Re-promote** — item was previously listed, then delisted. UPDATE the existing DELISTED `listings` row, DELETE from `collection_items`. Same `listings.id` — all FK relationships preserved.
3. **Delist (soft)** — INSERT into `collection_items`, UPDATE `listings` to DELISTED. No DELETE — preserves favorites, price history, views, videos.

### promote_to_listing()

Handles both first-promote and re-promote in a single function.

```sql
CREATE OR REPLACE FUNCTION promote_to_listing(
  p_collection_item_id UUID,
  p_dealer_id INTEGER,
  p_owner_id UUID,
  p_price_value NUMERIC DEFAULT NULL,
  p_price_currency TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  v_item collection_items%ROWTYPE;
  v_listing_id BIGINT;
  v_item_uuid UUID;
  v_existing_listing_id BIGINT;
BEGIN
  -- Lock and read the collection item (prevents concurrent promotes)
  SELECT * INTO v_item
  FROM collection_items
  WHERE id = p_collection_item_id AND owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection item not found or not owned by caller';
  END IF;

  v_item_uuid := v_item.item_uuid;

  -- Check if a DELISTED ghost exists from a previous listing period
  SELECT id INTO v_existing_listing_id
  FROM listings
  WHERE item_uuid = v_item_uuid AND status = 'DELISTED'
  FOR UPDATE;

  IF v_existing_listing_id IS NOT NULL THEN
    -- RE-PROMOTE: update existing listing row (preserves listing_id → FKs intact)
    UPDATE listings SET
      title = v_item.title, description = v_item.description,
      item_type = v_item.item_type, item_category = v_item.item_category,
      price_value = COALESCE(p_price_value, v_item.price_value),
      price_currency = COALESCE(p_price_currency, v_item.price_currency),
      price_raw = v_item.price_raw,
      smith = v_item.smith, school = v_item.school,
      province = v_item.province, era = v_item.era, mei_type = v_item.mei_type,
      tosogu_maker = v_item.tosogu_maker, tosogu_school = v_item.tosogu_school,
      material = v_item.material,
      nagasa_cm = v_item.nagasa_cm, sori_cm = v_item.sori_cm,
      motohaba_cm = v_item.motohaba_cm, sakihaba_cm = v_item.sakihaba_cm,
      kasane_cm = v_item.kasane_cm,
      weight_g = v_item.weight_g, height_cm = v_item.height_cm,
      width_cm = v_item.width_cm,
      cert_type = v_item.cert_type, cert_session = v_item.cert_session,
      cert_organization = v_item.cert_organization,
      images = v_item.images,
      artisan_id = v_item.artisan_id, artisan_confidence = v_item.artisan_confidence,
      artisan_method = v_item.artisan_method, artisan_candidates = v_item.artisan_candidates,
      sayagaki = v_item.sayagaki, koshirae = v_item.koshirae,
      provenance = v_item.provenance, kiwame = v_item.kiwame,
      kanto_hibisho = v_item.kanto_hibisho,
      setsumei_en = v_item.setsumei_en, setsumei_ja = v_item.setsumei_ja,
      -- Restore listing state:
      is_available = true, is_sold = false, status = 'AVAILABLE',
      admin_hidden = false, featured_score = 0  -- recomputed by caller after commit
    WHERE id = v_existing_listing_id;

    v_listing_id := v_existing_listing_id;
  ELSE
    -- FIRST PROMOTE: check no active listing exists for this item_uuid
    IF EXISTS (SELECT 1 FROM listings WHERE item_uuid = v_item_uuid) THEN
      RAISE EXCEPTION 'Item already has an active listing (item_uuid: %)', v_item_uuid;
    END IF;

    -- Insert new listing row
    INSERT INTO listings (
      item_uuid, owner_id, dealer_id, source, url,
      title, description, item_type, item_category,
      price_value, price_currency, price_raw,
      smith, school, province, era, mei_type,
      tosogu_maker, tosogu_school, material,
      nagasa_cm, sori_cm, motohaba_cm, sakihaba_cm, kasane_cm,
      weight_g, height_cm, width_cm,
      cert_type, cert_session, cert_organization,
      images,
      artisan_id, artisan_confidence, artisan_method, artisan_candidates,
      sayagaki, koshirae, provenance, kiwame, kanto_hibisho,
      setsumei_en, setsumei_ja,
      is_available, is_sold, status, first_seen_at, is_initial_import
    ) VALUES (
      v_item_uuid, p_owner_id, p_dealer_id, 'dealer',
      'nw://dealer/' || p_dealer_id || '/' || gen_random_uuid(),
      v_item.title, v_item.description, v_item.item_type, v_item.item_category,
      COALESCE(p_price_value, v_item.price_value),
      COALESCE(p_price_currency, v_item.price_currency),
      v_item.price_raw,
      v_item.smith, v_item.school, v_item.province, v_item.era, v_item.mei_type,
      v_item.tosogu_maker, v_item.tosogu_school, v_item.material,
      v_item.nagasa_cm, v_item.sori_cm, v_item.motohaba_cm,
      v_item.sakihaba_cm, v_item.kasane_cm,
      v_item.weight_g, v_item.height_cm, v_item.width_cm,
      v_item.cert_type, v_item.cert_session, v_item.cert_organization,
      v_item.images,
      v_item.artisan_id, v_item.artisan_confidence,
      v_item.artisan_method, v_item.artisan_candidates,
      v_item.sayagaki, v_item.koshirae, v_item.provenance,
      v_item.kiwame, v_item.kanto_hibisho,
      v_item.setsumei_en, v_item.setsumei_ja,
      true, false, 'AVAILABLE', now(), false
    ) RETURNING id INTO v_listing_id;
  END IF;

  -- Delete from collection (safe — no FKs reference collection_items)
  DELETE FROM collection_items WHERE id = p_collection_item_id;

  -- Audit log
  INSERT INTO collection_events (
    item_uuid, owner_id, event_type,
    item_title, item_type, price_value, price_currency,
    metadata
  ) VALUES (
    v_item_uuid, p_owner_id, 'promoted',
    v_item.title, v_item.item_type,
    COALESCE(p_price_value, v_item.price_value),
    COALESCE(p_price_currency, v_item.price_currency),
    jsonb_build_object('listing_id', v_listing_id)
  );

  RETURN v_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### delist_to_collection() — Soft Delist

**Does NOT delete from `listings`.** Marks the listing as DELISTED, which is invisible to all user-facing queries (verified: browse, SEO, alerts, featured score cron all filter by `is_available=true` or explicit status values). The listing row survives as an inert ghost, preserving FK relationships.

```sql
CREATE OR REPLACE FUNCTION delist_to_collection(
  p_listing_id BIGINT,
  p_owner_id UUID
) RETURNS UUID AS $$
DECLARE
  v_listing listings%ROWTYPE;
  v_collection_id UUID;
  v_item_uuid UUID;
BEGIN
  -- Lock and read the listing
  SELECT * INTO v_listing
  FROM listings
  WHERE id = p_listing_id AND owner_id = p_owner_id AND source = 'dealer'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found, not owned by caller, or not a dealer listing';
  END IF;

  v_item_uuid := v_listing.item_uuid;
  v_collection_id := gen_random_uuid();

  -- Insert into collection_items (captures current listing state including all edits)
  INSERT INTO collection_items (
    id, item_uuid, owner_id, visibility,
    title, description, item_type, item_category,
    price_value, price_currency, price_raw,
    smith, school, province, era, mei_type,
    tosogu_maker, tosogu_school, material,
    nagasa_cm, sori_cm, motohaba_cm, sakihaba_cm, kasane_cm,
    weight_g, height_cm, width_cm,
    cert_type, cert_session, cert_organization,
    images,
    artisan_id, artisan_confidence, artisan_method, artisan_candidates,
    sayagaki, koshirae, provenance, kiwame, kanto_hibisho,
    setsumei_en, setsumei_ja
  ) VALUES (
    v_collection_id, v_item_uuid, p_owner_id, 'private',
    v_listing.title, v_listing.description,
    v_listing.item_type, v_listing.item_category,
    v_listing.price_value, v_listing.price_currency, v_listing.price_raw,
    v_listing.smith, v_listing.school, v_listing.province,
    v_listing.era, v_listing.mei_type,
    v_listing.tosogu_maker, v_listing.tosogu_school, v_listing.material,
    v_listing.nagasa_cm, v_listing.sori_cm, v_listing.motohaba_cm,
    v_listing.sakihaba_cm, v_listing.kasane_cm,
    v_listing.weight_g, v_listing.height_cm, v_listing.width_cm,
    v_listing.cert_type, v_listing.cert_session, v_listing.cert_organization,
    v_listing.images,
    v_listing.artisan_id, v_listing.artisan_confidence,
    v_listing.artisan_method, v_listing.artisan_candidates,
    v_listing.sayagaki, v_listing.koshirae, v_listing.provenance,
    v_listing.kiwame, v_listing.kanto_hibisho,
    v_listing.setsumei_en, v_listing.setsumei_ja
  );

  -- Soft-delist: mark as DELISTED, NOT delete
  -- Preserves all FK relationships (favorites, price_history, views, videos)
  UPDATE listings SET
    status = 'DELISTED',
    is_available = false,
    featured_score = 0
  WHERE id = p_listing_id;

  -- Audit log
  INSERT INTO collection_events (
    item_uuid, owner_id, event_type,
    item_title, item_type, price_value, price_currency,
    metadata
  ) VALUES (
    v_item_uuid, p_owner_id, 'delisted',
    v_listing.title, v_listing.item_type,
    v_listing.price_value, v_listing.price_currency,
    jsonb_build_object('listing_id', p_listing_id)
  );

  RETURN v_collection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Edit sync is automatic.** Because `delist_to_collection()` reads the *current* listing row (via `FOR UPDATE`), any edits made while the item was for sale are captured in the collection item. No triggers, no polling, no sync. On re-promote, the current collection state is synced back to the listing row via UPDATE.

### delete_collection_item() — Permanent Deletion

When a user permanently deletes an item, both the collection row AND any DELISTED ghost must be removed. The ghost deletion cascades FK data (favorites, views, etc.) — acceptable because the user explicitly chose to delete.

**Important:** Video cleanup (Bunny file deletion) must happen **before** the DB deletes, because we need the `provider_id` values. The API endpoint calling this RPC should: (1) query `item_videos` for `provider_id` values, (2) delete Bunny files, (3) call this RPC. Same pattern as `DELETE /api/dealer/listings/[id]` uses today.

```sql
CREATE OR REPLACE FUNCTION delete_collection_item(
  p_collection_item_id UUID,
  p_owner_id UUID
) RETURNS VOID AS $$
DECLARE
  v_item_uuid UUID;
BEGIN
  -- Get the item_uuid before deletion
  SELECT item_uuid INTO v_item_uuid
  FROM collection_items
  WHERE id = p_collection_item_id AND owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection item not found or not owned by caller';
  END IF;

  -- Delete the collection item
  DELETE FROM collection_items WHERE id = p_collection_item_id;

  -- Delete any DELISTED ghost in listings (CASCADE cleans up FK data)
  DELETE FROM listings WHERE item_uuid = v_item_uuid AND status = 'DELISTED';

  -- Delete item videos (Bunny files already cleaned up by API caller)
  DELETE FROM item_videos WHERE item_uuid = v_item_uuid;

  -- Audit log
  INSERT INTO collection_events (
    item_uuid, owner_id, event_type, created_at
  ) VALUES (
    v_item_uuid, p_owner_id, 'deleted', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Schema Sync: Column Registry

The promote/delist RPCs explicitly list every shared column. If a column is added to `listings` but not to the RPCs, it's silently dropped during transit. This is caught by a **golden test**:

```typescript
test('shared schema columns match between tables', async () => {
  const listingCols = await getTableColumns('listings');
  const collectionCols = await getTableColumns('collection_items');

  // Columns that exist ONLY in listings (not copied during transit)
  const LISTING_ONLY = new Set([
    'id', 'url', 'dealer_id', 'source', 'is_available', 'is_sold',
    'status', 'featured_score', 'first_seen_at', 'is_initial_import',
    'focal_x', 'focal_y', 'video_count', 'last_scraped_at',
    'scrape_count', 'raw_page_text', 'page_exists', 'stored_images',
    'admin_hidden', 'price_jpy', 'artisan_verified', 'artisan_verified_at',
    'artisan_verified_by', 'artisan_admin_locked', 'artisan_matched_at',
    'hero_image_index', 'showcase_override', 'title_en', 'title_ja',
    'description_en', 'description_ja',
    // ... other listing-only columns
  ]);

  // Columns that exist ONLY in collection_items (not copied during transit)
  const COLLECTION_ONLY = new Set([
    'id', 'owner_id', 'visibility', 'source_listing_id',
    'personal_notes', 'created_at', 'updated_at',
  ]);

  const sharedFromListings = listingCols
    .filter(c => !LISTING_ONLY.has(c) && c !== 'item_uuid' && c !== 'owner_id');
  const sharedFromCollection = collectionCols
    .filter(c => !COLLECTION_ONLY.has(c) && c !== 'item_uuid');

  // If this fails, a migration added a column to one table but not the other.
  // Update both tables AND the promote/delist RPC functions.
  expect(sharedFromListings.sort()).toEqual(sharedFromCollection.sort());
});
```

This runs against the actual database schema in CI. When someone adds a column to one table but not the other, the build fails with a clear message.

---

## Image Architecture

### Single Bucket: `user-images`

All user-uploaded images (collection AND listed items) go to a **single bucket** to eliminate cross-bucket ghost references:

```
Bucket: user-images
Path:   {owner_id}/{item_uuid}/{uuid}.{ext}
```

**Why single bucket:**
- Path uses `item_uuid` → survives transit (same URL works in both tables)
- Path uses `owner_id` → survives tier changes
- **No image copy needed on promote/delist.** The image URL doesn't change because the item_uuid doesn't change. The URL works regardless of which table references it.
- **No ghost references.** Images live in one place under the owner's ID. No cross-bucket cleanup confusion.

**Account deletion safety:** Before deleting a user's images, check if any `item_uuid` values from their images are still referenced by active listings (e.g., sold items in `listings`). If yes, either keep those images or migrate them to a permanent archive bucket.

**Migration from existing buckets:** The existing `dealer-images` and `collection-images` buckets continue to work for previously uploaded images (URLs are stable). New uploads go to `user-images`. Old images can be migrated by a background job if desired.

### Storage RLS Policies

The `user-images` bucket is **public for reads, write-protected by owner**.

```sql
-- Anyone can read (images may be in public listings, and use UUID-based paths)
CREATE POLICY "Public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-images');

-- Only owner can upload to their own directory
CREATE POLICY "Owner upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only owner can delete their own images
CREATE POLICY "Owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'user-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

**Why public read:** When an item is promoted to `listings`, its images must be publicly viewable (browse grid, SEO, social cards). A private bucket would require signed URLs on every image render — unworkable for a browse grid of 100+ cards. Privacy for private collection items comes from UUID opacity in paths (same model as existing `dealer-images` bucket). Phase 5+ could add a proxy layer if true image privacy becomes a requirement.

### `stored_images` on Promote

The `listings` table has a `stored_images` column used by the image proxy/CDN optimization pipeline. `collection_items` does not have this column — it's a `listings`-only optimization. On first promote, the new listing row has `stored_images = NULL`. This is handled naturally:

- The browse API and `ListingCard` already fall back to `images` when `stored_images` is NULL (this is how newly scraped listings work before the proxy processes them)
- The smart crop cron picks up listings with NULL `focal_x`/`focal_y` within 4 hours and processes them
- If a `stored_images` optimization pipeline exists, it processes the new listing on its normal schedule

No special handling needed — the existing NULL-tolerant patterns cover this.

### Video Handling — `item_videos` Table

The existing `listing_videos` table FKs to `listings.id` — it can't serve collection items. Rather than maintain two parallel video tables, user-created items use a new **`item_videos`** table keyed by `item_uuid`:

```sql
CREATE TABLE item_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_uuid UUID NOT NULL,  -- stable identity (no FK — item may be in either table)
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL DEFAULT 'bunny',
  provider_id TEXT NOT NULL,  -- Bunny video ID
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'ready', 'failed')),
  title TEXT,
  duration_seconds INTEGER,
  thumbnail_url TEXT,
  stream_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_videos_item_uuid ON item_videos(item_uuid);
CREATE INDEX idx_item_videos_owner ON item_videos(owner_id);
```

**Why `item_uuid` instead of FK to either table:**
- Videos work identically in collection and listings — same upload UI, same player.
- Videos survive promote/delist automatically (same `item_uuid`).
- No copying rows between tables on transit. No cascade issues.
- The tradeoff: no FK constraint, so orphaned videos are possible. `delete_collection_item()` RPC handles cleanup (delete Bunny files + `item_videos` rows for the `item_uuid`).

**`item_videos` replaces `listing_videos` (complete migration):**

The scraper never creates videos — all videos are user-uploaded (dealer portal). This means `listing_videos` contains only dealer-uploaded video rows, and every one of those listings will get an `item_uuid` during the Phase 2 backfill. This enables a clean, complete migration:

1. Phase 2 backfills `item_uuid` on all existing dealer listings
2. Migrate all `listing_videos` rows to `item_videos` (JOIN with `listings` to get `item_uuid` + `owner_id`)
3. Update `listings.video_count` trigger to count from `item_videos WHERE item_uuid = listings.item_uuid`
4. Update Bunny webhook to write to `item_videos` (lookup by `provider_id`)
5. Update all TS code (`listingVideos.ts`, video API routes, `getListingDetail`) to read from `item_videos`
6. Drop `listing_videos` table after migration verification

**Result:** One video table (`item_videos`), one identity system (`item_uuid`), no dual-source complexity. Videos survive promote/delist automatically because `item_uuid` is stable across transit.

---

## Security Architecture

### Why Two Tables Solves the RLS Problem

| Attack vector | Single table + RLS | Two tables (this design) |
|--------------|-------------------|-------------------------|
| New cron job forgets visibility filter | **LEAK** — service role bypasses RLS | **SAFE** — cron queries `listings`, private items aren't there |
| New API route forgets `.neq('source','dealer')` | **LEAK** — all items returned | **SAFE** — `listings` only has public items |
| SEO sitemap generator queries all listings | **LEAK** — private items indexed by Google | **SAFE** — sitemap queries `listings` |
| Saved search alert cron matches private item | **LEAK** — user gets email about someone's private item | **SAFE** — alert cron queries `listings` |
| Developer queries base table directly | **LEAK** — RLS bypassed with service role | **SAFE** — must explicitly query `collection_items` |
| Browse API bug returns wrong rows | **LEAK** — private items in browse | **SAFE** — browse queries `listings` |

### RLS on collection_items

RLS on `collection_items` is simpler and lower-risk than RLS on `listings` would be:

1. **Fewer query sites.** `collection_items` is only queried by collection-specific endpoints (~4-5 routes vs 18+ for `listings`).
2. **All routes are authenticated.** No anon access — every query has `auth.uid()`.
3. **Separate storage bucket.** Collection images go to `user-images/{owner_id}/` — even image access is scoped.
4. **No service role queries.** Collection endpoints use the authenticated client. The service role bypass problem doesn't apply.

### What Stays the Same on `listings`

| System | Changes? | Why |
|--------|----------|-----|
| Browse API | **No** | Queries `listings` as before. `item_uuid`/`owner_id` not in SELECT list. DELISTED items excluded by `is_available=true` filter. |
| Scraper writes | **No** | Writes to `listings` with service role. New columns are nullable. **CRITICAL: scraper UPSERT column list must NEVER include `item_uuid` or `owner_id`** (see below). |
| Featured score cron | **No** | Filters `is_available=true` — DELISTED excluded. Also zeros `featured_score` for all `is_available=false`. |
| Smart crop cron | **Minor gap** | No `is_available` filter — may process DELISTED items unnecessarily. Add `.eq('is_available', true)` filter. Waste, not a leak. |
| Saved search alerts | **No** | Filters by status='available' or status='sold' — DELISTED excluded. |
| SEO sitemap | **No** | Filters `is_available=true` — DELISTED excluded. |
| JSON-LD structured data | **No** | Only for `listings` rows that are server-rendered (detail page). DELISTED items have no page. |
| Artist page listings | **No** | Queries `listings` only |
| Dealer analytics | **No** | Queries `listings` only |
| Existing RLS (migration 098) | **Keep** | Still gates `source='dealer'` until dealer portal goes live |
| `dealer-source-guard.test.ts` | **Keep** | Still validates `listings` query safety |

### Scraper Protection

The scraper (Oshi-scrapper `repository.py`) writes to `listings` via service role UPSERT. Its column list must **never** include `item_uuid` or `owner_id`. If the scraper touches these columns (even setting NULL explicitly), it could destroy the link between a promoted collection item and its listing row.

**Mitigation:**
- Document in CLAUDE.md Critical Rules (new rule #14)
- Golden test: grep scraper's `repository.py` INSERT/UPSERT column lists and assert `item_uuid` and `owner_id` are absent
- The scraper only matches on `url` (UNIQUE) for UPSERT — promoted items use `nw://dealer/...` URLs that the scraper never generates, so UPSERT collisions are impossible. But the explicit exclusion is defense-in-depth.

---

## UI Architecture

### Navigation

**Current:**
```
[NihontoWatch]  [Browse]  [Artists]  [Pricing]     [My Listings ▾]
                                                    ├─ Inventory
                                                    ├─ Profile Settings
                                                    └─ Preview
```

**Proposed:**
```
[NihontoWatch]  [Browse]  [Artists]  [Pricing]     [Collection ▾]
                                                    ├─ My Collection
                                                    ├─ Profile
                                                    └─ Preview
```

- "My Listings" → "Collection" in nav
- Single nav item. No separate "Inventory" concept in the nav
- Route: `/vault` (migrated from `/collection` in Phase 5, 301 redirect active)

### Collection Page

One page with tabs. Tabs differ by tier:

**Collector view (no dealer tier):**
```
┌──────────────────────────────────────────────────┐
│  MY COLLECTION                    [+ Add Item]   │
│                                                  │
│  [All Items]                                     │
│                                                  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                   │
│  │    │ │    │ │    │ │    │  ← ListingCard      │
│  │    │ │    │ │    │ │    │    museum/scholarly  │
│  └────┘ └────┘ └────┘ └────┘    presentation     │
└──────────────────────────────────────────────────┘
```

**Dealer view (has dealer tier):**
```
┌──────────────────────────────────────────────────┐
│  MY COLLECTION                    [+ Add Item]   │
│                                                  │
│  [All Items]  [For Sale]  [On Hold]  [Sold]      │
│                ↑ dealer    ↑ dealer               │
│                tier only   tier only              │
│                                                  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                   │
│  │    │ │    │ │    │ │    │                      │
│  └────┘ └────┘ └────┘ └────┘                     │
└──────────────────────────────────────────────────┘
```

**Tab data sources:**

| Tab | Data source | What it shows |
|-----|------------|---------------|
| **All Items** | `collection_items WHERE owner_id = me` | Items in your private catalog (not currently for sale) |
| **For Sale** | `listings WHERE owner_id = me AND is_available = true` | Items promoted to public marketplace |
| **On Hold** | `listings WHERE owner_id = me AND status = 'HOLD'` | Items marked as reserved — still visible in public browse, but flagged for the dealer |
| **Sold** | `listings WHERE owner_id = me AND is_sold = true` | Completed sales |

When an item is listed for sale, it **disappears** from "All Items" and **appears** in "For Sale." No ghosts, no badges. Clean move.

### Card Presentation

Cards look different between collection and for-sale contexts. The exact design is deferred to implementation, but the principle:

| Context | Card emphasis | Examples |
|---------|--------------|----------|
| **All Items** (collection) | Museum / scholarly | Artisan, certification, era, provenance highlights, personal notes icon |
| **For Sale** (inventory) | Commercial | Price, interested collectors, heat trend, position rank, days listed |

Same `ListingCard` component. Different `DisplayItem` extensions control what metadata renders. The source field (`'collection'` vs `'dealer'`) drives presentation branching.

### Publication Actions

The form **only saves to `collection_items`**. There is no split button, no "Save & List" shortcut. Publication is a separate action taken on an existing collection item from the card menu, QuickView action bar, or item detail view.

**Available actions on a collection item:**

| Action | Tier required | Effect | Phase |
|--------|--------------|--------|-------|
| **List for Sale** | Dealer | Promote to `listings` (public marketplace) | 1-4 |
| **Private Offer** | Dealer | Offer to a specific collector (stays in `collection_items`) | 5+ |
| **Show to Dealers** | Collector | Set `visibility='dealers'` (dealer-tier users can browse) | 5+ |
| **Show to Collectors** | Collector | Set `visibility='collectors'` (community showcase) | 5+ |

This design supports **fine-grained control** over who sees each item. "List for Sale" is one of several publication channels, not the default. Dealers who want to stage items (photograph, catalog, review) before publishing get a natural quality gate. Dealers who want to move fast save the item and immediately tap "List for Sale" — two taps, same total effort as the current single-step flow.

### "List for Sale" Flow

When a dealer taps "List for Sale" on a collection item:

1. **Tier check.** If not a dealer, show upgrade paywall. This is THE conversion moment — collector has a specific item they want to sell, maximum purchase intent.
2. **Price prompt.** If no price is set, prompt for price (required for public listings). Option for "Inquiry" (no price shown).
3. **Confirmation.** "This item will be visible on NihontoWatch. Continue?"
4. **Transit.** `promote_to_listing()` RPC (INSERT or UPDATE, depending on whether a DELISTED ghost exists).
5. **Recompute.** Featured score computation (`await`, outside the transaction).
6. **Success.** Item disappears from "All Items" tab, appears in "For Sale" tab. Audit log records the promotion.

### "Delist" Flow

When a dealer wants to take an item off the market:

1. **Action.** "Remove from Sale" in QuickView or item detail.
2. **Transit.** `delist_to_collection()` RPC soft-delists: creates collection item from current listing state, marks listing as DELISTED.
3. **Result.** Item disappears from "For Sale" tab, reappears in "All Items." Invisible in browse. The DELISTED ghost preserves favorites, price history, views, and videos. Audit log records the delist.

### "I Own This" Button

Existing browse QuickView button. Creates a new `collection_items` row with:
- Fresh `item_uuid` (this is a new ownership record, separate from the scraped listing)
- `source_listing_id` pointing to the original browse listing (ON DELETE SET NULL — link is informational, not structural)
- Owner can then enrich with personal notes, provenance, etc. using the full form

---

## Form Architecture

### One Form, One Backend

The existing `DealerListingForm.tsx` (1,572 lines, 74 fields, 6 rich metadata sections) works for both collectors and dealers. The form **writes to the item's current table**: `collection_items` for private items, `listings` for items already listed. Publication is a separate action — it's not a form submit variant.

```
DealerListingForm.tsx (the form)
     │
     ├── Creating new item → POST /api/collection/items
     │                        (writes to collection_items)
     │
     ├── Editing collection item → PATCH /api/collection/items/[id]
     │                              (writes to collection_items)
     │
     └── Editing a listed item → PATCH /api/dealer/listings/[id]
                                  (writes to listings, as today)
```

**What changes in the form:**
- Works for non-dealer users (no `dealer_id` requirement in collection context)
- Single "Save" button (no split button, no "Save & List")
- Publication actions live outside the form (card menu, QuickView action bar)

**What stays the same:**
- All 6 rich metadata sections (sayagaki, koshirae, provenance, kiwame, kanto hibisho, setsumei)
- Image upload (same component, `user-images` bucket)
- Video upload (Bunny TUS upload — works for both collection and listed items via `item_videos`)
- Catalog match panel (Yuhinkai lookup)
- Draft persistence (localStorage)
- All validation logic
- JSONB sanitization (all 5 section sanitizers apply to collection writes too)

---

## Unified Profile: Collector ⊂ Dealer

### Shared Profile Base

Collectors and dealers share a profile concept. A collector's profile is a strict subset of a dealer's:

```
┌─────────────────────────────────────────┐
│  PROFILE (shared base — all users)      │
│  ─────────────────────                  │
│  Display name / avatar / banner         │
│  Bio (EN + JA, bilingual)              │
│  Specializations (katana, tsuba, etc.)  │
│  Location / country                     │
│  Collection highlights (visible items)  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  DEALER EXTENSION (dealer tier) │    │
│  │  ───────────────────────        │    │
│  │  Business name / domain         │    │
│  │  Shipping & payment policies    │    │
│  │  Business contact info          │    │
│  │  Analytics dashboard            │    │
│  │  Public "For Sale" inventory    │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Profile Data Location

Extend the existing `profiles` table with collector profile columns (avatar, banner, bio_en, bio_ja, specializations, city, country, accent_color, display_name). Dealers already have `dealer_id` FK on `profiles` — their profile page pulls from both `profiles` (shared) and `dealers` (business extension).

### Profile URLs — Deferred

Profile URL strategy is deferred. Key considerations for future design:
- Dealers will want premium/branded profile URLs
- Collectors may want anonymous or pseudonymous profiles
- Upgrading from collector → dealer should not break existing URLs
- One URL scheme that adapts content by tier is likely cleanest

---

## DisplayItem Integration

The existing DisplayItem type already supports three sources (`browse`, `collection`, `dealer`). Collection items from `collection_items` map through a new `collectionItemToDisplayItem()`:

```typescript
function collectionItemToDisplayItem(item: CollectionItem): DisplayItem {
  return {
    id: item.item_uuid,  // Use item_uuid as DisplayItem id for stable references
    title: item.title,
    images: item.images,
    // ... all shared fields (schemas match) ...
    source: 'collection',
    collection: {
      visibility: item.visibility,
      personal_notes: item.personal_notes,
      source_listing_id: item.source_listing_id,
    },
  };
}
```

Because `collection_items` uses the same field names as `listings`, the mapper is straightforward. The `source: 'collection'` flag drives card presentation branching — scholarly metadata emphasis vs commercial emphasis.

### `DisplayItem.id` Type Strategy

Current `DisplayItem.id` is a number (from `listings.id` BIGINT). Collection items use `item_uuid` (UUID string). Rather than introduce a union type, **normalize `DisplayItem.id` to `string` everywhere:**

- **Scraped listings:** `String(listing.id)` — e.g., `"98765"`
- **Collection items:** `item.item_uuid` — e.g., `"abc-123-def"`
- **Promoted listings (in "For Sale" tab):** `String(listing.id)` — they're in `listings`, use `listing_id`

Downstream code uses `displayItem.source` to determine which API endpoint to call (collection API vs listings API). React list keys work with strings. The `id` field is for identity/routing, not for direct DB queries — the API layer resolves the correct table and primary key.

**Migration:** This is a type-level change. Grep for `displayItem.id` usages and update any that assume numeric type (e.g., `Number(id)` calls, numeric comparisons). Most existing code already uses `id` as an opaque key.

---

## Edge Cases & Behavioral Details

### `personal_notes` Across Promote/Delist Cycles

`personal_notes` is collection-only — not copied to `listings` on promote (it's private metadata, not product data). When the collection item is deleted on promote, `personal_notes` is lost.

**Preservation:** The `promote_to_listing()` RPC should snapshot `personal_notes` into the `collection_events` audit log `metadata` JSONB:

```sql
metadata = jsonb_build_object(
  'listing_id', v_listing_id,
  'personal_notes', v_item.personal_notes  -- preserved in audit trail
)
```

On delist, the new `collection_items` row starts with `personal_notes = NULL`. The user can view their previous notes in the audit history and manually re-add if desired. This is simpler than auto-restoring (which note version? what if they changed it?).

### Collector → Dealer Upgrade Flow

`promote_to_listing()` requires `p_dealer_id`. A collector upgrading to Dealer needs a `dealers` row before their first promote:

1. User taps "List for Sale" on a collection item.
2. Paywall shows Dealer tier. User subscribes.
3. **Dealer onboarding:** Create `dealers` row (business name, domain). Link to `profiles` via `dealer_id` FK. Minimum required: business name.
4. Redirect back to the item with "List for Sale" now available.

This flow needs explicit UX design — the onboarding step between payment and first listing is a conversion-critical moment. It should feel like progress ("You're now a dealer! Let's set up your shop."), not bureaucracy.

### Bulk Actions (Future)

For high-volume dealers managing 50+ items:

- **Bulk list:** Select multiple collection items → promote all (shared price prompt or per-item pricing).
- **Bulk delist:** Take multiple items off the market in one action.
- **Bulk delete:** Permanent removal with confirmation.

Not Phase 1-4. Note as Phase 6+ feature. The RPCs work per-item, so bulk actions are thin API wrappers calling the RPC in a loop (or a batch RPC function for performance).

### Existing Dealer Listings (Migration Prerequisite)

Current dealer listings are already in `listings` but lack `item_uuid` and `owner_id`. Phase 2 backfills these. **This backfill is a hard prerequisite for Phase 3** — the delist RPC reads `item_uuid` from the listing row. Without it, existing dealer listings can't be delisted.

The backfill:
```sql
-- Set owner_id from the dealer's profile
UPDATE listings l SET owner_id = p.id
FROM profiles p WHERE p.dealer_id = l.dealer_id
AND l.source = 'dealer' AND l.owner_id IS NULL;

-- Generate item_uuid for all dealer listings
UPDATE listings SET item_uuid = gen_random_uuid()
WHERE source = 'dealer' AND item_uuid IS NULL;
```

After backfill, existing dealer listings participate fully in the collection system — they can be delisted, re-promoted, and their behavioral data survives.

---

## What Gets Deleted

| Component | Lines | Replacement |
|-----------|-------|-------------|
| `user_collection_items` table | — | `collection_items` table (new, richer schema) |
| `src/components/collection/` (7 files) | ~1,200 | Dealer form + browse display components |
| `src/app/collection/` (old page + client) | ~400 | New unified collection page |
| `src/app/api/collection/` (6 old routes) | ~800 | New collection API routes |
| `src/types/collection.ts` | ~80 | New `CollectionItem` type matching `collection_items` schema |
| Old `collectionItemToDisplayItem()` mapper | ~120 | New mapper (simpler — schemas match now) |
| **Total deleted** | **~2,600 lines** | |

---

## What Gets Preserved

Everything in the dealer portal is preserved. The rich form, the intelligence overlays, the draft persistence, the video upload, the profile settings, the preview page — all of it.

The `listings` table gains two nullable columns (`item_uuid` and `owner_id`). Both are NULL for all existing scraped listings. All existing queries, cron jobs, and APIs are unaffected — they don't SELECT, filter, or join on these columns.

---

## Migration Plan

### Phase 1 — Rename (Cosmetic) ✅ DONE

**Scope:** UI labeling only. No data model changes. **Deployed.**

- [x] Rename "My Listings" → "Collection" in nav (Header, MobileNavDrawer)
- [x] Rename i18n keys: `dealer.tabInventory` → `collection.tabAllItems`, etc.
- [x] Rename tab labels: "Inventory" → "All Items", "Available" → "For Sale"
- [x] Update page title from "My Listings" to "My Collection"
- [x] Route migrated to `/vault` (Phase 5, 301 redirect from `/collection`)

### Phase 2 — Infrastructure + Dealer Migration

**Scope:** New tables, RLS, APIs, video migration, UI wiring. **Dealer-tier users only** — the collection infrastructure is built and accessible through the existing dealer portal. Non-dealer access is Phase 4.

Phase 2 is split into four sub-phases with explicit dependencies:

```
2a: DB migrations + backfills (foundation)
 │
 ├──→ 2b: Video migration (needs item_uuid on listings from 2a)
 │
 ├──→ 2c: Storage + collection API + form wiring (needs collection_items table from 2a)
 │
 └──→ 2d: DisplayItem + mapper + "All Items" tab (needs collection API from 2c)
```

2b and 2c are independent of each other and could run in parallel. 2d depends on 2c. Each sub-phase deploys independently with zero behavior change to existing functionality.

---

#### Phase 2a — Database Migrations + Backfills ✅ DONE

**Completed:** 2026-03-09. **Migrations:** 119-126. **Deployed to prod:** 2026-03-10.

- [x] Create `collection_items` table with full shared schema (migration 119)
- [x] Create `collection_events` audit table (migration 120)
- [x] Create `item_videos` table keyed by `item_uuid` (migration 122)
- [x] Add `item_uuid UUID UNIQUE` and `owner_id UUID` nullable columns to `listings` (migration 119)
- [x] Add `'DELISTED'` and `'HOLD'` to `listings.status` CHECK constraint
- [x] Create RLS policies on `collection_items` (owner access only)
- [x] Backfill `owner_id` on existing dealer listings from `profiles`
- [x] Backfill `item_uuid` on existing dealer listings (`gen_random_uuid()`)
- [x] TypeScript: shared `ItemDataFields` type, used by both `CollectionItem` and `Listing`
- [x] Create schema sync golden test (compares column lists, fails on divergence)
- [x] Verify existing test suite passes (new nullable columns invisible to existing code)

---

#### Phase 2b — Video Migration (`listing_videos` → `item_videos`) ✅ DONE

**Completed:** 2026-03-09
**Migration:** 125 (`125_migrate_listing_videos_to_item_videos.sql`)
**Session doc:** `docs/SESSION_20260309_VIDEO_MIGRATION_PHASE_2B.md`

- [x] Migrate `listing_videos` rows → `item_videos` (SQL: JOIN with `listings` to get `item_uuid` + `owner_id`)
- [x] Rewrite `listings.video_count` trigger to count from `item_videos WHERE item_uuid = listings.item_uuid`
- [x] Update Bunny webhook (`/api/dealer/videos/webhook`) to write `status='ready'` to `item_videos` + cache `stream_url`
- [x] Update video upload routes (`/api/dealer/videos`) to resolve `item_uuid` from listing, insert into `item_videos`
- [x] Update video delete route (`/api/dealer/videos/[id]`) to read/delete from `item_videos`, ownership via `owner_id`
- [x] Delete `src/lib/supabase/listingVideos.ts`, add `selectItemVideoSingle()` to `itemVideos.ts`
- [x] Update `getListingDetail()` — separate query on `item_videos` by `item_uuid` (no FK = no nested select)
- [x] Update dealer listing DELETE handler — Bunny cleanup queries `item_videos` by `item_uuid`
- [x] Remove `ListingVideosRow` from `src/types/media.ts`, re-export `ItemVideoRow`
- [x] 46 golden tests pass (33 video implementation + 5 API + 8 videoProvider)
- [x] Full suite: 5209/5209 pass, zero regressions
- [x] Drop `listing_videos` table (in migration 125, after data copy + verification)

**Key decisions:**
- API routes still accept `listingId` param — resolve `item_uuid` server-side. No UI changes needed.
- `getListingDetail()` does a separate `selectItemVideos()` call instead of PostgREST nested select (no FK).
- Webhook now caches `stream_url` in DB. API falls back to computing it for migrated rows where it's NULL.

---

#### Phase 2c — Storage Bucket + Collection API + Form Wiring

**Depends on:** 2a (needs `collection_items` table). Independent of 2b.

**Scope:** Create the `user-images` storage bucket, build CRUD API routes for collection items, wire the dealer form to write to `collection_items` for new items. Dealer-tier only.

- [x] Create `user-images` Supabase Storage bucket (public read, owner-scoped write/delete RLS) — migration 126
- [x] Create collection image upload routes (6 total: main + sayagaki/hakogaki/koshirae/provenance/kanto-hibisho) using `user-images/{owner_id}/{item_uuid}/` path
- [x] Create collection CRUD API routes:
  - `GET /api/collection/items` — list owner's collection items (facets, filters, pagination)
  - `POST /api/collection/items` — create new collection item (generates `item_uuid`, 56 fields, all 6 JSONB sanitizers)
  - `PATCH /api/collection/items/[id]` — update collection item (whitelist enforcement, JSONB sanitization)
  - `DELETE /api/collection/items/[id]` — delete collection item (+ storage cleanup + Bunny video cleanup)
- [x] Create collection video routes (`POST/GET /api/collection/videos`, `DELETE /api/collection/videos/[id]`)
- [x] Wire `DealerListingForm` with `context` prop ('listing' | 'collection') — routes all API calls through context-driven base path
- [x] Create `/collection/add` and `/collection/edit/[id]` pages using `DealerListingForm` with `context="collection"`
- [x] All JSONB sanitizers (`sanitizeKoshirae`, `sanitizeSayagaki`, etc.) apply to collection writes
- [x] Audit log: write `collection_events` rows on create/update/delete
- [x] `VideoUploadContext` types widened to `number | string` for collection item UUIDs
- [x] `CollectionPageClient` "Add Item" links to `/collection/add`
- [x] 64 tests across 5 files (24 items + 16 images + 9 videos + 7 form + 8 page)

**Risk:** Medium. New API surface, but fully isolated from `listings`. Form dual-routing (collection vs listed) is the main complexity.
**Deploys:** Yes — dealers can create collection items. Existing listing functionality unchanged.

---

#### Phase 2d — DisplayItem Mapper + Collection QuickView Upgrade ✅

**Depends on:** 2c (needs collection API to fetch data)
**Completed:** 2026-03-09 | **Tests:** 43 (35 mapper + 8 page client)

**Scope:** Rewrite collection→DisplayItem mapper to use `CollectionItemRow`, unlock JSONB sections in QuickView, redirect edit to full-page form.

**Key discovery:** `DisplayItem.id` was already typed as `string | number` (line 65 of `displayItem.ts`). The planned `id` type migration from `number` to `string` was unnecessary — no breaking changes anywhere.

- [x] Rewrite `collectionRowToDisplayItem()` mapper — all `ItemDataFields` pass through (JSONB sections, tosogu fields, setsumei, descriptions, translations, AI curator notes, focal points, video count). V1 silently dropped all of these.
- [x] Simplify `CollectionExtension` type — 4 fields (`item_uuid`, `personal_notes`, `visibility`, `source_listing_id`) replaces 10 V1 fields
- [x] Update barrel exports with new function names + V1 backward-compat aliases
- [x] Update 5 collection QuickView slot components to accept `CollectionItemRow`
- [x] Update `QuickViewContext` — `collectionItem` typed as `CollectionItemRow | null`, `openCollectionQuickView()` spreads item directly (carries JSONB sections)
- [x] Edit action redirects to `/collection/edit/[id]` instead of V1 inline QuickView form
- [x] Update `CollectionPageClient` — new types, new mapper, lookups via `item_uuid`
- [x] 35 mapper golden tests + 8 updated page client tests
- [x] `tsc --noEmit` passes, full suite 5,272 pass

**What was deferred to Phase 5 (now done):**
- ~~V1 `CollectionFormContent` — deleted in Phase 5 (2026-03-10).~~
- ~~V1 `CollectionItem` type — deleted in Phase 5.~~
- "All Items" tab — deferred. The tab concept requires the promote/delist state machine (Phase 3) to distinguish "not yet listed" from "listed". For now, the collection page shows all private items.

**Risk:** Turned out to be low. No `DisplayItem.id` type migration needed. The slot component updates were mechanical.
**Deploys:** Yes — collection QuickView now shows full rich metadata. Browse and all other pages unchanged.

---

**Phase 2 overall risk:** Medium. Each sub-phase is independently deployable and testable. The video migration (2b) and DisplayItem type change (2d) are the riskiest — both are "change everything, break nothing" refactors. The sub-phase structure allows shipping and verifying each one before moving to the next.

### Phase 3 — Promote / Delist Transit ✅ DONE

**Completed:** 2026-03-09. **Migrations:** 127-130 (3 RPCs). **Tests:** 29. **Deployed to prod:** 2026-03-10.

- [x] Implement `promote_to_listing()` Postgres RPC — handles both first-promote (INSERT) and re-promote (UPDATE existing DELISTED row, same `listings.id` preserved)
- [x] Implement `delist_to_collection()` Postgres RPC — soft-delist: INSERT into `collection_items`, UPDATE listing to DELISTED
- [x] Implement `delete_collection_item()` Postgres RPC — deletes collection item + DELISTED ghost + item videos
- [x] API endpoint: `POST /api/collection/items/[id]/promote` (calls RPC, gated by `verifyDealer()`)
- [x] API endpoint: `POST /api/listings/[id]/delist` (calls RPC, gated by `verifyDealer()`)
- [x] "List for Sale" action on collection items (`PromoteToListingModal` with price prompt)
- [x] Paywall gate (dealer tier required for promotion)
- [x] Price prompt on promote (required for public listings, "Inquiry" option)
- [x] "Remove from Sale" action on listed items (delist RPC)
- [x] "Mark On Hold" / "Remove Hold" actions (simple status UPDATE, `is_available` stays `true`)
- [x] Trigger featured score computation after promote (`await`, outside transaction)
- [x] Collection page tabs: All Items / For Sale / On Hold / Sold (dealer-only tabs)
- [x] CTA slot updates for promote/delist actions in QuickView
- [x] Golden tests: full round-trip + concurrent promote prevention + FK preservation + re-promote reuses listing_id

**Key files:**
| Component | Location |
|-----------|----------|
| Promote RPC | `supabase/migrations/127_promote_to_listing.sql` |
| Delist RPC | `supabase/migrations/128_delist_to_collection.sql` |
| Delete RPC | `supabase/migrations/130_delete_collection_item.sql` |
| Promote API | `src/app/api/collection/items/[id]/promote/route.ts` |
| Delist API | `src/app/api/listings/[id]/delist/route.ts` |
| Promote modal | `src/components/collection/PromoteToListingModal.tsx` |
| Tests (29) | `tests/api/collection/promote.test.ts`, `tests/api/listings/delist.test.ts` |

### Phase 4 — Open to All Users + Tier Gating 🟡 ~95% DONE

**Scope:** Gate collection access behind `yuhinkai` subscription tier (or any paid tier). Add nav links, "I Own This" button visibility. Route at `/vault` (migrated from `/collection` in Phase 5).

**Design pivot (2026-03-10):** Originally planned as "free for all authenticated users." Changed to **yuhinkai tier gating** after the P0 dealer listing leak (2026-03-03) showed that open access without proper tier checks is dangerous. The `yuhinkai` tier is manually assigned (not Stripe-purchasable) for users who need *only* collection access. All paid tiers (enthusiast/collector/inner_circle) also get access via rank comparison. Trial mode (`NEXT_PUBLIC_TRIAL_MODE=true`, currently ON) bypasses all checks — everyone can access collection during trial.

- [x] Add `yuhinkai` to `SubscriptionTier` union type and `TIER_RANK` (rank 1)
- [x] Add `collection_access` to `Feature` union and `FEATURE_MIN_TIER` (requires `yuhinkai`)
- [x] `canAccessFeature()` special cases for `dealer` and `yuhinkai` tiers
- [x] `checkCollectionAccess()` helper in `src/lib/collection/access.ts` — returns 403 or null
- [x] Added `checkCollectionAccess()` to ALL 15 collection API routes
- [x] Admin bypass (role='admin' always passes)
- [x] Trial mode bypass (`NEXT_PUBLIC_TRIAL_MODE=true` → all features free)
- [x] Stripe checkout excludes `yuhinkai` tier (no Stripe pricing)
- [x] `isYuhinkai` convenience boolean in subscription context
- [x] Nav links (Header + MobileNavDrawer) gated by `canAccess('collection_access')`
- [x] "I Own This" button shows/hides based on tier
- [x] 10 unit tests (`tests/lib/collection/access.test.ts`)
- [x] `NEXT_PUBLIC_COLLECTION_ENABLED` env var replaced by tier check (dead code)
- [ ] Verify nav link display end-to-end (desktop + mobile)
- [ ] Test non-dealer workflow end-to-end (create → view → edit → delete)
- [ ] Verify empty state message ("Start your collection")
- [ ] Test "I Own This" flow from browse → creates collection item
- [x] No paywall modal for collection — intentional. Silent redirect to `/browse` for unauthorized users. Nav links and "I Own This" button hidden. Paywall deferred to future phase.

**Key files:**
| Component | Location |
|-----------|----------|
| Access check helper | `src/lib/collection/access.ts` |
| Subscription types | `src/types/subscription.ts` (yuhinkai tier, collection_access feature) |
| Access tests (10) | `tests/lib/collection/access.test.ts` |
| Yuhinkai handoff | `docs/HANDOFF_YUHINKAI_TIER.md` |

**Risk:** Low. All dangerous architectural work done in Phases 2-3. Remaining items are UX verification and paywall cosmetics.

### Phase 5 — Drop Old Collection System + Route Migration ✅ DONE (2026-03-10)

**Scope:** Remove V1 collection code. Migrate route from `/collection` to `/vault`. Session: `docs/SESSION_20260310_VAULT_ROUTE_MIGRATION.md`.

- [x] Move page from `/collection` to `/vault` with permanent 301 redirect (`next.config.ts`)
- [x] Update all nav links and internal references to use `/vault` (8 files)
- [x] Update `robots.ts` disallow to `/vault`
- [x] Delete `CollectionFormContent.tsx` (458 lines) + dynamic import from QuickView.tsx
- [x] Remove `isCollectionEditMode` variable and branches (mobile + desktop) from QuickView.tsx
- [x] Delete old `CollectionItem` type + `CollectionListResponse` from `src/types/collection.ts`
- [x] Remove V1 display aliases (`collectionItemToDisplayItem`/`collectionItemsToDisplayItems`)
- [x] Narrow `QuickViewContext`: `collectionMode` dropped `'edit'`, `setCollectionMode` dropped `'edit'`
- [x] Fix "I Own This" flow: redirect to `/vault/add` instead of dead `openCollectionAddForm()`

**Not yet done (cleanup, no user impact):**
- [x] Delete `openCollectionAddForm` from QuickViewContext + drop `collectionMode: 'add'` (2026-03-10)
- [x] Delete folders API (`src/app/api/collection/folders/`) — V1 dead code, queries dropped tables (2026-03-10)
- [ ] Drop `user_collection_items` table (Supabase migration)
- [ ] Remove `NEXT_PUBLIC_COLLECTION_ENABLED` from Vercel env vars
- [x] Wire up "I Own This" prefill — `vault/add/page.tsx` reads `sessionStorage.collection_prefill`, maps to `DealerListingInitialData`, passes to form (2026-03-10). 8 tests.

**Previously done (earlier phases):** 7 V1 components (`CollectionCard`, `CollectionGrid`, etc.) deleted in Phase 2d.

**Risk:** Low. New system is already running. Old data is not migrated (see Decision #23).

### Phase 6 — Community Visibility + Private Sales

**Scope:** Collector/dealer visibility levels. Private offers. Deferred — built only when ready.

- [ ] Expose `collectors` and `dealers` visibility options in UI
- [ ] Authenticated browse endpoint for collector/dealer-visible items
- [ ] "Collector Showcase" section — browse items shared by collectors
- [ ] "Available from Collectors" view for dealers — items at dealer visibility
- [ ] Private offer/inquiry flow (dealer → collector on a specific item)
- [ ] Notification when a dealer inquires about your item
- [ ] Collection statistics (total items, visibility breakdown, categories)

**Risk:** Medium. New feature. Community dynamics and private sale UX need careful design.

### Phase 7 — Collector Profiles

**Scope:** Profile pages for collectors. Deferred — built only when ready.

- [ ] Extend `profiles` table with collector profile columns
- [ ] Collector profile settings page (subset of dealer profile settings)
- [ ] Collector profile page (URL scheme TBD)
- [ ] Extract shared `ProfileView.tsx` base from `DealerProfileView.tsx`
- [ ] Both share `ProfileImageUpload`, `AccentColorPicker`, `SpecializationPills`

**Risk:** Low. Existing component architecture supports this cleanly.

---

## Resolved Decisions

These questions were evaluated during the design process. Decisions are recorded here so they don't resurface.

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Single table vs two tables? | **Two tables** | Physical isolation prevents leaks. Service role bypasses RLS. See Appendix. |
| 2 | Copy or move on promote? | **INSERT new listing (first promote) or UPDATE existing DELISTED row (re-promote)** | First promote creates a new listing row. Re-promote reuses the existing row (same `listings.id`), preserving all FK relationships. |
| 3 | App-level or DB-level transit? | **Postgres RPC** (atomic transaction) | App-level orchestration can leave item in both/neither table on partial failure. RPC = single transaction, rollback on error. |
| 4 | Stable identity across moves? | **`item_uuid`** on both tables | Survives promote/delist. Favorites, URLs, tracking, audit log all reference `item_uuid`. |
| 5 | Hard-delete or soft-delist? | **Soft-delist** (UPDATE, not DELETE) | Hard DELETE cascades 6 FK tables — destroys favorites, price history, views, impressions, clicks, alerts. Soft-delist (mark `status='DELISTED'`, `is_available=false`) preserves all FK data. Verified: all user-facing queries already exclude DELISTED items. Ghost contains previously-public data — different blast radius from leaking private items. |
| 6 | Edit sync while listed? | **No sync needed** | Delist reads current listing state via `FOR UPDATE`. Edits preserved automatically. Re-promote syncs collection edits back to the listing row via UPDATE. |
| 7 | Dealer workflow — form saves? | **Form writes to the item's current table. Publication is a separate action.** | Private items save to `collection_items`. Listed items save to `listings` (existing PATCH behavior). "Save & List" rejected: future sale actions (public, private offer, dealer-only) are contextual actions on items, not form submit variants. Dealers who want to move fast: save → tap "List for Sale" (two taps, same total effort). |
| 8 | Image storage? | **Single `user-images` bucket, public read, owner write** | Path: `{owner_id}/{item_uuid}/`. Public read because promoted images must be viewable in browse. Privacy for private items through UUID opacity. No copy on transit. URLs stable across moves. |
| 9 | Schema drift between tables? | **CI golden test** | Compares column lists. Fails if a column is added to one table but not the other + the RPCs. |
| 10 | Nav structure? | **"Collection" — one nav item** | Tabs (All Items / For Sale / On Hold / Sold) are state filters, not sub-destinations. |
| 11 | "Inventory" label? | **Not used** | Tab says "For Sale." The word "inventory" doesn't appear in the UI. |
| 12 | Old collection fields (condition, price_paid, etc.)? | **Not carried over** | `price_paid` is a privacy liability — collectors won't store acquisition costs in a DB they don't control. No legacy fields. |
| 13 | Route path? | **`/vault`** | Evocative of a secure personal space. Not `/dealer` (breaks mental model), not `/collection` (too close to old system), not `/dashboard` (generic). Migrated in Phase 5 (2026-03-10) with 301 redirect. |
| 14 | Profile URLs? | **Deferred** | Dealers want premium URLs, collectors want anonymity. Design when building profiles. |
| 15 | Visibility levels in Phase 1-4? | **Private + public only** | Schema supports all 4 levels. UI only exposes 2. Community features in Phase 6. |
| 16 | Everyone starts in collection? | **Yes** | All items enter `collection_items` first. Publication is a separate action. One pipeline, multiple publication channels (public listing, private offer, dealer-only visibility). |
| 17 | Card design differences? | **Deferred to implementation** | Collection cards = museum/scholarly. For-sale cards = commercial. Same component, different extensions. |
| 18 | Video support in collection? | **Yes — `item_videos` table keyed by `item_uuid`, fully replacing `listing_videos`** | Videos are a cataloging feature, not a selling feature. The scraper never creates videos — all videos are user-uploaded. `item_videos` uses `item_uuid` (stable across transit). `listing_videos` is migrated into `item_videos` in Phase 2 and dropped. Single table, single identity system. |
| 19 | "I Own This" button? | **Creates `collection_items` row with `source_listing_id`** | Fresh `item_uuid`. Link is informational (ON DELETE SET NULL), not structural. Owner enriches with personal metadata via the full form. |
| 20 | Sold items never return to collection? | **Acceptable** | Sold items stay in `listings` (Sold tab queries them). `item_uuid` links to full history in audit log. Re-acquisition = new `item_uuid` (different ownership period). Private sales (Phase 6) stay in `collection_items` with status change. |
| 21 | `listings` table changes? | **Two nullable columns + `DELISTED` status value** | `item_uuid` and `owner_id` NULL for scraped items. `DELISTED` status invisible to all existing queries. |
| 22 | Free tier cataloging? | **~~Free, unlimited, no cap~~ → Yuhinkai tier gated (2026-03-10)** | Originally "free for all." Changed to require `yuhinkai` tier (or any paid tier) after the P0 dealer listing leak showed open access is dangerous. Trial mode (currently ON) keeps it free for now. The `yuhinkai` tier is manually assigned for users who need only collection access. All paid tiers also get access via rank comparison. See Decision #28. |
| 23 | Old `user_collection_items` data? | **Not migrated — clean break** | Old schema has fields collectors wouldn't want stored (`price_paid` = privacy concern). Minimal existing data. New system is better in every way. Drop table after 30-day notice. |
| 24 | Scraper protection for new columns? | **Explicit exclusion + golden test** | Scraper UPSERT column list must never include `item_uuid` or `owner_id`. Golden test greps `repository.py`. Defense-in-depth: scraper matches on `url` (UNIQUE), promoted items use `nw://` synthetic URLs that the scraper never generates. |
| 25 | What does "On Hold" mean? | **Dealer-side status marker, item stays publicly visible** | HOLD is a sticky note for the dealer (e.g., buyer expressed interest, pending payment). The item remains in public browse with `is_available=true` — other buyers can still view and inquire. Browse queries filter on `is_available`, not `status`, so HOLD items are visible. The "On Hold" tab in the dealer view filters `listings WHERE owner_id = me AND status = 'HOLD'`. |
| 26 | Favorites migration to `item_uuid`? | **No — keep `listing_id`** | Soft-delist preserves the `listings` row (same `listing_id`), so favorites survive delist/re-promote cycles without migration. Scraped items have no `item_uuid`, so favorites must use `listing_id` for those regardless. Adding `item_uuid` to favorites adds complexity for no benefit. |
| 27 | `listing_videos` coexistence? | **No — full migration to `item_videos`** | The scraper never creates videos. ALL videos are user-uploaded. Phase 2 backfills `item_uuid` on all dealer listings, then migrates `listing_videos` → `item_videos`. Single table, single identity system. No dual-source trigger complexity. |
| 28 | Collection access tier? (2026-03-10) | **Yuhinkai tier gated (not free-for-all)** | Originally planned as free unlimited cataloging. After the P0 dealer listing leak (2026-03-03), added proper tier gating via `checkCollectionAccess()` on all 15 API routes. `yuhinkai` tier is manually assigned (no Stripe). All paid tiers (enthusiast/collector/inner_circle) also get access via rank ≥ yuhinkai. Trial mode (currently ON) bypasses everything. `NEXT_PUBLIC_COLLECTION_ENABLED` env var replaced and is dead code. |
| 29 | Route migration timing? (2026-03-10) | **`/vault` — DONE** | Migrated in Phase 5 (2026-03-10). 301 redirect from `/collection` → `/vault` active in `next.config.ts`. |

---

## Key Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Schema drift between tables | Medium — fields silently dropped during transit | CI golden test compares column lists. Fails on divergence. 4-change coordination (both DDLs + both RPC column lists) documented. |
| Transit field loss on promote/delist | Medium — fields lost during move | Postgres RPC with exhaustive column list. Golden round-trip test (create → promote → edit → delist → re-promote → verify all fields + same listing_id). |
| Concurrent promote attempts | Low — item promoted twice | `FOR UPDATE` row lock + `UNIQUE(item_uuid)` on listings prevents double-promote. |
| Form complexity overwhelms collectors | Medium — adoption friction | Progressive disclosure (6 rich sections already collapsed by default). Free tier lets them experience value before committing. |
| DELISTED ghost accumulation | Low — abandoned DELISTED rows grow over time | DELISTED rows are tiny (no images stored in DB, just URLs). Periodic cleanup job could archive ghosts with no matching `collection_items` row (owner deleted item). |
| Scraper overwrites `item_uuid`/`owner_id` | High — breaks collection↔listing link | Golden test on scraper column list. `nw://` URLs prevent UPSERT collision. Documented as CLAUDE.md Critical Rule. |
| URL migration (`/listing/[id]` → `/listing/[item_uuid]`) | Medium — SEO impact | Support both URL formats. `/listing/[id]` redirects to `/listing/[item_uuid]` for promoted items. Scraped items keep BIGINT URLs. |
| Route migration breaks bookmarks | Low — mitigated | 301 redirect from `/collection` → `/vault` active since Phase 5 (2026-03-10). Keep redirect permanently. |
| Account deletion leaves orphaned images | Low — sold items reference deleted user's images | Pre-deletion check: archive images for any `item_uuid` still in `listings`. |
| Dual existence during DELISTED state | Low — item in both tables | Principled exception. `collection_items` row is the editable copy; `listings` ghost is inert (DELISTED, `is_available=false`, `featured_score=0`). Ghost contains previously-public data — low blast radius. |

---

## Success Metrics

- **Collector adoption.** Number of items cataloged (target: 100 items in first month). Free unlimited cataloging removes all friction.
- **Collector → Dealer conversion.** Users who tap "List for Sale" and upgrade to Dealer tier (target: 10% of active catalogers within 6 months).
- **Promotion rate.** Collection items promoted to for-sale listings (validates conversion funnel).
- **Round-trip integrity.** Zero data loss in promote → edit → delist → re-promote cycles (golden test). Same `listing_id` preserved across cycles.
- **FK preservation.** Favorites, price history, views survive delist/re-promote (golden test).
- **Code reduction.** ~2,600 lines deleted from old collection V1.
- **Zero leaks.** No private collection items appearing in browse, SEO, alerts, or any public surface.

---

## Appendix: Architecture Comparison

This design was chosen over two alternatives. The evaluation is preserved here for future reference.

### Approach A — Single Table + RLS (rejected)

Put everything in `listings` with a `visibility` column and RLS policies.

**Why rejected:** Service role key (used by scraper, 6 cron jobs, admin APIs) bypasses RLS entirely. These are the most dangerous access paths — automated systems that could mass-leak if a filter is missed. RLS only protects the least dangerous path (anon browse). Additionally, 18+ existing `.from('listings')` call sites would each need audit and ongoing vigilance. A single missed filter = a leak.

### Approach B — Two Tables with Soft-Delist Transit (chosen)

`collection_items` for private data, `listings` for public data, atomic Postgres RPCs for transit. Delist uses UPDATE (soft-transition), not DELETE.

**Why chosen:** Private items are physically absent from the table that serves browse, SEO, alerts, and cron jobs. A new developer adding a cron job cannot leak private items because they're querying `listings`, which doesn't contain them. Correct by construction. Transit is atomic (Postgres transaction). Soft-delist (UPDATE to DELISTED instead of DELETE) preserves FK relationships across 6 dependent tables — favorites, price history, views, impressions, clicks, and alerts all survive delist/re-promote cycles. (Videos use `item_uuid` via `item_videos` and survive regardless.) The `item_uuid` provides stable identity across moves.

**Trade-off acknowledged:** During DELISTED state, an item exists in both tables (collection_items as editable working copy, listings as inert ghost). This is a principled exception — the ghost contains previously-public data, is invisible to all user-facing queries (verified), and exists solely to preserve FK integrity.

### Approach C — Single Table + Postgres Views (considered)

Base table with visibility column, Postgres VIEWs (`public_listings`, `my_items`) that enforce filters.

**Why not chosen:** Supabase PostgREST has limited support for writable views (needs `INSTEAD OF` triggers). Views can be bypassed by querying the base table directly, reintroducing the discipline problem. Schema bloat on the base table (same concern as Approach A).
