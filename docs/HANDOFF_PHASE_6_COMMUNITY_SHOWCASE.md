# Phase 6 — Community Visibility + Collection Showcase

**Date:** 2026-03-10
**Status:** Implementation complete, NOT YET DEPLOYED
**Migrations:** 134, 135 (need `supabase db push` or production apply)

---

## What Was Built

Phase 6 activates the community layer of the collection system. Collectors can now share items with other collectors ("Collector Showcase") and signal availability to dealers ("Available from Collectors"). This is read-only sharing — no offers, no messaging, no notifications (deferred to Phase 7).

### Three Sub-phases

| Sub-phase | Summary | Tests |
|-----------|---------|-------|
| **6a** — Foundation | Type fix, CHECK constraint, RLS, PATCH API, visibility toggle UI | 31 (27 existing + 4 new) |
| **6b** — Browse Surface | `/showcase` page, API, DisplayItem mapper, QuickView read-only mode | 10 (mapper) |
| **6c** — Statistics | Stats API + dashboard card on `/vault` | 5 |

---

## Architecture

### Visibility Model

```
private    → Only the owner can see (default, unchanged behavior)
collectors → Any authenticated user with collection_access tier (yuhinkai+)
dealers    → Only dealer + inner_circle tier users
```

**Type:** `CollectionVisibility = 'private' | 'collectors' | 'dealers'`

**Previous type (WRONG):** `'private' | 'unlisted' | 'public'` — never used, no DB data exists with old values.

### Access Control (3 layers)

1. **DB CHECK constraint** (migration 134): Rejects any value not in `('private', 'collectors', 'dealers')`
2. **RLS policies** (migration 135): Two SELECT policies on `collection_items`:
   - `ci_collectors_read`: visibility='collectors' AND user tier IN (yuhinkai, enthusiast, collector, inner_circle, dealer)
   - `ci_dealers_read`: visibility='dealers' AND user tier IN (dealer, inner_circle)
3. **App-level** (API route): GET `/api/collection/items/[id]` checks tier for non-owner access

### DisplayItem Source Flow

```
browse      → crawled dealer listings (existing)
collection  → user's own collection items (existing)
dealer      → dealer's own listed items (existing)
showcase    → other users' shared collection items (NEW)
```

The `'showcase'` source triggers:
- Read-only QuickView (no edit/delete/promote buttons, no CTA, no admin tools)
- Tracking skipped (no views/impressions logged)
- Detail fetch skipped (data comes pre-loaded from showcase API)
- Owner identity shown instead of dealer name

---

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/134_collection_visibility_constraint.sql` | CHECK + partial index |
| `supabase/migrations/135_collection_community_rls.sql` | 2 RLS SELECT policies |
| `src/app/api/showcase/route.ts` | GET — tier-filtered community browse |
| `src/app/api/collection/stats/route.ts` | GET — collection statistics |
| `src/app/showcase/page.tsx` | SSR shell |
| `src/app/showcase/ShowcasePageClient.tsx` | Client component with tabs, grid, QuickView |
| `src/lib/displayItem/fromShowcaseItem.ts` | `showcaseItemToDisplayItem()` mapper |
| `src/components/listing/quickview-slots/ShowcaseActionBar.tsx` | Owner badge + share buttons |
| `src/components/listing/quickview-slots/ShowcaseOwnerRow.tsx` | "From [name]'s collection" row |
| `src/components/listing/quickview-slots/ShowcaseMobileHeaderActions.tsx` | Mobile owner badge |
| `src/components/collection/CollectionStatsCard.tsx` | Stats summary card |
| `tests/lib/displayItem/showcaseMapper.test.ts` | 10 mapper tests |
| `tests/api/collection-stats.test.ts` | 5 stats API tests |

## Files Modified

| File | Change |
|------|--------|
| `src/types/collectionItem.ts:18` | `CollectionVisibility` type fix |
| `src/types/displayItem.ts` | Added `'showcase'` to `DisplayItemSource`, added `ShowcaseExtension` |
| `src/app/api/collection/items/[id]/route.ts` | Visibility validation + tier-based GET access |
| `src/components/listing/quickview-slots/CollectionActionBar.tsx` | Added segmented visibility toggle |
| `src/components/listing/quickview-slots/index.ts` | Barrel exports for 3 new slots |
| `src/components/dealer/DealerListingForm.tsx` | Visibility selector for collection context |
| `src/components/listing/QuickView.tsx` | 4-way slot routing (showcase added) |
| `src/components/listing/QuickViewModal.tsx` | Source type updated |
| `src/contexts/QuickViewContext.tsx` | `'showcase'` source support, skip fetch for showcase |
| `src/lib/displayItem/index.ts` | Barrel exports for showcase mapper |
| `src/components/layout/Header.tsx` | "Showcase" nav link |
| `src/components/layout/MobileNavDrawer.tsx` | "Showcase" nav link (with people icon) |
| `src/app/vault/CollectionPageClient.tsx` | Stats card above grid |
| `src/i18n/locales/en.json` | 22 new strings |
| `src/i18n/locales/ja.json` | 22 new strings |
| `tests/api/collection-items.test.ts` | Updated for new visibility model, 4 new tests |

---

## Key Design Decisions

### 1. Price Stripping for Collectors Visibility
Items shared with `visibility='collectors'` have their price **stripped** by the `showcaseItemToDisplayItem()` mapper. This prevents community showcase from becoming a price comparison tool. Items with `visibility='dealers'` retain price (that's the whole point — signaling willingness to sell).

### 2. Showcase Source vs Collection Source
Showcase items use `source='showcase'` (not `source='collection'`). This cleanly separates the read-only community view from the editable personal collection. The QuickView uses this to:
- Hide all edit/delete/promote actions
- Show owner identity instead of "Personal Collection"
- Skip behavioral tracking
- Render no CTA section

### 3. No Paywall for Showcase (Phase 6)
Free users get 403 from the API, but there's no paywall modal. The nav link is hidden behind `collection_access` feature gate. This matches the pattern established for `/vault` in Phase 5.

### 4. Stats Card Defensive Rendering
`CollectionStatsCard` guards against malformed API responses with `!stats.by_visibility` check. This prevents crashes when test mocks or unexpected API responses are received. The card returns null for empty collections (no unnecessary chrome).

---

## Known Gaps & Future Work

### Must Do Before Deploy
- [ ] **Run migrations 134 + 135** against production Supabase
- [ ] **Verify RLS policies** don't conflict with existing `collection_items` policies
- [ ] **Manual QA**: Create items with different visibilities, verify they appear correctly on `/showcase` for correct tiers

### Deferred to Phase 7
- [ ] **Private offers / messaging** — collectors can't contact each other through the platform yet
- [ ] **Notification on visibility change** — no email/push when someone shares an item
- [ ] **Showcase paywall modal** — currently silent redirect for free users
- [ ] **Owner profile pages** — clicking owner name goes nowhere; need `/collectors/[slug]` or similar
- [ ] **Showcase filters sidebar** — currently no filter UI (only tabs). Should add item type, cert, era filters matching browse
- [ ] **Showcase facets API** — the `/api/showcase` doesn't return facets yet (needed for filter sidebar)
- [ ] **Showcase deep links** — no URL state management (`?item=UUID` not wired)
- [ ] **Artisan enrichment** — showcase items have `artisan_display_name: null` (mapper doesn't call Yuhinkai). Low priority since showcase is community items, not dealer inventory.
- [ ] **Visibility change audit event** — the visibility PATCH logs a generic "updated" event. Could add specific `visibility_changed` event type.

### Performance Considerations
- The `/api/showcase` query joins `profiles` for display_name/avatar_url. If showcase grows large, consider denormalizing owner name into `collection_items`.
- The `/api/collection/stats` fetches ALL collection items for the user to compute aggregates. For users with >1000 items, consider an RPC with SQL aggregation.
- The `idx_ci_visibility_type` partial index (migration 134) should handle the community browse queries efficiently.

---

## Showcase API Response Shape

```typescript
// GET /api/showcase?tab=community&page=1&limit=50
{
  data: Array<{
    // All collection_items columns
    id: string;
    item_uuid: string;
    owner_id: string;
    visibility: 'collectors' | 'dealers';
    title: string | null;
    item_type: string | null;
    // ... all other item fields

    // Profile JOIN
    profiles: {
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  }>;
  total: number;
  page: number;
  limit: number;
}
```

## Stats API Response Shape

```typescript
// GET /api/collection/stats
{
  total_items: number;
  by_visibility: { private: number; collectors: number; dealers: number };
  by_type: Record<string, number>;   // e.g. { KATANA: 5, TSUBA: 3 }
  by_cert: Record<string, number>;   // e.g. { juyo: 2, hozon: 4 }
  listed_for_sale: number;            // from listings WHERE owner_id = me AND is_available
  sold: number;                       // from listings WHERE owner_id = me AND is_sold
}
```

---

## Access Matrix

| Tier | Own Collection | Showcase (collectors) | Showcase (dealers) | Stats |
|------|---------------|----------------------|-------------------|-------|
| free | - | - | - | - |
| yuhinkai | Yes | Yes | - | Yes |
| enthusiast | Yes | Yes | - | Yes |
| collector | Yes | Yes | - | Yes |
| inner_circle | Yes | Yes | Yes | Yes |
| dealer | Yes | Yes | Yes | Yes |

---

## Test Coverage

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `tests/api/collection-items.test.ts` | 27 (4 new) | Visibility access: collectors+tier, collectors+free, dealers+enthusiast, dealers+dealer |
| `tests/lib/displayItem/showcaseMapper.test.ts` | 10 | Price stripping, owner identity, null handling, cert parsing, batch mapping |
| `tests/api/collection-stats.test.ts` | 5 | Auth, visibility breakdown, type/cert distribution, empty collection, null fields |

**Full suite:** 5,379 passing, 2 pre-existing failures (network-dependent integration tests).

---

## i18n Keys Added

```
collection.visibility.label / private / collectors / dealers
collection.visibility.privateHint / collectorsHint / dealersHint
nav.showcase
showcase.title / empty / emptyDealers / tabCommunity / tabDealers
showcase.ownerCollection / fromCollector
stats.totalItems / visibility / byType / byCert / listedForSale / sold
```

All keys present in both `en.json` and `ja.json`.
