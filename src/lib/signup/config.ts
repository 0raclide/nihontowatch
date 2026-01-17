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
 * Copy variants for different trigger contexts.
 *
 * Tone: Elevated, confident, understated.
 * Appeals to the discerning collector.
 */
export const SIGNUP_MODAL_COPY: SignupModalCopyVariants = {
  engagement: {
    headline: 'Track what matters.',
    body: "You're clearly discerning. Create an account to save the pieces you're watching, receive alerts when prices shift, and never lose track of a listing that caught your eye.",
    cta: 'Create Account',
    dismiss: 'Continue browsing',
    socialProof: 'Trusted by collectors in 40+ countries',
  },

  favorite: {
    headline: 'Keep this one close.',
    body: "Create an account to save this piece to your collection. You'll be notified if the price changes or if it sells.",
    cta: 'Create Account',
    dismiss: 'Continue browsing',
    socialProof: 'Join thousands of collectors tracking their acquisitions',
  },

  alert: {
    headline: 'Never miss the moment.',
    body: 'Price drops and new listings move fast. Create an account to receive instant alerts tailored to your criteria.',
    cta: 'Create Account',
    dismiss: 'Continue browsing',
    socialProof: 'Collectors receive alerts within minutes of price changes',
  },

  priceHistory: {
    headline: 'See the full picture.',
    body: 'Understanding price history helps you make informed decisions. Create an account to access historical data and market trends.',
    cta: 'Create Account',
    dismiss: 'Continue browsing',
    socialProof: 'Track price movements across 27 dealers worldwide',
  },
};

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
