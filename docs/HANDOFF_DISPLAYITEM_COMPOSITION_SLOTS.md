# DisplayItem Type + Composition Slots

**Date:** 2026-02-26
**Status:** Complete — all 4,440 tests passing, TypeScript clean

## Overview

This refactoring replaced 3 duplicate `Listing` interfaces and 11 conditional branches (`isCollection` / `source === 'collection'`) in QuickView with a **unified DisplayItem type** and **14 composition slot components**. The result is a rendering architecture where adding a third data source (e.g., dealer self-serve) requires writing new slot components — not touching the structural shells.

### Problem (before)

| Issue | Where | Impact |
|-------|-------|--------|
| 3 separate `Listing` interfaces | `ListingCard` (local), `VirtualListingGrid` (local), global `types/index.ts` | Fields diverged, `as any` casts everywhere |
| `AdaptedListing` with fake data | `adapter.ts`: `url: ''`, `dealer_id: -1`, `status: 'available'` | Semantic lies — any code checking `dealer_id` or `status` can misfire |
| 7 `isCollection` branches | `QuickViewContent.tsx` (676 lines) | Every new source would double the branching |
| 4 `source` branches | `QuickViewMobileSheet.tsx` (805 lines) | Same problem, mobile variant |
| Handler duplication | `handleInquire`, `handleDealerLinkClick`, etc. in both components | Bug fixes needed in 2 places |

### Solution (after)

1. **DisplayItem** — unified type with `source` discriminator and extension objects
2. **Mapper functions** — `listingToDisplayItem()` and `collectionItemToDisplayItem()` produce honest data
3. **Composition slots** — QuickViewContent/MobileSheet are structural shells that render `ReactNode` props
4. **QuickView.tsx orchestrator** — assembles slots based on source, passes to shells

---

## Architecture

### Data Flow

```
Browse API → Listing → listingToDisplayItem(listing, locale) → DisplayItem
                                                                    ↓
Collection API → CollectionItem → collectionItemToDisplayItem(item) → DisplayItem
                                                                    ↓
                                                              ListingCard
                                                              QuickView.tsx (orchestrator)
                                                                    ↓
                                                    ┌───────────────┼───────────────┐
                                                    ▼               ▼               ▼
                                            QuickViewContent  QuickViewMobileSheet  ...
                                            (structural shell)  (structural shell)
                                                    ↑               ↑
                                                    └── slots ──────┘
```

### Slot Architecture

QuickView.tsx (the **orchestrator**) reads `source` from context and assembles slots:

```tsx
// Desktop
<QuickViewContent
  listing={currentListing}
  actionBarSlot={isCollection ? <CollectionActionBar /> : <BrowseActionBar />}
  dealerSlot={isCollection ? <CollectionDealerRow /> : <BrowseDealerRow />}
  descriptionSlot={isCollection ? <CollectionNotes /> : <BrowseDescription />}
  provenanceSlot={isCollection ? <CollectionProvenance /> : null}
  adminToolsSlot={!isCollection && isAdmin ? <BrowseAdminTools /> : null}
  ctaSlot={isCollection ? <CollectionCTA /> : <BrowseCTA />}
/>
```

QuickViewContent and QuickViewMobileSheet are now **pure structural shells** — they render shared elements (price, cert badge, artist identity, MetadataGrid, TranslatedTitle) and insert `{slot}` at fixed positions. Zero conditional branching on source.

### Slot Components (14 total)

All in `src/components/listing/quickview-slots/`:

| Component | Context | Renders |
|-----------|---------|---------|
| `BrowseActionBar` | Desktop | Sold/hide/edit toggles, study mode, share, favorite |
| `CollectionActionBar` | Desktop | Edit, delete (with confirmation), share |
| `BrowseDealerRow` | Both | Dealer link → browse filter navigation |
| `CollectionDealerRow` | Both | "Acquired from X" + date |
| `BrowseDescription` | Desktop | TranslatedDescription with loading skeleton |
| `CollectionNotes` | Desktop | Notes as pre-wrapped text |
| `CollectionProvenance` | Desktop | Price paid, current value, condition, status |
| `BrowseAdminTools` | Desktop | AdminScoreInspector + AdminSetsumeiWidget |
| `BrowseCTA` | Desktop | Inquire + I Own This + View on Dealer + modals |
| `CollectionCTA` | Desktop | Edit + View Original |
| `BrowseMobileHeaderActions` | Mobile | Study/edit/share/favorite (with `stopPropagation`) |
| `CollectionMobileHeaderActions` | Mobile | Edit/share (with `stopPropagation`) |
| `BrowseMobileCTA` | Mobile | Inquire + View on Dealer (with touch handlers) |
| `CollectionMobileCTA` | Mobile | Edit button (with touch handlers) |

**Handler ownership:** Each slot owns its handlers and state. `BrowseCTA` includes InquiryModal + LoginModal internally. No cross-slot state sharing.

---

## DisplayItem Type

**File:** `src/types/displayItem.ts`

```typescript
interface DisplayItem {
  id: string | number;
  source: 'browse' | 'collection' | 'dealer';

  // ~60 shared fields (title, price, attribution, cert, measurements, media, artisan, status, temporal)

  // Pre-resolved dealer name (no locale logic needed at render time)
  dealer_display_name: string;
  dealer_display_name_ja?: string | null;
  dealer_domain?: string;
  dealer_id?: number | null;

  // Source-specific extensions
  browse?: BrowseExtension | null;    // url, admin_hidden, featured_score, sold_data
  collection?: CollectionExtension | null;  // notes, condition, price_paid, acquired_from, etc.
}
```

**Key design decisions:**
- `dealer_display_name` is pre-resolved at map time via `getDealerDisplayName()` — components never import locale utilities
- `browse.url` replaces the old top-level `url` field — collection items don't have URLs
- `collection.collection_status` is separate from top-level `status` — collection items always display as "available"
- `is_initial_import: true` on all collection items to suppress "New" badges

---

## Mapper Functions

### `listingToDisplayItem(listing, locale): DisplayItem`

**File:** `src/lib/displayItem/fromListing.ts`

- Accepts a structural `ListingInput` interface (handles both `dealers` and `dealer` field names from Supabase)
- Pre-resolves `dealer_display_name` via `getDealerDisplayName(dealerObj, locale)`
- Populates `browse: { url, admin_hidden, status_admin_locked, featured_score, sold_data }`
- Sets `collection: null`

### `collectionItemToDisplayItem(item): DisplayItem`

**File:** `src/lib/displayItem/fromCollectionItem.ts`

- `price_value` = `current_value ?? price_paid` (prioritizes current estimated value)
- `dealer_display_name` = `acquired_from || 'Personal Collection'`
- `artisan_confidence` = `'HIGH'` if artisan_id exists (user-verified)
- `is_initial_import: true` (suppresses "New" badge)
- `status: 'available'`, `is_available: true`, `is_sold: false` (display status, not collection status)
- Populates `collection: { notes, condition, collection_status, price_paid, ... }`
- Sets `browse: null`

---

## Files Changed

### New Files (8)

| File | Purpose |
|------|---------|
| `src/types/displayItem.ts` | Unified type + extensions |
| `src/lib/displayItem/index.ts` | Barrel exports |
| `src/lib/displayItem/fromListing.ts` | Browse mapper |
| `src/lib/displayItem/fromCollectionItem.ts` | Collection mapper |
| `src/components/listing/quickview-slots/*.tsx` (14 files) | Slot components |
| `tests/lib/displayItem/fromListing.test.ts` | 21 tests |
| `tests/lib/displayItem/fromCollectionItem.test.ts` | 27 tests |

### Refactored Files (9)

| File | Before | After | Change |
|------|--------|-------|--------|
| `QuickViewContent.tsx` | 676 lines | 228 lines | -66%, 7 branches → 0, 6 slot props |
| `QuickViewMobileSheet.tsx` | 805 lines | 474 lines | -41%, 4 branches → 0, 4 slot props |
| `QuickView.tsx` | — | +50 lines | Orchestrator: assembles 10 slots |
| `ListingCard.tsx` | Local `Listing` interface | `DisplayItem` import | Deleted 58-line interface |
| `VirtualListingGrid.tsx` | Local `Listing` interface | `DisplayItem` + `useMemo` map | Deleted 55-line interface |
| `CollectionPageClient.tsx` | `collectionItemsToListings` + `as any` | `collectionItemsToDisplayItems` | No casts |
| `FavoritesList.tsx` | `item.listing` direct | `listingToDisplayItem` + `useMemo` | Type-safe |
| `ArtisanListings.tsx` | `listing as any` | `listingToDisplayItem` + `useMemo` | No casts |
| `QuickViewContext.tsx` | — | No changes (still uses `Listing` internally) | Adapter stays for context |

### Updated Tests (4)

| File | Change |
|------|--------|
| `tests/components/listing/QuickViewContent.test.tsx` | Rewritten: 23 tests verifying slot rendering + regression guards |
| `tests/components/listing/QuickViewMobileSheet.test.tsx` | Mock slot props added, assertions updated |
| `tests/components/browse/ListingCard.test.tsx` | `mockListing` updated to `DisplayItem` shape |
| `tests/subscription/feature-gating.test.tsx` | Inquiry gating checks BrowseCTA.tsx (not QuickViewContent) |

---

## What Stays Unchanged

- **QuickViewContext** still stores `Listing` internally (for detail API fetch, merge, optimistic updates). The `collectionItemToListing` adapter is still used here — it's internal plumbing, not display code.
- **MetadataGrid**, **TranslatedTitle**, **TranslatedDescription** still accept `Listing` via structural typing — both `Listing` and `DisplayItem` have the same field names for the fields they read.
- **AdminScoreInspector**, **AdminSetsumeiWidget**, **InquiryModal** still expect `Listing` — the slot components access `currentListing` from QuickViewContext when they need to pass `Listing` to these components.

---

## Adding a Third Source (e.g., Dealer Self-Serve)

This is the payoff of the architecture. To add a dealer source:

1. **Create mapper:** `src/lib/displayItem/fromDealerItem.ts` — `dealerItemToDisplayItem()`
2. **Define extension:** Add `DealerExtension` to `displayItem.ts` (e.g., `{ listing_age, competitors, analytics_summary }`)
3. **Create slots:** `DealerActionBar`, `DealerCTA`, `DealerDealerRow`, etc.
4. **Wire in QuickView.tsx:** Add `source === 'dealer'` branches to the slot assembly section
5. **No changes to:** QuickViewContent, QuickViewMobileSheet, ListingCard, MetadataGrid, etc.

---

## What Still Uses the Old Adapter

| File | Import | Why |
|------|--------|-----|
| `src/contexts/QuickViewContext.tsx` | `collectionItemToListing` from `adapter.ts` | Context stores `Listing` internally for API compatibility |
| `tests/lib/collection/adapter.test.ts` | Tests for the old adapter | Can be deleted once QuickViewContext migrates |
| `src/lib/collection/adapter.ts` | The adapter itself | Only consumed by QuickViewContext now |

**To finish the cleanup:** Migrate QuickViewContext to store `DisplayItem` instead of `Listing`. This is optional — the adapter works correctly and is only used in one place. The rendering path already goes through `DisplayItem`.

---

## Test Coverage

| Test File | Count | What It Tests |
|-----------|-------|---------------|
| `tests/lib/displayItem/fromListing.test.ts` | 21 | All field mappings, dealer resolution (EN/JA), sold data, minimal input |
| `tests/lib/displayItem/fromCollectionItem.test.ts` | 27 | Price priority, dealer name fallback, "New" badge suppression, extensions |
| `tests/components/listing/QuickViewContent.test.tsx` | 23 | Structural shell rendering, all 6 slot insertion points, admin regression guards |
| `tests/components/listing/QuickViewMobileSheet.test.tsx` | 29 | Slot rendering, drag gestures, expand/collapse |
| `tests/components/browse/ListingCard.test.tsx` | 47 | DisplayItem rendering, cert colors, artisan badges, memo comparator |
| `tests/subscription/feature-gating.test.tsx` | 13 | Inquiry gating in BrowseCTA (moved from QuickViewContent) |

**Total: 160 tests** covering the refactored architecture.

---

## Gotchas

1. **`as any` in context:** `QuickViewContext.openCollectionQuickView` casts `collectionItemToListing(item) as unknown as Listing`. This is intentional — the context needs a `Listing` for `fetchFullListing` and `mergeDetailIntoListing`. Don't try to remove it without migrating the context.

2. **ListingCard memo comparator:** The `React.memo` comparator in `ListingCard.tsx` compares `DisplayItem` field paths. If you add new fields to `DisplayItem` that affect rendering, update the comparator.

3. **Mobile slots need `stopPropagation`:** The mobile sheet uses drag gestures. All interactive elements in mobile slots MUST call `e.stopPropagation()` on `onClick`, `onTouchStart`, and `onTouchEnd` to prevent gesture interference.

4. **`has_setsumei` cast:** `fromListing.ts` uses `(listing as any).has_setsumei` because `has_setsumei` is a generated column that exists at runtime but not in the TypeScript `Listing` type. This is safe and intentional.

5. **`BrowseCTA` owns inquiry state:** `isInquiryModalOpen` and `showLoginModal` state moved from QuickViewContent into `BrowseCTA`. The feature-gating test (`feature-gating.test.tsx`) now checks `BrowseCTA.tsx` for `canAccess('inquiry_emails')`.
