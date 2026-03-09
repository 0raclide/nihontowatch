# Handoff: Yuhinkai Tier + Collection Gating

**Date:** 2026-03-10
**Status:** Implemented, tests passing, not yet committed

## What Was Done

Added a `yuhinkai` subscription tier that gates access to the Collection feature (`/collection`, "I Own This" button, nav links). Previously Collection was behind a `NEXT_PUBLIC_COLLECTION_ENABLED` env var; now it's behind a proper subscription tier check.

### Changes (13 files + 1 new migration)

**Type system (core):**
- `src/types/subscription.ts` — `'yuhinkai'` added to `SubscriptionTier` union, `'collection_access'` added to `Feature` union, `isYuhinkai` convenience boolean on `SubscriptionState`, tier rank = 1 (same as enthusiast)
- `src/types/database.ts` — `'yuhinkai'` added to both `subscription_tier` string literal unions (Row + Insert)
- `src/contexts/SubscriptionContext.tsx` — `isYuhinkai: true` in admin override block

**Access control:**
- `canAccessFeature()` — yuhinkai gets enthusiast features + `collection_access`. Dealer also gets `collection_access`.
- `src/app/collection/page.tsx` — Server-side tier check replaces env var. Queries `profiles` for `subscription_tier`, `subscription_status`, `role`.
- `src/components/listing/quickview-slots/BrowseCTA.tsx` — `canAccess('collection_access')` replaces env var check

**UI:**
- `src/components/layout/Header.tsx` — Collection nav link (desktop) after Glossary, conditional on `canAccess('collection_access')`
- `src/components/layout/MobileNavDrawer.tsx` — Collection nav link (mobile) with archive box icon, same condition

**Admin:**
- `src/app/admin/users/page.tsx` — New "Tier" column with dropdown (Free/Yuhinkai/Pro/Collector/Inner Circle/Dealer)
- `src/app/api/admin/users/route.ts` — GET includes `subscription_tier, subscription_status`. PATCH accepts optional `subscriptionTier` field (sets tier + auto-sets status to active/inactive)

**Stripe type cascade:**
- `src/lib/stripe/server.ts` — `STRIPE_PRICES`, `getPriceId`, `CreateCheckoutParams` all exclude `'yuhinkai'` (no Stripe pricing for manual tier)
- `src/components/subscription/PaywallModal.tsx` — yuhinkai → enthusiast fallback in pricing display
- `src/app/api/subscription/checkout/route.ts` — Exclude yuhinkai from checkout body type

**DB:**
- `supabase/migrations/132_yuhinkai_tier.sql` — Drops and re-adds CHECK constraint to include `'yuhinkai'`

**Tests:**
- `tests/api/admin/users.test.ts` — 3 tests updated: validation message changed (`'userId is required'` not `'userId and isAdmin are required'`), added tier change test and invalid tier rejection test

## What I'd Have Done Differently

1. **Run `tsc --noEmit` before `npm test`.** I ran the full 76-second test suite first, then discovered TypeScript errors in the Stripe/Paywall type cascade. A 10-second `tsc` check would have surfaced all five type errors upfront, saving an entire test cycle. **Lesson: always type-check before running tests when modifying shared types.**

2. **Grep for `Exclude<SubscriptionTier` upfront.** Adding a new member to the `SubscriptionTier` union has ripple effects wherever `Exclude<SubscriptionTier, 'free'>` appears — Stripe pricing records, checkout params, paywall modal. The plan didn't account for these cascade files (stripe/server.ts, PaywallModal.tsx, checkout/route.ts). I should have searched for all `Exclude<SubscriptionTier` references during planning and added them to the file list.

3. **Study test mock patterns before writing new tests.** My first attempt at the "accepts userId with only subscriptionTier" test failed with 403 because I used a naive mock setup instead of the established pattern (separate admin auth + call-counting `mockImplementation`). Reading the existing test patterns before writing would have avoided the retry.

## Known Gaps / Future Work

1. **`NEXT_PUBLIC_COLLECTION_ENABLED` env var is now dead code** — still set in Vercel env vars and referenced in docs (`HANDOFF_COLLECTION_V2_LISTINGGRID.md`, `HANDOFF_COLLECTION_PHASE_4.md`). Should be removed from Vercel env vars and docs updated.

2. **No paywall UX for collection** — free users who try to access `/collection` get silently redirected to `/browse`. No modal explaining what they're missing or how to get access. A paywall modal on the collection page would convert better, but since yuhinkai is manually assigned (not Stripe), a "contact us" CTA might be more appropriate than a checkout button.

3. **"I Own This" button visibility** — currently hidden entirely for non-yuhinkai users. An alternative design: show the button but trigger a paywall modal on click (similar to how inquiry emails work). This would create awareness of the collection feature for free users.

4. **Yuhinkai tier has no Stripe pricing** — it's entirely manual (admin assigns via `/admin/users`). If this needs self-serve signup later, need to add Stripe price IDs and include yuhinkai in the checkout flow.

5. **Collection nav link position** — on desktop it appears between Glossary and the FeedbackButton. On mobile it appears between Feedback and Dealer links. This seems natural but hasn't been reviewed by a designer.

6. **Trial mode interaction** — when `NEXT_PUBLIC_TRIAL_MODE=true`, `canAccessFeature()` returns true for all features including `collection_access`. This means all users see the Collection nav link and can access `/collection` during trial. This is probably the desired behavior but worth confirming.

7. **The collection page server-side check queries `profiles` directly** — this adds a DB query on every collection page load. The auth context already loads the profile client-side, but server components can't use React context. This is fine for now since the page is `force-dynamic` anyway.

## Access Matrix

| Tier | collection_access | Nav link visible | "I Own This" visible |
|------|-------------------|------------------|----------------------|
| free | NO | NO | NO |
| enthusiast (Pro) | NO | NO | NO |
| collector | NO | NO | NO |
| inner_circle | NO | NO | NO |
| **yuhinkai** | **YES** | **YES** | **YES** |
| dealer | YES | YES | YES |
| admin | YES (override) | YES | YES |
| trial mode ON | YES (all features) | YES | YES |
