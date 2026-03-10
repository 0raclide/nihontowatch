# Handoff: Yuhinkai Tier + Collection Gating

**Date:** 2026-03-10
**Status:** Implemented, tests passing, not yet committed

## What Was Done

Added a `yuhinkai` subscription tier that gates access to the Collection feature (`/collection`, "I Own This" button, nav links). Previously Collection was behind a `NEXT_PUBLIC_COLLECTION_ENABLED` env var; now it's behind a proper subscription tier check — both at the page level **and** at every API route.

### Changes (17 files modified + 1 new helper + 1 new migration)

**Type system (core):**
- `src/types/subscription.ts` — `'yuhinkai'` added to `SubscriptionTier` union, `'collection_access'` added to `Feature` union, `isYuhinkai` convenience boolean on `SubscriptionState`, tier rank = 1 (same as enthusiast)
- `src/types/database.ts` — `'yuhinkai'` added to both `subscription_tier` string literal unions (Row + Insert)
- `src/contexts/SubscriptionContext.tsx` — `isYuhinkai: true` in admin override block. `checkout` type narrowed to `Exclude<SubscriptionTier, 'free' | 'yuhinkai'>` (yuhinkai has no Stripe pricing)

**Access control (page-level):**
- `canAccessFeature()` — yuhinkai gets enthusiast features + `collection_access`. Dealer also gets `collection_access`.
- `src/app/collection/page.tsx` — Server-side tier check replaces env var. Queries `profiles` for `subscription_tier`, `subscription_status`, `role`.
- `src/components/listing/quickview-slots/BrowseCTA.tsx` — `canAccess('collection_access')` replaces env var check

**Access control (API-level — P0 security fix):**
- `src/lib/collection/access.ts` — **NEW** shared helper `checkCollectionAccess(supabase, userId)`. Queries `profiles` for tier/status/role, returns `null` (allowed) or `403 NextResponse` (denied). Admins always allowed. Respects trial mode via `canAccessFeature()`.
- All 15 collection API routes now call `checkCollectionAccess()` after auth:
  - `src/app/api/collection/items/route.ts` (GET + POST)
  - `src/app/api/collection/items/[id]/route.ts` (PATCH + DELETE)
  - `src/app/api/collection/images/route.ts` (POST + DELETE)
  - `src/app/api/collection/sayagaki-images/route.ts` (POST + DELETE)
  - `src/app/api/collection/hakogaki-images/route.ts` (POST + DELETE)
  - `src/app/api/collection/koshirae-images/route.ts` (POST + DELETE)
  - `src/app/api/collection/provenance-images/route.ts` (POST + DELETE)
  - `src/app/api/collection/kanto-hibisho-images/route.ts` (POST + DELETE)
  - `src/app/api/collection/videos/route.ts` (POST + GET)
  - `src/app/api/collection/videos/[id]/route.ts` (DELETE)
  - `src/app/api/collection/folders/route.ts` (GET + POST)
  - `src/app/api/collection/folders/[id]/route.ts` (PATCH + DELETE)
  - `src/app/api/collection/catalog-search/route.ts` (GET)
  - `src/app/api/collection/artisan-search/route.ts` (GET)
- Note: `items/[id]/promote/route.ts` was already gated by `verifyDealer()` — no change needed.
- Note: `items/[id]/route.ts` GET (single item) allows unauthenticated reads of public/unlisted items — no tier check on that path (it's content viewing, not collection management).

**UI:**
- `src/components/layout/Header.tsx` — Collection nav link (desktop) after Glossary, conditional on `canAccess('collection_access')`
- `src/components/layout/MobileNavDrawer.tsx` — Collection nav link (mobile) with archive box icon, same condition

**Admin:**
- `src/app/admin/users/page.tsx` — New "Tier" column with dropdown (Free/Yuhinkai/Pro/Collector/Inner Circle/Dealer)
- `src/app/api/admin/users/route.ts` — GET includes `subscription_tier, subscription_status`. PATCH accepts optional `subscriptionTier` field (sets tier + auto-sets status to active/inactive)

**Stripe type cascade (P1 type-safety fix):**
- `src/lib/stripe/server.ts` — `STRIPE_PRICES`, `getPriceId`, `CreateCheckoutParams` all exclude `'yuhinkai'`
- `src/lib/stripe/client.ts` — `CheckoutOptions.tier` narrowed to `Exclude<SubscriptionTier, 'free' | 'yuhinkai'>`
- `src/components/subscription/PaywallModal.tsx` — yuhinkai → enthusiast fallback in pricing display. All `onCheckout` props narrowed to exclude yuhinkai.
- `src/app/api/subscription/checkout/route.ts` — Exclude yuhinkai from checkout body type

**DB:**
- `supabase/migrations/132_yuhinkai_tier.sql` — Drops and re-adds CHECK constraint to include `'yuhinkai'`

**Tests:**
- `tests/api/admin/users.test.ts` — 3 tests updated: validation message changed (`'userId is required'` not `'userId and isAdmin are required'`), added tier change test and invalid tier rejection test
- `tests/api/collection-items.test.ts` — Added `vi.mock('@/lib/collection/access')` to bypass tier check in unit tests
- `tests/api/collection-images.test.ts` — Same mock added
- `tests/api/collection-videos.test.ts` — Same mock added

## Issues Found & Fixed During Review

### P0 — Collection API routes had no tier gating (FIXED)

The initial implementation only gated collection access at the UI level:
- Page redirect in `collection/page.tsx`
- Nav link visibility in Header/MobileNavDrawer
- "I Own This" button visibility in BrowseCTA

**Problem:** Any authenticated free-tier user could directly call `POST /api/collection/items` (or any of the 15 collection API routes) and bypass the gate entirely. This is the same class of vulnerability as the 2026-03-03 dealer listing leak incident where UI-only gating proved insufficient.

**Fix:** Created `checkCollectionAccess()` in `src/lib/collection/access.ts` and added it to all 28 handler functions across 13 route files. Each handler now queries `profiles` for the user's tier after auth, returning 403 if the user lacks `collection_access`. The check respects trial mode, admin override, and active subscription status.

**Pattern:** After existing auth check, add 2 lines:
```typescript
const accessDenied = await checkCollectionAccess(supabase, user.id);
if (accessDenied) return accessDenied;
```

**Latency impact:** One additional `profiles` query per collection API call. Acceptable because collection is low-traffic and the query is fast (single row by PK).

### P1 — `checkout()` accepted `'yuhinkai'` (FIXED)

`SubscriptionContextValue.checkout`, `PaywallModal.onCheckout`, and `stripe/client.ts CheckoutOptions` were all typed `Exclude<SubscriptionTier, 'free'>`, which included `'yuhinkai'`. Calling `checkout('yuhinkai', 'monthly')` compiled cleanly but would 400 at runtime because yuhinkai has no Stripe price IDs.

**Fix:** Narrowed all 6 call sites to `Exclude<SubscriptionTier, 'free' | 'yuhinkai'>`. TypeScript now catches attempts to checkout with yuhinkai at compile time.

**Lesson reinforced:** When adding a member to a union type, grep for `Exclude<ThatType` patterns. The cascade is non-obvious and silent — the type error only surfaces when code tries to use the new member in a context that excludes it.

## What I'd Have Done Differently

1. **Run `tsc --noEmit` before `npm test`.** I ran the full 76-second test suite first, then discovered TypeScript errors in the Stripe/Paywall type cascade. A 10-second `tsc` check would have surfaced all five type errors upfront, saving an entire test cycle. **Lesson: always type-check before running tests when modifying shared types.**

2. **Grep for `Exclude<SubscriptionTier` upfront.** Adding a new member to the `SubscriptionTier` union has ripple effects wherever `Exclude<SubscriptionTier, 'free'>` appears — Stripe pricing records, checkout params, paywall modal. The plan didn't account for these cascade files (stripe/server.ts, PaywallModal.tsx, checkout/route.ts). I should have searched for all `Exclude<SubscriptionTier` references during planning and added them to the file list.

3. **Study test mock patterns before writing new tests.** My first attempt at the "accepts userId with only subscriptionTier" test failed with 403 because I used a naive mock setup instead of the established pattern (separate admin auth + call-counting `mockImplementation`). Reading the existing test patterns before writing would have avoided the retry.

4. **Gate API routes from the start.** The initial implementation only gated at the UI level. The data isolation rule from the dealer listing leak postmortem explicitly says: "grep EVERY `.from('table')` call — not just the obvious browse API." API-level gating should have been in the original plan, not discovered during review.

## Known Gaps / Future Work

1. **`NEXT_PUBLIC_COLLECTION_ENABLED` env var is now dead code** — ~~still set in Vercel env vars and referenced in docs~~. Docs updated (2026-03-10). Remove from Vercel env vars (manual step).

2. **No paywall UX for collection — intentional (2026-03-10).** Silent redirect to `/browse` for unauthorized users. Nav links and "I Own This" button hidden entirely. Paywall modal deferred to a future phase when collection access becomes a paid/self-serve feature.

3. ~~**Misleading paywall for `collection_access`**~~ — **Not a current issue (2026-03-10).** No paywall modal is triggered in the collection flow. `getPaywallConfig('yuhinkai')` exists but is never called. If a paywall is added later, it will need a "contact us" CTA since yuhinkai is not Stripe-purchasable.

4. **"I Own This" button visibility — intentional (2026-03-10).** Hidden entirely for non-yuhinkai users. No paywall-on-click pattern. Revisit when collection opens to broader audience.

5. **Yuhinkai tier has no Stripe pricing** — it's entirely manual (admin assigns via `/admin/users`). If this needs self-serve signup later, need to add Stripe price IDs and include yuhinkai in the checkout flow.

6. **Collection nav link position** — on desktop it appears between Glossary and the FeedbackButton. On mobile it appears between Feedback and Dealer links. This seems natural but hasn't been reviewed by a designer.

7. **Trial mode interaction** — when `NEXT_PUBLIC_TRIAL_MODE=true`, `canAccessFeature()` returns true for all features including `collection_access`. This means all users see the Collection nav link and can access `/collection` during trial. This is probably the desired behavior but worth confirming.

8. **The collection page server-side check queries `profiles` directly** — this adds a DB query on every collection page load. The auth context already loads the profile client-side, but server components can't use React context. This is fine for now since the page is `force-dynamic` anyway.

9. **No dedicated access-control tests** — the `checkCollectionAccess()` helper is tested implicitly via mocking in route tests, but there are no direct unit tests verifying it returns 403 for free users, null for yuhinkai, null for admins, null during trial mode, etc. Consider adding `tests/lib/collection/access.test.ts`.

## Access Matrix

| Tier | collection_access | Nav link visible | "I Own This" visible | API routes |
|------|-------------------|------------------|----------------------|------------|
| free | NO | NO | NO | 403 |
| enthusiast (Pro) | NO | NO | NO | 403 |
| collector | NO | NO | NO | 403 |
| inner_circle | NO | NO | NO | 403 |
| **yuhinkai** | **YES** | **YES** | **YES** | **200** |
| dealer | YES | YES | YES | 200 |
| admin | YES (override) | YES | YES | 200 |
| trial mode ON | YES (all features) | YES | YES | 200 |

## Key Files

| Component | Location |
|-----------|----------|
| Subscription types | `src/types/subscription.ts` |
| Access helper | `src/lib/collection/access.ts` |
| Page-level gate | `src/app/collection/page.tsx` |
| Admin tier management | `src/app/api/admin/users/route.ts` |
| DB migration | `supabase/migrations/132_yuhinkai_tier.sql` |
| Stripe type exclusions | `src/lib/stripe/server.ts`, `src/lib/stripe/client.ts` |
| Paywall fallback | `src/components/subscription/PaywallModal.tsx` |
