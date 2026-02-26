# Collection Manager — Architecture & Vision

**Last updated**: 2026-02-26
**Status**: V1 live at nihontowatch.com/collection — V2 rebuild planned
**Migration**: `057_collection_tables.sql` applied
**Storage bucket**: `collection-images` (public, 5MB limit, JPEG/PNG/WebP)

---

## Vision

The collection is a **private gallery**, not a database. It should feel like walking into your own curated showroom — the same visual quality as browse, because it IS browse, just with your data.

**Core principle**: No collection-specific chrome. Cards look identical to browse cards. QuickView looks identical to browse QuickView. The only differences are: where the data comes from, and what actions are available.

**Why this matters**:
- Every browse improvement (smart crop, cert colors, JA metadata, artisan badges, typography) automatically applies to collection
- The collector's items feel like first-class citizens, not second-class copies
- The same architecture becomes the dealer feature — one visual system, three data sources

**Key differentiator**: Yuhinkai catalog search — certified Juyo/Tokuju items can be looked up and linked from authoritative NBTHK data. No other collector tool has this.

**Access**: Free unlimited for all authenticated users. No tier gating.

---

## V2 Architecture: Collection = Browse With Your Data

### The Unified Visual System

Browse, collection, artist listings, and (future) dealer pages are the **same visual system** with different data sources and different action sets:

| Page | Data Source | Card | QuickView | Actions |
|------|-----------|------|-----------|---------|
| **Browse** | All dealers | ListingCard | QuickViewContent | Favorite, Inquire, Track |
| **Collection** | Your items | ListingCard | QuickViewContent | Edit, Share, Delete |
| **Artist** | One maker | ListingCard | QuickViewContent | Browse filtered |
| **Dealer** (future) | One dealer | ListingCard | QuickViewContent | Analytics |

### The DisplayItem Adapter

A `CollectionItem` gets normalized into the same shape that `ListingCard` and `QuickViewContent` already render. No collection-specific card component.

```typescript
// Mapper: CollectionItem → Listing-compatible shape
function collectionItemToDisplayItem(item: CollectionItem): DisplayItem {
  return {
    id: item.id,
    source: 'collection',
    title: item.title,
    images: item.images,
    item_type: item.item_type,
    cert_type: item.cert_type,
    smith: item.smith,
    school: item.school,
    artisan_id: item.artisan_id,
    artisan_display_name: item.artisan_display_name,
    nagasa_cm: item.nagasa_cm,
    era: item.era,
    // ... all visual fields map 1:1

    // Source-specific rendering hints
    headerLabel: item.acquired_from || null,  // replaces dealer name
    priceValue: item.current_value || item.price_paid,
    priceCurrency: item.current_value_currency || item.price_paid_currency,
  };
}
```

### What Gets Reused (95%)

| Browse Component | Collection Reuse | Notes |
|-----------------|-----------------|-------|
| `ListingCard` | Direct | Same card, no visual differences |
| `ListingGrid` / `VirtualListingGrid` | Direct | Same grid layout |
| `QuickViewContent` | With source branching | Action bar switches based on `source` |
| `QuickViewModal` | Direct | Same modal container |
| `QuickViewMobileSheet` | Direct | Same mobile bottom sheet |
| `FilterSidebar` / `FilterContent` | Adapted | Same structure, different facet data |
| `MetadataGrid` | Direct | Same metadata layout |
| `ImageGallery` | Direct | Same swipe/zoom/thumbnails |

### What's Collection-Specific (5%)

| Component | Purpose | Stays? |
|-----------|---------|--------|
| `CollectionFormContent` | Add/edit form with sections | Yes — genuinely unique |
| `CatalogSearchBar` | Yuhinkai catalog lookup | Yes — the killer feature |
| `ImageUploadZone` | Drag-drop image upload + resize | Yes — collection-only capability |
| `AddItemCard` | "+" card for adding items | Yes — small, grid-specific |
| `CollectionQuickViewContext` | QuickView state for collection | Merge into shared QuickView context |

### What Gets Deleted (~1,070 lines)

| Component | Lines | Replaced By |
|-----------|-------|------------|
| `CollectionCard` | ~180 | `ListingCard` via DisplayItem adapter |
| `CollectionGrid` | ~40 | `ListingGrid` |
| `CollectionMobileSheet` | ~180 | `QuickViewMobileSheet` |
| `CollectionItemContent` | ~360 | `QuickViewContent` with source branching |
| `CollectionFilterSidebar` | ~30 | `FilterSidebar` |
| `CollectionFilterDrawer` | ~30 | Mobile filter drawer |
| `CollectionQuickView` | ~250 | Shared QuickView system |

---

## Yuhinkai Catalog Search (The Killer Feature)

The ability to search NBTHK certification records and auto-populate collection items from authoritative data. This is what differentiates NihontoWatch from any spreadsheet or generic cataloging tool.

### Current State

The catalog search exists (`CatalogSearchBar` + `/api/collection/catalog-search`) but is embedded inside the add/edit form. It works but is not prominent enough — most users won't discover it.

### Vision: Searchable Catalog System

The Yuhinkai catalog search should be a first-class feature, not buried in a form. When adding a Juyo or Tokuju item:

1. User indicates cert type (Juyo/Tokuju) → search interface opens
2. Search by: smith name, session number, nagasa, form type
3. Results show rich previews: smith name, form, measurements, mei status, collection/volume/item
4. Click result → all fields auto-populate (item type, smith, school, measurements, certification, artisan link)
5. The linked `object_uuid` from Yuhinkai enables future features: setsumei lookup, provenance chain, form analysis

### Search Pipeline

```
User query: "Juyo 63 Masamune"
    │
    ▼
CatalogSearchBar (300ms debounce)
    │
    ├──▶ GET /api/collection/catalog-search?cert=Juyo&session=63&q=Masamune
    │      │
    │      ▼
    │    Yuhinkai DB: gold_values → catalog_records → artisan_makers
    │      │
    │      ▼
    │    Results: [{smith_name, form_type, nagasa, collection, volume, item_number, ...}]
    │
    └──▶ GET /api/collection/artisan-search?q=Masamune
           │
           ▼
         Yuhinkai DB: artisan_makers (domain-filtered)
           │
           ▼
         Results: [{code, name_kanji, name_romaji, school, province, juyo_count, ...}]
```

User selects a result → `mapCatalogToCollectionItem()` converts Yuhinkai fields (mm→cm, collection name→cert_type, form_type→item_type) → form auto-populates.

---

## Collection ↔ Browse Bridge

### Owned Items Visible in Browse

When browsing, items linked to your collection (via `source_listing_id`) show a subtle owned indicator on the card. Your collection is a living overlay on the market.

### "I Own This" Flow

**Current (V1)**: Click button → sessionStorage → navigate to /collection → form opens → fill out → save. Five steps, leaves browse.

**Target (V2)**: Click "I Own This" → instant creation with prefilled data → toast confirmation → owned indicator appears on browse card. Never leave browse. Go to /collection later to add condition, notes, price paid.

### Cross-References

- **Collection QuickView → Browse**: "View original listing" link (if source listing exists). "Find similar on market" → opens browse filtered to same smith/school/type.
- **Browse QuickView → Collection**: "You own N items by this maker" when the artisan matches items in your collection.
- **Artist Profiles → Collection**: "In your collection" badge showing how many items you own by that artisan.

---

## Public Collection Pages (Future → Dealer Feature)

`/collector/username` — your collection rendered as a public gallery. Same cards, same QuickView. Visitors can't edit. Only `is_public` items appear.

The same architecture directly becomes the dealer feature:
- `/collector/username` → collector's public gallery
- `/dealer/aoi-art` → dealer's inventory page with analytics overlay

One component tree, three skins. The `source` discriminator on `DisplayItem` controls which actions, headers, and metadata sections are rendered.

---

## Data Model

### `user_collection_items` table

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | UUID | `gen_random_uuid()` | PK |
| `user_id` | UUID | — | FK → auth.users, ON DELETE CASCADE |
| `source_listing_id` | INTEGER | null | FK → listings, "I Own This" back-reference |
| `item_type` | TEXT | null | katana, tsuba, etc. |
| `title` | TEXT | null | User's custom title |
| `artisan_id` | TEXT | null | Yuhinkai code (e.g., MAS590) |
| `artisan_display_name` | TEXT | null | Cached display name |
| `cert_type` | TEXT | null | Juyo, Hozon, Tokubetsu Juyo, etc. |
| `cert_session` | INTEGER | null | Session/volume number |
| `cert_organization` | TEXT | null | NBTHK, NTHK |
| `smith` | TEXT | null | Swordsmith or tosogu maker name |
| `school` | TEXT | null | |
| `province` | TEXT | null | |
| `era` | TEXT | null | Koto, Shinto, Shinshinto, Gendai |
| `mei_type` | TEXT | null | signed, mumei, gimei, etc. |
| `nagasa_cm` | NUMERIC | null | Blade length in cm |
| `sori_cm` | NUMERIC | null | Curvature in cm |
| `motohaba_cm` | NUMERIC | null | Width at base in cm |
| `sakihaba_cm` | NUMERIC | null | Width at tip in cm |
| `price_paid` | NUMERIC | null | Purchase price |
| `price_paid_currency` | TEXT | null | JPY, USD, EUR |
| `current_value` | NUMERIC | null | Estimated current value |
| `current_value_currency` | TEXT | null | |
| `acquired_date` | DATE | null | |
| `acquired_from` | TEXT | null | Free text (dealer, auction, etc.) |
| `condition` | TEXT | `'good'` | mint/excellent/good/fair/project |
| `status` | TEXT | `'owned'` | owned/sold/lent/consignment |
| `notes` | TEXT | null | |
| `images` | JSONB | `'[]'` | Array of full public URLs or external URLs |
| `catalog_reference` | JSONB | null | `{collection, volume, item_number, object_uuid}` |
| `is_public` | BOOLEAN | `false` | |
| `folder_id` | UUID | null | FK → user_collection_folders (Phase 2) |
| `sort_order` | INTEGER | `0` | |
| `created_at` | TIMESTAMPTZ | `now()` | |
| `updated_at` | TIMESTAMPTZ | `now()` | Auto-updated via trigger |

### `user_collection_folders` table (schema only, UI deferred)

| Column | Type | Default |
|--------|------|---------|
| `id` | UUID | `gen_random_uuid()` |
| `user_id` | UUID | FK → auth.users |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | null |
| `cover_image_url` | TEXT | null |
| `sort_order` | INTEGER | `0` |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()` |

### RLS Policies

- **Owner full access**: SELECT/INSERT/UPDATE/DELETE where `auth.uid() = user_id`
- **Public read**: SELECT where `is_public = true`
- **Service role bypass**: ALL for admin operations

### Indexes

`user_id`, `item_type`, `cert_type`, `status`, `condition`, `source_listing_id`, `artisan_id` on items; `user_id` on folders.

### Supabase Storage: `collection-images` bucket

- **Path format**: `{user_id}/{item_id}/{uuid}.jpg`
- **Public**: Yes (images served directly)
- **Limits**: 5MB per file, JPEG/PNG/WebP only, max 20 images per item
- **Security**: API verifies `user_id/` prefix matches authenticated user

---

## API Reference

### `GET /api/collection/items`

List user's collection with filters and facets. Auth required.

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Filter by item_type (case-insensitive) |
| `cert` | string | Filter by cert_type |
| `status` | string | owned/sold/lent/consignment |
| `condition` | string | mint/excellent/good/fair/project |
| `folder` | string | Filter by folder_id |
| `sort` | string | `newest` (default), `value_desc`, `value_asc`, `type` |
| `page` | number | 1-based, default 1 |
| `limit` | number | Default 100, max 200 |

**Response**: `{ data: CollectionItem[], total: number, facets: CollectionFacets }`

Facets are computed from ALL items (ignoring current filters) for accurate sidebar counts.

### `POST /api/collection/items`

Create new item. Auth required. Max 500 items per user.

**Body**: `CreateCollectionItemInput` (all fields optional)

**Response**: `{ item: CollectionItem }` (201)

### `GET /api/collection/items/[id]`

Fetch single item. Owner sees any item; others see only public items.

### `PATCH /api/collection/items/[id]`

Update item. Owner only. Partial updates — only provided fields change.

### `DELETE /api/collection/items/[id]`

Delete item and cleanup storage images. Owner only.

### `POST /api/collection/images`

Upload image to collection item. Auth required.

**Body**: `FormData` with `file` and `itemId`

**Response**: `{ path, publicUrl }` (201)

### `DELETE /api/collection/images`

Remove image from item and storage. Auth required.

**Body**: `{ imageUrl: string, itemId: string }`

### `GET /api/collection/catalog-search`

Search Yuhinkai catalog records. Auth required.

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Free text (smith name, 2+ chars) |
| `cert` | string | Juyo, Tokuju, Kokuho, JuBun, Jubi |
| `session` | number | Volume/session number |
| `nagasa` | number | Blade length in cm (+/- 1.0cm tolerance) |
| `limit` | number | Max 50 |

**Response**: `{ results: CatalogSearchResult[], total: number }`

### `GET /api/collection/artisan-search`

Search Yuhinkai artisans. Auth required.

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Query (2+ chars) |
| `type` | string | `all` (default), `smith`, `tosogu` |
| `limit` | number | Max 50 |

**Response**: `{ results: ArtisanSearchResult[], query, total }`

### `GET/POST /api/collection/folders`

List or create folders. Auth required. Max 50 folders per user.

---

## File Map

### Current V1 Files (pre-rebuild)

#### Pages

| File | Purpose |
|------|---------|
| `src/app/collection/page.tsx` | Server component — auth gate, redirect if unauthenticated |
| `src/app/collection/CollectionPageClient.tsx` | Client component — filter state, data fetch, grid, URL sync |

#### API Routes

| Endpoint | File |
|----------|------|
| `GET/POST /api/collection/items` | `src/app/api/collection/items/route.ts` |
| `GET/PATCH/DELETE /api/collection/items/[id]` | `src/app/api/collection/items/[id]/route.ts` |
| `POST/DELETE /api/collection/images` | `src/app/api/collection/images/route.ts` |
| `GET /api/collection/catalog-search` | `src/app/api/collection/catalog-search/route.ts` |
| `GET /api/collection/artisan-search` | `src/app/api/collection/artisan-search/route.ts` |
| `GET/POST /api/collection/folders` | `src/app/api/collection/folders/route.ts` |

#### Components (V1 — to be replaced in V2)

| Component | File | V2 Fate |
|-----------|------|---------|
| `CollectionCard` | `src/components/collection/CollectionCard.tsx` | **Delete** → ListingCard via adapter |
| `CollectionGrid` | `src/components/collection/CollectionGrid.tsx` | **Delete** → ListingGrid |
| `CollectionQuickView` | `src/components/collection/CollectionQuickView.tsx` | **Delete** → shared QuickView system |
| `CollectionItemContent` | `src/components/collection/CollectionItemContent.tsx` | **Delete** → QuickViewContent with source branching |
| `CollectionMobileSheet` | `src/components/collection/CollectionMobileSheet.tsx` | **Delete** → QuickViewMobileSheet |
| `CollectionFilterSidebar` | `src/components/collection/CollectionFilterSidebar.tsx` | **Delete** → FilterSidebar |
| `CollectionFilterDrawer` | `src/components/collection/CollectionFilterDrawer.tsx` | **Delete** → mobile filter drawer |
| `CollectionFormContent` | `src/components/collection/CollectionFormContent.tsx` | **Keep** — unique add/edit form |
| `CatalogSearchBar` | `src/components/collection/CatalogSearchBar.tsx` | **Keep** — Yuhinkai search (the killer feature) |
| `ImageUploadZone` | `src/components/collection/ImageUploadZone.tsx` | **Keep** — collection-only upload |
| `AddItemCard` | `src/components/collection/AddItemCard.tsx` | **Keep** — grid "+" card |
| `CollectionBottomBar` | `src/components/collection/CollectionBottomBar.tsx` | **Delete** → shared mobile bottom bar |
| `CollectionFilterContent` | `src/components/collection/CollectionFilterContent.tsx` | **Delete** → FilterContent |

#### Context

| File | Purpose | V2 Fate |
|------|---------|---------|
| `src/contexts/CollectionQuickViewContext.tsx` | QuickView state for collection | Merge into shared QuickView context |

#### Utilities

| File | Purpose |
|------|---------|
| `src/lib/collection/catalogMapping.ts` | Maps Yuhinkai `gold_values` → `CollectionItem` (mm→cm conversion) |
| `src/lib/collection/listingImport.ts` | Maps browse `Listing` → `CollectionItem` for "I Own This" |
| `src/lib/collection/labels.ts` | Cert labels, status labels, condition labels, formatting |

#### Types

| File | Purpose |
|------|---------|
| `src/types/collection.ts` | All type definitions — CollectionItem, Filters, Facets, CatalogSearchResult |

#### Database

| File | Purpose |
|------|---------|
| `supabase/migrations/057_collection_tables.sql` | Tables, indexes, RLS, triggers, storage bucket |

#### Modified Files (existing)

| File | Change |
|------|--------|
| `src/components/listing/QuickViewContent.tsx` | "I Own This" button (auth-gated) |
| `src/components/layout/Header.tsx` | "Collection" nav link (auth-gated) |
| `src/components/layout/MobileNavDrawer.tsx` | "Collection" nav link (auth-gated) |

---

## Key Implementation Details

### Two-Phase Image Upload

In **add mode**, the item doesn't exist yet (no `itemId`), so images can't be uploaded immediately:

1. User selects images → client-side resize (max 2048px, JPEG 0.85) → `blob:` URLs for preview
2. Files queue in `pendingFiles` state via `onPendingFilesChange` prop
3. User clicks Save → POST creates item → returns new `item.id`
4. `uploadPendingFiles(files, itemId)` uploads queued files to storage
5. PATCH updates the item's `images` array with the returned public URLs
6. `blob:` URLs are stripped before the initial POST

In **edit mode**, images upload immediately via POST `/api/collection/images` and the item's `images` array is updated server-side.

### Image Storage Format

Images in the `images` JSONB array are stored as **full public URLs** (e.g., `https://xxx.supabase.co/storage/v1/object/public/collection-images/user123/item456/uuid.jpg`). This is critical — Next.js `<Image>` needs full URLs. External URLs from "I Own This" imports (e.g., `https://dealer.co.jp/photo.jpg`) are stored as-is.

When deleting, the API extracts the storage path from the URL using the `/collection-images/` marker.

---

## Limits & Constraints

| Constraint | Value |
|------------|-------|
| Max items per user | 500 |
| Max images per item | 20 |
| Max file size | 5MB |
| Max folders per user | 50 |
| Image resize max dimension | 2048px |
| Image quality | JPEG 0.85 |
| Accepted formats | JPEG, PNG, WebP |
| Catalog search min query | 2 characters |
| Nagasa search tolerance | +/- 1.0 cm |
| Search debounce | 300ms |
| Items per page (default) | 100 |
| Items per page (max) | 200 |

---

## V2 Rebuild Roadmap

### Phase 1: Unified Visual System

1. Create `DisplayItem` adapter type and `collectionItemToDisplayItem()` mapper
2. Make `ListingCard` accept `DisplayItem` (or extend its existing `Listing` interface to support collection fields)
3. Make `QuickViewContent` branch on `source` for action bar (edit/delete vs. favorite/inquire)
4. Add provenance section to QuickViewContent (shown when `source === 'collection'`)
5. Wire collection page to use `ListingGrid` + `FilterSidebar` instead of custom components
6. Delete ~1,070 lines of parallel collection components

### Phase 2: Instant "I Own This"

1. Click "I Own This" → instant POST with prefilled data → toast confirmation
2. Owned indicator on browse cards (check `source_listing_id` match)
3. Stay in browse — no navigation away
4. Edit details later from /collection

### Phase 3: Collection Intelligence

1. Collection header: item count, cert breakdown, schools represented
2. "Find similar on market" from collection QuickView
3. "You own N items by this maker" in browse QuickView
4. "In your collection" badge on artist profiles
5. Market alerts: "N new listings by smiths you collect" (Pro tier hook)

### Phase 4: Public Collections & Dealer Feature

1. `/collector/username` — public gallery (same grid, same cards, read-only)
2. `is_public` toggle per item
3. Extend same pattern to `/dealer/slug` with analytics overlay

---

## Troubleshooting

### Images not displaying
Check that the `images` array contains full public URLs (not bare storage paths). The correct format is:
```
https://itbhfhyptogxcjbjfzwx.supabase.co/storage/v1/object/public/collection-images/user123/item456/uuid.jpg
```
Not: `user123/item456/uuid.jpg`

### "I Own This" button not visible
The button is auth-gated (`{user && (...)}`) in `QuickViewContent.tsx`. User must be logged in.

### Catalog search returns empty
Verify Yuhinkai Supabase is configured (`YUHINKAI_SUPABASE_URL` and `YUHINKAI_SUPABASE_KEY` in env). API returns 503 if not configured.

### Upload fails in add mode
This is by design — add mode queues files locally. The actual upload happens after the item is created (POST → uploadPendingFiles → PATCH). Check browser console for errors in the save flow.
