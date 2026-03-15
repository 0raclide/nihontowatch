# Handoff: Unified Collection Phase 4 — Inner Circle + Dealer Only

**Date:** 2026-03-10 (created), 2026-03-14 (trial-exempt + showcase gate)
**Prerequisite phases:** Phase 1 (rename), 2a-2d (DB + API + form + mapper), 3 (promote/delist), 5 (route migration + cleanup) — all DONE.
**Design doc:** `docs/DESIGN_UNIFIED_COLLECTION.md`

---

## Decision

The vault (`/vault`) and showcase (`/showcase`) are restricted to **Inner Circle**, **Dealer**, and **Admin** users only. They are **not** open to all authenticated users.

**Rationale:** The vault is a premium feature. Opening it to all users is deferred until a future phase when the business case is clearer. For now it remains an exclusive perk of the highest-tier subscriptions plus dealers who need inventory management.

---

## Current Access Model

| Tier | Vault + Showcase Access | Mechanism |
|------|------------------------|-----------|
| free | **NO** | `canAccessFeature('free', 'collection_access')` → false |
| **inner_circle** | **YES** | `FEATURE_MIN_TIER.collection_access = 'inner_circle'` |
| **dealer** | **YES** | Special case: explicit `collection_access` grant |
| **admin** | **YES** | Role bypass in `checkCollectionAccess()` / page-level `isAdmin` check |
| **trial mode** | **NO** | `collection_access` is **trial-exempt** (see below) |

> **Note (2026-03-10):** The old tiers `enthusiast`, `collector`, and `yuhinkai` were removed (migration 139). Only 3 tiers remain: `free`, `inner_circle`, `dealer`.

### Trial Mode Exemption (2026-03-14)

`collection_access` is listed in `TRIAL_EXEMPT_FEATURES` in `subscription.ts`. When `NEXT_PUBLIC_TRIAL_MODE=true`, all other features bypass tier checks, but `collection_access` still requires `inner_circle` / `dealer` / `admin`. This means free users **cannot** access vault or showcase even during trial periods.

**Why:** Trial mode exists to let all users try browse-level features (alerts, setsumei, artist stats, etc.). Vault + showcase are premium-exclusive and should never be opened by trial mode.

### Key files

| Component | Location |
|-----------|----------|
| Feature min tier | `src/types/subscription.ts` (`FEATURE_MIN_TIER.collection_access = 'inner_circle'`) |
| Trial exemption | `src/types/subscription.ts` (`TRIAL_EXEMPT_FEATURES = ['collection_access']`) |
| `canAccessFeature()` | `src/types/subscription.ts` (dealer special case includes `collection_access`) |
| API gating | `src/lib/collection/access.ts` (`checkCollectionAccess()`) — all 15 collection API routes |
| Tests (7) | `tests/lib/collection/access.test.ts` |

---

## What's Enforced

### Vault (`/vault`)

#### Server-side (page + API)
- `/vault` page: fetches profile, checks `canAccessFeature(effectiveTier, 'collection_access')` → redirects to `/browse` if denied
- `checkCollectionAccess()` called in all 15+ collection API routes → returns 403 for unauthorized tiers
- Admin bypass via `role === 'admin'` check

#### Client-side (UI gating)
- Vault nav pill (desktop Header + mobile MobileNavDrawer): hidden unless `canAccess('collection_access')`
- "I Own This" button in browse QuickView (BrowseCTA + BrowseMobileCTA): hidden unless `user && canAccess('collection_access')`

### Showcase (`/showcase`)

#### Server-side (page + API)
- `/showcase` page: fetches profile, checks `canAccessFeature(effectiveTier, 'collection_access')` → redirects to `/browse` if denied (added 2026-03-14)
- `/api/showcase` API: visibility-filtered by tier (free tier gets empty array, inner_circle sees collectors, dealer sees dealers)

#### Client-side (UI gating)
- Showcase nav link (desktop Header + mobile MobileNavDrawer): hidden unless `canAccess('collection_access')` (added 2026-03-14)
- `HeaderFallback` (SSR skeleton): showcase link removed entirely (no hooks available pre-hydration)

---

## Future Consideration: Opening to All Users

When/if the decision is made to open the vault more broadly:

1. **Remove `collection_access` from `TRIAL_EXEMPT_FEATURES`** if trial mode should grant access
2. **Lower `FEATURE_MIN_TIER.collection_access`** from `'inner_circle'` to `'free'` to open to all users
3. **Remove showcase page tier gate** in `src/app/showcase/page.tsx`
4. **Remove nav link gating** for showcase in Header + MobileNavDrawer
5. **Add empty state** for new collectors (0 items)
6. **Add paywall** if gating at a paid tier (currently silent redirect)
7. **Update tests** in `tests/lib/collection/access.test.ts`

---

## Changes Made

### 2026-03-10 (initial restriction)

| File | Change |
|------|--------|
| `src/types/subscription.ts` | `FEATURE_MIN_TIER.collection_access = 'inner_circle'` |
| `src/types/subscription.ts` | `canAccessFeature()`: dealer gets explicit `collection_access` grant |
| `src/lib/collection/access.ts` | Updated doc comment (required tiers: inner_circle, dealer, admin) |
| `tests/lib/collection/access.test.ts` | 9 tests: free denied, inner_circle/dealer allowed, admin bypass, trial mode |
| `docs/HANDOFF_COLLECTION_PHASE_4.md` | Created — inner_circle+dealer+admin restriction |

### 2026-03-14 (trial-exempt + showcase gate)

| File | Change |
|------|--------|
| `src/types/subscription.ts` | Added `TRIAL_EXEMPT_FEATURES = ['collection_access']`; `canAccessFeature()` skips trial bypass for exempt features |
| `src/app/showcase/page.tsx` | Added tier check (same as vault page): fetches profile, checks `canAccessFeature`, redirects to `/browse` |
| `src/components/layout/Header.tsx` | Gated showcase nav link behind `canAccess('collection_access')`; removed from `HeaderFallback` |
| `src/components/layout/MobileNavDrawer.tsx` | Gated showcase nav link behind `canAccess('collection_access')` |
| `tests/lib/collection/access.test.ts` | Updated trial mode test: free tier now denied even with trial mode (7 tests) |
