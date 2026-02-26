# Collection V2: Shared ListingGrid Integration

**Date:** 2026-02-26
**Status:** Complete — live at nihontowatch.com/collection, all tests passing
**Commits:** `3b5cc01`, `8e4f7b8`, `62ed3c0`

## Overview

Replaced the collection page's hand-coded grid with the shared `ListingGrid` / `VirtualListingGrid` infrastructure. Collection items now render through the same `ListingCard` → `DisplayItem` pipeline as browse, gaining all visual improvements (smart crop, cert colors, artisan badges, JA metadata) automatically. Also deleted the dead `adapter.ts` bridge code and added deep link support.

### Problem (before)

| Issue | Where | Impact |
|-------|-------|--------|
| Hand-coded `<div className="grid ...">` | `CollectionPageClient.tsx` | No virtual scroll, no loading skeleton, no empty state |
| `collectionItemToListing` adapter | `adapter.ts` (114 lines) | Fabricated fake data (`url: ''`, `dealer_id: -1`) — semantic lies |
| No deep linking | Collection page | Can't share/bookmark specific items via `?item=UUID` |
| Double mapping | VirtualListingGrid always ran `listingToDisplayItem()` | Collection items already mapped to `DisplayItem` — wasted work |

### Solution (after)

1. **Three new props** on `VirtualListingGrid` / `ListingGrid`: `preMappedItems`, `onCardClick`, `appendSlot`
2. **CollectionPageClient** uses `<ListingGrid>` with pre-mapped `DisplayItem[]` and `AddItemCard` via `appendSlot`
3. **Deep link handler** for `?item=UUID` auto-opens QuickView on page load
4. **Dead adapter deleted** — `QuickViewContext` now uses `collectionItemToDisplayItem()` directly

---

## Architecture

### New Props on ListingGrid / VirtualListingGrid

| Prop | Type | Purpose |
|------|------|---------|
| `preMappedItems` | `DisplayItem[]` | Bypass internal `listingToDisplayItem()` — items already mapped |
| `onCardClick` | `(item: DisplayItem) => void` | Override default `openQuickView()` — route to `openCollectionQuickView()` |
| `appendSlot` | `ReactNode` | Render after last card in grid (used for `AddItemCard` "+" button) |

### Data Flow

```
Collection API → CollectionItem[]
    │
    ▼
collectionItemToDisplayItem() (from DisplayItem refactor)
    │
    ▼
ListingGrid (preMappedItems={adaptedItems})
    │
    ├── VirtualListingGrid (skips internal listingToDisplayItem)
    │   ├── ListingCard × N
    │   └── AddItemCard (via appendSlot)
    │
    └── onCardClick → look up original CollectionItem → openCollectionQuickView()
```

### Deep Link Handler

`?item=UUID` in the URL auto-opens QuickView for that item on page load:

```typescript
const deepLinkHandledRef = useRef(false);
useEffect(() => {
  if (deepLinkHandledRef.current || isLoading || items.length === 0) return;
  const itemId = searchParams.get('item');
  if (!itemId) return;
  const match = items.find(i => i.id === itemId);
  if (match) {
    deepLinkHandledRef.current = true;
    quickView.openCollectionQuickView(match, 'view');
  }
}, [items, isLoading, searchParams, quickView]);
```

The ref guard prevents re-opening on re-renders. Items must be loaded before the deep link can resolve.

---

## Files Changed

### Modified Files (4)

| File | Change |
|------|--------|
| `src/components/browse/VirtualListingGrid.tsx` | Added `preMappedItems`, `onCardClick`, `appendSlot` props; skip internal `setListings` when preMappedItems provided |
| `src/components/browse/ListingGrid.tsx` | Pass-through for 3 new props; empty state checks `preMappedItems.length`; skip empty state when `appendSlot` provided |
| `src/app/collection/CollectionPageClient.tsx` | Replaced manual grid with `<ListingGrid>`; added deep link handler; `handleCardClick` looks up original `CollectionItem` by ID |
| `src/contexts/QuickViewContext.tsx` | Swapped `collectionItemToListing` import → `collectionItemToDisplayItem` |

### Deleted Files (2)

| File | Lines | Reason |
|------|-------|--------|
| `src/lib/collection/adapter.ts` | 114 | Dead code — only consumer was QuickViewContext, now uses `collectionItemToDisplayItem()` |
| `tests/lib/collection/adapter.test.ts` | 251 | Tests for deleted adapter |

### New Test Files (2)

| File | Tests | What It Tests |
|------|-------|---------------|
| `tests/components/browse/ListingGrid.collection.test.tsx` | 6 | appendSlot rendering, preMappedItems bypass, onCardClick override, empty+appendSlot, loading state |
| `tests/app/collection/CollectionPageClient.test.tsx` | 8 | ListingGrid integration, preMappedItems passing, AddItemCard via appendSlot, card click routing, deep link ?item=UUID (match/no-match), J/K navigation setup |

---

## What Stays Unchanged (intentionally)

| Component | Reason |
|-----------|--------|
| `CollectionFilterContent.tsx` | Different filter paradigm (single-select toggles vs browse's multi-select arrays) — not worth merging |
| `CollectionBottomBar.tsx` | 71 lines with collection-specific Add button and sort options |
| `CollectionFormContent.tsx` | Unique add/edit form — genuinely collection-specific |
| `CatalogSearchBar.tsx` | Yuhinkai catalog search — the killer feature |
| `ImageUploadZone.tsx` | Collection-only image upload |
| `AddItemCard.tsx` | 36 lines, grid "+" card — now rendered via `appendSlot` |

---

## Gotchas

1. **`preMappedItems` skips `setListings`**: When `preMappedItems` is provided, VirtualListingGrid does NOT call `quickView.setListings()` — the parent (`CollectionPageClient`) manages its own `setListings` call with the adapted items. This prevents a conflict where both would try to set the navigation array.

2. **`handleCardClick` needs original CollectionItem**: `onCardClick` receives a `DisplayItem`, but `openCollectionQuickView` needs the original `CollectionItem`. The handler does a `items.find(i => i.id === displayItem.id)` lookup. This works because `DisplayItem.id` preserves the UUID from `CollectionItem.id`.

3. **Empty state + appendSlot**: When `preMappedItems` is empty but `appendSlot` is provided, ListingGrid renders the grid (with just the appendSlot) instead of the empty state. This lets the "+" AddItemCard show even when the collection is empty.

4. **`as unknown as Listing` cast in QuickViewContext**: The context still stores `Listing` internally. `collectionItemToDisplayItem(item) as unknown as Listing` is the bridge. This is inherited from the DisplayItem refactor — the proper fix is migrating QuickViewContext to store `DisplayItem` natively (deferred).

5. **Feature flag**: `/collection` requires `NEXT_PUBLIC_COLLECTION_ENABLED=true` in env vars. Without it, the server component redirects to `/browse`. Set in both `.env.local` and Vercel production env vars.

---

## Test Coverage

| Test File | Count | Key Assertions |
|-----------|-------|----------------|
| `ListingGrid.collection.test.tsx` | 6 | appendSlot renders after cards, preMappedItems bypasses internal mapping, onCardClick fires with DisplayItem, empty collection shows appendSlot not empty state |
| `CollectionPageClient.test.tsx` | 8 | ListingGrid receives adapted items, AddItemCard in appendSlot, click routes through openCollectionQuickView, deep link ?item=UUID opens matching item, non-matching UUID silently ignored, J/K navigation array set |

**Total: 14 new tests** for collection grid integration.

---

## What's Next (deferred)

| Task | Priority | Notes |
|------|----------|-------|
| Delete remaining V1 collection components | Medium | `CollectionCard`, `CollectionGrid`, `CollectionQuickView`, `CollectionItemContent`, `CollectionMobileSheet`, `CollectionFilterSidebar`, `CollectionFilterDrawer` — all ~1,070 lines, fully replaced by shared infrastructure |
| Migrate QuickViewContext to store DisplayItem | Low | Eliminates the `as unknown as Listing` cast |
| "I Own This" instant import | Medium | One-click from browse → instant creation → toast → owned indicator on browse card |
| Filter sidebar unification | Low | Different paradigms (single-select vs multi-select) — negative ROI to merge |
