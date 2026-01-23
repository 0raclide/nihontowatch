# Pro Tier Implementation Checklist

Actionable implementation guide for Nihontowatch subscription tiers.

---

## Phase 1: Foundation + Collector Tier

### 1.1 Database Schema

- [ ] **Migration: Add subscription fields to profiles**
  ```sql
  -- supabase/migrations/037_subscription_fields.sql
  ALTER TABLE profiles ADD COLUMN subscription_tier TEXT DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'collector', 'connoisseur', 'dealer'));
  ALTER TABLE profiles ADD COLUMN subscription_status TEXT DEFAULT 'inactive'
    CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'past_due'));
  ALTER TABLE profiles ADD COLUMN subscription_started_at TIMESTAMPTZ;
  ALTER TABLE profiles ADD COLUMN subscription_expires_at TIMESTAMPTZ;
  ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
  ALTER TABLE profiles ADD COLUMN stripe_subscription_id TEXT;

  -- Index for tier-based queries
  CREATE INDEX idx_profiles_subscription_tier ON profiles(subscription_tier);
  ```

- [ ] **Migration: Setsumei translations table**
  ```sql
  -- supabase/migrations/038_setsumei_translations.sql
  CREATE TABLE setsumei_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE UNIQUE,
    original_text TEXT,
    translated_text TEXT,
    translator TEXT DEFAULT 'claude', -- 'claude' | 'manual'
    confidence NUMERIC, -- 0-1 translation confidence
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX idx_setsumei_listing ON setsumei_translations(listing_id);
  ```

### 1.2 Stripe Integration

- [ ] **Install Stripe SDK**
  ```bash
  npm install stripe @stripe/stripe-js
  ```

- [ ] **Environment variables**
  ```env
  # .env.local
  STRIPE_SECRET_KEY=sk_live_xxx
  STRIPE_WEBHOOK_SECRET=whsec_xxx
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

  # Stripe Price IDs (create in Stripe Dashboard first)
  STRIPE_PRICE_COLLECTOR_MONTHLY=price_xxx
  STRIPE_PRICE_COLLECTOR_ANNUAL=price_xxx
  STRIPE_PRICE_CONNOISSEUR_MONTHLY=price_xxx
  STRIPE_PRICE_CONNOISSEUR_ANNUAL=price_xxx
  ```

- [ ] **Create: `src/lib/stripe.ts`**
  ```typescript
  import Stripe from 'stripe';

  export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
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
  ```

- [ ] **Create: `src/app/api/subscription/checkout/route.ts`**
  - Accept tier + billing period
  - Create Stripe checkout session
  - Include user email, metadata
  - Redirect to Stripe hosted checkout

- [ ] **Create: `src/app/api/subscription/portal/route.ts`**
  - Create Stripe billing portal session
  - Allow subscription management

- [ ] **Create: `src/app/api/subscription/webhook/route.ts`**
  - Handle `checkout.session.completed`
  - Handle `customer.subscription.updated`
  - Handle `customer.subscription.deleted`
  - Handle `invoice.payment_failed`
  - Update profiles table accordingly

- [ ] **Create: `src/app/api/subscription/status/route.ts`**
  - Return current subscription tier/status
  - Cache for performance

### 1.3 Subscription Context & Hooks

- [ ] **Create: `src/contexts/SubscriptionContext.tsx`**
  ```typescript
  type SubscriptionTier = 'free' | 'collector' | 'connoisseur' | 'dealer';

  interface SubscriptionContext {
    tier: SubscriptionTier;
    status: 'active' | 'inactive' | 'cancelled' | 'past_due';
    isCollector: boolean;
    isConnoisseur: boolean;
    canAccess: (feature: Feature) => boolean;
    openUpgradeModal: (feature?: Feature) => void;
  }
  ```

- [ ] **Create: `src/lib/subscription.ts`**
  ```typescript
  export type Feature =
    | 'fresh_data'
    | 'setsumei_translation'
    | 'inquiry_emails'
    | 'saved_searches'
    | 'search_alerts'
    | 'private_listings'
    | 'smith_stats'
    | 'line_access'
    | 'export_data';

  export const FEATURE_ACCESS: Record<Feature, SubscriptionTier[]> = {
    fresh_data: ['collector', 'connoisseur', 'dealer'],
    setsumei_translation: ['collector', 'connoisseur', 'dealer'],
    inquiry_emails: ['collector', 'connoisseur', 'dealer'],
    saved_searches: ['collector', 'connoisseur', 'dealer'],
    search_alerts: ['connoisseur'],
    private_listings: ['connoisseur'],
    smith_stats: ['connoisseur'],  // Juyo/Tokuju/Bunkazai/Bijutsuhin/Kokuho
    line_access: ['connoisseur'],
    export_data: ['collector', 'connoisseur', 'dealer'],
  };

  // Favorites are NOT gated - available to all users (valuable intent data)
  ```

- [ ] **Create: `src/hooks/useSubscription.ts`**
  - Wrap context for easy access
  - Memoize canAccess checks

### 1.4 Subscription UI Components

- [ ] **Create: `src/components/subscription/PricingTable.tsx`**
  - Three-column tier comparison
  - Feature checkmarks
  - CTA buttons for each tier
  - Annual/monthly toggle
  - Highlight current tier if logged in

- [ ] **Create: `src/components/subscription/PaywallModal.tsx`**
  - Triggered when accessing gated feature
  - Shows which feature is locked
  - Displays upgrade options
  - Direct checkout button

- [ ] **Create: `src/components/subscription/UpgradePrompt.tsx`**
  - Inline prompt for upgrade
  - Contextual messaging
  - Less intrusive than modal

- [ ] **Create: `src/components/subscription/SubscriptionBadge.tsx`**
  - Small badge showing tier
  - Used in header/profile
  - Color-coded by tier

- [ ] **Create: `src/app/pricing/page.tsx`**
  - Standalone pricing page
  - SEO optimized
  - Full feature comparison

### 1.5 Data Freshness Gating (Free = 72h delay)

- [ ] **Modify: `src/app/api/browse/route.ts`**
  ```typescript
  // Add to query based on user tier
  if (userTier === 'free') {
    query = query.lte('first_seen_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString());
  }
  ```

- [ ] **Create: `src/components/collector/DataFreshnessIndicator.tsx`**
  - Show "Listed 3 days ago" on listings for free users
  - "Real-time data" badge for paid users
  - Upgrade prompt on hover/click

- [ ] **Add delay messaging**
  - Banner on browse page for free users
  - Dismissable but persistent
  - Links to upgrade

### 1.6 Setsumei Translation

- [ ] **Create: `src/app/api/setsumei/[listingId]/route.ts`**
  - Check if translation exists in cache table
  - If not, generate with Claude API
  - Store in setsumei_translations table
  - Return translated text
  - Gate behind Collector+ tier

- [ ] **Create: `src/components/collector/SetsumeiTranslation.tsx`**
  - Display translated setsumei
  - Toggle between Japanese/English
  - Loading state while translating
  - Paywall for free users

- [ ] **Modify: Listing detail page**
  - Add SetsumeiTranslation component
  - Show lock icon for free users
  - "Unlock with Collector" prompt

### 1.7 Gate Inquiry Emails

- [ ] **Modify: `src/components/InquiryModal.tsx`**
  - Check subscription tier before generating
  - Show PaywallModal if free
  - Allow full access for Collector+

- [ ] **Alternative for free users**
  - Show "Contact dealer directly" with link
  - No AI-generated email draft

### 1.8 Favorites & Saved Search Limits

- [ ] **Modify: Favorites logic**
  - Free tier: max 10 favorites
  - Show count "7/10 favorites used"
  - PaywallModal when hitting limit

- [ ] **Modify: Saved searches logic**
  - Free tier: max 1 saved search
  - Collector: unlimited, but no alerts
  - Connoisseur: unlimited + alerts

- [ ] **Disable alerts for Collector**
  - Save search works
  - Alert toggle hidden/disabled
  - "Upgrade to Connoisseur for alerts"

---

## Phase 2: Connoisseur Tier

### 2.1 Connoisseur Application Flow

- [ ] **Migration: Applications table**
  ```sql
  -- supabase/migrations/039_connoisseur_applications.sql
  CREATE TABLE connoisseur_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    collecting_focus TEXT[] DEFAULT '{}',
    seeking_description TEXT,
    annual_budget_range TEXT,
    collecting_years TEXT,
    collection_photos JSONB DEFAULT '[]',
    dealer_references TEXT,
    line_id TEXT,
    status TEXT DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, status) -- One pending application per user
  );
  ```

- [ ] **Create: `src/app/connoisseur/page.tsx`**
  - Marketing page for Connoisseur tier
  - Benefits overview
  - "Apply for Access" CTA

- [ ] **Create: `src/app/connoisseur/apply/page.tsx`**
  - Application form
  - Fields: focus, seeking, budget, experience, photos, references, LINE ID

- [ ] **Create: `src/app/api/connoisseur/apply/route.ts`**
  - Validate application
  - Store in database
  - Send notification to admin

- [ ] **Create: `src/app/api/connoisseur/status/route.ts`**
  - Return application status for current user

- [ ] **Create: Admin review interface**
  - List pending applications
  - View application details
  - Approve (triggers Stripe checkout) / Reject (with reason)

### 2.2 Private Listings System

- [ ] **Migration: Private listings tables**
  ```sql
  -- supabase/migrations/040_private_listings.sql
  CREATE TABLE private_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID REFERENCES dealers(id),
    -- Can optionally link to existing listing
    public_listing_id UUID REFERENCES listings(id),
    title TEXT NOT NULL,
    description TEXT,
    price_value NUMERIC,
    price_currency TEXT DEFAULT 'JPY',
    images JSONB DEFAULT '[]',
    setsumei TEXT,
    specs JSONB DEFAULT '{}',
    -- Visibility control
    visibility TEXT DEFAULT 'all_connoisseurs'
      CHECK (visibility IN ('all_connoisseurs', 'selected_users')),
    visible_to UUID[] DEFAULT '{}',
    -- Status
    status TEXT DEFAULT 'active'
      CHECK (status IN ('active', 'reserved', 'sold', 'withdrawn')),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    sold_at TIMESTAMPTZ,
    sold_to UUID REFERENCES profiles(id)
  );

  CREATE TABLE private_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    private_listing_id UUID REFERENCES private_listings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending'
      CHECK (status IN ('pending', 'viewed', 'responded', 'closed')),
    dealer_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    viewed_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ
  );

  -- Indexes
  CREATE INDEX idx_private_listings_dealer ON private_listings(dealer_id);
  CREATE INDEX idx_private_listings_status ON private_listings(status);
  CREATE INDEX idx_private_inquiries_listing ON private_inquiries(private_listing_id);
  CREATE INDEX idx_private_inquiries_user ON private_inquiries(user_id);
  ```

- [ ] **Create: `src/app/api/private-listings/route.ts`**
  - GET: Return private listings visible to user
  - Gate behind Connoisseur tier
  - Filter by visibility rules

- [ ] **Create: `src/app/api/private-listings/[id]/route.ts`**
  - GET: Single private listing detail

- [ ] **Create: `src/app/api/private-listings/inquiry/route.ts`**
  - POST: Submit inquiry for private listing
  - Notify dealer (email)

- [ ] **Create: `src/components/connoisseur/PrivateListingFeed.tsx`**
  - Grid of private offerings
  - Filtered, sortable
  - "New this week" indicator

- [ ] **Create: `src/components/connoisseur/PrivateListingCard.tsx`**
  - Similar to ListingCard but styled differently
  - "Private" badge
  - Dealer name
  - Inquiry button

- [ ] **Create: `src/components/connoisseur/PrivateInquiryModal.tsx`**
  - Form to express interest
  - Pre-filled user info
  - Message field

- [ ] **Create: `src/app/private/page.tsx`**
  - Private listings feed page
  - Only accessible to Connoisseur

### 2.3 LINE Integration

- [ ] **Migration: LINE connections table**
  ```sql
  -- supabase/migrations/041_line_connections.sql
  CREATE TABLE line_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    line_display_name TEXT,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT -- Admin notes about this user
  );
  ```

- [ ] **Create: `src/components/connoisseur/LineConnectCard.tsx`**
  - Show LINE QR code / link
  - Instructions for connecting
  - Only visible to Connoisseur members
  - Mark as connected when done

- [ ] **Add to Connoisseur dashboard**
  - "Connect with Hoshi on LINE"
  - Status indicator (connected/not connected)

### 2.4 Search Alerts (Connoisseur Only)

- [ ] **Modify: Saved search alert toggle**
  - Hide alert options for non-Connoisseur
  - Show upgrade prompt instead
  - "Get instant alerts with Connoisseur"

- [ ] **Modify: Alert processing cron**
  - Only process alerts for Connoisseur users
  - Or: downgrade alerts to weekly digest for others

### 2.5 Smith Certification Statistics

Research-grade data: Juyo, Tokuju, Juyo Bunkazai, Juyo Bijutsuhin, and Kokuho counts for every smith capable of receiving these designations.

- [ ] **Migration: Smith stats table**
  ```sql
  -- supabase/migrations/042_smith_certification_stats.sql
  CREATE TABLE smith_certification_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    smith_name TEXT NOT NULL,
    smith_name_kanji TEXT,
    school TEXT,
    province TEXT,
    era TEXT,
    -- Certification counts
    juyo_count INTEGER DEFAULT 0,
    tokuju_count INTEGER DEFAULT 0,         -- Tokubetsu Juyo
    juyo_bunkazai_count INTEGER DEFAULT 0,  -- Important Cultural Property
    juyo_bijutsuhin_count INTEGER DEFAULT 0, -- Important Art Object (older)
    kokuho_count INTEGER DEFAULT 0,          -- National Treasure
    -- Metadata
    total_known_works INTEGER,
    notes TEXT,
    data_source TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(smith_name, school, era)
  );

  CREATE INDEX idx_smith_stats_name ON smith_certification_stats(smith_name);
  CREATE INDEX idx_smith_stats_school ON smith_certification_stats(school);
  ```

- [ ] **Create: `src/app/api/smith-stats/route.ts`**
  - GET: List all smiths with stats (paginated, searchable)
  - Gate behind Connoisseur tier

- [ ] **Create: `src/app/api/smith-stats/[name]/route.ts`**
  - GET: Single smith detail with full stats
  - Gate behind Connoisseur tier

- [ ] **Create: `src/components/connoisseur/SmithStatsCard.tsx`**
  - Display certification counts
  - Visual breakdown (bar chart or badges)
  - Link to related listings

- [ ] **Create: `src/app/smiths/page.tsx`**
  - Searchable smith database
  - Filter by school, era, certification level
  - Connoisseur-only access

- [ ] **Integrate into listing detail**
  - Show smith stats on listing page when smith is known
  - "This smith has 23 Juyo, 4 Tokuju"
  - Teaser for non-Connoisseurs: "Unlock smith statistics"

- [ ] **Data population**
  - Source: NBTHK records, published references
  - Manual entry initially, potential for automation

### 2.6 Private Listings Teaser

- [ ] **Create teaser for Collector users**
  - "X private listings shared this week"
  - No details, just count
  - Link to Connoisseur upgrade

- [ ] **Add to browse sidebar/header**
  - Subtle but visible
  - Updates weekly

---

## Phase 3: Conversion Optimization

### 3.1 Contextual Upgrade Prompts

- [ ] **Sold item click prompt**
  - When free user clicks listing that's sold
  - "This sold 2 days ago. With Collector, you'd have seen it first."

- [ ] **Setsumei paywall**
  - Blur/hide translated setsumei
  - "Unlock translation with Collector"

- [ ] **Inquiry email paywall**
  - Show preview of what email would look like
  - "Generate emails like this with Collector"

- [ ] **Favorites limit**
  - "You've saved 10 items. Upgrade for unlimited."

- [ ] **Alert paywall**
  - "Get notified instantly with Connoisseur"

### 3.2 Annual Pricing

- [ ] **Add annual toggle to PricingTable**
  - Show monthly and annual options
  - Highlight savings (25% off)

- [ ] **Update Stripe checkout**
  - Support annual price IDs
  - Correct billing period display

### 3.3 Subscription Analytics

- [ ] **Add to admin dashboard**
  - Subscriber counts by tier
  - MRR calculation
  - Churn rate
  - Conversion funnel (views → checkout → complete)

- [ ] **Track upgrade events**
  - Log in user_activity
  - Source of upgrade (which paywall)

### 3.4 Email Sequences

- [ ] **Welcome email for new subscribers**
  - What they now have access to
  - Quick start guide

- [ ] **Cancellation email**
  - Win-back messaging
  - What they'll lose

- [ ] **Failed payment email**
  - Update payment method prompt

---

## Phase 4: Dealer Tier (Future)

### 4.1 Dealer Subscription

- [ ] Add dealer tier to Stripe
- [ ] Dealer signup/onboarding flow
- [ ] Dealer dashboard page

### 4.2 Dealer Analytics

- [ ] Views per listing
- [ ] Saves/favorites per listing
- [ ] Inquiry count
- [ ] Competitor pricing

### 4.3 Private Listing Submission

- [ ] Dealer portal for submitting private items
- [ ] Image upload
- [ ] Visibility controls
- [ ] Inquiry management

---

## Testing Checklist

### Unit Tests

- [ ] `lib/subscription.ts` - canAccess logic
- [ ] Feature gating in API routes
- [ ] Stripe webhook signature verification

### Integration Tests

- [ ] Checkout flow end-to-end
- [ ] Webhook handling
- [ ] Tier upgrade/downgrade

### Manual Testing

- [ ] Free user experience
- [ ] Collector feature access
- [ ] Connoisseur feature access
- [ ] Paywall modals appear correctly
- [ ] Stripe checkout works
- [ ] Billing portal works
- [ ] Subscription cancellation works

---

## Launch Checklist

### Pre-Launch

- [ ] Stripe products created (test mode)
- [ ] All migrations applied
- [ ] All features tested
- [ ] Pricing page live
- [ ] Email templates ready
- [ ] Admin can manage subscriptions

### Launch Day

- [ ] Switch Stripe to live mode
- [ ] Update environment variables
- [ ] Announce to existing users
- [ ] Monitor for errors

### Post-Launch

- [ ] Track conversion rates
- [ ] Gather feedback
- [ ] Iterate on paywalls
- [ ] Recruit beta Connoisseurs

---

## File Structure Summary

```
src/
├── app/
│   ├── api/
│   │   ├── subscription/
│   │   │   ├── checkout/route.ts
│   │   │   ├── portal/route.ts
│   │   │   ├── webhook/route.ts
│   │   │   └── status/route.ts
│   │   ├── connoisseur/
│   │   │   ├── apply/route.ts
│   │   │   └── status/route.ts
│   │   ├── private-listings/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   └── inquiry/route.ts
│   │   ├── setsumei/
│   │   │   └── [listingId]/route.ts
│   │   └── smith-stats/
│   │       ├── route.ts
│   │       └── [name]/route.ts
│   ├── pricing/
│   │   └── page.tsx
│   ├── connoisseur/
│   │   ├── page.tsx
│   │   └── apply/page.tsx
│   ├── private/
│   │   └── page.tsx
│   └── smiths/
│       └── page.tsx
├── components/
│   ├── subscription/
│   │   ├── PricingTable.tsx
│   │   ├── PaywallModal.tsx
│   │   ├── UpgradePrompt.tsx
│   │   └── SubscriptionBadge.tsx
│   ├── collector/
│   │   ├── SetsumeiTranslation.tsx
│   │   └── DataFreshnessIndicator.tsx
│   └── connoisseur/
│       ├── ApplicationForm.tsx
│       ├── PrivateListingFeed.tsx
│       ├── PrivateListingCard.tsx
│       ├── PrivateInquiryModal.tsx
│       ├── LineConnectCard.tsx
│       ├── SmithStatsCard.tsx
│       └── SmithStatsTeaser.tsx
├── contexts/
│   └── SubscriptionContext.tsx
├── hooks/
│   └── useSubscription.ts
└── lib/
    ├── stripe.ts
    └── subscription.ts
```

---

*Implementation guide for Nihontowatch Pro Tiers*
