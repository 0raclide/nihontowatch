# Subscription System Handoff

Implementation status and handoff notes for the Nihontowatch subscription system.

**Last Updated:** 2026-02-10 (Tier Restructure: 5-tier system)

---

## Current State: Trial Mode Active

**All premium features are currently FREE for all users** to maximize adoption.

### Why Trial Mode?

Market analysis revealed:
- ~8,400 registered collectors on Nihonto Message Board (larger than expected)
- Growth matters more than conversion at this stage
- Goal: Become the default first stop for collectors

### Business Model Shift

Moving from collector-paid to hybrid model:
1. **Free for collectors** - All features available to maximize traffic
2. **Charge dealers** - B2B revenue from analytics (infrastructure already built)
3. **Optional collector premium** - Power features for serious buyers (future)

### Trial Mode Toggle

```bash
# Vercel environment variables
NEXT_PUBLIC_TRIAL_MODE=true   # All features free (current)
NEXT_PUBLIC_TRIAL_MODE=false  # Normal paywall restored
```

### What Trial Mode Does

| Component | Behavior |
|-----------|----------|
| `canAccessFeature()` | Returns `true` for all features |
| `isDelayed` | Returns `false` (no 7-day data delay) |
| `DataDelayBanner` | Hidden |

### Key Files Changed

| File | Change |
|------|--------|
| `src/types/subscription.ts` | Added `isTrialModeActive()`, updated `canAccessFeature()` |
| `src/lib/subscription/server.ts` | `isDelayed` respects trial mode |
| `src/components/subscription/DataDelayBanner.tsx` | Hidden in trial mode |
| `tests/subscription/trial-mode.test.ts` | Comprehensive test coverage |

---

## Subscription Tiers (5-tier system)

| Tier (internal) | Display Name | Price | Key Features |
|-----------------|-------------|-------|--------------|
| `free` | Free | $0 | 7-day delayed data, basic browsing, filters, favorites |
| `enthusiast` | Pro | $25/mo ($225/yr) | Fresh data, AI inquiry emails, saved search alerts, data exports |
| `collector` | Collector | $99/mo ($891/yr) | Setsumei translations, artist stats, priority Juyo alerts, blade analysis |
| `inner_circle` | Inner Circle | $249/mo ($2,241/yr) | Private listings, Yuhinkai Discord, LINE access |
| `dealer` | Dealer | $150/mo ($1,350/yr) | Analytics dashboard, click tracking, competitive intel |

### Gating Philosophy

**Thesis:** "Gate speed, not access. Gate insight, not inventory."

Three gating axes:
1. **Time** — 7-day delay for free users, instant for Pro+
2. **Insight** — Artist stats, setsumei translations for Collector+
3. **Alert Priority** — Juyo/Tokuju 15-min alerts only for Collector+

### Internal-to-Display Name Mapping

```typescript
TIER_DISPLAY_NAMES: Record<SubscriptionTier, string> = {
  free: 'Free',
  enthusiast: 'Pro',       // User-facing name is "Pro"
  collector: 'Collector',
  inner_circle: 'Inner Circle',
  dealer: 'Dealer',
};
```

### Feature Access Matrix

| Feature | Pro (enthusiast) | Collector | Inner Circle | Dealer |
|---------|:---:|:---:|:---:|:---:|
| `fresh_data` (no 7-day delay) | x | x | x | x |
| `inquiry_emails` | x | x | x | |
| `saved_searches` | x | x | x | |
| `search_alerts` | x | x | x | |
| `export_data` | x | x | x | |
| `setsumei_translation` | | x | x | |
| `artist_stats` | | x | x | |
| `priority_juyo_alerts` | | x | x | |
| `blade_analysis` | | x | x | |
| `provenance_data` | | x | x | |
| `private_listings` | | | x | |
| `yuhinkai_discord` | | | x | |
| `line_access` | | | x | |
| `dealer_analytics` | | | | x |

### Convenience Booleans

```typescript
// In SubscriptionState / useSubscription()
isPro        // tier >= enthusiast (was isEnthusiast)
isCollector  // tier >= collector  (NEW)
isInnerCircle // tier >= inner_circle (was isConnoisseur)
isDealer     // tier === dealer
```

---

## Paywall Design Principles

Based on Superwall/Parra patterns (4,500+ A/B tested paywalls). These rules govern all paywall UI.

### The Baseline

Single screen. No scroll. Bullet list layout:

```
[Plan Name]

  Benefit one
  Benefit two
  Benefit three
  Benefit four

$X/mo

[ Continue ]

No commitment, cancel anytime

Not now
```

### 8 Rules

1. **No verbage** — Bullets are 2-4 words each. No sentences, no paragraphs.
2. **Simple plan naming** — One word: "Pro", "Collector". Don't repeat app name.
3. **"No commitment, cancel anytime"** — Below CTA, small muted text. Always.
4. **"Continue" not "Subscribe"** — Implies forward momentum, not a transaction.
5. **CTA is the only colored element** — Everything else neutral.
6. **Big button** — Full-width, minimum ~4rem / 65pt height.
7. **Match the app's design language** — Same fonts, colors, feel.
8. **One price, no toggles** — Show one price. No monthly/annual toggle.

### Implementation

```typescript
// src/types/subscription.ts
PAYWALL_BULLETS: Record<'enthusiast' | 'collector', string[]> = {
  enthusiast: ['New listings first', 'AI inquiry emails', 'Saved search alerts', 'Data exports'],
  collector: ['Setsumei translations', 'Artist stats & analysis', 'Priority Juyo alerts', 'Blade form insights'],
};

getPaywallConfig(requiredTier: SubscriptionTier) => {
  name: string;        // Display name
  price: string;       // e.g. "$25/mo"
  bullets: string[];   // Value prop bullets
  tierToCheckout: SubscriptionTier;
}
```

### Anti-Patterns (DO NOT)

- Feature comparison tables (bullets always win)
- Long descriptions per feature (users don't read)
- Multiple plan tiers visible (decision fatigue)
- Billing period toggle (forces a decision before the main decision)
- "Upgrade to [Tier Name]" CTA (transactional language = friction)
- Small CTA button (must be dominant visual element)

---

## Changelog

### 2026-02-10: Tier Restructure — 5-Tier System

**What changed:**
- **Old:** `free → enthusiast("Enthusiast" $25/mo) → connoisseur("Connoisseur" $200/mo) + dealer`
- **New:** `free → enthusiast("Pro" $25/mo) → collector("Collector" $99/mo) → inner_circle("Inner Circle" $249/mo) + dealer($150/mo)`

**Feature rebalancing:**
- `setsumei_translation` and `artist_stats` moved from enthusiast → collector tier
- New features added: `priority_juyo_alerts`, `blade_analysis`, `provenance_data`
- Inner Circle gets exclusive: `private_listings`, `yuhinkai_discord`, `line_access`

**Data delay:**
- 72 hours → 7 days (`DATA_DELAY_MS` in server.ts, `EARLY_ACCESS_WINDOW_MS` in ListingCard)

**Code changes:**
- `FEATURE_PAYWALL_MESSAGES` removed entirely → replaced by `PAYWALL_BULLETS` + `getPaywallConfig()`
- `TIER_DISPLAY_NAMES` mapping added (internal name → user-facing name)
- Convenience booleans renamed: `isEnthusiast` → `isPro`, `isConnoisseur` → `isCollector`, added `isInnerCircle`
- Admin tier: `connoisseur` → `inner_circle` (in SubscriptionContext + server.ts)
- PaywallModal: derives content from `getPaywallConfig()` instead of hardcoded messages
- Old pages (`/pricing`, `/connoisseur`) moved to `archived_pages/`, excluded in `tsconfig.json`

**Files modified (24 files):**

| File | Change |
|------|--------|
| `src/types/subscription.ts` | Full rewrite — new tiers, features, pricing, paywall config |
| `src/types/index.ts` | Updated re-exports |
| `src/types/database.ts` | Updated subscription_tier enum |
| `src/contexts/SubscriptionContext.tsx` | New booleans, admin tier, simplified PaywallInfo |
| `src/lib/subscription/server.ts` | 7-day delay, inner_circle admin |
| `src/lib/stripe/server.ts` | New price IDs for collector/inner_circle |
| `src/app/api/subscription/checkout/route.ts` | Tier validation updated |
| `src/components/subscription/DataDelayBanner.tsx` | 72h → 7-day |
| `src/components/subscription/PaywallModal.tsx` | getPaywallConfig integration |
| `src/components/browse/ListingCard.tsx` | EARLY_ACCESS_WINDOW_MS 7 days |
| `src/app/api/browse/route.ts` | Comment update |
| `src/app/api/debug/subscription/route.ts` | 72h → 7d |
| `tsconfig.json` | Exclude archived_pages |
| `tests/setup.ts` | Updated mock |
| `tests/subscription/data-delay.test.ts` | Full rewrite for 7-day delay |
| `tests/subscription/feature-gating.test.tsx` | New tier tests |
| `tests/subscription/trial-mode.test.ts` | Updated for new tiers |
| `tests/components/browse/ListingCard.test.tsx` | Updated badge text |
| `CLAUDE.md` | Updated documentation |

**Deleted:** `src/app/connoisseur/page.tsx`, `src/app/pricing/page.tsx` (archived)

---

### 2026-01-26: Sold Items Sorting & Price Preservation

**Problem Identified:**
- ¥60M Kotetsu katana disappeared from Sold tab after being marked sold
- Sold items were sorted by discovery date (`first_seen_at`), not sale date (`status_changed_at`)
- Price was cleared to NULL when items sold, showing "Price on request" instead of sale price
- Recently sold high-value items were buried beyond position 1000 in pagination

**Fixes Applied:**

| File | Change |
|------|--------|
| `src/app/api/browse/route.ts` | Added `sale_date` sort option (orders by `status_changed_at` DESC) |
| `src/app/api/browse/route.ts` | Enriches sold items with sale price from `price_history.old_price` |
| `src/app/api/listing/[id]/route.ts` | Fetches sale price from `price_history` for detail page |
| `src/app/page.tsx` | Auto-switches to "Recently Sold" sort when entering Sold tab |
| `src/app/page.tsx` | Added "Recently Sold" option to desktop sort dropdown |
| `src/components/browse/FilterContent.tsx` | Added "Recently Sold" option to mobile sort dropdown |

**Commits:**
- `1a95430` - feat: Add sale date sorting and price preservation for sold items
- `ef829ac` - fix: Add secondary sort for sale_date to handle nulls better

---

### 2026-01-25: Dealer Analytics Tracking Fix

**Problem:** Dealer analytics showed 0 listing views. `viewport_dwell` events silently rejected.

**Fixes:** Added `viewport_dwell` to API + DB, changed consent default to ON, added detail page tracking.

**Commits:** See previous handoff version for full details.

---

### 2026-01-24: Search Alerts Production Fix & Enthusiast Tier Access

**Problem:** SendGrid env vars missing from Vercel production. All alert emails failing silently.

**Fixes:** Added env vars to Vercel, fixed TypeScript build, moved search_alerts to enthusiast tier.

**Commits:**
- `3625b32` - fix: Exclude tests from TypeScript build check
- `cc703f3` - feat: Make search alerts available to Enthusiast tier

---

## Implementation Status

### COMPLETED

| Component | File(s) | Notes |
|-----------|---------|-------|
| Database Migration | `supabase/migrations/039_subscription_tiers.sql` | Adds subscription fields to profiles + setsumei_translations table |
| TypeScript Types | `src/types/subscription.ts` | 5-tier system, feature matrix, `getPaywallConfig()`, `PAYWALL_BULLETS` |
| Database Types | `src/types/database.ts` | Updated profiles with 5-tier enum |
| Stripe Server Lib | `src/lib/stripe/server.ts` | Checkout sessions, portal, webhook utils, lazy initialization |
| Stripe Client Lib | `src/lib/stripe/client.ts` | Browser-safe checkout redirect, portal open |
| Checkout API | `src/app/api/subscription/checkout/route.ts` | Creates Stripe checkout session |
| Portal API | `src/app/api/subscription/portal/route.ts` | Creates Stripe billing portal session |
| Webhook API | `src/app/api/subscription/webhook/route.ts` | Handles all Stripe webhook events |
| Subscription Context | `src/contexts/SubscriptionContext.tsx` | App-wide state, paywall, `isPro`/`isCollector`/`isInnerCircle` |
| useSubscription Hook | `src/hooks/useSubscription.ts` | Convenience re-export |
| App Layout | `src/app/layout.tsx` | SubscriptionProvider + PaywallModal added |
| Subscription Server Lib | `src/lib/subscription/server.ts` | getUserSubscription(), getDataDelayCutoff(), 7-day delay |

### COMPLETED (Phase 1 - Feature Gating)

| Component | File(s) | Notes |
|-----------|---------|-------|
| PaywallModal | `src/components/subscription/PaywallModal.tsx` | Uses `getPaywallConfig()` for content |
| DataDelayBanner | `src/components/subscription/DataDelayBanner.tsx` | 7-day delay banner for free tier |
| 7-day data delay | `src/app/api/browse/route.ts`, `src/lib/subscription/server.ts` | Filters listings >7 days old for free tier |
| Gate inquiry emails | `src/components/listing/QuickViewContent.tsx` | requireFeature check |
| Gate saved searches | `src/components/browse/SaveSearchButton.tsx` | requireFeature check |
| Gate setsumei translations | `src/components/listing/SetsumeiSection.tsx` | Shows preview with "Unlock Full Translation" CTA |
| Admin full access | `src/contexts/SubscriptionContext.tsx`, `src/lib/subscription/server.ts` | Admins get inner_circle tier automatically |
| Trial mode | `src/types/subscription.ts` | `isTrialModeActive()` bypasses all gating |

### COMPLETED (Phase 1 - Search Alerts)

| Component | File(s) | Notes |
|-----------|---------|-------|
| Saved searches DB | `supabase/migrations/018_saved_searches.sql` | saved_searches + saved_search_notifications tables |
| Saved searches API | `src/app/api/saved-searches/route.ts` | Full CRUD, tier gating |
| Cron: instant alerts | `src/app/api/cron/process-saved-searches/route.ts` | Every 15 min |
| Cron: daily digest | `src/app/api/cron/process-saved-searches/route.ts` | 8am UTC |
| Email templates | `src/lib/email/templates/saved-search.ts` | HTML + plaintext |
| Matcher logic | `src/lib/savedSearches/matcher.ts` | findMatchingListings() |

### PENDING (Post-trial)

| Task | Priority | Notes |
|------|----------|-------|
| Stripe price IDs | HIGH | Create `STRIPE_PRICE_COLLECTOR_*` and `STRIPE_PRICE_INNER_CIRCLE_*` in Stripe Dashboard |
| DB migration | HIGH | Update `profiles.subscription_tier` constraint for `collector` + `inner_circle` values |
| PaywallModal redesign | MEDIUM | Full Superwall bullet-list layout (current is functional but not final) |
| Inner Circle application page | LOW | Exclusive tier with application flow |
| Delayed items lock card | LOW | `DelayedItemsCard` component showing blurred items for free users |
| Alert splitting by tier | LOW | Priority Juyo/Tokuju alerts for Collector+ |
| Private listings | LOW | Exclusive dealer items (Inner Circle feature) |

---

## Key Files Reference

### Types (`src/types/subscription.ts`)

```typescript
// 5-tier system
type SubscriptionTier = 'free' | 'enthusiast' | 'collector' | 'inner_circle' | 'dealer';

// Display name mapping
TIER_DISPLAY_NAMES: { free: 'Free', enthusiast: 'Pro', collector: 'Collector', ... }

// Features that can be gated
type Feature =
  | 'fresh_data'             // No 7-day delay (Pro+)
  | 'inquiry_emails'         // AI email drafts (Pro+)
  | 'saved_searches'         // Save search queries (Pro+)
  | 'search_alerts'          // Get notified (Pro+)
  | 'export_data'            // Data exports (Pro+)
  | 'setsumei_translation'   // AI translation (Collector+)
  | 'artist_stats'           // Cert statistics (Collector+)
  | 'priority_juyo_alerts'   // Priority alerts (Collector+)
  | 'blade_analysis'         // Form analysis (Collector+)
  | 'provenance_data'        // Denrai data (Collector+)
  | 'private_listings'       // Exclusive items (Inner Circle)
  | 'yuhinkai_discord'       // Discord access (Inner Circle)
  | 'line_access'            // LINE access (Inner Circle)
  | 'dealer_analytics';      // Dealer-only

// Check access
canAccessFeature(tier: SubscriptionTier, feature: Feature): boolean
```

### Context (`src/contexts/SubscriptionContext.tsx`)

```typescript
const {
  tier,              // Current tier
  status,            // 'active' | 'inactive' | etc.
  isFree,            // Boolean helpers
  isPro,             // tier >= enthusiast
  isCollector,       // tier >= collector
  isInnerCircle,     // tier >= inner_circle
  isDealer,          // tier === dealer
  canAccess,         // (feature: Feature) => boolean
  requireFeature,    // (feature: Feature) => boolean - shows paywall if false
  checkout,          // (tier, billingPeriod) => Promise<void>
  openPortal,        // () => Promise<void>
  paywallInfo,       // Current paywall state { feature, requiredTier }
  showPaywall,       // (feature: Feature) => void
  hidePaywall,       // () => void
} = useSubscription();
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
STRIPE_PRICE_COLLECTOR_MONTHLY=price_xxx       # NEW
STRIPE_PRICE_COLLECTOR_ANNUAL=price_xxx         # NEW
STRIPE_PRICE_INNER_CIRCLE_MONTHLY=price_xxx     # NEW
STRIPE_PRICE_INNER_CIRCLE_ANNUAL=price_xxx      # NEW
STRIPE_PRICE_DEALER_MONTHLY=price_xxx
STRIPE_PRICE_DEALER_ANNUAL=price_xxx

# Trial Mode
NEXT_PUBLIC_TRIAL_MODE=true
```

---

## Database Schema Changes

Migration `039_subscription_tiers.sql` adds:

**profiles table:**
- `subscription_tier` - 'free' | 'enthusiast' | 'collector' | 'inner_circle' | 'dealer'
- `subscription_status` - 'active' | 'inactive' | 'cancelled' | 'past_due'
- `subscription_started_at` - Timestamp
- `subscription_expires_at` - Timestamp
- `stripe_customer_id` - Stripe customer reference
- `stripe_subscription_id` - Stripe subscription reference

**NOTE:** DB constraint on `subscription_tier` may need updating for `collector` and `inner_circle` values.

---

## Test Coverage

**50+ subscription tests** in `tests/subscription/`:

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `data-delay.test.ts` | 22 | Server auth, 7-day cutoff, admin bypass, client fallback, credentials |
| `feature-gating.test.tsx` | 12 | Component gating, paywall triggers, feature access matrix (4 tiers) |
| `trial-mode.test.ts` | 16 | Trial mode toggle, feature unlock, data delay bypass, regression guards |

### Running Tests

```bash
# All subscription tests
npm test -- tests/subscription

# Just feature gating
npm test -- tests/subscription/feature-gating.test.tsx

# Just data delay auth
npm test -- tests/subscription/data-delay.test.ts

# Just trial mode
npm test -- tests/subscription/trial-mode.test.ts
```

---

## Deployment Checklist

Before deploying subscription changes:

1. [ ] Run `npm test` - all subscription tests must pass
2. [ ] Verify migration is applied: `supabase db push`
3. [ ] Check env vars in Vercel: `SUPABASE_SERVICE_ROLE_KEY`, Stripe keys
4. [ ] After deploy, test `/api/debug/subscription` while logged in as admin
5. [ ] Verify `isDelayed: false` and `tier: "inner_circle"` for admin
6. [ ] Hard refresh main site, confirm fresh listings visible

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
│  │ startCheckout() │───>│ /api/subscription│                   │
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
│  │  profiles table │<───│ /api/subscription│                   │
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

## Known Issues / Technical Debt

1. **Type Assertions in Webhook Handler**: Uses `@ts-expect-error` for subscription columns. After running migration, regenerate types with `supabase gen types typescript`.

2. **Stripe API Version**: Using `2025-12-15.clover`. `current_period_end` is on `subscription.items.data[0]`.

3. **Lazy Stripe Initialization**: Uses Proxy for lazy init to avoid build-time errors.

4. **PaywallModal**: Functional but not yet fully redesigned to Superwall bullet-list pattern. Currently uses `getPaywallConfig()` for content but retains some old layout elements.

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

## Stripe Test Mode

Use test card: `4242 4242 4242 4242`

For local webhook testing:
```bash
stripe listen --forward-to localhost:3000/api/subscription/webhook
```

---

## Contact

For questions about this implementation, refer to:
- `docs/PRO_TIER_STRATEGY.md` - Business strategy
- `docs/PRO_TIER_IMPLEMENTATION.md` - Full implementation checklist
- `CLAUDE.md` - AI context with full project guide

---

*Handoff document for Nihontowatch subscription system*
