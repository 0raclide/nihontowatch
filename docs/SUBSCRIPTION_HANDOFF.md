# Subscription System Handoff

Implementation status and handoff notes for the Nihontowatch subscription system.

**Last Updated:** 2026-03-10 (Tier Simplification: 3-tier system)

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
| `canAccessFeature()` | Returns `true` for all features (including inner_circle exclusives) |
| DataDelayBanner | Hidden |

**Note:** `isDelayed` derives from `canAccessFeature(tier, 'fresh_data')`. Since `fresh_data` is now free, `isDelayed` is always `false` for all users regardless of trial mode.

### Key Files Changed

| File | Change |
|------|--------|
| `src/types/subscription.ts` | Added `isTrialModeActive()`, updated `canAccessFeature()` |
| `src/lib/subscription/server.ts` | `isDelayed` derives from `canAccessFeature('fresh_data')` |
| `src/components/subscription/DataDelayBanner.tsx` | Hidden in trial mode |
| `tests/subscription/trial-mode.test.ts` | Comprehensive test coverage |

---

## Subscription Tiers (3-tier system, simplified 2026-03-10)

All previously-paid features (fresh_data, setsumei, alerts, inquiry_emails, artist_stats, export_data, blade_analysis, provenance_data) are now **free for all users**.

| Tier (internal) | Display Name | Price | Key Features |
|-----------------|-------------|-------|--------------|
| `free` | Free | $0 | All browse features, filters, favorites, fresh data, email alerts, AI inquiry emails, setsumei, artist stats, data exports |
| `inner_circle` | Inner Circle | $249/mo ($2,241/yr) | Private listings, Discord access, LINE access, collection access |
| `dealer` | Dealer | $150/mo ($1,350/yr) | Analytics dashboard, listing management, competitive intel |

**Removed tiers** (migrated to `free` via migration 139): `enthusiast` ($25/mo "Pro"), `collector` ($99/mo), `yuhinkai`. Legacy Stripe metadata with these names is safely mapped to `free` via `mapLegacyTier()` in `src/lib/stripe/server.ts`.

### Feature Access Matrix

| Feature | Free | Inner Circle | Dealer |
|---------|:---:|:---:|:---:|
| `fresh_data` (no delay) | x | x | x |
| `inquiry_emails` | x | x | |
| `saved_searches` | x | x | |
| `search_alerts` | x | x | |
| `export_data` | x | x | |
| `setsumei_translation` | x | x | |
| `artist_stats` | x | x | |
| `priority_juyo_alerts` | x | x | |
| `blade_analysis` | x | x | |
| `provenance_data` | x | x | |
| `private_listings` | | x | |
| `discord_access` | | x | |
| `line_access` | | x | |
| `collection_access` | | x | |
| `dealer_analytics` | | | x |

### Convenience Booleans

```typescript
// In SubscriptionState / useSubscription()
isFree         // tier === 'free'
isInnerCircle  // tier === 'inner_circle'
isDealer       // tier === 'dealer'
```

**Removed:** `isPro`, `isCollector`, `isYuhinkai` (no longer applicable with 3-tier system).

### Internal-to-Display Name Mapping

```typescript
TIER_DISPLAY_NAMES: Record<SubscriptionTier, string> = {
  free: 'Free',
  inner_circle: 'Inner Circle',
  dealer: 'Dealer',
};
```

---

## Paywall Design Principles

Based on Superwall/Parra patterns (4,500+ A/B tested paywalls). These rules govern all paywall UI.

**Current status:** PaywallModal is dormant (trial mode ON). Single paywall screen for `inner_circle`. No multi-tier comparison needed with simplified system.

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

1. **No verbage** - Bullets are 2-4 words each. No sentences, no paragraphs.
2. **Simple plan naming** - One word: "Inner Circle". Don't repeat app name.
3. **"No commitment, cancel anytime"** - Below CTA, small muted text. Always.
4. **"Continue" not "Subscribe"** - Implies forward momentum, not a transaction.
5. **CTA is the only colored element** - Everything else neutral.
6. **Big button** - Full-width, minimum ~4rem / 65pt height.
7. **Match the app's design language** - Same fonts, colors, feel.
8. **One price, no toggles** - Show one price. No monthly/annual toggle.

### Anti-Patterns (DO NOT)

- Feature comparison tables (bullets always win)
- Long descriptions per feature (users don't read)
- Multiple plan tiers visible (decision fatigue)
- Billing period toggle (forces a decision before the main decision)
- "Upgrade to [Tier Name]" CTA (transactional language = friction)
- Small CTA button (must be dominant visual element)

---

## Changelog

### 2026-03-10: Tier Simplification — 3-Tier System

**What changed:**
- **Old:** `free → enthusiast("Pro" $25/mo) → collector("Collector" $99/mo) → inner_circle("Inner Circle" $249/mo) + dealer($150/mo)`
- **New:** `free → inner_circle("Inner Circle" $249/mo) + dealer($150/mo)`

**All previously-paid features moved to free:**
- `fresh_data`, `setsumei_translation`, `inquiry_emails`, `saved_searches`, `search_alerts`, `export_data`, `artist_stats`, `blade_analysis`, `provenance_data`, `priority_juyo_alerts`

**Inner Circle exclusives (unchanged):**
- `private_listings`, `discord_access` (was `yuhinkai_discord`), `line_access`, `collection_access`

**`isDelayed` fix:** Now derives from `canAccessFeature(tier, 'fresh_data')` instead of hardcoded `effectiveTier === 'free'`. Since `fresh_data` is free, `isDelayed` is always `false`.

**Legacy Stripe safety:** `mapLegacyTier()` maps `enthusiast`/`collector`/`yuhinkai` → `'free'` in webhook processing. Prevents CHECK constraint violations from old Stripe metadata.

**DB migration 139:** Migrates existing `enthusiast`/`collector`/`yuhinkai` users to `free`, updates CHECK constraint to `('free', 'inner_circle', 'dealer')`.

**Key files modified:**
| File | Change |
|------|--------|
| `src/types/subscription.ts` | Removed tiers, updated FEATURE_MIN_TIER, removed convenience booleans |
| `src/lib/subscription/server.ts` | `isDelayed` uses `canAccessFeature()` |
| `src/lib/stripe/server.ts` | Added `mapLegacyTier()`, STRIPE_PRICES reduced to 2 tiers |
| `src/contexts/SubscriptionContext.tsx` | Removed `isPro`/`isCollector`/`isYuhinkai`, PaywallModal dormant |
| `supabase/migrations/139_simplify_subscription_tiers.sql` | DB tier migration + CHECK constraint |

### 2026-02-10: Tier Restructure — 5-Tier System (HISTORICAL)

Restructured from 3 tiers to 5 tiers. Now superseded by 2026-03-10 simplification back to 3 tiers.

**Old:** `free → enthusiast("Enthusiast" $25/mo) → connoisseur("Connoisseur" $200/mo) + dealer`
**New (at the time):** `free → enthusiast("Pro" $25/mo) → collector("Collector" $99/mo) → inner_circle("Inner Circle" $249/mo) + dealer($150/mo)`

### 2026-01-26: Sold Items Sorting & Price Preservation

**Problem:** ¥60M Kotetsu katana disappeared from Sold tab after being marked sold. Sold items were sorted by discovery date, not sale date.

**Fixes:** Added `sale_date` sort option, enriches sold items with sale price from `price_history`.

### 2026-01-25: Dealer Analytics Tracking Fix

**Problem:** Dealer analytics showed 0 listing views. `viewport_dwell` events silently rejected.

**Fixes:** Added `viewport_dwell` to API + DB, changed consent default to ON, added detail page tracking.

### 2026-01-24: Search Alerts Production Fix

**Problem:** SendGrid env vars missing from Vercel production. All alert emails failing silently.

**Fixes:** Added env vars to Vercel, fixed TypeScript build.

---

## Implementation Status

### COMPLETED

| Component | File(s) | Notes |
|-----------|---------|-------|
| Database Migration | `supabase/migrations/039_subscription_tiers.sql`, `139_simplify_subscription_tiers.sql` | Profiles + tier simplification |
| TypeScript Types | `src/types/subscription.ts` | 3-tier system, feature matrix, `canAccessFeature()` |
| Stripe Server Lib | `src/lib/stripe/server.ts` | Checkout, portal, webhook utils, `mapLegacyTier()` |
| Stripe Client Lib | `src/lib/stripe/client.ts` | Browser-safe checkout redirect, portal open |
| Checkout API | `src/app/api/subscription/checkout/route.ts` | Creates Stripe checkout session |
| Portal API | `src/app/api/subscription/portal/route.ts` | Creates Stripe billing portal session |
| Webhook API | `src/app/api/subscription/webhook/route.ts` | Handles all Stripe webhook events |
| Subscription Context | `src/contexts/SubscriptionContext.tsx` | App-wide state, paywall, `isFree`/`isInnerCircle`/`isDealer` |
| Subscription Server Lib | `src/lib/subscription/server.ts` | `getUserSubscription()`, `getDataDelayCutoff()`, `isDelayed` from `canAccessFeature()` |
| Feature Gating | Various components | `requireFeature` checks, PaywallModal (dormant) |
| Trial Mode | `src/types/subscription.ts` | `isTrialModeActive()` bypasses all gating |
| Search Alerts | `src/app/api/cron/process-saved-searches/route.ts` | Cron every 15 min + daily digest |
| Collection Gating | `src/lib/collection/access.ts` | `inner_circle` + `dealer` + admin only |

### PENDING (Post-trial)

| Task | Priority | Notes |
|------|----------|-------|
| Stripe price IDs | HIGH | Create `STRIPE_PRICE_INNER_CIRCLE_*` in Stripe Dashboard |
| PaywallModal redesign | MEDIUM | Full Superwall bullet-list layout for inner_circle |
| Private listings | LOW | Exclusive dealer items (Inner Circle feature) |

---

## Key Files Reference

### Types (`src/types/subscription.ts`)

```typescript
// 3-tier system (simplified 2026-03-10)
type SubscriptionTier = 'free' | 'inner_circle' | 'dealer';

// Display name mapping
TIER_DISPLAY_NAMES: { free: 'Free', inner_circle: 'Inner Circle', dealer: 'Dealer' }

// Features — most are free, only inner_circle exclusives are gated
type Feature =
  | 'fresh_data'             // Free
  | 'inquiry_emails'         // Free
  | 'saved_searches'         // Free
  | 'search_alerts'          // Free
  | 'export_data'            // Free
  | 'setsumei_translation'   // Free
  | 'artist_stats'           // Free
  | 'priority_juyo_alerts'   // Free
  | 'blade_analysis'         // Free
  | 'provenance_data'        // Free
  | 'private_listings'       // Inner Circle
  | 'discord_access'         // Inner Circle
  | 'line_access'            // Inner Circle
  | 'collection_access'      // Inner Circle
  | 'dealer_analytics';      // Dealer-only

// Check access
canAccessFeature(tier: SubscriptionTier, feature: Feature): boolean
```

### Context (`src/contexts/SubscriptionContext.tsx`)

```typescript
const {
  tier,              // Current tier
  status,            // 'active' | 'inactive' | etc.
  isFree,            // tier === 'free'
  isInnerCircle,     // tier === 'inner_circle'
  isDealer,          // tier === 'dealer'
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
STRIPE_PRICE_INNER_CIRCLE_MONTHLY=price_xxx
STRIPE_PRICE_INNER_CIRCLE_ANNUAL=price_xxx
STRIPE_PRICE_DEALER_MONTHLY=price_xxx
STRIPE_PRICE_DEALER_ANNUAL=price_xxx

# Trial Mode
NEXT_PUBLIC_TRIAL_MODE=true
```

---

## Database Schema

Migration `039_subscription_tiers.sql` (original) + `139_simplify_subscription_tiers.sql` (simplification):

**profiles table:**
- `subscription_tier` - `'free' | 'inner_circle' | 'dealer'` (CHECK constraint)
- `subscription_status` - `'active' | 'inactive' | 'cancelled' | 'past_due'`
- `subscription_started_at` - Timestamp
- `subscription_expires_at` - Timestamp
- `stripe_customer_id` - Stripe customer reference
- `stripe_subscription_id` - Stripe subscription reference

---

## Test Coverage

**50+ subscription tests** in `tests/subscription/`:

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `data-delay.test.ts` | 22 | Server auth, cutoff, admin bypass, client fallback, credentials |
| `feature-gating.test.tsx` | 12 | Component gating, paywall triggers, feature access matrix |
| `trial-mode.test.ts` | 16 | Trial mode toggle, feature unlock, data delay bypass |
| `tests/lib/stripe/webhook-tier-mapping.test.ts` | 6 | Legacy tier mapping (enthusiast/collector/yuhinkai → free) |

### Running Tests

```bash
# All subscription tests
npm test -- tests/subscription

# Webhook tier mapping
npm test -- tests/lib/stripe/webhook-tier-mapping.test.ts
```

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
│  └─────────────────┘    │ mapLegacyTier() │                   │
│         │               └─────────────────┘                    │
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

4. **PaywallModal**: Dormant (trial mode ON). Single paywall screen for `inner_circle`. Needs Superwall bullet-list redesign before activating.

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
- `docs/PRO_TIER_STRATEGY.md` - Business strategy (HISTORICAL — predates tier simplification)
- `docs/PRO_TIER_IMPLEMENTATION.md` - Implementation checklist (HISTORICAL)
- `CLAUDE.md` - AI context with full project guide

---

*Handoff document for Nihontowatch subscription system*
