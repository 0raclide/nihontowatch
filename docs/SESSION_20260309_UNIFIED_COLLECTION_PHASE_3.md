# Session: Unified Collection Phase 3 — Promote/Delist Transit

**Date:** 2026-03-09
**Duration:** ~25 minutes
**Scope:** Bridge between private collection and public listings

---

## What Was Built

Phase 3 adds the transit layer between `collection_items` (private) and `listings` (public). Three Postgres RPCs, two API endpoints, UI actions in QuickView CTAs, and dealer-facing tabs on the collection page.

### Files Created (9)
| File | Purpose |
|------|---------|
| `supabase/migrations/127_add_thickness_mm_to_listings.sql` | Schema gap fix |
| `supabase/migrations/128_promote_to_listing.sql` | Promote RPC (182 lines) |
| `supabase/migrations/129_delist_to_collection.sql` | Delist RPC (94 lines) |
| `supabase/migrations/130_delete_collection_item.sql` | Delete+cleanup RPC (44 lines) |
| `src/app/api/collection/items/[id]/promote/route.ts` | Promote endpoint |
| `src/app/api/listings/[id]/delist/route.ts` | Delist endpoint |
| `src/components/dealer/PromoteToListingModal.tsx` | Price prompt modal |
| `tests/api/promote-delist.test.ts` | 29 golden tests |
| `docs/SESSION_20260309_UNIFIED_COLLECTION_PHASE_3.md` | This doc |

### Files Modified (8)
| File | Change |
|------|--------|
| `src/components/listing/quickview-slots/CollectionCTA.tsx` | Added "List for Sale" (dealer-tier) |
| `src/components/listing/quickview-slots/CollectionMobileCTA.tsx` | Same for mobile |
| `src/components/listing/quickview-slots/DealerCTA.tsx` | Added "Remove from Sale" (when item_uuid set) |
| `src/components/listing/quickview-slots/DealerMobileCTA.tsx` | Same for mobile |
| `src/components/listing/QuickView.tsx` | Pass `collectionItem` to mobile CTA |
| `src/app/collection/CollectionPageClient.tsx` | Dealer tabs (Collection/For Sale/Hold/Sold) |
| `src/app/api/dealer/listings/route.ts` | Exclude DELISTED from inventory tab |
| `src/app/api/cron/compute-focal-points/route.ts` | Skip non-available listings |

### i18n Keys Added (7)
- `dealer.removeFromSale` / `dealer.promoteTitle` / `dealer.promoteDesc`
- `collection.tabCollection` / `collection.tabForSale` / `collection.tabOnHold` / `collection.tabSold`

---

## Key Decisions

### 1. Re-promote via UPDATE, not DELETE+INSERT
The promote RPC checks for an existing DELISTED ghost listing with the same `item_uuid`. If found, it UPDATEs that row instead of creating a new one. This preserves `listing.id` — meaning all FK relationships (favorites, price_history, views, impressions) survive a delist→re-promote round-trip. This is the single most important architectural choice in Phase 3.

### 2. Soft-delist, not hard delete
Delisting sets `status='DELISTED', is_available=false, featured_score=0` but does NOT delete the listing row. Six FK tables reference `listing.id` with cascade or restrict constraints. Hard-deleting would destroy behavioral data and break favorites. The DELISTED ghost is invisible to browse (RLS + API filters) but preserves the FK graph.

### 3. `SECURITY DEFINER` RPCs
Both promote and delist write to tables that the authenticated user doesn't have direct access to (cross-table writes between `collection_items` and `listings`). Using `SECURITY DEFINER` lets the RPC execute with elevated privileges while the API layer enforces ownership checks before calling it.

### 4. `FOR UPDATE` row locking
All three RPCs use `SELECT ... FOR UPDATE` to prevent concurrent operations on the same item. Two promote calls for the same collection item would race without this — one would succeed and the other would find the item already deleted.

### 5. Collection page tabs reuse existing dealer API
Rather than building a new API for "dealer's listings visible in collection context", the tabs simply call `/api/dealer/listings?tab=available` (etc.) and convert results via `dealerListingToDisplayItem()`. Zero new backend code for the tabs.

---

## Schema Gap Discovered

`thickness_mm` was defined in the TypeScript `Listing` type and in `collection_items` (migration 120) but never added to the `listings` table. The column was in `SHARED_COLUMNS` and passed all TS type checks, but would have caused a silent null on any actual DB write. The `QUICKVIEW_METADATA.md` doc even noted "Not in DB" but the migration was never created. Fixed with migration 127.

---

## Bugs Fixed (opportunistic)

1. **Dealer listings inventory tab showed DELISTED items.** The inventory case had `.eq('is_available', false).eq('is_sold', false).neq('status', 'HOLD')` which matched DELISTED. Added `.neq('status', 'DELISTED')`.

2. **Focal points cron processed unavailable listings.** The 500/run cap was being consumed by sold/withdrawn/delisted items. Added `.eq('is_available', true)`.

---

## What I'd Do Differently

### 1. Write the column-parity test FIRST
The golden test that reads the SQL migrations and asserts every `SHARED_COLUMNS` entry appears in the RPC was the single highest-value test. It would have caught the `thickness_mm` gap before I even wrote the RPCs. In hindsight, I should have started with that test, discovered the schema gap via test failure, then written the migration to fix it. TDD for SQL schema alignment is underused.

### 2. Extract a shared delist hook instead of duplicating in DealerCTA + DealerMobileCTA
Both `DealerCTA` and `DealerMobileCTA` got identical `handleDelist` logic (fetch, error state, setTimeout clear, CustomEvent dispatch). This is the same duplication pattern that `useDealerStatusChange` already solved for status changes. I should have created a `useDelistAction` hook (or extended the existing hook) instead of inlining 15 lines of identical fetch logic in both components. Low risk since both are thin wrappers, but it's the kind of copy-paste that drifts over time.

### 3. The tab implementation is minimal — intentionally
The collection page tabs don't have filter integration for dealer tabs (no sidebar, no facets). This is fine for now because the dealer listings are small (10s of items, not 1000s), but if we ever surface scraped listings in these tabs (Phase 5?), we'd need proper faceting. A more future-proof approach would have been to route through a unified API that returns facets regardless of source. Deferred because YAGNI — dealer-only tabs don't need facets yet.

### 4. Confirm dialog for delist
"Remove from Sale" immediately calls the API with no confirmation. This is a reversible action (re-promote restores everything), so a confirmation dialog would be friction without value. But some dealers might find it jarring — a listing disappearing from browse with one tap. If we get feedback, add a lightweight confirm (not a modal — just an inline "Are you sure?" toggle).

### 5. The PromoteToListingModal duplicates ListForSaleModal
~80% of the code is identical (price input, currency selector, Ask checkbox, portal, escape handler). I considered making `ListForSaleModal` accept a generic `onSubmit` prop instead of hardcoding the PATCH endpoint, but that would have changed an existing component's interface for a new consumer. The duplication is clear and bounded — if a third modal needs the same pattern, that's the signal to extract a shared `PriceInputModal` shell.

### 6. Browse API `tab=all` still returns DELISTED
The plan noted this as a minor gap. The `tab=all` URL param isn't linked anywhere in the UI, but a savvy user could construct it. Adding `.neq('status', 'DELISTED')` to the browse API's base query would be a one-line fix. Deferred because it has no user-facing impact and the browse API is already complex enough.

---

## Test Strategy

29 tests split across 4 categories:

1. **SQL parity (2 tests):** Read migration files, assert every `SHARED_COLUMNS` entry appears in the RPC SQL. Catches column drift between TS types and SQL.

2. **Promote API (7 tests):** 401 (unauthenticated), 403 (not dealer), 404 (item not found), 403 (wrong owner), success with RPC params, null price passthrough, elite sync call verification.

3. **Delist API (7 tests):** 400 (invalid ID), 401, 404, 403 (wrong owner), 400 (not dealer source), 400 (already delisted), success with RPC params.

4. **SQL structure (13 tests):** SECURITY DEFINER presence, FOR UPDATE locking, audit event types, item_videos cleanup, is_initial_import=false, re-promote path, featured_score=0 on delist, DELISTED ghost deletion, thickness_mm migration existence, dealer inventory DELISTED exclusion.

The SQL structure tests are source-file assertions (read the .sql file and check for strings). This is deliberately brittle — if someone refactors the SQL, the test fails and forces a review. That's the point.

---

## Verification

- `tsc --noEmit` — 0 errors
- `vitest run` — 5301 passed, 29 new, 1 pre-existing timeout (search concordance, unrelated)
- Manual flow: create collection item → QuickView → "List for Sale" → price modal → confirm → item appears in browse → "Remove from Sale" → returns to collection → re-promote → same listing_id preserved
