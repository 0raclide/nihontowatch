/**
 * Signup Pressure System - Configuration
 *
 * Central configuration for trigger thresholds, cooldowns, and modal copy.
 * Adjust these values to tune the signup pressure behavior.
 */

import type { SignupPressureConfig, SignupModalCopyVariants } from './types';

/**
 * Trigger configuration.
 *
 * Based on industry benchmarks for marketplace/aggregator sites:
 * - 5-7 detail views indicates serious shopping behavior
 * - 3-4 minutes indicates invested browsing
 * - Combination filters out casual browsers and idle tabs
 */
export const SIGNUP_PRESSURE_CONFIG: SignupPressureConfig = {
  // Engagement thresholds
  quickViewThreshold: 5,
  timeThreshold: 180, // 3 minutes in seconds

  // Require BOTH thresholds (AND logic)
  // This filters out fast clickers and idle tabs
  requireBoth: true,

  // Cooldown after dismissal
  cooldownHours: 48,

  // Stop showing after this many dismissals
  // Respects user choice, avoids annoyance
  maxDismissals: 3,

  // Session timeout (new session resets quick view count)
  sessionTimeoutMinutes: 30,
};

/**
 * Generate copy variants for different trigger contexts.
 * Dealer count is dynamic — fetched from the database at render time.
 *
 * Tone: Elevated, confident, understated.
 * Appeals to the discerning collector.
 */
export function getSignupModalCopy(dealerCount: number): SignupModalCopyVariants {
  return {
    engagement: {
      headline: `${dealerCount} dealers. One watchlist.`,
      body: 'Save the pieces that caught your eye. Get alerted when new inventory appears across the market. Never miss an item.',
      cta: 'Create Account',
      dismiss: 'Continue browsing',
      socialProof: 'Every major dealer — Japanese and international',
    },

    favorite: {
      headline: 'Keep this one close.',
      body: "Sign up to save this piece. You'll be notified if the price drops or it sells.",
      cta: 'Create Account',
      dismiss: 'Continue browsing',
      socialProof: 'Price alerts delivered within minutes',
    },

    alert: {
      headline: 'New pieces move fast.',
      body: `Listings from ${dealerCount} dealers, the moment they appear. Create an account to set alerts tailored to exactly what you collect.`,
      cta: 'Create Account',
      dismiss: 'Continue browsing',
      socialProof: 'Alerts delivered within minutes of changes',
    },

    priceHistory: {
      headline: 'See the full picture.',
      body: 'Understanding price history helps you make informed decisions. Create an account to access historical data and market trends.',
      cta: 'Create Account',
      dismiss: 'Continue browsing',
      socialProof: 'Price data across all major dealers',
    },
  };
}

/**
 * localStorage key for persisted state.
 */
export const STORAGE_KEY = 'nihontowatch_signup_pressure';

/**
 * Animation timing constants (in ms).
 * Matches existing modal animations in the codebase.
 */
export const ANIMATION_TIMING = {
  modalEnter: 250,
  modalExit: 200,
  backdropFade: 200,
} as const;

/**
 * Z-index for the signup modal.
 * Should be above QuickView (which uses z-50).
 */
export const MODAL_Z_INDEX = 60;
