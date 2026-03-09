# Session: Unified Collection Phase 2c — Collection CRUD API + Form Wiring

> **Date:** 2026-03-09
> **Phase:** 2c of Unified Collection Architecture
> **Depends on:** Phase 2a (collection_items table), Phase 2b (item_videos migration)
> **Tests:** 64 (24 items + 16 images + 9 videos + 7 form + 8 page)

## What Was Built

### 1. Storage Bucket (Migration 126)

`supabase/migrations/126_user_images_bucket.sql` — Creates `user-images` Supabase Storage bucket:
- Public read (images may become public after promote in Phase 3)
- Owner-scoped write/delete via path prefix matching `auth.uid()`

### 2. Collection Items CRUD API

**`src/app/api/collection/items/route.ts`** — GET + POST

- **GET**: Queries `collection_items` via `collectionItemsFrom()` typed helper. Supports filters (item_category, cert_type, search), facets, pagination via `.range()`. Returns items + count + facets.
- **POST**: Creates new collection item with ~56 shared fields. Routes artisan fields by `item_category` (nihonto vs tosogu). Sanitizes all 6 JSONB sections. Sets `artisan_confidence: 'HIGH'` if artisan_id provided. Logs `collection_events` row. Returns 201.

**`src/app/api/collection/items/[id]/route.ts`** — GET + PATCH + DELETE

- **GET**: Fetches single item. Ownership check via `owner_id === user.id`.
- **PATCH**: Whitelist enforcement via `ALLOWED_FIELDS` Set. Sanitizes JSONB sections conditionally. Logs audit event with changed field names.
- **DELETE**: Cleans up storage images (parses public URLs → extract paths → `storage.remove()`), cleans up Bunny videos (queries `item_videos` by `item_uuid`), logs audit event BEFORE delete, then deletes row.

### 3. Image Upload Routes (6 routes)

All mirror dealer image routes with collection-specific auth (`supabase.auth.getUser()` instead of `verifyDealer()`):

| Route | Bucket Path | Max Images |
|-------|-------------|------------|
| `collection/images` | `{owner_id}/{item_uuid}/{uuid}.{ext}` | 20 |
| `collection/sayagaki-images` | `{owner_id}/{item_uuid}/sayagaki/{uuid}.{ext}` | 5/entry |
| `collection/hakogaki-images` | `{owner_id}/{item_uuid}/hakogaki/{uuid}.{ext}` | 5/entry |
| `collection/koshirae-images` | `{owner_id}/{item_uuid}/koshirae/{uuid}.{ext}` | 10 |
| `collection/provenance-images` | `{owner_id}/{item_uuid}/provenance/{uuid}.{ext}` | 5/entry |
| `collection/kanto-hibisho-images` | `{owner_id}/{item_uuid}/kanto-hibisho/{uuid}.{ext}` | 10 |

NULL-check pattern applied: if JSONB section is NULL (user added section but hasn't saved), initialize empty object to allow upload. Same fix as the koshirae-images 404 bug from Phase 1.

### 4. Video Routes

- `POST /api/collection/videos` — Creates Bunny video + DB row, returns TUS credentials
- `GET /api/collection/videos` — Lists videos by `item_uuid`
- `DELETE /api/collection/videos/[id]` — Bunny cleanup + DB deletion

Auth: `supabase.auth.getUser()` + ownership via `selectCollectionItemSingle()`. Webhook is shared (already writes to `item_videos` by `provider_id`).

### 5. Form Wiring

**`DealerListingForm` context prop:**

```typescript
interface DealerListingFormProps {
  mode: 'add' | 'edit';
  initialData?: DealerListingInitialData;
  context?: 'listing' | 'collection';  // defaults to 'listing'
}
```

All API paths computed from context:
- `apiBase = context === 'collection' ? '/api/collection' : '/api/dealer'`
- Items endpoint: `${apiBase}/items` (collection) vs `${apiBase}/listings` (dealer)
- Image endpoints: `${apiBase}/images`, `${apiBase}/sayagaki-images`, etc.
- Success redirect: `/collection` (collection) vs `/dealer` (dealer)
- Draft localStorage key: `nw-collection-draft` vs `nw-dealer-draft`

### 6. Collection Pages

- `src/app/collection/add/page.tsx` — Renders `<DealerListingForm mode="add" context="collection" />`
- `src/app/collection/edit/[id]/page.tsx` — Fetches item from API, renders form with initialData

### 7. V1 Page Update

`CollectionPageClient.tsx` — "Add Item" button now navigates to `/collection/add` (was opening V1 modal).

### 8. Type Widening

`VideoUploadContext` and `VideoUploadProgress` — `listingId` widened from `number` to `number | string` throughout (UploadEntry, startUpload, getUploadsForListing, subscribeToListing, subscribersRef Map key).

## Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `tests/api/collection-items.test.ts` | 24 | POST (create, sanitize, audit), PATCH (whitelist, sanitize), DELETE (cleanup), auth, limits |
| `tests/api/collection-images.test.ts` | 16 | Upload cycle for all 6 routes, NULL-check, path traversal, rollback |
| `tests/api/collection-videos.test.ts` | 9 | POST (Bunny create), GET (list), DELETE (cleanup) |
| `tests/components/dealer/DealerListingForm-collection.test.tsx` | 7 | Context routing, draft key, redirect |
| `tests/app/collection/CollectionPageClient.test.tsx` | 8 | Updated: AddItemCard navigates to /collection/add |

### Test Infrastructure Notes

Vitest `vi.mock()` factories are hoisted — mock variables must be wrapped in `vi.hoisted()` to avoid temporal dead zone. `NextRequest.formData()` never resolves in jsdom — use custom `makeFormRequest()` helper. jsdom `File` lacks `arrayBuffer()` — needs polyfill.

## Files Created/Modified

### Created (14 files)
- `supabase/migrations/126_user_images_bucket.sql`
- `src/app/api/collection/images/route.ts` (replaced V1)
- `src/app/api/collection/items/route.ts` (replaced V1)
- `src/app/api/collection/items/[id]/route.ts` (replaced V1)
- `src/app/api/collection/sayagaki-images/route.ts`
- `src/app/api/collection/hakogaki-images/route.ts`
- `src/app/api/collection/koshirae-images/route.ts`
- `src/app/api/collection/provenance-images/route.ts`
- `src/app/api/collection/kanto-hibisho-images/route.ts`
- `src/app/api/collection/videos/route.ts`
- `src/app/api/collection/videos/[id]/route.ts`
- `src/app/collection/add/page.tsx`
- `src/app/collection/edit/[id]/page.tsx`
- 4 test files

### Modified (4 files)
- `src/components/dealer/DealerListingForm.tsx` — context prop + API routing
- `src/components/dealer/VideoUploadSection.tsx` — listingId type widened
- `src/contexts/VideoUploadContext.tsx` — all listingId types widened to `number | string`
- `src/components/video/VideoUploadProgress.tsx` — listingId prop widened
- `src/app/collection/CollectionPageClient.tsx` — Add button links to /collection/add

## What's Next

**Phase 2d — DisplayItem + "All Items" Tab:**
- Change `DisplayItem.id` from `number` to `string`
- Create `collectionItemToDisplayItem()` mapper
- Add "All Items" tab to collection page
- Collection cards render via existing `ListingCard`
- QuickView works for collection items
