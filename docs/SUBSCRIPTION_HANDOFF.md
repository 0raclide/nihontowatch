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
| PaywallModal | `src/components/subscription/PaywallModal.tsx` | Desktop modal + mobile sheet, billing toggle |
| DataDelayBanner | `src/components/subscription/DataDelayBanner.tsx` | Banner for free tier users |
| 72h data delay | `src/app/api/browse/route.ts`, `src/lib/subscription/server.ts` | Filters listings >72h old for free tier |
| Gate inquiry emails | `src/components/inquiry/InquiryModal.tsx` | requireFeature check before generation |
| Gate saved searches | `src/app/api/saved-searches/route.ts`, `src/components/browse/SaveSearchButton.tsx` | API + UI gating |

### ⏳ REMAINING (Phase 1)

| Task | Priority | Estimate | Notes |
|------|----------|----------|-------|
| Setsumei translation API | MEDIUM | 1.5h | Claude API integration |
| Setsumei component | MEDIUM | 1.5h | UI for listing detail |
| Pricing page | MEDIUM | 2h | Full pricing table + page |

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

## Next Steps (Recommended Order)

### 1. Setsumei Translation API

Create `src/app/api/setsumei/translate/route.ts`:

```typescript
// POST with listingId
// Fetch setsumei_text_ja from listing
// Call Claude API for translation
// Cache result in setsumei_translations table
// Gate behind 'setsumei_translation' feature
```

### 2. Setsumei Translation Component

Create component for listing detail page:
- Show Japanese setsumei with "Translate" button
- On click, check subscription and call translation API
- Display translated text with source attribution

### 3. Create Pricing Page

Create `src/app/pricing/page.tsx` with:
- PricingTable component (3 columns)
- Feature comparison
- Monthly/Annual toggle
- Checkout CTAs

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

1. Create account (free tier)
2. Try accessing gated feature → should show paywall
3. Click upgrade → Stripe checkout
4. Complete payment → webhook updates profile
5. Verify feature now accessible
6. Open billing portal → manage subscription
7. Cancel → verify downgrade to free

---

## Known Issues / Technical Debt

1. **Type Assertions in Webhook Handler**: The webhook handler uses `@ts-expect-error` comments and type assertions because the Supabase client types don't include the new subscription columns yet. After running migration, regenerate types with `supabase gen types typescript`.

2. **Stripe API Version**: Using `2025-12-15.clover`. The `current_period_end` is now on `subscription.items.data[0]` instead of directly on subscription.

3. **Lazy Stripe Initialization**: The Stripe client uses a Proxy for lazy initialization to avoid build-time errors when env vars aren't set.

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
