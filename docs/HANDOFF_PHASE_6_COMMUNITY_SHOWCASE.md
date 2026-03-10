# Phase 6 — Community Visibility + Collection Showcase

**Date:** 2026-03-10
**Status:** DEPLOYED to production. Migrations 133-138 applied.

---

## What Was Built

Phase 6 activates the community layer of the collection system. Collectors can share items with Yuhinkai members ("Yuhinkai" visibility) and signal availability to galleries ("Galleries" visibility). This is read-only sharing — no offers, no messaging, no notifications (deferred to Phase 7).

### Three Sub-phases

| Sub-phase | Summary | Tests |
|-----------|---------|-------|
| **6a** — Foundation | Type fix, CHECK constraint, RLS, PATCH API, visibility toggle UI | 31 (27 existing + 4 new) |
| **6b** — Browse Surface | `/showcase` page, API, DisplayItem mapper, QuickView read-only mode | 10 (mapper) |
| **6c** — Statistics | Stats API + dashboard card on `/vault` | 5 |

---

## Architecture

### Visibility Model

| UI Label | DB Value | Who Can See |
|----------|----------|-------------|
| **Private** | `private` | Owner only (default) |
| **Yuhinkai** (遊刃会) | `collectors` | `inner_circle` tier + admins |
| **Galleries** (ギャラリー) | `dealers` | `dealer` tier + admins |

**Type:** `CollectionVisibility = 'private' | 'collectors' | 'dealers'`

**Previous type (WRONG):** `'private' | 'unlisted' | 'public'` — never used, no DB data exists with old values.

### Access Control (3 layers)

1. **DB CHECK constraint** (migration 134): Rejects any value not in `('private', 'collectors', 'dealers')`
2. **RLS policies** (migrations 135 → 137 → 138):
   - `ci_collectors_read`: visibility='collectors' AND tier = 'inner_circle'
   - `ci_dealers_read`: visibility='dealers' AND tier = 'dealer'
3. **App-level** (API routes):
   - Showcase API: checks `is_admin` flag OR tier match. Admins see both visibility levels.
   - Single item GET: checks tier for non-owner access (`inner_circle` for collectors, `dealer` for dealers)

### DisplayItem Source Flow

```
browse      → crawled dealer listings (existing)
collection  → user's own collection items (existing)
dealer      → dealer's own listed items (existing)
showcase    → shared collection items from any user (NEW)
```

The `'showcase'` source triggers:
- Read-only QuickView (no edit/delete/promote buttons, no CTA, no admin tools)
- Tracking skipped (no views/impressions logged)
- Detail fetch skipped (data comes pre-loaded from showcase API)
- Owner identity shown instead of dealer name

---

## Deploy QA & Hotfixes (2026-03-10)

Seven hotfix commits during production QA:

| Commit | Issue | Fix |
|--------|-------|-----|
| `3f0b848` | Showcase API 500 "Failed to load" | `profiles!owner_id` FK join broken — replaced with separate profile query + merge |
| `3f0b848` | Incognito `/showcase` not redirecting | Added server-side auth check → redirect to `/browse` |
| `3f0b848` | Ugly stats card on `/vault` | Removed `CollectionStatsCard` from vault page |
| `3f0b848` | Confusing visibility labels | Renamed: Collectors→Yuhinkai, Dealers→Galleries (EN+JA) |
| `3f0b848` | Delete button always visible in QuickView | Removed from action bar — only accessible in edit mode |
| `549c264` | API `?tab=dealers` bypassed tier check | Added tier enforcement on dealers tab API path |
| `d38b6a5` | `inner_circle` could see Galleries items | Tightened: Galleries = dealer-only (not inner_circle) |
| `8c1e43e` | Yuhinkai visible to all paid tiers | Tightened: Yuhinkai = inner_circle-only |
| `7b1f7bd` | Showcase link cluttering nav | Removed Showcase from header + mobile drawer. Collection moved to gold position. |
| `1b00e19` | Own items excluded from showcase | Removed `.neq('owner_id', user.id)` — users see their own shared items |
| `a5dd11b` | Admin saw empty showcase | Admin's `subscription_tier` ≠ `inner_circle` — added `is_admin` bypass |

### Key Lesson: `profiles!owner_id` FK Join

`collection_items.owner_id` references `auth.users(id)`, NOT `profiles(id)`. PostgREST can't resolve the FK hint `profiles!owner_id`. Fix: query profiles separately by unique owner_ids and merge into results.

### Key Lesson: Admin Tier ≠ Admin Flag

Admin users may have any `subscription_tier` value. The `is_admin` boolean is a separate field. All tier-gated APIs that should be accessible to admins must check `is_admin` explicitly — don't assume admin tier is `inner_circle`.

---

## Migrations

| Migration | Status | Purpose |
|-----------|--------|---------|
| **133** | Applied | Drop V1 collection tables (`user_collection_items`, `user_collection_folders`) |
| **134** | Applied | CHECK constraint on visibility + partial index `idx_ci_visibility_type` |
| **135** | Applied | Initial RLS policies (superseded by 137+138) |
| **136** | Applied | Add `nakago_cm REAL` to listings |
| **137** | Applied | Fix `ci_dealers_read` → dealer-only (remove inner_circle) |
| **138** | Applied | Fix `ci_collectors_read` → inner_circle-only (remove all other paid tiers) |

---

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/134_collection_visibility_constraint.sql` | CHECK + partial index |
| `supabase/migrations/135_collection_community_rls.sql` | Initial RLS (superseded) |
| `supabase/migrations/137_fix_dealers_rls_policy.sql` | Galleries = dealer-only |
| `supabase/migrations/138_fix_collectors_rls_inner_circle_only.sql` | Yuhinkai = inner_circle-only |
| `src/app/api/showcase/route.ts` | GET — tier-filtered community browse with admin bypass |
| `src/app/api/collection/stats/route.ts` | GET — collection statistics |
| `src/app/showcase/page.tsx` | SSR shell with auth redirect |
| `src/app/showcase/ShowcasePageClient.tsx` | Client component with tabs, grid, QuickView |
| `src/lib/displayItem/fromShowcaseItem.ts` | `showcaseItemToDisplayItem()` mapper |
| `src/components/listing/quickview-slots/ShowcaseActionBar.tsx` | Owner badge + share buttons |
| `src/components/listing/quickview-slots/ShowcaseOwnerRow.tsx` | "From [name]'s collection" row |
| `src/components/listing/quickview-slots/ShowcaseMobileHeaderActions.tsx` | Mobile owner badge |
| `src/components/collection/CollectionStatsCard.tsx` | Stats summary card (created but removed from vault — available for future use) |
| `tests/lib/displayItem/showcaseMapper.test.ts` | 10 mapper tests |
| `tests/api/collection-stats.test.ts` | 5 stats API tests |

## Files Modified

| File | Change |
|------|--------|
| `src/types/collectionItem.ts` | `CollectionVisibility` type fix |
| `src/types/displayItem.ts` | Added `'showcase'` to `DisplayItemSource`, added `ShowcaseExtension` |
| `src/app/api/collection/items/[id]/route.ts` | Visibility validation + tier-based GET access |
| `src/components/listing/quickview-slots/CollectionActionBar.tsx` | Visibility toggle (Private/Yuhinkai/Galleries), delete button removed |
| `src/components/listing/quickview-slots/index.ts` | Barrel exports for 3 new slots |
| `src/components/dealer/DealerListingForm.tsx` | Visibility selector for collection context |
| `src/components/listing/QuickView.tsx` | 4-way slot routing (showcase added) |
| `src/components/listing/QuickViewModal.tsx` | Source type updated |
| `src/contexts/QuickViewContext.tsx` | `'showcase'` source support, skip fetch for showcase |
| `src/lib/displayItem/index.ts` | Barrel exports for showcase mapper |
| `src/components/layout/Header.tsx` | Showcase removed; Collection moved to gold position (right side) |
| `src/components/layout/MobileNavDrawer.tsx` | Showcase removed from mobile nav |
| `src/i18n/locales/en.json` | 22 new strings (visibility renamed to Yuhinkai/Galleries) |
| `src/i18n/locales/ja.json` | 22 new strings (遊刃会/ギャラリー) |
| `tests/api/collection-items.test.ts` | Updated for new visibility model, 4 new tests |
| `tests/lib/dealer-source-guard.test.ts` | Added `collection/stats` to known-safe list |

---

## Key Design Decisions

### 1. Price Stripping for Yuhinkai Visibility
Items shared with `visibility='collectors'` have their price **stripped** by the `showcaseItemToDisplayItem()` mapper. This prevents community showcase from becoming a price comparison tool. Items with `visibility='dealers'` retain price (that's the whole point — signaling willingness to sell).

### 2. Showcase Source vs Collection Source
Showcase items use `source='showcase'` (not `source='collection'`). This cleanly separates the read-only community view from the editable personal collection. The QuickView uses this to:
- Hide all edit/delete/promote actions
- Show owner identity instead of "Personal Collection"
- Skip behavioral tracking
- Render no CTA section

### 3. No Paywall for Showcase (Phase 6)
Free users see empty results (not 403). The `/showcase` page redirects unauthenticated users to `/browse` server-side. No paywall modal. Deferred to future phase.

### 4. Own Items Included
Users see their own shared items on `/showcase`. No self-exclusion filter. This lets users verify how their items appear to others.

### 5. Profile Query Separate from Items
`collection_items` has no direct FK to `profiles` (only to `auth.users`). Profile data (display_name, avatar_url) is fetched separately by unique owner_ids and merged into results.

### 6. Showcase Hidden from Nav
`/showcase` is accessible by URL but not linked in the header or mobile drawer. The Collection link was moved to the gold-text position on the right side of the header (same spot as dealer portal link).

---

## Known Gaps & Future Work

### Deferred to Phase 7
- [ ] **Private offers / messaging** — collectors can't contact each other through the platform yet
- [ ] **Notification on visibility change** — no email/push when someone shares an item
- [ ] **Showcase paywall modal** — currently silent empty results for non-qualifying tiers
- [ ] **Owner profile pages** — clicking owner name goes nowhere; need `/collectors/[slug]` or similar
- [ ] **Showcase filters sidebar** — currently no filter UI (only tabs). Should add item type, cert, era filters matching browse
- [ ] **Showcase facets API** — the `/api/showcase` doesn't return facets yet (needed for filter sidebar)
- [ ] **Showcase deep links** — no URL state management (`?item=UUID` not wired)
- [ ] **Artisan enrichment** — showcase items have `artisan_display_name: null` (mapper doesn't call Yuhinkai)
- [ ] **Visibility change audit event** — the visibility PATCH logs a generic "updated" event
- [ ] **Re-add Showcase to nav** — currently hidden; add back when there's enough community content
- [ ] **Stats card redesign** — `CollectionStatsCard` exists but removed from vault (too ugly). Redesign before re-adding.

### Performance Considerations
- Profile query is separate (not a join) — adds one extra DB round-trip per showcase page load
- The `/api/collection/stats` fetches ALL collection items to compute aggregates. For users with >1000 items, consider an RPC with SQL aggregation.
- The `idx_ci_visibility_type` partial index (migration 134) should handle community browse queries efficiently.

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

    // Profile (merged separately, not FK join)
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

## Access Matrix (Updated 2026-03-10)

> **Note:** Old tiers `yuhinkai`, `enthusiast`, `collector` removed (migration 139). Only 3 tiers remain.

| Tier | Own Collection | Showcase (Yuhinkai) | Showcase (Galleries) | Stats |
|------|---------------|---------------------|---------------------|-------|
| free | - | - | - | - |
| inner_circle | Yes | **Yes** | - | Yes |
| dealer | Yes | - | **Yes** | Yes |
| **admin** | Yes | **Yes** | **Yes** | Yes |

---

## Test Coverage

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `tests/api/collection-items.test.ts` | 27 (4 new) | Visibility access: collectors+tier, collectors+free, dealers+enthusiast, dealers+dealer |
| `tests/lib/displayItem/showcaseMapper.test.ts` | 10 | Price stripping, owner identity, null handling, cert parsing, batch mapping |
| `tests/api/collection-stats.test.ts` | 5 | Auth, visibility breakdown, type/cert distribution, empty collection, null fields |

**Full suite:** 5,379 passing, 2 pre-existing failures (flaky LoginModal timing + network-dependent integration test).

---

## i18n Keys

```
collection.visibility.label / private / collectors / dealers
collection.visibility.privateHint / collectorsHint / dealersHint
nav.showcase
showcase.title / empty / emptyDealers / tabCommunity / tabDealers
showcase.ownerCollection / fromCollector
stats.totalItems / visibility / byType / byCert / listedForSale / sold
```

**Display values:**
- EN: Private / Yuhinkai / Galleries
- JA: 非公開 / 遊刃会 / ギャラリー

All keys present in both `en.json` and `ja.json`.
