# Phase 1: Foundation + Collector Tier

Detailed task breakdown with dependencies and estimates.

---

## Overview

**Goal:** Launch Collector tier ($25/mo) with core value props:
- Fresh data (no 72h delay)
- Setsumei translations
- Inquiry email drafts
- Unlimited favorites
- Saved searches (no alerts)

**Total Estimate:** ~22 hours of dev work

---

## Task Groups

```
┌─────────────────────────────────────────────────────────────────┐
│                         PHASE 1 FLOW                            │
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐               │
│  │    DB    │────▶│  Stripe  │────▶│ Context  │               │
│  │Migration │     │   Setup  │     │ & Hooks  │               │
│  └──────────┘     └──────────┘     └──────────┘               │
│       │                                  │                      │
│       │           ┌──────────────────────┴───────┐             │
│       │           │                              │             │
│       ▼           ▼                              ▼             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │Setsumei  │ │  72h     │ │ Inquiry  │ │ Searches │         │
│  │Feature   │ │  Delay   │ │  Gate    │ │  Gate    │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│       │              │            │            │               │
│       └──────────────┴────────────┴────────────┘               │
│                              │                                  │
│                              ▼                                  │
│                      ┌──────────────┐                          │
│                      │  Pricing UI  │                          │
│                      │  & Paywalls  │                          │
│                      └──────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Group A: Database & Infrastructure

### A1. Subscription fields migration
**Estimate:** 30 min | **Depends on:** Nothing | **Blocks:** Everything else

```sql
-- supabase/migrations/037_subscription_fields.sql
ALTER TABLE profiles
  ADD COLUMN subscription_tier TEXT DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'collector', 'connoisseur', 'dealer')),
  ADD COLUMN subscription_status TEXT DEFAULT 'inactive'
    CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'past_due')),
  ADD COLUMN subscription_started_at TIMESTAMPTZ,
  ADD COLUMN subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN stripe_customer_id TEXT,
  ADD COLUMN stripe_subscription_id TEXT;

CREATE INDEX idx_profiles_subscription ON profiles(subscription_tier, subscription_status);
```

**Deliverable:** profiles table has subscription fields

---

### A2. Setsumei translations table
**Estimate:** 20 min | **Depends on:** Nothing | **Blocks:** Setsumei feature

```sql
-- supabase/migrations/038_setsumei_translations.sql
CREATE TABLE setsumei_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id)
);
```

**Deliverable:** Table for caching translations

---

### A3. Update TypeScript types
**Estimate:** 20 min | **Depends on:** A1 | **Blocks:** Context/hooks

```typescript
// src/types/subscription.ts
export type SubscriptionTier = 'free' | 'collector' | 'connoisseur' | 'dealer';
export type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'past_due';

export interface UserSubscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  startedAt: string | null;
  expiresAt: string | null;
}

// Update Profile type
export interface Profile {
  // ... existing fields
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}
```

**Deliverable:** Type-safe subscription handling

---

## Group B: Stripe Integration

### B1. Install Stripe & configure
**Estimate:** 30 min | **Depends on:** Nothing | **Blocks:** B2-B5

```bash
npm install stripe @stripe/stripe-js
```

Add to `.env.local`:
```
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_PRICE_COLLECTOR_MONTHLY=price_xxx
STRIPE_PRICE_COLLECTOR_ANNUAL=price_xxx
```

Create products in Stripe Dashboard:
- Collector Monthly: $25/mo
- Collector Annual: $225/yr

**Deliverable:** Stripe SDK installed, env vars set, products created

---

### B2. Stripe utility library
**Estimate:** 30 min | **Depends on:** B1 | **Blocks:** B3-B5

```typescript
// src/lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export const PRICES = {
  collector: {
    monthly: process.env.STRIPE_PRICE_COLLECTOR_MONTHLY!,
    annual: process.env.STRIPE_PRICE_COLLECTOR_ANNUAL!,
  },
  connoisseur: {
    monthly: process.env.STRIPE_PRICE_CONNOISSEUR_MONTHLY!,
    annual: process.env.STRIPE_PRICE_CONNOISSEUR_ANNUAL!,
  },
} as const;

export type BillingPeriod = 'monthly' | 'annual';
```

**Deliverable:** Reusable Stripe client

---

### B3. Checkout API route
**Estimate:** 1 hour | **Depends on:** B2 | **Blocks:** Pricing UI

```typescript
// src/app/api/subscription/checkout/route.ts
// - Accept: tier, billing period
// - Get/create Stripe customer
// - Create checkout session
// - Return session URL
```

Key logic:
- Look up user by Supabase auth
- Create Stripe customer if needed (store ID in profiles)
- Create checkout session with correct price
- Include success/cancel URLs
- Store tier in session metadata

**Deliverable:** POST /api/subscription/checkout returns Stripe checkout URL

---

### B4. Webhook handler
**Estimate:** 1.5 hours | **Depends on:** B2, A1 | **Blocks:** Nothing (but critical)

```typescript
// src/app/api/subscription/webhook/route.ts
// Handle events:
// - checkout.session.completed → activate subscription
// - customer.subscription.updated → sync status
// - customer.subscription.deleted → downgrade to free
// - invoice.payment_failed → mark past_due
```

Key logic:
- Verify webhook signature
- Extract customer/subscription from event
- Look up user by stripe_customer_id
- Update profiles table accordingly

**Deliverable:** Stripe webhooks update user subscription status

---

### B5. Customer portal route
**Estimate:** 30 min | **Depends on:** B2 | **Blocks:** Account settings

```typescript
// src/app/api/subscription/portal/route.ts
// - Get user's stripe_customer_id
// - Create portal session
// - Return portal URL
```

**Deliverable:** Users can manage billing via Stripe portal

---

## Group C: Subscription Context & Access Control

### C1. Subscription utility functions
**Estimate:** 45 min | **Depends on:** A3 | **Blocks:** C2, all gating

```typescript
// src/lib/subscription.ts
export type Feature =
  | 'fresh_data'
  | 'setsumei_translation'
  | 'inquiry_emails'
  | 'unlimited_favorites'
  | 'search_alerts'
  | 'private_listings'
  | 'line_access'
  | 'export_data';

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  collector: 1,
  connoisseur: 2,
  dealer: 1, // Same as collector for features
};

const FEATURE_MIN_TIER: Record<Feature, SubscriptionTier> = {
  fresh_data: 'collector',
  setsumei_translation: 'collector',
  inquiry_emails: 'collector',
  unlimited_favorites: 'collector',
  search_alerts: 'connoisseur',
  private_listings: 'connoisseur',
  line_access: 'connoisseur',
  export_data: 'collector',
};

export function canAccess(tier: SubscriptionTier, feature: Feature): boolean {
  const requiredRank = TIER_RANK[FEATURE_MIN_TIER[feature]];
  const userRank = TIER_RANK[tier];
  return userRank >= requiredRank;
}

export function getRequiredTier(feature: Feature): SubscriptionTier {
  return FEATURE_MIN_TIER[feature];
}
```

**Deliverable:** Clean access control logic

---

### C2. Subscription context
**Estimate:** 1 hour | **Depends on:** C1, A1 | **Blocks:** All UI gating

```typescript
// src/contexts/SubscriptionContext.tsx
interface SubscriptionContextType {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isActive: boolean;
  isCollector: boolean;
  isConnoisseur: boolean;
  canAccess: (feature: Feature) => boolean;
  openUpgrade: (feature?: Feature) => void;
  loading: boolean;
}
```

Key logic:
- Fetch subscription from user profile
- Provide canAccess helper
- Manage upgrade modal state
- Cache subscription status

**Deliverable:** App-wide subscription state

---

### C3. useSubscription hook
**Estimate:** 20 min | **Depends on:** C2 | **Blocks:** Component usage

```typescript
// src/hooks/useSubscription.ts
export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}
```

**Deliverable:** Clean hook for components

---

### C4. Wrap app in SubscriptionProvider
**Estimate:** 15 min | **Depends on:** C2 | **Blocks:** All gating

Update `src/app/layout.tsx` or providers to include SubscriptionProvider.

**Deliverable:** Subscription context available everywhere

---

## Group D: Core UI Components

### D1. PaywallModal component
**Estimate:** 1.5 hours | **Depends on:** C2 | **Blocks:** All feature gating

```typescript
// src/components/subscription/PaywallModal.tsx
interface PaywallModalProps {
  feature: Feature;
  isOpen: boolean;
  onClose: () => void;
}
```

Design:
- Shows which feature is locked
- Explains what tier unlocks it
- CTA button → checkout
- Secondary: "Learn more" → pricing page

**Deliverable:** Reusable paywall modal

---

### D2. UpgradePrompt component
**Estimate:** 45 min | **Depends on:** C2 | **Blocks:** Inline prompts

```typescript
// src/components/subscription/UpgradePrompt.tsx
interface UpgradePromptProps {
  feature: Feature;
  variant: 'inline' | 'banner' | 'card';
  message?: string;
}
```

Inline, non-modal upgrade prompts for contextual placement.

**Deliverable:** Inline upgrade prompts

---

### D3. PricingTable component
**Estimate:** 2 hours | **Depends on:** B3 | **Blocks:** Pricing page

```typescript
// src/components/subscription/PricingTable.tsx
```

Design:
- 3 columns: Free / Collector / Connoisseur
- Feature comparison rows with checkmarks
- Monthly/Annual toggle
- "Current plan" indicator if logged in
- CTA buttons per tier

**Deliverable:** Full pricing comparison table

---

### D4. Pricing page
**Estimate:** 1 hour | **Depends on:** D3 | **Blocks:** Launch

```typescript
// src/app/pricing/page.tsx
```

- Hero section
- PricingTable
- FAQ section
- SEO metadata

**Deliverable:** /pricing page live

---

### D5. SubscriptionBadge component
**Estimate:** 30 min | **Depends on:** C2 | **Blocks:** Nothing

```typescript
// src/components/subscription/SubscriptionBadge.tsx
```

Small badge showing tier (Collector/Connoisseur) for header/profile.

**Deliverable:** Visual tier indicator

---

## Group E: Feature Gating

### E1. 72-hour data delay for free users
**Estimate:** 1.5 hours | **Depends on:** C2 | **Blocks:** Nothing

**Backend changes:**
```typescript
// src/app/api/browse/route.ts
// Add to query if user is free tier:
if (userTier === 'free') {
  query = query.lte('first_seen_at',
    new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
  );
}
```

**Frontend indicator:**
```typescript
// src/components/collector/DataFreshnessIndicator.tsx
// Shows "Listed 3 days ago" for free users
// "Real-time" badge for paid
```

**Banner for free users:**
- Dismissable notice explaining delay
- Link to upgrade

**Deliverable:** Free users see 72h delayed data

---

### E2. Gate inquiry email generator
**Estimate:** 45 min | **Depends on:** C2, D1 | **Blocks:** Nothing

**Modify:** `src/components/InquiryModal.tsx`
- Check `canAccess('inquiry_emails')`
- If false, show PaywallModal instead of generating
- For free users, show "Contact dealer directly" with link

**Deliverable:** Inquiry emails require Collector

---

### E3. Hide saved searches for free tier
**Estimate:** 30 min | **Depends on:** C2, D1 | **Blocks:** Nothing

**Backend:**
```typescript
// src/app/api/saved-searches/route.ts (POST)
if (userTier === 'free') {
  return Response.json({ error: 'upgrade_required', feature: 'saved_searches' }, { status: 403 });
}
```

**Frontend:**
- Hide "Save Search" button for free users
- Or show it but trigger PaywallModal on click
- Saved searches page shows upgrade prompt if free

**Deliverable:** Saved searches require Collector+

---

### E4. Disable alerts for non-Connoisseur
**Estimate:** 30 min | **Depends on:** C2 | **Blocks:** Nothing

**Modify:** Saved search form / alert toggle
- Hide or disable alert options for free/collector
- Show "Alerts require Connoisseur" tooltip
- Link to upgrade

**Deliverable:** Alerts are Connoisseur-only

---

## Group F: Setsumei Translation Feature

### F1. Translation API route
**Estimate:** 1.5 hours | **Depends on:** A2, C2 | **Blocks:** F2

```typescript
// src/app/api/setsumei/[listingId]/route.ts
```

Logic:
1. Check user has Collector+ tier
2. Check if translation exists in cache table
3. If not, fetch listing's setsumei text
4. Call Claude API to translate
5. Store in setsumei_translations table
6. Return translated text

**Deliverable:** API returns translated setsumei

---

### F2. SetsumeiTranslation component
**Estimate:** 1.5 hours | **Depends on:** F1, D1 | **Blocks:** Nothing

```typescript
// src/components/collector/SetsumeiTranslation.tsx
interface Props {
  listingId: string;
  originalText: string;
}
```

Design:
- For free users: Show Japanese text + lock icon + upgrade prompt
- For paid users: Fetch translation, show loading state, display
- Toggle between Japanese/English

**Deliverable:** Setsumei translation in listing detail

---

### F3. Integrate into listing detail
**Estimate:** 30 min | **Depends on:** F2 | **Blocks:** Nothing

Add SetsumeiTranslation component to listing detail page where setsumei data exists.

**Deliverable:** Translations visible on listing pages

---

## Group G: Final Polish

### G1. Add subscription to profile page
**Estimate:** 45 min | **Depends on:** D5, B5 | **Blocks:** Nothing

- Show current tier with badge
- "Manage subscription" button → Stripe portal
- Upgrade options if on free tier

**Deliverable:** Users can see/manage subscription

---

### G2. Upgrade success page
**Estimate:** 30 min | **Depends on:** B3 | **Blocks:** Nothing

```typescript
// src/app/subscription/success/page.tsx
```

- Confirmation message
- What they now have access to
- CTA to explore features

**Deliverable:** Clean post-checkout experience

---

### G3. Email templates
**Estimate:** 1 hour | **Depends on:** Nothing | **Blocks:** Nothing (nice to have)

- Welcome email for new Collector
- Subscription cancelled
- Payment failed warning

**Deliverable:** Transactional emails for subscription events

---

## Task Sequencing

### Critical Path (Must be sequential)

```
A1 (DB) → B2 (Stripe lib) → B3 (Checkout) → B4 (Webhook) → Launch-ready
                ↓
           C1 (Utils) → C2 (Context) → D1 (Paywall) → E1-E5 (Gating)
```

### Can Be Parallelized

Once A1 + B1 are done, these can run in parallel:
- B3 + B4 + B5 (Stripe routes)
- C1 + C2 + C3 (Context/hooks)
- D1 + D2 + D3 (UI components)

Once context is ready, these can run in parallel:
- E1 (72h delay)
- E2 (Inquiry gate)
- E3 (Saved searches gate)
- E4 (Saved search limit)
- E5 (Alerts gate)
- F1 + F2 (Setsumei)

---

## Recommended Order of Implementation

### Day 1: Foundation
1. A1 - Subscription migration
2. A2 - Setsumei table migration
3. A3 - TypeScript types
4. B1 - Install Stripe, create products

### Day 2: Stripe Integration
5. B2 - Stripe utility lib
6. B3 - Checkout route
7. B4 - Webhook handler
8. B5 - Portal route

### Day 3: Context & Core UI
9. C1 - Subscription utils
10. C2 - Subscription context
11. C3 - useSubscription hook
12. C4 - Wrap app in provider
13. D1 - PaywallModal

### Day 4: Pricing & Gating
14. D3 - PricingTable
15. D4 - Pricing page
16. E1 - 72h data delay
17. E2 - Gate inquiry emails

### Day 5: Gating & Setsumei
18. E3 - Saved searches gate
19. E4 - Disable alerts
20. F1 - Setsumei API

### Day 6: Polish & Launch
21. F2 - Setsumei component
22. F3 - Integrate setsumei
23. D2 - UpgradePrompt
24. D5 - SubscriptionBadge
25. G1 - Profile subscription section
26. G2 - Success page
27. G3 - Email templates (optional)

---

## Definition of Done

Phase 1 is complete when:

- [ ] Free user sees 72h delayed listings
- [ ] Free user cannot generate inquiry emails
- [ ] Free user can favorite items (no limit)
- [ ] Free user cannot save searches
- [ ] Free user cannot enable alerts
- [ ] Free user sees locked setsumei translation
- [ ] Collector can access all above features
- [ ] /pricing page shows tier comparison
- [ ] Stripe checkout flow works end-to-end
- [ ] Webhooks update user subscription status
- [ ] Profile page shows subscription status
- [ ] Users can manage billing via Stripe portal

---

## Testing Checklist

### Manual Testing Flow

1. **As logged-out user:**
   - Can browse (delayed data)
   - Prompted to sign up for features

2. **As free user:**
   - See 72h delayed listings
   - Can favorite items (unlimited)
   - Cannot save searches
   - Cannot generate inquiry email
   - See locked setsumei
   - Can start checkout flow

3. **Complete checkout as Collector:**
   - Stripe checkout works
   - Redirected to success page
   - Profile shows Collector tier
   - All gated features now accessible

4. **As Collector:**
   - See real-time listings
   - Can save searches (no alerts)
   - Can generate inquiry emails
   - Can see translated setsumei
   - Cannot enable alerts (Connoisseur only)

5. **Cancel subscription:**
   - Use Stripe portal
   - Downgraded to free
   - Features re-gated

---

*Phase 1 Breakdown - Nihontowatch Pro Tier*
