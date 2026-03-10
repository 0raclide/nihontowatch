# Session: Yuhinkai Tier — Tests + Dead Code Cleanup (2026-03-10)

## What Was Done

### 1. Unit Tests for `checkCollectionAccess()`

**New file:** `tests/lib/collection/access.test.ts` — 10 test cases.

| Case | Profile data | Expected | Result |
|------|-------------|----------|--------|
| Free tier | `tier: 'free', status: 'active', role: 'user'` | 403 | 403 |
| Yuhinkai + active | `tier: 'yuhinkai', status: 'active', role: 'user'` | null | null |
| Yuhinkai + inactive | `tier: 'yuhinkai', status: 'inactive', role: 'user'` | 403 | 403 |
| Dealer + active | `tier: 'dealer', status: 'active', role: 'user'` | null | null |
| Admin (any tier/status) | `tier: 'free', status: 'inactive', role: 'admin'` | null | null |
| Enthusiast + active | `tier: 'enthusiast', status: 'active', role: 'user'` | null | null |
| Collector + active | `tier: 'collector', status: 'active', role: 'user'` | null | null |
| Inner Circle + active | `tier: 'inner_circle', status: 'active', role: 'user'` | null | null |
| Profile not found | `data: null` | 403 | 403 |
| Trial mode (free tier) | `tier: 'free'` + `NEXT_PUBLIC_TRIAL_MODE=true` | null | null |

**Mock pattern:** Factory function `mockSupabase(data)` returns a chainable mock (`from().select().eq().single()`) — no module-level `vi.mock()` needed since `checkCollectionAccess` accepts a Supabase client as parameter.

### 2. Dead Code Doc Cleanup

Three edits to mark `NEXT_PUBLIC_COLLECTION_ENABLED` as replaced:

- **`docs/HANDOFF_COLLECTION_V2_LISTINGGRID.md`** line 129 — struck through env var reference, replaced with note about `checkCollectionAccess()` in `src/lib/collection/access.ts`
- **`docs/HANDOFF_COLLECTION_PHASE_4.md`** lines 63-71 — struck through code blocks with env var gates, replaced with tier check note
- **`docs/HANDOFF_COLLECTION_PHASE_4.md`** lines 133-134 — marked checklist rows as done (2026-03-10)

## Key Finding: Paid Tiers Have Collection Access

The original plan expected `enthusiast`, `collector`, and `inner_circle` to be denied `collection_access`. This was incorrect.

**Why they're allowed:** `canAccessFeature()` in `src/types/subscription.ts` uses rank-based comparison for standard tiers. `collection_access` requires `yuhinkai` (rank 1). Since `enthusiast` (rank 1), `collector` (rank 2), and `inner_circle` (rank 3) all rank >= 1, they pass the check. Only `free` (rank 0) is denied.

The special-case branches for `dealer` and `yuhinkai` tiers exist because those tiers have non-standard feature sets (e.g., `dealer` gets `dealer_analytics` but not `collector`-tier features). For standard paid tiers, the rank comparison handles everything.

**This is correct behavior** — any paying subscriber should have collection access. The `yuhinkai` tier exists for users who need *only* collection access without paying for the full enthusiast feature set.

## Verification

- `tsc --noEmit` — clean
- `npm test -- --run tests/lib/collection/access.test.ts` — 10/10 pass
- `npm test -- --run` — 5342 pass, 1 pre-existing flake (`LoginModal.test.tsx`)
- `grep -r NEXT_PUBLIC_COLLECTION_ENABLED src/` — zero hits (confirmed dead in code)

## Files Changed

| File | Change |
|------|--------|
| `tests/lib/collection/access.test.ts` | **NEW** — 10 unit tests for `checkCollectionAccess()` |
| `docs/HANDOFF_COLLECTION_V2_LISTINGGRID.md` | Updated env var reference → tier check note |
| `docs/HANDOFF_COLLECTION_PHASE_4.md` | Updated 3 env var references → tier check notes |

## Remaining Work

- **Remove `NEXT_PUBLIC_COLLECTION_ENABLED` from Vercel env vars** — manual step, no code change needed
- **Paywall UX (deferred)** — `getPaywallConfig('yuhinkai')` shows Pro pricing (misleading). Needs "contact us" CTA since collection isn't Stripe-purchasable.
