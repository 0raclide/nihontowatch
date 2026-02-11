/**
 * Subscription & Tier Type Definitions
 *
 * Types for subscription tiers, features, and billing.
 *
 * Tier structure (2026-02-10 restructure):
 *   free → enthusiast("Pro") → collector("Collector") → inner_circle("Inner Circle") + dealer
 *
 * Gating philosophy: "Gate speed, not access. Gate insight, not inventory."
 *   - Pro: speed & convenience (fresh data, alerts, inquiry emails)
 *   - Collector: insight & analysis (setsumei, artist stats, blade analysis)
 *   - Inner Circle: exclusive access (private listings, Discord, LINE)
 */

// =============================================================================
// SUBSCRIPTION TIERS
// =============================================================================

export type SubscriptionTier = 'free' | 'enthusiast' | 'collector' | 'inner_circle' | 'dealer';

export type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'past_due';

/**
 * Internal tier name → user-facing display name
 */
export const TIER_DISPLAY_NAMES: Record<SubscriptionTier, string> = {
  free: 'Free',
  enthusiast: 'Pro',
  collector: 'Collector',
  inner_circle: 'Inner Circle',
  dealer: 'Dealer',
};

// =============================================================================
// FEATURES
// =============================================================================

export type Feature =
  | 'fresh_data'           // Real-time listings (no 7-day delay)
  | 'setsumei_translation' // AI-translated certification descriptions
  | 'inquiry_emails'       // AI-generated dealer inquiry emails
  | 'saved_searches'       // Save search queries
  | 'search_alerts'        // Notifications on new matches
  | 'priority_juyo_alerts' // 15-min Juyo/Tokuju alerts (vs daily digest)
  | 'private_listings'     // Exclusive dealer offerings
  | 'artist_stats'         // Juyo/Tokuju/Bunkazai statistics
  | 'blade_analysis'       // Blade form & measurement insights
  | 'provenance_data'      // Denrai/provenance chain data
  | 'yuhinkai_discord'     // Private Discord community
  | 'line_access'          // LINE chat with Hoshi
  | 'export_data'          // CSV/Excel exports
  | 'dealer_analytics';    // Dealer-only analytics

/**
 * Feature access by tier
 * Order matters for tier comparison (higher index = higher tier)
 */
export const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  enthusiast: 1,
  collector: 2,
  inner_circle: 3,
  dealer: 1, // Same level as enthusiast for most features
};

/**
 * Minimum tier required for each feature
 *
 * Pro (enthusiast) — speed & convenience
 * Collector — insight & analysis
 * Inner Circle — exclusive access
 */
export const FEATURE_MIN_TIER: Record<Feature, SubscriptionTier> = {
  // Pro (enthusiast) features — speed & convenience
  fresh_data: 'enthusiast',
  inquiry_emails: 'enthusiast',
  saved_searches: 'enthusiast',
  search_alerts: 'enthusiast',
  export_data: 'enthusiast',
  // Collector features — insight & analysis
  priority_juyo_alerts: 'collector',
  artist_stats: 'collector',
  setsumei_translation: 'collector',
  blade_analysis: 'collector',
  provenance_data: 'collector',
  // Inner Circle features — exclusive access
  private_listings: 'inner_circle',
  yuhinkai_discord: 'inner_circle',
  line_access: 'inner_circle',
  // Dealer features
  dealer_analytics: 'dealer',
};

/**
 * Check if trial mode is active (all features free)
 * Toggle via NEXT_PUBLIC_TRIAL_MODE env var in Vercel
 */
export const isTrialModeActive = (): boolean => {
  return process.env.NEXT_PUBLIC_TRIAL_MODE === 'true';
};

/**
 * Check if a tier has access to a feature
 */
export function canAccessFeature(tier: SubscriptionTier, feature: Feature): boolean {
  // Trial mode: everyone gets all features
  if (isTrialModeActive()) {
    return true;
  }

  const requiredTier = FEATURE_MIN_TIER[feature];

  // Special case: dealer has access to enthusiast features but not collector/inner_circle
  if (tier === 'dealer') {
    return requiredTier === 'enthusiast' || requiredTier === 'dealer';
  }

  const userRank = TIER_RANK[tier];
  const requiredRank = TIER_RANK[requiredTier];

  return userRank >= requiredRank;
}

/**
 * Get all features available to a tier
 */
export function getTierFeatures(tier: SubscriptionTier): Feature[] {
  return (Object.keys(FEATURE_MIN_TIER) as Feature[]).filter(
    feature => canAccessFeature(tier, feature)
  );
}

// =============================================================================
// SUBSCRIPTION PROFILE FIELDS
// =============================================================================

export interface SubscriptionFields {
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

// =============================================================================
// STRIPE TYPES
// =============================================================================

export type BillingPeriod = 'monthly' | 'annual';

export interface StripeCheckoutRequest {
  tier: 'enthusiast' | 'collector' | 'inner_circle' | 'dealer';
  billingPeriod: BillingPeriod;
  successUrl?: string;
  cancelUrl?: string;
}

export interface StripeCheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
}

export interface StripePortalResponse {
  portalUrl: string;
}

// =============================================================================
// SUBSCRIPTION STATE
// =============================================================================

export interface SubscriptionState {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isActive: boolean;
  expiresAt: string | null;
  // Convenience booleans
  isFree: boolean;
  isPro: boolean;        // enthusiast or higher
  isCollector: boolean;  // collector or higher
  isInnerCircle: boolean;
  isDealer: boolean;
  // Feature access
  canAccess: (feature: Feature) => boolean;
}

/**
 * Create subscription state from profile fields
 */
export function createSubscriptionState(
  fields: Partial<SubscriptionFields> | null
): SubscriptionState {
  const tier = fields?.subscription_tier ?? 'free';
  const status = fields?.subscription_status ?? 'inactive';
  const isActive = status === 'active';

  // If not active, treat as free tier for feature access
  const effectiveTier = isActive ? tier : 'free';
  const rank = TIER_RANK[effectiveTier] ?? 0;

  return {
    tier: effectiveTier,
    status,
    isActive,
    expiresAt: fields?.subscription_expires_at ?? null,
    isFree: effectiveTier === 'free',
    isPro: rank >= TIER_RANK.enthusiast && effectiveTier !== 'dealer',
    isCollector: rank >= TIER_RANK.collector,
    isInnerCircle: effectiveTier === 'inner_circle',
    isDealer: effectiveTier === 'dealer',
    canAccess: (feature: Feature) => canAccessFeature(effectiveTier, feature),
  };
}

// =============================================================================
// PRICING
// =============================================================================

export interface TierPricing {
  monthly: number;
  annual: number;
  annualSavings: number; // Percentage saved
}

export const TIER_PRICING: Record<Exclude<SubscriptionTier, 'free'>, TierPricing> = {
  enthusiast: {
    monthly: 25,
    annual: 225,
    annualSavings: 25, // 25% off
  },
  collector: {
    monthly: 99,
    annual: 891,
    annualSavings: 25,
  },
  inner_circle: {
    monthly: 249,
    annual: 2241,
    annualSavings: 25,
  },
  dealer: {
    monthly: 150,
    annual: 1350,
    annualSavings: 25, // 25% off
  },
};

// =============================================================================
// TIER DISPLAY INFO
// =============================================================================

export interface TierInfo {
  name: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}

export const TIER_INFO: Record<SubscriptionTier, TierInfo> = {
  free: {
    name: 'Free',
    description: 'Browse and explore',
    features: [
      'Browse all listings',
      'Full filters and search',
      'Unlimited favorites',
      'Currency conversion',
    ],
  },
  enthusiast: {
    name: 'Pro',
    description: 'For active collectors',
    features: [
      'New listings first',
      'AI inquiry email drafts',
      'Saved searches with alerts',
      'Data exports',
    ],
    highlighted: true,
  },
  collector: {
    name: 'Collector',
    description: 'Deep insight & analysis',
    features: [
      'Everything in Pro',
      'Setsumei translations',
      'Artist certification stats',
      'Priority Juyo alerts',
      'Blade form insights',
    ],
  },
  inner_circle: {
    name: 'Inner Circle',
    description: 'Exclusive access',
    features: [
      'Everything in Collector',
      'Private dealer offerings',
      'Exclusive Discord community',
      'Direct LINE support',
    ],
  },
  dealer: {
    name: 'Dealer',
    description: 'For trade professionals',
    features: [
      'All Pro features',
      'Analytics dashboard',
      'Competitor intelligence',
      'Submit private listings',
    ],
  },
};

// =============================================================================
// PAYWALL CONFIG (Superwall/Parra pattern)
// =============================================================================

/**
 * Paywall bullet points — 2-4 words each, benefits not features.
 * See /paywall skill for design rules.
 */
export const PAYWALL_BULLETS: Record<'enthusiast' | 'collector', string[]> = {
  enthusiast: [
    'New listings first',
    'AI inquiry emails',
    'Saved search alerts',
    'Data exports',
  ],
  collector: [
    'Setsumei translations',
    'Artist stats & analysis',
    'Priority Juyo alerts',
    'Blade form insights',
  ],
};

/**
 * Get paywall configuration for a required tier.
 * Returns the tier name, price, and bullet points for the paywall modal.
 */
export function getPaywallConfig(requiredTier: SubscriptionTier): {
  tier: 'enthusiast' | 'collector';
  name: string;
  price: number;
  bullets: string[];
} {
  // Map the required tier to one of our two paywall screens
  const tier: 'enthusiast' | 'collector' =
    requiredTier === 'free' ? 'enthusiast'
    : requiredTier === 'inner_circle' ? 'collector'
    : requiredTier === 'dealer' ? 'enthusiast'
    : requiredTier as 'enthusiast' | 'collector';

  return {
    tier,
    name: TIER_DISPLAY_NAMES[tier],
    price: TIER_PRICING[tier].monthly,
    bullets: PAYWALL_BULLETS[tier],
  };
}
