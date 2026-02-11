# Collection Manager — Comprehensive Documentation

**Last updated**: 2026-02-11
**Status**: Live at nihontowatch.com/collection
**Migration**: `057_collection_tables.sql` applied
**Storage bucket**: `collection-images` (public, 5MB limit, JPEG/PNG/WebP)

---

## Overview

The Collection Manager is a personal cataloging system for authenticated users to inventory their nihonto (Japanese swords) and tosogu (sword fittings). It reuses 70-80% of the browse infrastructure (card layout, QuickView pattern, filter sidebar, grid) to create a "personal museum" that feels instantly familiar.

**Key differentiator**: Yuhinkai catalog lookup — certified Juyo/Tokuju items auto-populate from authoritative data. No other collector tool has this.

**Access**: Free unlimited for all authenticated users. No tier gating.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    COLLECTION MANAGER                            │
│                                                                  │
│  ┌──────────────┐       ┌──────────────┐       ┌────────────┐  │
│  │  /collection │──────▶│  QuickView   │──────▶│  /browse    │  │
│  │    Grid      │       │ Add/Edit/View│       │"I Own This" │  │
│  └──────┬───────┘       └──────┬───────┘       └──────┬─────┘  │
│         │                      │                      │         │
│         │ Client fetch         │ CRUD + Upload        │ Import  │
│         ▼                      ▼                      ▼         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    API Layer                                │ │
│  │  /api/collection/items     (GET, POST)                     │ │
│  │  /api/collection/items/[id](GET, PATCH, DELETE)            │ │
│  │  /api/collection/images    (POST, DELETE)                  │ │
│  │  /api/collection/catalog-search  (GET → Yuhinkai)          │ │
│  │  /api/collection/artisan-search  (GET → Yuhinkai)          │ │
│  │  /api/collection/folders   (GET, POST)                     │ │
│  └────────────────┬──────────────────────┬────────────────────┘ │
│                   │                      │                      │
│                   ▼                      ▼                      │
│  ┌────────────────────────┐  ┌──────────────────────────────┐  │
│  │  NihontoWatch DB       │  │  Yuhinkai DB (Supabase)      │  │
│  │  user_collection_items │  │  smith_entities, gold_values  │  │
│  │  user_collection_folders│  │  tosogu_makers, catalog_records│ │
│  └────────────────────────┘  └──────────────────────────────┘  │
│                   │                                              │
│                   ▼                                              │
│  ┌────────────────────────┐                                     │
│  │  Supabase Storage      │                                     │
│  │  collection-images     │                                     │
│  │  {user}/{item}/{uuid}  │                                     │
│  └────────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
```

**Pattern**: Hybrid SSR + client fetch (same as `/artists` and `/browse`):
- Server component gates auth, redirects unauthenticated → `/browse?login=collection`
- Client component manages filter state, fetches data, syncs URL via `replaceState()`
- `AbortController` cancels in-flight requests on rapid filter changes

---

## Four Entry Paths (One Form)

The add form has a smart search bar at the top. All paths use the same form — the difference is how much gets pre-filled:

### Path 0 — "I Own This" (from browse QuickView)

User clicks "I Own This" on a browse listing → collection QuickView opens in add mode with ALL fields pre-populated from the listing.

**Flow**: `QuickViewContent.tsx` → `mapListingToCollectionItem()` → `sessionStorage('collection_prefill')` → redirect to `/collection?add=listing` → `CollectionPageClient` reads sessionStorage → `openAddForm(prefill)`

**What copies**: item_type, smith, school, certification, measurements, images (dealer URLs), artisan_id, province, era, mei_type, acquired_from (dealer name), price

**What user adds**: condition, notes, acquired_date (price may need adjustment)

### Path 1 — Yuhinkai Catalog Lookup

User types "Juyo 63 Masamune" or uses refinement fields (cert type + session + nagasa).

**Flow**: `CatalogSearchBar` → `/api/collection/catalog-search` → Yuhinkai gold_values + catalog_records → `mapCatalogToCollectionItem()` → 15+ fields auto-populate

### Path 2 — Artisan-Linked

User types artisan name → search results appear from Yuhinkai.

**Flow**: `CatalogSearchBar` → `/api/collection/artisan-search` → select artisan → artisan_id, smith, school, province, era populate

### Path 3 — Fully Manual

Skip the search bar → blank form. For unpapered, unsigned, or non-Japanese items.

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

Delete item and cleanup storage images. Owner only. Extracts storage paths from full URLs, removes from bucket, then deletes the DB row.

### `POST /api/collection/images`

Upload image to collection item. Auth required.

**Body**: `FormData` with `file` and `itemId`

**Response**: `{ path, publicUrl }` (201)

Resizing happens client-side before upload. Server validates type, size, ownership, and image count.

### `DELETE /api/collection/images`

Remove image from item and storage. Auth required.

**Body**: `{ imageUrl: string, itemId: string }`

Extracts storage path from URL, verifies user owns the path prefix, removes from bucket and item's images array.

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

Two-step search: `gold_values` → join `catalog_records` for collection/volume/item_number, then join `smith_entities`/`tosogu_makers` for names.

### `GET /api/collection/artisan-search`

Search Yuhinkai artisans. Auth required.

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Query (2+ chars) |
| `type` | string | `all` (default), `smith`, `tosogu` |
| `limit` | number | Max 50 |

**Response**: `{ results: ArtisanSearchResult[], query, total }`

Searches both `smith_entities` and `tosogu_makers` in parallel, sorted by Juyo+Tokuju count.

### `GET/POST /api/collection/folders`

List or create folders. Auth required. Max 50 folders per user.

---

## File Map

### Pages

| File | Purpose |
|------|---------|
| `src/app/collection/page.tsx` | Server component — auth gate, redirect if unauthenticated |
| `src/app/collection/CollectionPageClient.tsx` | Client component — filter state, data fetch, grid, URL sync |

### API Routes

| Endpoint | File |
|----------|------|
| `GET/POST /api/collection/items` | `src/app/api/collection/items/route.ts` |
| `GET/PATCH/DELETE /api/collection/items/[id]` | `src/app/api/collection/items/[id]/route.ts` |
| `POST/DELETE /api/collection/images` | `src/app/api/collection/images/route.ts` |
| `GET /api/collection/catalog-search` | `src/app/api/collection/catalog-search/route.ts` |
| `GET /api/collection/artisan-search` | `src/app/api/collection/artisan-search/route.ts` |
| `GET/POST /api/collection/folders` | `src/app/api/collection/folders/route.ts` |

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `CollectionQuickView` | `src/components/collection/CollectionQuickView.tsx` | Modal shell — navigation, mode switching, top bar |
| `CollectionViewContent` | `src/components/collection/CollectionViewContent.tsx` | Read-only view — gallery, metadata grid, edit/delete buttons |
| `CollectionFormContent` | `src/components/collection/CollectionFormContent.tsx` | Add/edit form — search bar, all field sections, save/cancel |
| `CatalogSearchBar` | `src/components/collection/CatalogSearchBar.tsx` | Dual catalog + artisan search with 300ms debounce |
| `ImageUploadZone` | `src/components/collection/ImageUploadZone.tsx` | Drag-drop upload, resize, two-phase upload, thumbnail strip |
| `CollectionCard` | `src/components/collection/CollectionCard.tsx` | Item card — cert badges, status, condition, artisan, price |
| `AddItemCard` | `src/components/collection/AddItemCard.tsx` | "+" skeleton card for adding new items |
| `CollectionGrid` | `src/components/collection/CollectionGrid.tsx` | Responsive CSS grid of cards |
| `CollectionFilterSidebar` | `src/components/collection/CollectionFilterSidebar.tsx` | Sort + filter sidebar with facet counts |

### Context

| File | Purpose |
|------|---------|
| `src/contexts/CollectionQuickViewContext.tsx` | QuickView state — open/close, mode, navigation, refresh callback |

### Utilities

| File | Purpose |
|------|---------|
| `src/lib/collection/catalogMapping.ts` | Maps Yuhinkai `gold_values` → `CollectionItem` (mm→cm conversion) |
| `src/lib/collection/listingImport.ts` | Maps browse `Listing` → `CollectionItem` for "I Own This" |

### Types

| File | Purpose |
|------|---------|
| `src/types/collection.ts` | All type definitions — CollectionItem, Filters, Facets, CatalogSearchResult, etc. |

### Database

| File | Purpose |
|------|---------|
| `supabase/migrations/057_collection_tables.sql` | Tables, indexes, RLS, triggers, storage bucket note |

### Modified Files (existing)

| File | Change |
|------|--------|
| `src/components/listing/QuickViewContent.tsx` | Added "I Own This" button (auth-gated) in CTA area |
| `src/components/layout/Header.tsx` | Added "Collection" nav link (auth-gated) |
| `src/components/layout/MobileNavDrawer.tsx` | Added "Collection" nav link (auth-gated) |
| `src/types/database.ts` | Added `user_collection_items` and `user_collection_folders` table type defs |
| `tests/components/listing/QuickViewContent.test.tsx` | Added mocks for `useRouter`, `mapListingToCollectionItem` |

---

## Component Hierarchy

```
CollectionPageClient
  └─ CollectionQuickViewProvider (context)
      └─ CollectionPageInner
          ├─ CollectionFilterSidebar
          │   ├─ Sort dropdown (newest, value, type)
          │   └─ FilterSection × 4 (type, cert, status, condition)
          │
          ├─ CollectionGrid
          │   ├─ CollectionCard × N (memoized)
          │   └─ AddItemCard
          │
          └─ CollectionQuickView (modal)
              ├─ [mode=view] CollectionViewContent
              │   ├─ Image gallery + thumbnails
              │   ├─ Metadata grid
              │   ├─ Edit / Delete buttons
              │   └─ Source listing link
              │
              └─ [mode=add|edit] CollectionFormContent
                  ├─ CatalogSearchBar (add mode, no prefill)
                  │   ├─ Catalog results
                  │   └─ Artisan results
                  ├─ ImageUploadZone
                  │   ├─ Drop zone
                  │   └─ Thumbnail strip with remove
                  ├─ Classification section
                  ├─ Attribution section
                  ├─ Measurements section
                  ├─ Provenance section
                  ├─ Valuation section
                  ├─ Status & Condition section
                  ├─ Notes section
                  └─ Sticky footer (Save / Cancel)
```

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

### Catalog Search Pipeline

```
User query: "Juyo 63 Masamune"
    │
    ▼
CatalogSearchBar (300ms debounce)
    │
    ├─▶ GET /api/collection/catalog-search?cert=Juyo&session=63&q=Masamune
    │     │
    │     ▼
    │   Yuhinkai DB: gold_values → catalog_records → smith_entities
    │     │
    │     ▼
    │   Results: [{smith_name, form_type, nagasa, collection, volume, item_number, ...}]
    │
    └─▶ GET /api/collection/artisan-search?q=Masamune
          │
          ▼
        Yuhinkai DB: smith_entities + tosogu_makers
          │
          ▼
        Results: [{code, name_kanji, name_romaji, school, province, juyo_count, ...}]
```

User selects a result → `mapCatalogToCollectionItem()` converts Yuhinkai fields (mm→cm, collection name→cert_type, form_type→item_type) → form auto-populates.

### "I Own This" Flow

```
Browse QuickView           Collection Page
┌──────────────┐          ┌──────────────┐
│ "I Own This" │──────────│  ?add=listing │
│   button     │ redirect │              │
│              │          │ reads session │
│ mapListing() │          │ Storage      │
│ → session    │          │              │
│   Storage    │          │ openAddForm  │
└──────────────┘          │ (prefill)    │
                          └──────────────┘
```

1. `QuickViewContent.tsx`: `handleIOwn` calls `mapListingToCollectionItem(listing)`, stores in `sessionStorage('collection_prefill')`, closes QuickView, navigates to `/collection?add=listing`
2. `CollectionPageClient.tsx`: On mount, checks for `?add=listing` param, reads and clears sessionStorage, calls `openAddForm(prefill)`, cleans up URL

### QuickView Keyboard Navigation

| Key | Action | Condition |
|-----|--------|-----------|
| `Escape` | Close | Always |
| `→` or `j` | Next item | View mode, not at end |
| `←` or `k` | Previous item | View mode, not at start |

Navigation is bounded (no wrap-around). Counter shows "X of Y" in the top bar.

### Memoization

`CollectionCard` uses `React.memo` with custom comparison on `item.id`, `item.updated_at`, and first image URL. This prevents re-renders when the parent grid re-renders with the same data.

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

## What's Deferred (Phase 2+)

| Feature | Status | Notes |
|---------|--------|-------|
| **Folders UI** | Schema ready, API ready, UI deferred | `folder_id` column exists, `/api/collection/folders` works |
| **Stats bar** | Not started | Total value, item count by type, value trends |
| **Image reorder** | Not started | Drag-to-reorder in thumbnail strip |
| **Public collection profile** | Schema ready (`is_public` field) | Share your collection with a public URL |
| **Mobile filter drawer** | Not started | Desktop sidebar only currently |
| **Bulk operations** | Not started | Multi-select delete, folder assignment |
| **Export** | Not started | CSV/PDF export of collection |
| **Collection sharing** | Not started | Share link, QR code |

---

## Testing

### Automated

- `tests/components/listing/QuickViewContent.test.tsx` — Updated with mocks for "I Own This" button (`useRouter`, `mapListingToCollectionItem`)
- Build verification: `npm run build` passes
- All 3,782 existing tests pass

### Manual Smoke Test Checklist

- [ ] `/collection` redirects to browse if not logged in
- [ ] Empty state shows "+" card
- [ ] Add item manually (Path 3)
- [ ] Add item via Yuhinkai catalog lookup (Path 1)
- [ ] Add item via artisan search (Path 2)
- [ ] "I Own This" from browse QuickView (Path 0)
- [ ] Edit item — all fields persist
- [ ] Delete item — confirmation, grid refreshes
- [ ] Image upload in add mode — blob preview, uploads on save
- [ ] Image upload in edit mode — immediate upload
- [ ] Image delete — removes from storage
- [ ] Filters work (type, cert, status, condition)
- [ ] Sort works (newest, value high/low, type)
- [ ] QuickView navigation (arrows, keyboard)
- [ ] Mobile: 2-col grid, full-width QuickView

---

## Troubleshooting

### Images not displaying
Check that the `images` array contains full public URLs (not bare storage paths). The correct format is:
```
https://itbhfhyptogxcjbjfzwx.supabase.co/storage/v1/object/public/collection-images/user123/item456/uuid.jpg
```
Not: `user123/item456/uuid.jpg`

### "I Own This" button not visible
The button is auth-gated (`{user && (...)}`) in `QuickViewContent.tsx`. User must be logged in. Hard refresh (Cmd+Shift+R) if deployment is recent.

### Catalog search returns empty
Verify Yuhinkai Supabase is configured (`YUHINKAI_SUPABASE_URL` and `YUHINKAI_SUPABASE_KEY` in env). API returns 503 if not configured.

### Upload fails in add mode
This is by design — add mode queues files locally. The actual upload happens after the item is created (POST → uploadPendingFiles → PATCH). Check browser console for errors in the save flow.

### Delete doesn't remove storage files
Storage cleanup is best-effort. If the image URL doesn't contain `/collection-images/`, the storage path can't be extracted and the file stays in the bucket. External URLs (from "I Own This" imports) are never deleted from dealer servers.
