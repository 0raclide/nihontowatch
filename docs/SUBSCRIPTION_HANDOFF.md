# Subscription System Handoff

Implementation status and handoff notes for the Nihontowatch Pro Tier system.

**Last Updated:** 2026-01-23

---

## Implementation Status

### ✅ COMPLETED

| Component | File(s) | Notes |
|-----------|---------|-------|
| Database Migration | `supabase/migrations/039_subscription_tiers.sql` | Adds subscription fields to profiles + setsumei_translations table |
| TypeScript Types | `src/types/subscription.ts` | Full type definitions, feature access matrix, paywall messages |
| Database Types | `src/types/database.ts` | Updated profiles Row/Insert with subscription fields |
| Stripe Server Lib | `src/lib/stripe/server.ts` | Checkout sessions, portal, webhook utils, lazy initialization |
| Stripe Client Lib | `src/lib/stripe/client.ts` | Browser-safe checkout redirect, portal open |
| Stripe Index | `src/lib/stripe/index.ts` | Re-exports for convenience |
| Checkout API | `src/app/api/subscription/checkout/route.ts` | Creates Stripe checkout session |
| Portal API | `src/app/api/subscription/portal/route.ts` | Creates Stripe billing portal session |
| Webhook API | `src/app/api/subscription/webhook/route.ts` | Handles all Stripe webhook events |
| Subscription Context | `src/contexts/SubscriptionContext.tsx` | App-wide subscription state, paywall management |
| useSubscription Hook | `src/hooks/useSubscription.ts` | Convenience re-export |
| App Layout | `src/app/layout.tsx` | SubscriptionProvider + PaywallModal added |
| Subscription Server Lib | `src/lib/subscription/server.ts` | getUserSubscription(), getDataDelayCutoff() |

### ✅ COMPLETED (Phase 1 - Feature Gating)

| Component | File(s) | Notes |
|-----------|---------|-------|
| PaywallModal | `src/components/subscription/PaywallModal.tsx` | Desktop modal + mobile sheet, billing toggle, sign-in flow for anonymous users |
| DataDelayBanner | `src/components/subscription/DataDelayBanner.tsx` | Banner for free tier users |
| 72h data delay | `src/app/api/browse/route.ts`, `src/lib/subscription/server.ts` | Filters listings >72h old for free tier, private cache for authenticated users |
| Gate inquiry emails | `src/components/inquiry/InquiryModal.tsx`, `src/components/listing/QuickViewContent.tsx` | requireFeature check, shows paywall before login for anonymous |
| Gate saved searches | `src/app/api/saved-searches/route.ts`, `src/components/browse/SaveSearchButton.tsx` | API + UI gating, shows paywall before login for anonymous |
| Gate setsumei translations | `src/components/listing/SetsumeiSection.tsx` | Shows 1/3 preview with fade, "Unlock Full Translation" CTA |
| Admin full access | `src/contexts/SubscriptionContext.tsx`, `src/lib/subscription/server.ts` | Admins (role='admin') get connoisseur tier access automatically |
| Value-prop paywall messages | `src/types/subscription.ts` | Inquiry emails mention 10% export discount, saved searches highlight watchlist value |
| Feature gating tests | `tests/subscription/feature-gating.test.tsx` | 12 tests for component gating behavior |
| Data delay tests | `tests/subscription/data-delay.test.ts` | 22 tests for auth, caching, admin bypass |

### ⏳ REMAINING (Phase 1)

| Task | Priority | Notes |
|------|----------|-------|
| Pricing page | HIGH | Full pricing table + page at `/pricing` with checkout CTAs |

### 🔮 FUTURE (Phase 2+)

| Task | Priority | Notes |
|------|----------|-------|
| Search alerts | MEDIUM | Email notifications for matching listings (Connoisseur feature) |
| Private listings | MEDIUM | Exclusive dealer items (Connoisseur feature) |
| Artist stats | LOW | Certification statistics by smith/school |
| Setsumei on-demand translation | LOW | Claude API for items without pre-translated setsumei |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION FLOW                             │
│                                                                 │
│  User clicks upgrade                                            │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │ startCheckout() │───▶│ /api/subscription│                   │
│  │   (client.ts)   │    │    /checkout     │                   │
│  └─────────────────┘    └────────┬────────┘                    │
│                                  │                              │
│                                  ▼                              │
│                         ┌─────────────────┐                    │
│                         │ Stripe Checkout │                    │
│                         │   (Hosted Page) │                    │
│                         └────────┬────────┘                    │
│                                  │                              │
│                                  ▼                              │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │  profiles table │◀───│ /api/subscription│                   │
│  │   (updated)     │    │    /webhook      │                   │
│  └─────────────────┘    └─────────────────┘                    │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │SubscriptionContext                                          │
│  │  derives state  │                                           │
│  │  from profile   │                                           │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

### Types (`src/types/subscription.ts`)

```typescript
// Tiers
type SubscriptionTier = 'free' | 'enthusiast' | 'connoisseur' | 'dealer';

// Features that can be gated
type Feature =
  | 'fresh_data'           // No 72h delay
  | 'setsumei_translation' // AI translation
  | 'inquiry_emails'       // Email drafts
  | 'saved_searches'       // Save search queries
  | 'search_alerts'        // Get notified of matches
  | 'private_listings'     // Exclusive dealer items
  | 'artist_stats'         // Certification statistics
  | 'yuhinkai_discord'     // Community access
  | 'line_access'          // Chat with Hoshi
  | 'export_data'          // Export capabilities
  | 'dealer_analytics';    // Dealer-only

// Check access
canAccessFeature(tier: SubscriptionTier, feature: Feature): boolean
```

### Context (`src/contexts/SubscriptionContext.tsx`)

```typescript
const {
  tier,              // Current tier
  status,            // 'active' | 'inactive' | etc.
  isFree,            // Boolean helpers
  isEnthusiast,
  isConnoisseur,
  canAccess,         // (feature: Feature) => boolean
  requireFeature,    // (feature: Feature) => boolean - shows paywall if false
  checkout,          // (tier, billingPeriod) => Promise<void>
  openPortal,        // () => Promise<void>
  paywallInfo,       // Current paywall state
  showPaywall,       // (feature: Feature) => void
  hidePaywall,       // () => void
} = useSubscription();
```

### Stripe Server (`src/lib/stripe/server.ts`)

```typescript
// Create checkout session
createCheckoutSession({
  userId, userEmail, tier, billingPeriod, successUrl, cancelUrl, customerId
})

// Create billing portal
createPortalSession(customerId, returnUrl)

// Webhook verification
constructWebhookEvent(body, signature)

// Extract subscription details
extractSubscriptionDetails(subscription)
```

---

## Environment Variables Required

```env
# Stripe Keys (required for functionality)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Stripe Price IDs (create in Stripe Dashboard)
STRIPE_PRICE_ENTHUSIAST_MONTHLY=price_xxx
STRIPE_PRICE_ENTHUSIAST_ANNUAL=price_xxx
STRIPE_PRICE_CONNOISSEUR_MONTHLY=price_xxx
STRIPE_PRICE_CONNOISSEUR_ANNUAL=price_xxx
STRIPE_PRICE_DEALER_MONTHLY=price_xxx
STRIPE_PRICE_DEALER_ANNUAL=price_xxx
```

---

## Database Schema Changes

Migration `039_subscription_tiers.sql` adds:

**profiles table:**
- `subscription_tier` - 'free' | 'enthusiast' | 'connoisseur' | 'dealer'
- `subscription_status` - 'active' | 'inactive' | 'cancelled' | 'past_due'
- `subscription_started_at` - Timestamp
- `subscription_expires_at` - Timestamp
- `stripe_customer_id` - Stripe customer reference
- `stripe_subscription_id` - Stripe subscription reference

**setsumei_translations table:**
- `listing_id` - FK to listings
- `original_text` - Japanese text
- `translated_text` - English translation
- `translator` - 'claude' | 'gpt4' | 'manual'
- `created_at`, `updated_at`

---

## Next Steps

### 1. Create Pricing Page (HIGH PRIORITY)

Create `src/app/pricing/page.tsx` with:
- PricingTable component (3 tiers: Free, Enthusiast, Connoisseur)
- Feature comparison matrix
- Monthly/Annual billing toggle
- Checkout CTAs that call `checkout()` from SubscriptionContext
- SEO meta tags

### 2. Future: On-Demand Setsumei Translation API

For items without pre-translated setsumei, create `src/app/api/setsumei/translate/route.ts`:

```typescript
// POST with listingId
// Fetch setsumei_text_ja from listing
// Call Claude API for translation
// Cache result in setsumei_translations table
// Gate behind 'setsumei_translation' feature
```

---

## Test Coverage

**34 total subscription tests** in `tests/subscription/`:

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `data-delay.test.ts` | 22 | Server auth, 72h cutoff, admin bypass, client fallback, credentials |
| `feature-gating.test.tsx` | 12 | Component gating, paywall triggers, feature access matrix |

### What Tests Catch

- Removing `useSubscription` from gated components
- Removing `canAccess`/`requireFeature`/`showPaywall` calls
- Breaking the feature access matrix (free vs paid)
- Breaking admin bypass logic
- Breaking auth client fallback
- Missing `credentials: 'include'` in fetch calls
- Missing `force-dynamic` or `no-store` cache headers

### Running Tests

```bash
# All subscription tests
npm test -- tests/subscription

# Just feature gating
npm test -- tests/subscription/feature-gating.test.tsx

# Just data delay auth
npm test -- tests/subscription/data-delay.test.ts
```

---

## Testing Notes

### Stripe Test Mode

Use test card: `4242 4242 4242 4242`

### Webhook Testing

For local development:
```bash
stripe listen --forward-to localhost:3000/api/subscription/webhook
```

### Manual Test Flow

**Anonymous User:**
1. Visit nihontowatch.com (not logged in)
2. Open a listing quick view → Click "Inquire"
3. Should see paywall with "Professional Inquiry Emails" and 10% export discount message
4. Click "Sign in to upgrade" → Login modal appears
5. Similarly test "Save Search" button with active filters

**Logged-in Free User:**
1. Create account (free tier)
2. Try accessing gated feature → should show paywall with "Upgrade to Enthusiast"
3. Click upgrade → Stripe checkout
4. Complete payment → webhook updates profile
5. Verify feature now accessible
6. Open billing portal → manage subscription
7. Cancel → verify downgrade to free

**Admin User:**
1. Log in as admin (role='admin' in profiles)
2. Should see fresh listings (no 72h delay banner)
3. All premium features accessible without subscription

---

## Known Issues / Technical Debt

1. **Type Assertions in Webhook Handler**: The webhook handler uses `@ts-expect-error` comments and type assertions because the Supabase client types don't include the new subscription columns yet. After running migration, regenerate types with `supabase gen types typescript`.

2. **Stripe API Version**: Using `2025-12-15.clover`. The `current_period_end` is now on `subscription.items.data[0]` instead of directly on subscription.

3. **Lazy Stripe Initialization**: The Stripe client uses a Proxy for lazy initialization to avoid build-time errors when env vars aren't set.

## Recent Fixes

### 1. Edge Cache Issue (2026-01-23)
Fixed issue where admins saw delayed data because Vercel edge was caching responses before auth check ran.
- Added `dynamic = 'force-dynamic'` to browse API route
- Added `no-store` cache header for authenticated users

### 2. Paywall-before-Login UX (2026-01-23)
Anonymous users now see paywall with value proposition before being prompted to sign in. Previously showed generic login modal which didn't explain the feature value.

### 3. Auth Cookies Not Sent (2026-01-23)
**Problem:** `fetch()` calls to `/api/browse` were missing `credentials: 'include'`, so auth cookies weren't sent and all users were treated as free tier.
**Fix:** Added `credentials: 'include'` to all browse API fetch calls in `src/app/page.tsx`.

### 4. Service Client Fallback (2026-01-23)
**Problem:** `getUserSubscription()` silently failed when service client couldn't fetch profile (e.g., if `SUPABASE_SERVICE_ROLE_KEY` was missing or query failed).
**Fix:** Added fallback to authenticated client in `src/lib/subscription/server.ts`:
```typescript
// Try service client first, fall back to auth client
const { data: serviceProfile, error: serviceError } = await serviceClient...
if (serviceProfile) {
  profile = serviceProfile;
} else {
  // Fall back to authenticated client
  const { data: authProfile } = await supabase...
  profile = authProfile;
}
```

### 5. Migration Not Applied (2026-01-23) - ROOT CAUSE
**Problem:** The subscription migration `039_subscription_tiers.sql` was never pushed to production. The `subscription_tier` column didn't exist, causing all profile queries to fail with "column profiles.subscription_tier does not exist".
**Fix:** Ran `supabase db push --include-all` to apply the migration.
**Lesson:** Always verify migrations are applied after deployment. Use debug endpoints to diagnose database issues.

### 6. Early Access Badge Styling (2026-01-23)
Changed "Early Access" badge from orange gradient to green (matching "New" badge styling) per user feedback.

---

## Critical Tests

22 tests in `tests/subscription/data-delay.test.ts` guard against regression:

| Test | What it catches |
|------|-----------------|
| `CRITICAL: falls back to auth client when service client fails` | Service client returns error |
| `CRITICAL: admin with failed service client must NOT be treated as free` | Silent service client failure |
| `server subscription util has auth client fallback` | Verifies fallback code exists |
| `browse API fetch must include credentials` | Missing `credentials: 'include'` |
| `browse API route has force-dynamic export` | CDN caching authenticated responses |
| `browse API uses no-store cache` | Cache-Control header missing |

Run tests before every deploy:
```bash
npm test -- tests/subscription/data-delay.test.ts
```

---

## Debug Endpoint

A debug endpoint exists at `/api/debug/subscription` for diagnosing auth issues:

```typescript
// Returns:
{
  subscription: { tier, status, userId, isDelayed },
  profileDebug: {
    serviceClient: { profile, error, isAdmin },
    regularClient: { profile, error, isAdmin },
    serviceKeyConfigured: boolean
  },
  counts: { totalAvailable, freshListings, delayedListings }
}
```

**DELETE THIS ENDPOINT** after debugging is complete (contains sensitive info).

---

## Deployment Checklist

Before deploying subscription changes:

1. [ ] Run `npm test` - all 22 subscription tests must pass
2. [ ] Verify migration is applied: `supabase db push`
3. [ ] Check env vars in Vercel: `SUPABASE_SERVICE_ROLE_KEY`, Stripe keys
4. [ ] After deploy, test `/api/debug/subscription` while logged in as admin
5. [ ] Verify `isDelayed: false` and `tier: "connoisseur"` for admin
6. [ ] Hard refresh main site, confirm fresh listings visible

---

## Pricing Reference

| Tier | Monthly | Annual | Key Features |
|------|---------|--------|--------------|
| Free | $0 | $0 | 72h delayed data, basic browsing |
| Enthusiast | $25 | $225 (25% off) | Fresh data, translations, inquiry emails, saved searches |
| Connoisseur | $200 | $1,800 (25% off) | Private listings, alerts, artist stats, LINE access, Discord |
| Dealer | TBD | TBD | Analytics, private listing management |

---

## Contact

For questions about this implementation, refer to:
- `docs/PRO_TIER_STRATEGY.md` - Business strategy
- `docs/PRO_TIER_IMPLEMENTATION.md` - Full implementation checklist
- `docs/PHASE_1_BREAKDOWN.md` - Detailed task breakdown

---

*Handoff document for Nihontowatch Pro Tier implementation*
