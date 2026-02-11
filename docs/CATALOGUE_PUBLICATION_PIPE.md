# Catalogue Publication Pipe: Yuhinkai → NihontoWatch

**Status:** Data infrastructure complete. NihontoWatch UI deferred.

**Date:** 2026-02-11

**Cross-repo feature** — spans both [oshi-v2](https://github.com/0raclide/oshi-v2) and [nihontowatch](https://github.com/0raclide/nihontowatch). Identical copy of this doc lives in both repos.

---

## What It Does

Yuhinkai users document swords with photos, sayagaki transcriptions, provenance notes, and videos. The Catalogue Publication Pipe lets them "Publish to Catalogue" and have that content flow to the corresponding artist's NihontoWatch page.

**Flow:**
```
Yuhinkai item detail page
  → User clicks globe icon (Publish to Catalogue)
  → Row inserted into catalogue_publications table
  → NihontoWatch artist page queries published objects
  → CatalogueEntry[] available in page data (UI TBD)
```

---

## Database Schema

### `catalogue_publications` table (Yuhinkai Supabase)

```sql
CREATE TABLE catalogue_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_uuid UUID NOT NULL REFERENCES physical_objects(uuid) ON DELETE CASCADE,
  published_by UUID NOT NULL REFERENCES auth.users(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,                    -- Optional curator's note
  UNIQUE(object_uuid)           -- One publication per object
);
```

**Migration:** `oshi-v2/supabase/migrations/286_catalogue_publications.sql`

**RLS Policies:**
| Policy | Rule |
|--------|------|
| Public read | Anyone can SELECT (needed for NihontoWatch service role queries) |
| Owner insert | Authenticated user can INSERT where `auth.uid() = published_by` |
| Owner delete | Authenticated user can DELETE where `auth.uid() = published_by` |
| Service role | Full access for service role |

**Index:** `idx_catalogue_publications_object` on `object_uuid` (for join from `gold_values`)

---

## oshi-v2 (Yuhinkai) Side

### API Route: `/api/catalogue/publish`

**File:** `src/app/api/catalogue/publish/route.ts`

**POST — Publish an object:**
1. Auth check via `createClient()` + `getUser()`
2. Validate `objectUuid` in request body
3. Verify user has at least one `linked_records` row on this object (`.eq('created_by', user.id)`)
4. Upsert into `catalogue_publications` via `createServiceClient()`
5. Return `{ success: true }`

**DELETE — Unpublish:**
1. Auth check
2. Verify `published_by` matches current user
3. Delete from `catalogue_publications`
4. Return `{ success: true }`

### Publish Button (Item Detail Page)

**Files:**
- `src/app/item/[collection]/[volume]/[item]/ItemDetailClient.tsx` — Desktop button + state/handlers
- `src/app/item/[collection]/[volume]/[item]/ItemDetailMobile.tsx` — Mobile button
- `src/app/item/[collection]/[volume]/[item]/types.ts` — Props interface

**Behavior:**
- Only visible when `userCanEdit` (Fellowship+ tier) AND `physicalObject?.uuid` exists
- On mount: queries `catalogue_publications` via browser Supabase client (public read RLS)
- Globe icon = unpublished, Checkmark (accent color) = published
- Toggle calls the API route on click

**State:**
```typescript
const [isPublished, setIsPublished] = useState<boolean | null>(null);  // null = loading/hidden
const [publishLoading, setPublishLoading] = useState(false);
```

---

## NihontoWatch Side

### Types

**File:** `src/lib/supabase/yuhinkai.ts`

```typescript
export interface CatalogueImage {
  url: string;
  type: 'oshigata' | 'sugata' | 'art' | 'detail' | 'other' | 'photo';
  width?: number;
  height?: number;
}

export interface CatalogueEntry {
  objectUuid: string;
  collection: string;        // "Juyo", "Tokuju", etc. (highest prestige)
  volume: number;
  itemNumber: number;
  formType: string | null;   // "tachi", "katana", etc.
  images: CatalogueImage[];  // Whitelisted only (no setsumei)
  sayagakiEn: string | null;
  provenanceEn: string | null;
  curatorNote: string | null;
  contributor: {
    displayName: string;     // pseudonym > display_name > 'Member'
    avatarUrl: string | null;
  };
  publishedAt: string;
}
```

### Query Function

**File:** `src/lib/supabase/yuhinkai.ts`

```typescript
export async function getPublishedCatalogueEntries(
  artisanCode: string,
  entityType: 'smith' | 'tosogu'
): Promise<CatalogueEntry[]>
```

**Query chain:**
1. Get object UUIDs for this artisan from `gold_values` (`.eq(codeColumn, code)`)
2. Filter to published objects: `.in('object_uuid', uuids)` on `catalogue_publications`
3. For each published object, fetch in parallel:
   - `catalog_records` — highest-prestige collection entry
   - `stored_images` — catalog-level images (`image_type != 'setsumei'`)
   - `linked_records` — whitelisted types only (photo, cover_image, sayagaki, provenance)
   - `stored_images` by ID — photo images from `linked_records.image_ids`
   - `user_profiles` — contributor display info
4. Assemble `CatalogueEntry[]` sorted by collection prestige

### Whitelist Enforcement

NihontoWatch uses the Yuhinkai service role key (bypasses RLS), so whitelisting is enforced **in code**:

| Category | Allowed | Blocked |
|----------|---------|---------|
| Image types | oshigata, sugata, art, detail, other, photo | **setsumei** |
| Linked record types | photo, cover_image, sayagaki, provenance | note, market, reference, origami, kantei, video |
| Text columns | `content_en` only | **`content_jp`** (never exposed) |

### Collection Prestige Order

```typescript
const CATALOGUE_COLLECTION_PRESTIGE: Record<string, number> = {
  Tokuju: 0,   // Highest
  Juyo: 1,
  Kokuho: 2,
  JuBun: 3,
  Jubi: 4,     // Lowest
};
```

When an object has multiple catalog_records (e.g., both Juyo and Tokuju), the highest-prestige collection is picked.

### Data Wiring

**Artist page:** `src/app/artists/[slug]/page.tsx`
- `getPublishedCatalogueEntries(entityCode, entityType)` added to the existing `Promise.all` in `getArtistData()`
- Passed through as `catalogueEntries` (undefined if empty)

**API type:** `src/app/api/artisan/[code]/route.ts`
- `catalogueEntries?: CatalogueEntry[]` added to `ArtisanPageResponse` interface

**Client component:** `src/app/artists/[slug]/ArtistPageClient.tsx`
- Accepts `catalogueEntries` in data prop — **no rendering yet** (UI deferred)

---

## Key Files (Both Repos)

### oshi-v2
| File | Purpose |
|------|---------|
| `supabase/migrations/286_catalogue_publications.sql` | Table + RLS + index |
| `src/app/api/catalogue/publish/route.ts` | POST/DELETE API |
| `src/app/item/[collection]/[volume]/[item]/ItemDetailClient.tsx` | Desktop publish button + state |
| `src/app/item/[collection]/[volume]/[item]/ItemDetailMobile.tsx` | Mobile publish button |
| `src/app/item/[collection]/[volume]/[item]/types.ts` | Props interface (`isPublished`, `publishLoading`, `handleTogglePublish`) |

### nihontowatch
| File | Purpose |
|------|---------|
| `src/lib/supabase/yuhinkai.ts` | `CatalogueEntry` types + `getPublishedCatalogueEntries()` query |
| `src/app/api/artisan/[code]/route.ts` | `ArtisanPageResponse.catalogueEntries` type extension |
| `src/app/artists/[slug]/page.tsx` | Data wiring (Promise.all + prop pass-through) |
| `tests/lib/cataloguePublications.test.ts` | 11 unit tests |

---

## Testing

### Automated Tests (NihontoWatch)

**File:** `tests/lib/cataloguePublications.test.ts` — 11 tests

| Test | What it verifies |
|------|------------------|
| Empty gold_values | Returns `[]` when artisan has no objects |
| No published objects | Returns `[]` when no publications exist |
| Full assembly | Complete entry with all fields populated |
| Pseudonym fallback | `pseudonym > display_name > 'Member'` contributor resolution |
| Display name fallback | Falls back to `display_name` when pseudonym is null |
| Member fallback | Falls back to `'Member'` when both are null |
| Prestige sorting | Tokuju sorts before Jubi |
| Best collection pick | Picks Juyo over Jubi when object has both |
| No catalog records | Skips objects with no catalog_records |
| Photo image resolution | Resolves images from `linked_records.image_ids` |
| Tosogu entity type | Uses `gold_maker_id` column for tosogu |
| Null note handling | Graceful handling of null note/sayagaki/provenance |

Run: `npm test -- cataloguePublications`

### Manual Production Test

1. **Publish:** Go to any Yuhinkai item detail page where you have linked records → click globe icon → should toggle to checkmark
2. **Verify DB:** Query `catalogue_publications` via Supabase REST API
3. **Verify data chain:** Check `gold_values` for the object's artisan code → verify the NihontoWatch artist page would pick it up
4. **Unpublish:** Click checkmark again → should toggle back to globe

---

## Bug History

| Date | Bug | Root Cause | Fix |
|------|-----|------------|-----|
| 2026-02-11 | Publish button does nothing (silent 403) | API queried `.eq('user_id', ...)` but column is `created_by` | Changed to `.eq('created_by', user.id)` |

---

## Future Work

- **NihontoWatch catalogue UI** — Render `CatalogueEntry[]` on artist profile pages (photos, sayagaki, provenance, contributor credit)
- **Curator's note modal** — Optional note input when first publishing
- **Bulk publish** — Publish all documented objects for an artisan at once
- **Video support** — Pipe video linked_records through (currently filtered out)
- **Publication feed** — Activity feed of recent catalogue publications across all artisans
