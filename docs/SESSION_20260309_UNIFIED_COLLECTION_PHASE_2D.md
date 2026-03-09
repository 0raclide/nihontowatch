# Session: Unified Collection Phase 2d — DisplayItem Mapper + Collection QuickView Upgrade

> **Date:** 2026-03-09
> **Phase:** 2d of Unified Collection Architecture
> **Depends on:** Phase 2c (collection CRUD API + form wiring)
> **Tests:** 43 (35 mapper + 8 page client)
> **Next:** Phase 3 (promote/delist transit)

## What Was Built

### 1. Rewritten Collection→DisplayItem Mapper

**`src/lib/displayItem/fromCollectionItem.ts`** — Complete rewrite.

The V1 mapper (`collectionItemToDisplayItem`) was a data firewall that silently dropped everything interesting:
- JSONB sections (sayagaki, hakogaki, koshirae, provenance, kiwame, kanto_hibisho) — **all dropped**
- Tosogu fields (tosogu_maker, tosogu_school, material, height_cm, width_cm) — **all dropped**
- Setsumei (setsumei_text_en, setsumei_text_ja) — **all dropped**
- Descriptions (description, description_en, description_ja) — **dropped** (V1 mapped `notes` to `description`)
- Translation cache (title_en, title_ja) — **all dropped**
- AI curator notes — **dropped**
- Smart crop data (focal_x, focal_y, hero_image_index) — **dropped**
- Video count — **dropped**
- Stored images — **dropped**

The new mapper `collectionRowToDisplayItem(CollectionItemRow)` passes through every `ItemDataFields` field. Collection QuickView now displays the same rich metadata that browse and dealer QuickViews show.

Key mappings:
- `id: item.item_uuid` — stable identity, not PK
- `source: 'collection'`
- `cert_session`: TEXT→number parse (DB stores TEXT, DisplayItem expects number)
- `images`: empty array → `null` (ListingCard null-check)
- `has_setsumei`: derived from `setsumei_text_en || setsumei_text_ja`
- `status: item.status || 'INVENTORY'` — uses actual status, not hardcoded 'available'
- `is_initial_import: true` — suppresses "New" badge
- `dealer_display_name: 'Personal Collection'` — always, no conditional

### 2. Simplified CollectionExtension Type

**`src/types/displayItem.ts`**

Before (10 V1 fields):
```typescript
interface CollectionExtension {
  notes, condition, collection_status,
  price_paid, price_paid_currency,
  current_value, current_value_currency,
  acquired_from, acquired_date,
  source_listing_id
}
```

After (4 Phase 2a fields):
```typescript
interface CollectionExtension {
  item_uuid: string;
  personal_notes: string | null;
  visibility: CollectionVisibility;
  source_listing_id: number | null;
}
```

The V1 fields (`price_paid`, `condition`, `acquired_from`, etc.) don't exist on `CollectionItemRow`. Price is now the shared `price_value`/`price_currency` on `DisplayItem` itself. Status is the shared `status` field. The `CollectionExtension` only carries fields that are truly collection-specific.

### 3. QuickViewContext Update

**`src/contexts/QuickViewContext.tsx`**

- `collectionItem` state typed as `CollectionItemRow | null`
- `openCollectionQuickView()` now spreads the `CollectionItemRow` directly as a Listing shape instead of going through the V1 mapper. This means the `currentListing` in QuickView carries all JSONB sections natively — the QuickViewContent/MobileSheet slots that render sayagaki, koshirae, provenance etc. "just work" because they read from `currentListing.sayagaki`, `currentListing.koshirae`, etc.
- URL uses `item_uuid` instead of PK `id`

### 4. Edit Redirect

**`src/components/listing/QuickView.tsx`**

`handleEditCollection()` changed from `setCollectionMode('edit')` (which loaded the V1 `CollectionFormContent` inline) to `window.location.href = /collection/edit/${collectionItem.id}`. This routes to the Phase 2c full-page form with all 6 metadata sections, video upload, and catalog match.

The V1 `CollectionFormContent` dynamic import is kept as dead code with `as any` type casts. It's unreachable but removing it is Phase 5 work.

### 5. Five Slot Component Updates

| Component | Change |
|-----------|--------|
| `CollectionActionBar` | Prop type `CollectionItem` → `CollectionItemRow` |
| `CollectionNotes` | `collectionItem.notes` → `collectionItem.personal_notes` |
| `CollectionDealerRow` | Simplified to always show "Personal Collection" + optional source listing link. Removed `acquired_from`/`acquired_date` display. |
| `CollectionProvenance` | Rewritten from price_paid/current_value/condition to status + visibility |
| `CollectionCTA` | Prop type updated |

### 6. CollectionPageClient Update

**`src/app/collection/CollectionPageClient.tsx`**

- State typed as `CollectionItemRow[]`
- Mapper: `collectionRowsToDisplayItems()` (new)
- Card click lookup: `items.find(i => i.item_uuid === displayItem.id)`
- Deep link lookup: `items.find(i => i.item_uuid === itemId)`
- API response typed inline (dropped V1 `CollectionListResponse`)

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/displayItem.ts` | `CollectionExtension` simplified to 4 fields |
| `src/lib/displayItem/fromCollectionItem.ts` | Full rewrite + V1 aliases |
| `src/lib/displayItem/index.ts` | Barrel exports new names + aliases |
| `src/contexts/QuickViewContext.tsx` | `CollectionItemRow` type, direct spread, `item_uuid` URL |
| `src/components/listing/QuickView.tsx` | Edit redirect, `as any` casts for V1 form, mobile dealer slot fix |
| `src/app/collection/CollectionPageClient.tsx` | New types, mapper, `item_uuid` lookups |
| `src/components/listing/quickview-slots/CollectionActionBar.tsx` | Prop type |
| `src/components/listing/quickview-slots/CollectionNotes.tsx` | Field name |
| `src/components/listing/quickview-slots/CollectionDealerRow.tsx` | Simplified |
| `src/components/listing/quickview-slots/CollectionProvenance.tsx` | Rewritten |
| `src/components/listing/quickview-slots/CollectionCTA.tsx` | Prop type |
| `tests/lib/displayItem/fromCollectionItem.test.ts` | 35 tests, full rewrite |
| `tests/app/collection/CollectionPageClient.test.tsx` | 8 tests, mock data updated |

---

## What I'd Design Differently

### 1. The V1 CollectionItem type should never have existed

The original `CollectionItem` in `src/types/collection.ts` was a hand-rolled type with its own field vocabulary (`notes` vs `personal_notes`, `price_paid`/`current_value` vs shared `price_value`, `user_id` vs `owner_id`, `condition` enum, etc.). When Phase 2a introduced `CollectionItemRow extends ItemDataFields`, we ended up with **two complete type systems for the same concept** living side by side.

Every component that touches collection data now has to know which type it's dealing with. The V1 `CollectionFormContent` still uses `CollectionItem`. The new form uses `CollectionItemRow`. The slot components were just migrated. The context was just migrated. It's confusing and brittle.

**What I'd do instead:** The moment `ItemDataFields` was defined (Phase 2a), `CollectionItem` should have been aliased or replaced in the same PR. One migration, one type. Instead, we deferred the type migration to "Phase 5 cleanup" — but every intermediate phase pays the tax of dual types, `as any` casts, and cognitive overhead.

### 2. The V1 mapper should have been a pass-through from day one

The original `collectionItemToDisplayItem()` was written as if `CollectionItem` was a fundamentally different shape from `Listing`, manually mapping ~50 fields with hardcoded nulls for anything "collection items don't have." But collection items always had images, always had cert_type, always had measurements. The mapper just... decided they didn't matter and dropped them.

The root cause: the original collection manager was designed as a "lite" feature with thin data, so the mapper matched that assumption. When the dealer form (sayagaki, koshirae, etc.) was adopted as the collection form, the mapper never caught up. Data flowed in through the form and silently vanished in the mapper.

**What I'd do instead:** Define the mapper contract as "pass-through by default, override only what's semantically different." The `listingToDisplayItem` mapper does this reasonably well. The collection mapper should have started with the same pattern.

### 3. `replace_all` on a variable name is a footgun

During implementation, I used `replace_all` to change `CollectionItem` → `CollectionItemRow` across `QuickViewContext.tsx`. This also renamed `setCollectionItem` → `setCollectionItemRow` and mangled the import to `CollectionItemRowRow`. Three separate fixes needed.

**Lesson:** When a type name is a substring of variable names (which it usually is — `CollectionItem` appears in `setCollectionItem`, `collectionItem`, `CollectionItemRow`, etc.), `replace_all` is dangerous. Better to do targeted edits on the type annotations and import statement only, leaving variable names alone.

### 4. The "All Items" tab should have been scoped out of Phase 2d

The original plan title was "DisplayItem + All Items Tab" but the tab was deferred because it requires the promote/delist state machine (Phase 3) to meaningfully distinguish "not yet listed" from "listed" items. This was predictable from the design doc's state machine diagram — the tab concept is tightly coupled to the transit states.

**What I'd do instead:** Name the phase "DisplayItem Mapper + QuickView Upgrade" from the start. The tab is a Phase 3+ deliverable because it's a UX concept that depends on promote/delist states, not a data plumbing concern.

### 5. The slot component split created unnecessary indirection for collection

The 5 collection slot components (`CollectionActionBar`, `CollectionNotes`, `CollectionDealerRow`, `CollectionProvenance`, `CollectionCTA`) were created during the DisplayItem composition slots work (2026-02-26) to mirror the browse/dealer pattern. But the collection slots are trivial — `CollectionProvenance` is now 20 lines, `CollectionNotes` is 10 lines, `CollectionDealerRow` is 15 lines. They don't justify dedicated files.

Meanwhile, the real value of the slot system — the ability to render sayagaki, koshirae, provenance sections in QuickView — works automatically through `QuickViewContent`/`QuickViewMobileSheet` reading from `currentListing`. No slot component needed. The V1 mapper was the bottleneck, not the slot architecture.

**What I'd do instead:** Inline the trivial collection slots (Notes, DealerRow, Provenance) as conditionals inside QuickViewContent. Keep ActionBar and CTA as slots since they have meaningful logic (delete API call, edit redirect). Less files, less indirection, same result.

---

## Handoff Notes for Phase 3

### What's ready

1. **`collection_items` table** with full `ItemDataFields` (Phase 2a)
2. **CRUD API** at `/api/collection/items` (Phase 2c)
3. **DisplayItem mapper** that preserves all data (this phase)
4. **`item_uuid`** populated on all existing `listings` rows (migration 119)
5. **Full-page add/edit form** at `/collection/add` and `/collection/edit/[id]` (Phase 2c)
6. **`collection_events`** audit log table (Phase 2a)

### What Phase 3 needs to build

1. **`promote_to_listing()` Postgres RPC** — Copies `collection_items` row to `listings` (or reactivates DELISTED ghost). Sets `item_uuid`, `owner_id`. Deletes from `collection_items`. Logs event.
2. **`delist_to_collection()` Postgres RPC** — Copies `listings` row to `collection_items`. Marks listing as DELISTED (`is_available=false`). Logs event.
3. **API endpoints** — `POST /api/collection/items/[id]/promote`, `POST /api/listings/[id]/delist`
4. **Paywall gate** — Dealer tier required for promotion
5. **"List for Sale" action** — Button in collection QuickView/page
6. **"Remove from Sale" action** — Button in dealer QuickView/page
7. **Trigger featured score** computation after promote

### Gotchas for the next developer

- **`DisplayItem.id` is `item_uuid` for collection items, `listing.id` (numeric) for browse items.** Phase 3 promote should ensure the promoted listing's `id` (auto-increment PK) doesn't clash with QuickView URL patterns. The `?listing=` param expects a numeric ID, `?item=` expects a UUID. After promote, the item lives in `listings` and should use `?listing=`.

- **V1 `CollectionFormContent` is dead code in QuickView.tsx** but still imported. If you touch QuickView imports, know that removing it is safe (edit redirects to full-page form now). But doing so changes the V1 "add via QuickView" flow — make sure `/collection/add` fully replaces it before removing.

- **`CollectionPageClient` fetches from `/api/collection/items`** which returns `CollectionItemRow[]`. After Phase 3, the page will need to also show promoted items (which live in `listings`). The "All Items" tab likely needs a unified query that JOINs or UNIONs both tables by `item_uuid` + `owner_id`. This is the hard part of the tab — not the UI, but the data source.

- **`openCollectionQuickView` spreads the item directly as a Listing.** This works because `CollectionItemRow extends ItemDataFields` and `Listing` shares most of those fields. But if a future `Listing` field becomes required and isn't on `ItemDataFields`, the `as unknown as Listing` cast will hide the gap. Keep the cast narrow or add a proper adapter if the Listing type diverges.

- **Backward-compat aliases** (`collectionItemToDisplayItem`, `collectionItemsToDisplayItems`) are exported from the barrel. Grep for callers before removing them in Phase 5 — there may be test files or other references that use the old names.
