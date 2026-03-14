/**
 * Subscription & Tier Type Definitions
 *
 * Types for subscription tiers, features, and billing.
 *
 * Tier structure (2026-03-10 simplification):
 *   free → inner_circle("Inner Circle") + dealer
 *
 * All previously paid features (fresh data, alerts, setsumei, artist stats)
 * are now free. Inner Circle gates: exclusive access (private listings, Discord, LINE).
 * Dealer gates: analytics dashboard + collection access.
 */

// =============================================================================
// SUBSCRIPTION TIERS
// =============================================================================

export type SubscriptionTier = 'free' | 'inner_circle' | 'dealer';

export type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'past_due';

/**
 * Internal tier name → user-facing display name
 */
export const TIER_DISPLAY_NAMES: Record<SubscriptionTier, string> = {
  free: 'Free',
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
  | 'discord_access'       // Private Discord community
  | 'line_access'          // LINE chat with Hoshi
  | 'export_data'          // CSV/Excel exports
  | 'dealer_analytics'     // Dealer-only analytics
  | 'collection_access';   // Personal collection manager

/**
 * Feature access by tier
 * Order matters for tier comparison (higher index = higher tier)
 */
export const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  inner_circle: 1,
  dealer: 1, // Same level as inner_circle for most features
};

/**
 * Minimum tier required for each feature
 *
 * Free — all browse/analysis features (previously paid)
 * Inner Circle — exclusive access (private listings, Discord, LINE)
 * Dealer — analytics dashboard + collection access
 */
export const FEATURE_MIN_TIER: Record<Feature, SubscriptionTier> = {
  // Free features (previously paid, now available to all)
  fresh_data: 'free',
  inquiry_emails: 'free',
  saved_searches: 'free',
  search_alerts: 'free',
  export_data: 'free',
  priority_juyo_alerts: 'free',
  artist_stats: 'free',
  setsumei_translation: 'free',
  blade_analysis: 'free',
  provenance_data: 'free',
  // Inner Circle features — exclusive access
  private_listings: 'inner_circle',
  discord_access: 'inner_circle',
  line_access: 'inner_circle',
  // Dealer features
  dealer_analytics: 'dealer',
  // Inner Circle features (collection)
  collection_access: 'inner_circle',
};

/**
 * Check if trial mode is active (all features free)
 * Toggle via NEXT_PUBLIC_TRIAL_MODE env var in Vercel
 */
export const isTrialModeActive = (): boolean => {
  return process.env.NEXT_PUBLIC_TRIAL_MODE === 'true';
};

/**
 * Check if smart crop focal points are active for thumbnails
 * Default enabled. Set NEXT_PUBLIC_SMART_CROP=false to revert to center center.
 */
export const isSmartCropActive = (): boolean => {
  return process.env.NEXT_PUBLIC_SMART_CROP !== 'false';
};

/**
 * Check if a tier has access to a feature
 */
// Features that are NOT unlocked by trial mode (always require proper tier)
const TRIAL_EXEMPT_FEATURES: Feature[] = ['collection_access'];

export function canAccessFeature(tier: SubscriptionTier, feature: Feature): boolean {
  // Trial mode: everyone gets all features EXCEPT trial-exempt ones
  if (isTrialModeActive() && !TRIAL_EXEMPT_FEATURES.includes(feature)) {
    return true;
  }

  const requiredTier = FEATURE_MIN_TIER[feature];

  // Special case: dealer has access to free features + dealer features + collection
  if (tier === 'dealer') {
    return requiredTier === 'free' || requiredTier === 'dealer' || feature === 'collection_access';
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
  tier: 'inner_circle' | 'dealer';
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
    description: 'Full access to browse and tools',
    features: [
      'Browse all listings',
      'Full filters and search',
      'Saved searches with alerts',
      'AI inquiry emails',
      'Setsumei translations',
      'Artist stats & analysis',
      'Data exports',
    ],
  },
  inner_circle: {
    name: 'Inner Circle',
    description: 'Exclusive access',
    features: [
      'Everything in Free',
      'Private dealer offerings',
      'Exclusive Discord community',
      'Direct LINE support',
      'Personal collection vault',
    ],
    highlighted: true,
  },
  dealer: {
    name: 'Dealer',
    description: 'For trade professionals',
    features: [
      'All free features',
      'Analytics dashboard',
      'Competitor intelligence',
      'Submit private listings',
      'Personal collection vault',
    ],
  },
};

// =============================================================================
// PAYWALL CONFIG (Superwall/Parra pattern)
// =============================================================================

/**
 * Paywall bullet points for Inner Circle upsell.
 */
export const PAYWALL_BULLETS: Record<'inner_circle', string[]> = {
  inner_circle: [
    'Private dealer offerings',
    'Exclusive Discord community',
    'Direct LINE support',
    'Personal collection vault',
  ],
};

/**
 * Get paywall configuration for a required tier.
 * Returns the tier name, price, and bullet points for the paywall modal.
 */
export function getPaywallConfig(requiredTier: SubscriptionTier): {
  tier: 'inner_circle';
  name: string;
  price: number;
  bullets: string[];
} {
  return {
    tier: 'inner_circle',
    name: TIER_DISPLAY_NAMES.inner_circle,
    price: TIER_PRICING.inner_circle.monthly,
    bullets: PAYWALL_BULLETS.inner_circle,
  };
}
