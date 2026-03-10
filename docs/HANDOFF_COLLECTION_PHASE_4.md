# Handoff: Unified Collection Phase 4 — Open to All Users

**Date:** 2026-03-09
**Prerequisite phases:** Phase 1 (rename), 2a-2d (DB + API + form + mapper), 3 (promote/delist) — all DONE.
**Design doc:** `docs/DESIGN_UNIFIED_COLLECTION.md`
**Memory file:** `memory/unified-collection.md`

---

## Goal

Open the collection (private item cataloging) to **all authenticated users**, not just dealers. Free, unlimited cataloging with zero friction. The only paywall remains "List for Sale" (dealer tier, already gated in Phase 3).

**Why this matters:** Cataloging is the engagement hook. Collectors who catalog items become daily users. The larger the personal catalog, the higher the switching cost. Revenue comes from dealers promoting items to browse — collectors cataloging for free is the funnel that drives dealer subscriptions.

---

## Current State (What's Already Done)

The infrastructure is 95% built. Phase 4 is primarily a **UI routing and visibility** task.

### Already works for all authenticated users (no changes needed):
- `POST/GET/PATCH/DELETE /api/collection/items` — auth-only, no tier check
- All 6 image upload routes — auth-only
- Video upload routes — auth-only
- `DealerListingForm` with `context='collection'` — works without `dealer_id`
- "I Own This" button (`BrowseCTA.tsx`) — no tier check, just needs feature flag
- `collection_items` RLS — owner-based, works for any user
- `collectionRowToDisplayItem()` mapper — source-agnostic

### Intentionally dealer-only (keep restricted):
- "List for Sale" button in `CollectionCTA.tsx` / `CollectionMobileCTA.tsx` — checks `isDealer`
- `POST /api/collection/items/[id]/promote` — calls `verifyDealer()`
- Dealer inventory tabs (For Sale / On Hold / Sold) — checks `isDealer`
- `DealerCTA` / `DealerMobileCTA` — "Remove from Sale" button
- `/api/dealer/listings` — all `verifyDealer()` gated

---

## What Phase 4 Must Implement

### 1. Add "Collection" to Navigation (both platforms)

**Mobile nav** (`src/components/layout/MobileNavDrawer.tsx`):
- Lines 95-119 have dealer links inside `{isDealer && (...)}`.
- Add a "Collection" link **outside** the isDealer block, visible to **all authenticated users**.
- Place it in the authenticated user section (after "Saved Searches", before dealer links).
- Use icon: folder or archive (not the storefront icon used for dealer links).
- Link to `/collection`.
- i18n key: `nav.collection` (add to both `en.json` and `ja.json`).

**Desktop header** (`src/components/layout/Header.tsx`):
- Currently has NO collection link at all.
- Add "Collection" to the authenticated user menu/nav area.
- Same visibility rule: any authenticated user.

### 2. Enable "I Own This" for All Users

Three files gate this feature:

**`src/app/collection/page.tsx`** — ~~`NEXT_PUBLIC_COLLECTION_ENABLED` gate~~ **replaced by `yuhinkai` tier check** (2026-03-10). Collection access is now gated by `checkCollectionAccess()` in `src/lib/collection/access.ts`. The env var is dead code.

**`src/components/listing/quickview-slots/BrowseCTA.tsx`** — ~~`NEXT_PUBLIC_COLLECTION_ENABLED` check~~ **replaced by `yuhinkai` tier check** (2026-03-10). Same as above.

**`docs/HANDOFF_COLLECTION_V2_LISTINGGRID.md`** — references the env var, update if removing.

### 3. Collection Page Tab Visibility for Non-Dealers

**`src/app/collection/CollectionPageClient.tsx`** (line 347):
```typescript
{isDealer && (
  <div className="flex gap-1 ...">
    {/* tabs: Collection, For Sale, On Hold, Sold */}
  </div>
)}
```

Current behavior: non-dealers see NO tabs (just a flat list of their items).

**Target behavior:** Non-dealers see only the "Collection" tab (or no tab bar at all since they only have one view). The For Sale / On Hold / Sold tabs remain dealer-only. No paywall prompt needed for the tabs themselves — the paywall is on the "List for Sale" CTA button inside QuickView.

### 4. Empty State for New Collectors

When a non-dealer user visits `/collection` for the first time (0 items), show a welcoming empty state:
- "Start your collection" heading
- Brief explanation: "Catalog swords and fittings you own. Track provenance, add photos, organize your collection."
- Two CTAs:
  - "Add Item" — opens the add form
  - "Browse Listings" — links to `/browse` (where "I Own This" buttons live)

The existing `AddItemCard` component may already serve this role — check current implementation.

### 5. i18n Keys to Add

```json
// en.json
"nav.collection": "Collection",

// ja.json
"nav.collection": "コレクション",
```

Any new empty-state copy needs both locales.

---

## What Phase 4 Should NOT Do

- **Do NOT rename `/collection` to `/vault`** — the design doc mentions this but it's cosmetic churn. The URL is already `/collection` after Phase 1 rename. No redirect needed.
- **Do NOT change URL scheme to `/listing/[item_uuid]`** — deferred to Phase 5+. Current numeric `/listing/[id]` works. Collection items use QuickView (no dedicated URL yet).
- **Do NOT add privacy/visibility controls** — `collection_items.visibility` column exists but UI for public/private toggle is a separate feature (Phase 5+).
- **Do NOT touch RLS policies** — they already work for all users (owner-based).
- **Do NOT modify the promote/delist RPCs** — Phase 3 is complete and correct.

---

## File Map

| File | What to Change |
|------|----------------|
| `src/components/layout/MobileNavDrawer.tsx` | Add collection link for all authed users (lines 94-95 area) |
| `src/components/layout/Header.tsx` | Add collection link to desktop nav for authed users |
| `src/app/collection/page.tsx` | ~~Remove `NEXT_PUBLIC_COLLECTION_ENABLED` gate~~ — **Done** (replaced by `yuhinkai` tier check, 2026-03-10) |
| `src/components/listing/quickview-slots/BrowseCTA.tsx` | ~~Remove `NEXT_PUBLIC_COLLECTION_ENABLED` check~~ — **Done** (replaced by `yuhinkai` tier check, 2026-03-10) |
| `src/app/collection/CollectionPageClient.tsx` | Verify non-dealer UX (no tabs = fine) |
| `src/i18n/locales/en.json` | Add `nav.collection` key |
| `src/i18n/locales/ja.json` | Add `nav.collection` key |

---

## Testing Checklist

1. **Non-dealer authenticated user** can navigate to `/collection` from nav
2. **Non-dealer** can add an item via the form (POST succeeds)
3. **Non-dealer** can edit their own item (PATCH succeeds)
4. **Non-dealer** can delete their own item (DELETE succeeds)
5. **Non-dealer** sees NO dealer tabs (For Sale / On Hold / Sold)
6. **Non-dealer** does NOT see "List for Sale" button in collection QuickView
7. **Non-dealer** CAN see "I Own This" button on browse listings
8. **"I Own This"** creates collection item with `source_listing_id` set
9. **Dealer** experience unchanged — still sees all tabs, "List for Sale" button works
10. **Unauthenticated user** redirected to login when clicking collection nav link
11. **Empty state** renders correctly for new users with 0 items
12. **Mobile + desktop** nav both show collection link

---

## Risk Assessment

**Low risk.** Phase 4 is the smallest phase in the collection roadmap. The dangerous work (data isolation, cross-table writes, FK preservation, status transitions) was all done in Phases 2-3. This phase is primarily about making existing functionality visible to more users.

**One thing to watch:** The `DealerListingForm` was built for dealer context. Verify that non-dealer users don't see dealer-specific UI elements in the form (dealer name display, catalog match panel). The `context='collection'` prop should handle this, but worth a manual check.

---

## Verification After Deploy

1. Log in as a non-dealer user
2. Confirm collection link appears in both mobile drawer and desktop header
3. Visit `/collection` — should see empty state or items (not a redirect)
4. Add an item — confirm it saves and appears
5. Open a browse listing → click "I Own This" → confirm it pre-fills the collection form
6. Confirm no "List for Sale" button appears for non-dealer users
