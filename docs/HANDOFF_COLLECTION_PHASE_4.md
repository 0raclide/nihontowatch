# Handoff: Unified Collection Phase 4 — Inner Circle + Dealer Only

**Date:** 2026-03-10
**Prerequisite phases:** Phase 1 (rename), 2a-2d (DB + API + form + mapper), 3 (promote/delist), 5 (route migration + cleanup) — all DONE.
**Design doc:** `docs/DESIGN_UNIFIED_COLLECTION.md`
**Memory file:** `memory/unified-collection.md`

---

## Decision

The vault (personal collection manager at `/vault`) is restricted to **Inner Circle**, **Dealer**, and **Admin** users only. It is **not** open to all authenticated users.

**Rationale:** The vault is a premium feature. Opening it to all users is deferred until a future phase when the business case is clearer. For now it remains an exclusive perk of the highest-tier subscriptions plus dealers who need inventory management.

---

## Current Access Model

| Tier | Collection Access | Mechanism |
|------|------------------|-----------|
| free | NO | `canAccessFeature('free', 'collection_access')` → false |
| **inner_circle** | **YES** | `FEATURE_MIN_TIER.collection_access = 'inner_circle'` |
| **dealer** | **YES** | Special case: explicit `collection_access` grant |
| **admin** | **YES** | Role bypass in `checkCollectionAccess()` |
| **trial mode** | **YES (all)** | `isTrialModeActive()` → all features free |

> **Note (2026-03-10):** The old tiers `enthusiast`, `collector`, and `yuhinkai` were removed (migration 139). Only 3 tiers remain: `free`, `inner_circle`, `dealer`.

### Key files

| Component | Location |
|-----------|----------|
| Feature min tier | `src/types/subscription.ts` (`FEATURE_MIN_TIER.collection_access = 'inner_circle'`) |
| `canAccessFeature()` | `src/types/subscription.ts` (dealer special case includes `collection_access`) |
| API gating | `src/lib/collection/access.ts` (`checkCollectionAccess()`) — all 15 collection API routes |
| Tests (10) | `tests/lib/collection/access.test.ts` |

---

## What's Already Enforced

### API layer (server-side)
- `checkCollectionAccess()` called in all 15 collection API routes — returns 403 for unauthorized tiers
- Admin bypass via `role === 'admin'` check
- Trial mode bypass via `isTrialModeActive()`

### UI layer (client-side)
- Nav links to `/vault` gated by `isDealer` (only dealers see it in nav currently)
- "I Own This" button in browse QuickView — hidden for non-eligible users
- `/vault` page redirects unauthorized users to `/browse`

---

## What Phase 4 Does NOT Need To Do

Since we're keeping the current restricted access:

- **No nav changes** — vault link stays dealer-gated in nav (inner_circle users access via direct URL or will get nav link in a future phase)
- **No "open to all" flow** — no empty states for new collectors needed
- **No paywall modal for vault** — unauthorized users silently redirect to `/browse`
- **No i18n keys to add** — existing nav uses dealer-specific labels

---

## Future Consideration: Opening to All Users

When/if the decision is made to open the vault more broadly:

1. **Lower `FEATURE_MIN_TIER.collection_access`** from `'inner_circle'` to `'free'` to open to all users
2. **Add nav links** for all authenticated users (Header + MobileNavDrawer)
3. **Add empty state** for new collectors (0 items)
4. **Add paywall** if gating at a paid tier (currently silent redirect)
5. **Update tests** in `tests/lib/collection/access.test.ts`

---

## Changes Made (2026-03-10)

| File | Change |
|------|--------|
| `src/types/subscription.ts` | `FEATURE_MIN_TIER.collection_access = 'inner_circle'` |
| `src/types/subscription.ts` | `canAccessFeature()`: dealer gets explicit `collection_access` grant |
| `src/lib/collection/access.ts` | Updated doc comment (required tiers: inner_circle, dealer, admin) |
| `tests/lib/collection/access.test.ts` | 9 tests: free denied, inner_circle/dealer allowed, admin bypass, trial mode |
| `docs/HANDOFF_COLLECTION_PHASE_4.md` | Rewritten to reflect inner_circle+dealer+admin restriction |
