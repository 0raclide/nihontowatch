# Nihontowatch Pro Tier Strategy

## Executive Summary

This document outlines the monetization strategy for Nihontowatch through a tiered subscription model. The strategy is designed for a niche market with a small TAM but high-value customers (enthusiasts spending $50-100K/year on nihonto).

**Target Revenue:** $10-15K/month at maturity (~$150K ARR)

---

## Current State Analysis

### What Exists Today

| Category | Status | Details |
|----------|--------|---------|
| **Browse/Search** | ✅ Complete | Faceted filters, infinite scroll, currency conversion |
| **Listing Detail** | ✅ Complete | Full specs, images, dealer links, price history |
| **User Auth** | ✅ Complete | Magic link + password auth, profiles table |
| **Favorites** | ✅ Complete | Watchlist with heart toggle |
| **Saved Searches** | ✅ Complete | Save filter combinations with names |
| **Alerts** | ✅ Complete | Price drop, new listing, back-in-stock (cron jobs) |
| **Inquiry Emails** | ✅ Complete | AI-generated Japanese business emails |
| **Admin Dashboard** | ✅ Complete | Users, activity, scrapers, analytics |
| **Email Infrastructure** | ✅ Complete | SendGrid integration, templates |
| **Setsumei Data** | ✅ Exists | Stored in listings, not translated on frontend |
| **Subscriptions** | ❌ Not Started | No payment processing, no tier logic |
| **Private Listings** | ❌ Not Started | No dealer submission portal |
| **LINE Integration** | ❌ Not Started | No chat/messaging |

### Key Assets to Leverage

1. **Existing alert infrastructure** → Gate behind tiers
2. **Inquiry email generator** → Already built, gate behind Enthusiast tier
3. **Setsumei data in DB** → Add translation layer, gate behind Enthusiast tier
4. **User/auth system** → Add subscription_tier to profiles

---

## Tier Structure

### Free Tier — *Window Shopping*

**Target:** Casual browsers, new enthusiasts, tire-kickers

| Feature | Implementation |
|---------|----------------|
| Browse listings | 72-hour delay on new listings |
| Basic filters | All filters available |
| Listing detail | Full detail, but setsumei in Japanese only |
| Currency conversion | Available |
| Favorites | Unlimited |
| Saved searches | Not available |
| Alerts | Not available |
| Inquiry emails | Not available — link to dealer site only |

**Conversion triggers:**
- Clicking sold items ("You're seeing this 72h late")
- Trying to save a search
- Trying to save a search
- Seeing locked setsumei translation
- Wanting to send inquiry email

---

### Enthusiast Tier — $25/month ($225/year)

**Target:** Active enthusiasts who buy 2-10 pieces/year

| Feature | Implementation |
|---------|----------------|
| Fresh data | Real-time listings (no 72h delay) |
| Setsumei translation | AI-translated certification descriptions |
| Inquiry email drafts | Full access to AI email generator |
| Unlimited favorites | No cap |
| Saved searches with alerts | Multiple saved searches + instant/daily notifications |
| Price history | Full historical data |
| Export data | CSV/Excel exports |

**Value proposition:** Remove friction from the buying process
- See listings when they drop (not 3 days late)
- Understand what papers say (translated setsumei)
- Contact dealers properly (email drafts)

---

### Connoisseur Tier — $200/month ($1,800/year)

**Target:** Serious enthusiasts spending $50K+/year

| Feature | Implementation |
|---------|----------------|
| Everything in Enthusiast | All Enthusiast features |
| Private dealer offerings | Exclusive inventory not shown publicly |
| Artist certification stats | Juyo/Tokuju/Bunkazai/Bijutsuhin/Kokuho counts per artist |
| Yuhinkai Discord | Private community of serious collectors |
| LINE with Hoshi | Direct access to expert guidance |
| Early access | See new listings before Enthusiast tier (optional) |
| Collection tracker | Private collection management (Phase 2) |

**Value proposition:** Access, expertise, rare data, and community
- Get notified instantly when your target appears
- See items that never go public
- Research-grade certification statistics by artist
- Join the Yuhinkai — private community of serious collectors
- Talk to someone who knows the market

---

### Dealer Tier — $150/month (Phase 2)

**Target:** The 27+ dealers in the system

| Feature | Implementation |
|---------|----------------|
| Analytics dashboard | Views, saves, inquiries on their listings |
| Competitor intelligence | Price comparisons for similar items |
| Lead insights | Anonymized demand signals |
| Featured placement | Promoted listings (optional add-on) |
| Private offering submission | Submit exclusive items for Connoisseur members |

---

## Revenue Projections

### Conservative Scenario (Year 1)

| Tier | Users | Rate | Monthly | Annual |
|------|-------|------|---------|--------|
| Free | 3,000 | $0 | $0 | $0 |
| Enthusiast | 100 | $25 | $2,500 | $30,000 |
| Connoisseur | 15 | $200 | $3,000 | $36,000 |
| **Total** | | | **$5,500** | **$66,000** |

### Target Scenario (Year 2)

| Tier | Users | Rate | Monthly | Annual |
|------|-------|------|---------|--------|
| Free | 8,000 | $0 | $0 | $0 |
| Enthusiast | 300 | $25 | $7,500 | $90,000 |
| Connoisseur | 40 | $200 | $8,000 | $96,000 |
| Dealer | 10 | $150 | $1,500 | $18,000 |
| **Total** | | | **$17,000** | **$204,000** |

---

## Technical Architecture

### Database Changes

```sql
-- Add subscription fields to profiles
ALTER TABLE profiles ADD COLUMN subscription_tier TEXT DEFAULT 'free'
  CHECK (subscription_tier IN ('free', 'enthusiast', 'connoisseur', 'dealer'));
ALTER TABLE profiles ADD COLUMN subscription_status TEXT DEFAULT 'inactive'
  CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'past_due'));
ALTER TABLE profiles ADD COLUMN subscription_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN subscription_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN stripe_subscription_id TEXT;

-- Private listings table
CREATE TABLE private_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id),
  dealer_id UUID REFERENCES dealers(id),
  title TEXT NOT NULL,
  description TEXT,
  price_value NUMERIC,
  price_currency TEXT DEFAULT 'JPY',
  images JSONB DEFAULT '[]',
  visibility TEXT DEFAULT 'all_connoisseurs'
    CHECK (visibility IN ('all_connoisseurs', 'selected_users')),
  visible_to_users UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'sold', 'withdrawn', 'expired'))
);

-- Private listing inquiries
CREATE TABLE private_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  private_listing_id UUID REFERENCES private_listings(id),
  user_id UUID REFERENCES profiles(id),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  dealer_response TEXT,
  responded_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'responded', 'closed'))
);

-- Connoisseur applications (for vetting)
CREATE TABLE connoisseur_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  collecting_focus TEXT[], -- ['swords', 'tosogu', 'koshirae']
  seeking_description TEXT,
  annual_budget_range TEXT,
  collecting_experience TEXT,
  collection_photos JSONB DEFAULT '[]',
  references TEXT,
  line_id TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LINE chat tracking (for Connoisseur tier)
CREATE TABLE line_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) UNIQUE,
  line_user_id TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

-- Setsumei translations cache
CREATE TABLE setsumei_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) UNIQUE,
  original_text TEXT,
  translated_text TEXT,
  translation_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Routes to Add

```
# Subscription Management
POST   /api/subscription/checkout     # Create Stripe checkout session
POST   /api/subscription/portal       # Stripe customer portal
POST   /api/subscription/webhook      # Stripe webhook handler
GET    /api/subscription/status       # Current subscription status

# Tier-gated Features
GET    /api/setsumei/[listingId]      # Translated setsumei (Enthusiast+)
GET    /api/private-listings          # Private offerings (Connoisseur)
POST   /api/private-listings/inquiry  # Send inquiry (Connoisseur)

# Connoisseur Application
POST   /api/connoisseur/apply         # Submit application
GET    /api/connoisseur/status        # Application status

# Dealer Portal (Phase 2)
POST   /api/dealer/private-listing    # Submit private offering
GET    /api/dealer/analytics          # View analytics
GET    /api/dealer/inquiries          # View inquiries

# Admin
GET    /api/admin/applications        # Review Connoisseur apps
POST   /api/admin/applications/[id]   # Approve/reject
```

### Component Structure

```
src/components/
├── subscription/
│   ├── PricingTable.tsx           # Tier comparison
│   ├── SubscriptionCard.tsx       # Individual tier card
│   ├── UpgradePrompt.tsx          # Contextual upgrade CTA
│   ├── PaywallModal.tsx           # "Upgrade to access"
│   ├── SubscriptionBadge.tsx      # Show current tier
│   └── BillingPortal.tsx          # Manage subscription
├── connoisseur/
│   ├── ApplicationForm.tsx        # Apply for Connoisseur
│   ├── PrivateListingFeed.tsx     # Private offerings view
│   ├── PrivateListingCard.tsx     # Individual private item
│   ├── PrivateInquiryModal.tsx    # Send inquiry
│   └── LineConnectCard.tsx        # Connect LINE account
├── enthusiast/
│   ├── SetsumeiTranslation.tsx    # Translated setsumei display
│   └── DataFreshnessIndicator.tsx # Show data delay for free
└── dealer/  (Phase 2)
    ├── DealerDashboard.tsx
    ├── PrivateListingForm.tsx
    └── InquiryList.tsx
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Subscription infrastructure + Enthusiast tier launch

| Task | Priority | Effort |
|------|----------|--------|
| Add subscription fields to profiles table | P0 | 1h |
| Integrate Stripe (checkout, portal, webhooks) | P0 | 4h |
| Create PricingTable component | P0 | 3h |
| Build PaywallModal for gated features | P0 | 2h |
| Implement 72h data delay for free tier | P0 | 2h |
| Build SetsumeiTranslation component | P0 | 3h |
| Gate inquiry email behind Enthusiast | P0 | 1h |
| Gate alerts behind tiers | P0 | 2h |
| Add SubscriptionBadge to header/profile | P1 | 1h |
| Upgrade prompts at conversion points | P1 | 3h |
| Email templates for subscription events | P1 | 2h |
| **Total** | | **~24h** |

**Deliverables:**
- Stripe integration working
- Free vs Enthusiast tier enforcement
- Setsumei translations live
- Inquiry emails gated
- 72h delay for free users

---

### Phase 2: Connoisseur Tier (Week 3-4)

**Goal:** Private listings + LINE integration + application flow

| Task | Priority | Effort |
|------|----------|--------|
| Create private_listings table + API | P0 | 3h |
| Build Connoisseur application form | P0 | 4h |
| Admin interface for reviewing applications | P0 | 3h |
| PrivateListingFeed component | P0 | 4h |
| PrivateInquiryModal | P0 | 2h |
| LINE connection flow + storage | P1 | 3h |
| LINE QR/link reveal for Connoisseurs | P1 | 1h |
| Private listing notification emails | P1 | 2h |
| **Total** | | **~23h** |

**Deliverables:**
- Connoisseur application flow
- Private listings visible to Connoisseurs
- Inquiry system for private items
- LINE access gated to tier

---

### Phase 3: Polish & Conversion Optimization (Week 5-6)

**Goal:** Maximize conversion through UX improvements

| Task | Priority | Effort |
|------|----------|--------|
| Upgrade prompts on sold item clicks | P0 | 2h |
| "X private listings this week" teaser | P0 | 2h |
| Favorites limit for free tier (10) | P1 | 1h |
| Saved search limit for free tier (1) | P1 | 1h |
| Annual pricing option (discount) | P1 | 2h |
| Subscription analytics in admin | P1 | 3h |
| Founding member badge/pricing | P2 | 2h |
| Referral system | P2 | 4h |
| **Total** | | **~17h** |

---

### Phase 4: Dealer Tier (Week 7-8)

**Goal:** Monetize dealers + enable private listing submission

| Task | Priority | Effort |
|------|----------|--------|
| Dealer subscription tier in Stripe | P0 | 1h |
| Dealer analytics dashboard | P0 | 6h |
| Private listing submission form | P0 | 4h |
| Dealer inquiry management | P0 | 3h |
| Competitor pricing intelligence | P1 | 4h |
| Lead demand signals | P2 | 4h |
| **Total** | | **~22h** |

---

## Gating Logic

### Feature Access Matrix

| Feature | Free | Enthusiast | Connoisseur | Dealer |
|---------|------|-----------|-------------|--------|
| Browse listings | 72h delay | Real-time | Real-time | Real-time |
| Listing detail | ✓ | ✓ | ✓ | ✓ |
| Setsumei (Japanese) | ✓ | ✓ | ✓ | ✓ |
| Setsumei (translated) | ✗ | ✓ | ✓ | ✓ |
| Inquiry email drafts | ✗ | ✓ | ✓ | ✓ |
| Favorites | Unlimited | Unlimited | Unlimited | Unlimited |
| Saved searches | ✗ | Unlimited + alerts | Unlimited + alerts | Unlimited |
| Search alerts | ✗ | ✓ | ✓ | ✓ |
| Artist certification stats | ✗ | ✗ | ✓ | ✗ |
| Yuhinkai Discord | ✗ | ✗ | ✓ | ✗ |
| Price history | Basic | Full | Full | Full |
| Export data | ✗ | ✓ | ✓ | ✓ |
| Private listings | ✗ | ✗ | ✓ | Submit only |
| LINE with Hoshi | ✗ | ✗ | ✓ | ✗ |
| Dealer analytics | ✗ | ✗ | ✗ | ✓ |

### Implementation Pattern

```typescript
// lib/subscription.ts
export type SubscriptionTier = 'free' | 'enthusiast' | 'connoisseur' | 'dealer';

export function canAccess(
  userTier: SubscriptionTier,
  feature: string
): boolean {
  const access: Record<string, SubscriptionTier[]> = {
    'fresh_data': ['enthusiast', 'connoisseur', 'dealer'],
    'setsumei_translation': ['enthusiast', 'connoisseur', 'dealer'],
    'inquiry_emails': ['enthusiast', 'connoisseur', 'dealer'],
    'saved_searches': ['enthusiast', 'connoisseur', 'dealer'],
    'search_alerts': ['enthusiast', 'connoisseur', 'dealer'],
    'private_listings': ['connoisseur'],
    'artist_stats': ['connoisseur'],  // Juyo/Tokuju/Bunkazai/Kokuho counts
    'yuhinkai_discord': ['connoisseur'],  // Private community access
    'line_access': ['connoisseur'],
    'dealer_analytics': ['dealer'],
    'export_data': ['enthusiast', 'connoisseur', 'dealer'],
  };

  return access[feature]?.includes(userTier) ?? false;
}

// Hook for components
export function useSubscription() {
  const { user } = useAuth();
  const tier = user?.subscription_tier ?? 'free';

  return {
    tier,
    isEnthusiast: tier === 'enthusiast' || tier === 'connoisseur',
    isConnoisseur: tier === 'connoisseur',
    isDealer: tier === 'dealer',
    canAccess: (feature: string) => canAccess(tier, feature),
  };
}
```

---

## Stripe Integration

### Products to Create

| Product | Price ID | Billing |
|---------|----------|---------|
| Enthusiast Monthly | price_enthusiast_monthly | $25/mo |
| Enthusiast Annual | price_enthusiast_annual | $225/yr (25% off) |
| Connoisseur Monthly | price_connoisseur_monthly | $200/mo |
| Connoisseur Annual | price_connoisseur_annual | $1,800/yr (25% off) |
| Dealer Monthly | price_dealer_monthly | $150/mo |

### Webhook Events to Handle

```typescript
// /api/subscription/webhook
switch (event.type) {
  case 'checkout.session.completed':
    // Activate subscription
    break;
  case 'customer.subscription.updated':
    // Handle tier changes, renewals
    break;
  case 'customer.subscription.deleted':
    // Downgrade to free
    break;
  case 'invoice.payment_failed':
    // Mark as past_due, send warning
    break;
}
```

---

## Conversion Optimization

### Upgrade Trigger Points

| Trigger | Message | CTA |
|---------|---------|-----|
| Click sold listing | "This sold 2 days ago. See listings in real-time." | Upgrade to Enthusiast |
| View setsumei | "Translation available for Enthusiasts" | Unlock Translation |
| Try inquiry email | "Draft emails with Enthusiast" | Upgrade to Enthusiast |
| Try to save search | "Save searches with alerts for Enthusiasts" | Upgrade to Enthusiast |
| View artist on listing | "This artist has 23 Juyo. See full stats." | Upgrade to Connoisseur |
| View private listing teaser | "3 private offerings this week" | Apply for Connoisseur |

### Teaser Content for Free/Enthusiast

```tsx
// On browse page for Enthusiast users
<div className="bg-gold/10 p-4 rounded-lg">
  <p className="text-sm">
    <strong>5 private offerings</strong> were shared with Connoisseur
    members this week.
    <Link href="/connoisseur">Learn more →</Link>
  </p>
</div>
```

---

## Artist Certification Statistics (Connoisseur Feature)

### What This Is

A database of certification counts for every Juyo-capable artist — both swordsmiths and tosogu makers:

**Swordsmiths:**
| Artist | School | Era | Juyo | Tokuju | Bunkazai | Kokuho |
|--------|--------|-----|------|--------|----------|--------|
| Osafune Kanemitsu | Bizen | Nanbokucho | 45 | 12 | 2 | 0 |
| Awataguchi Yoshimitsu | Yamashiro | Kamakura | 8 | 5 | 1 | 1 |
| Masamune | Soshu | Kamakura | 12 | 8 | 3 | 2 |

**Tosogu Artists:**
| Artist | School | Era | Juyo | Tokuju | Bunkazai | Kokuho |
|--------|--------|-----|------|--------|----------|--------|
| Goto Yujo | Goto | Muromachi | 38 | 15 | 4 | 0 |
| Yokoya Somin | Yokoya | Edo | 22 | 8 | 1 | 0 |
| Natsuo | — | Meiji | 12 | 3 | 0 | 0 |

### Why This Is Valuable

1. **Research-grade data** — This information is scattered across Japanese publications, auction records, and NBTHK archives. No single English source compiles it.

2. **Purchase decisions** — "Is this artist's work regularly recognized at Juyo level?" helps evaluate if a piece is from a proven maker.

3. **Collection planning** — Understand which artists have museum-quality recognition vs. emerging appreciation.

4. **Market intelligence** — Tokuju count indicates scarcity and demand for top-tier examples.

### How It Displays

**On listing detail page (Connoisseur):**
```
┌─────────────────────────────────────────┐
│ ARTIST: Goto Yujo (後藤祐乗)             │
│ School: Goto | Era: Muromachi           │
│                                         │
│ Certification Record:                   │
│ ████████████████████ Juyo: 38           │
│ ██████             Tokuju: 15           │
│ ████               Bunkazai: 4          │
│                                         │
│ Founder of the Goto school. Among the   │
│ most recognized tosogu artists with     │
│ exceptional Tokuju representation.      │
└─────────────────────────────────────────┘
```

**On listing detail page (Free/Enthusiast):**
```
┌─────────────────────────────────────────┐
│ ARTIST: Goto Yujo                       │
│                                         │
│ 🔒 Certification statistics available   │
│    for Connoisseur members              │
│                                         │
│ This artist has 38+ Juyo certifications.│
│ [Unlock Full Stats]                     │
└─────────────────────────────────────────┘
```

### Data Sources

- NBTHK Juyo Token Nado Zufu (published volumes)
- NBTHK Juyo Tosogu Nado Zufu (tosogu volumes)
- Token Bijutsu magazine archives
- Agency for Cultural Affairs Bunkazai database
- Published auction records (Bonhams, Christie's)
- Manual research and verification

---

## Success Metrics

### Launch Targets (90 days)

| Metric | Target |
|--------|--------|
| Enthusiast subscribers | 50 |
| Connoisseur subscribers | 10 |
| MRR | $3,250 |
| Free → Enthusiast conversion | 3% |
| Enthusiast → Connoisseur conversion | 15% |

### Tracking

- Subscription events in Supabase (start, cancel, upgrade, downgrade)
- Stripe dashboard for revenue metrics
- Admin dashboard: subscriber counts by tier, churn rate
- Conversion funnel: paywall views → checkout starts → completions

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Low conversion | A/B test pricing, add more free value first |
| High churn | Focus on Connoisseur stickiness (LINE relationship) |
| Dealer reluctance for private listings | Start with 2-3 trusted dealers, prove value |
| Support burden from LINE | Set response time expectations, batch responses |
| Stripe complexity | Use Stripe's hosted checkout/portal to minimize code |

---

## Open Questions

1. **Founding member pricing?** Lock in early adopters at discounted rate?
2. **Trial period?** 7-day free trial for Enthusiast?
3. **Refund policy?** Pro-rated refunds or none?
4. **Geographic pricing?** Different rates for Japan vs US vs EU?
5. **Team/family plans?** Multiple users on one Connoisseur subscription?

---

## Next Steps

1. **Approve this strategy** — Finalize tier features and pricing
2. **Set up Stripe account** — Create products and prices
3. **Start Phase 1** — Foundation + Enthusiast tier
4. **Recruit beta Connoisseurs** — 5-10 serious enthusiasts for launch

---

*Document created: January 2025*
*Last updated: January 2025*
