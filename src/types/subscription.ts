/**
 * Subscription & Pro Tier Type Definitions
 *
 * Types for subscription tiers, features, and billing.
 */

// =============================================================================
// SUBSCRIPTION TIERS
// =============================================================================

export type SubscriptionTier = 'free' | 'enthusiast' | 'connoisseur' | 'dealer';

export type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'past_due';

// =============================================================================
// FEATURES
// =============================================================================

export type Feature =
  | 'fresh_data'           // Real-time listings (no 72h delay)
  | 'setsumei_translation' // AI-translated certification descriptions
  | 'inquiry_emails'       // AI-generated dealer inquiry emails
  | 'saved_searches'       // Save search queries
  | 'search_alerts'        // Notifications on new matches
  | 'private_listings'     // Exclusive dealer offerings
  | 'artist_stats'         // Juyo/Tokuju/Bunkazai statistics
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
  connoisseur: 2,
  dealer: 1, // Same level as enthusiast for most features
};

/**
 * Minimum tier required for each feature
 */
export const FEATURE_MIN_TIER: Record<Feature, SubscriptionTier> = {
  // Enthusiast+ features
  fresh_data: 'enthusiast',
  setsumei_translation: 'enthusiast',
  inquiry_emails: 'enthusiast',
  saved_searches: 'enthusiast',
  search_alerts: 'enthusiast',
  export_data: 'enthusiast',
  // Connoisseur features
  private_listings: 'connoisseur',
  artist_stats: 'connoisseur',
  yuhinkai_discord: 'connoisseur',
  line_access: 'connoisseur',
  // Dealer features
  dealer_analytics: 'dealer',
};

/**
 * Check if a tier has access to a feature
 */
export function canAccessFeature(tier: SubscriptionTier, feature: Feature): boolean {
  const requiredTier = FEATURE_MIN_TIER[feature];

  // Special case: dealer has access to enthusiast features but not connoisseur
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
  tier: 'enthusiast' | 'connoisseur' | 'dealer';
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
  isEnthusiast: boolean;
  isConnoisseur: boolean;
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

  return {
    tier: effectiveTier,
    status,
    isActive,
    expiresAt: fields?.subscription_expires_at ?? null,
    isFree: effectiveTier === 'free',
    isEnthusiast: effectiveTier === 'enthusiast' || effectiveTier === 'connoisseur',
    isConnoisseur: effectiveTier === 'connoisseur',
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
  connoisseur: {
    monthly: 200,
    annual: 1800,
    annualSavings: 25, // 25% off
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
      'Browse listings (72h delay)',
      'Basic filters and search',
      'Unlimited favorites',
      'Currency conversion',
    ],
  },
  enthusiast: {
    name: 'Enthusiast',
    description: 'For active collectors',
    features: [
      'Real-time listings',
      'Setsumei translations',
      'AI inquiry email drafts',
      'Saved searches with alerts',
      'Data exports',
    ],
    highlighted: true,
  },
  connoisseur: {
    name: 'Connoisseur',
    description: 'Join an exclusive community',
    features: [
      'Everything in Enthusiast',
      'Private dealer offerings',
      'Artist certification stats',
      'Exclusive Discord community',
      'Direct LINE support',
    ],
  },
  dealer: {
    name: 'Dealer',
    description: 'For trade professionals',
    features: [
      'All Enthusiast features',
      'Analytics dashboard',
      'Competitor intelligence',
      'Submit private listings',
    ],
  },
};

// =============================================================================
// PAYWALL MESSAGES
// =============================================================================

export const FEATURE_PAYWALL_MESSAGES: Record<Feature, { title: string; message: string; requiredTier: SubscriptionTier }> = {
  fresh_data: {
    title: 'Real-time Listings',
    message: 'Free members see listings 72 hours after they\'re posted. Upgrade to see new listings instantly.',
    requiredTier: 'enthusiast',
  },
  setsumei_translation: {
    title: 'Setsumei Translation',
    message: 'Get AI-translated certification descriptions in English.',
    requiredTier: 'enthusiast',
  },
  inquiry_emails: {
    title: 'Professional Inquiry Emails',
    message: 'Send professional emails in Japanese with proper business etiquette. Learn how to request the 10% tax-free export discount that most collectors miss.',
    requiredTier: 'enthusiast',
  },
  saved_searches: {
    title: 'Saved Searches',
    message: 'Save your search criteria and never miss a matching listing. Build your personal watchlist of exactly what you\'re looking for.',
    requiredTier: 'enthusiast',
  },
  search_alerts: {
    title: 'Search Alerts',
    message: 'Get notified instantly when new items match your saved searches.',
    requiredTier: 'enthusiast',
  },
  private_listings: {
    title: 'Private Listings',
    message: 'Access exclusive offerings from top dealers that never go public.',
    requiredTier: 'connoisseur',
  },
  artist_stats: {
    title: 'Artist Statistics',
    message: 'View Juyo, Tokuju, and Bunkazai certification counts for every artist.',
    requiredTier: 'connoisseur',
  },
  yuhinkai_discord: {
    title: 'Yuhinkai Community',
    message: 'Join our private Discord community of serious collectors.',
    requiredTier: 'connoisseur',
  },
  line_access: {
    title: 'LINE with Hoshi',
    message: 'Direct access to market expertise and guidance.',
    requiredTier: 'connoisseur',
  },
  export_data: {
    title: 'Data Export',
    message: 'Export search results to CSV or Excel for your records.',
    requiredTier: 'enthusiast',
  },
  dealer_analytics: {
    title: 'Dealer Analytics',
    message: 'View detailed analytics about your listings and market position.',
    requiredTier: 'dealer',
  },
};
