/**
 * Signup Pressure System - Type Definitions
 *
 * This module defines the types for the signup pressure system that
 * encourages user registration at optimal engagement moments.
 */

/**
 * Trigger context determines which copy variant to show in the modal.
 * Each context maps to a different value proposition.
 */
export type SignupTriggerContext =
  | 'engagement' // Triggered by view count + time threshold
  | 'favorite' // Triggered by attempting to favorite
  | 'alert' // Triggered by setting up price/listing alerts
  | 'priceHistory'; // Triggered by viewing price history

/**
 * Persisted state stored in localStorage.
 * Survives browser sessions to maintain trigger logic across visits.
 */
export interface SignupPressurePersistedState {
  /** Number of quick view opens in this visit session */
  quickViewCount: number;

  /** Timestamp when user first arrived (current session) */
  sessionStartTime: number;

  /** Timestamp when modal was last dismissed (null if never) */
  lastDismissedAt: number | null;

  /** Number of times modal has been dismissed total */
  dismissCount: number;

  /** Whether user has signed up (stops all triggers) */
  hasSignedUp: boolean;

  /** Items saved locally before signup (preserved for migration) */
  localFavorites: string[];

  /** Session ID to detect new sessions */
  sessionId: string;
}

/**
 * Runtime state managed by the context provider.
 */
export interface SignupPressureState {
  /** Whether the signup modal is currently visible */
  isModalOpen: boolean;

  /** What triggered the modal (determines copy variant) */
  triggerContext: SignupTriggerContext | null;

  /** Current quick view count this session */
  quickViewCount: number;

  /** Seconds elapsed since session start */
  timeOnSite: number;

  /** Whether thresholds have been met (but modal may be on cooldown) */
  thresholdsMet: boolean;

  /** Whether modal is in cooldown period after dismissal */
  isOnCooldown: boolean;

  /** Whether user is authenticated (disables all triggers) */
  isAuthenticated: boolean;

  /** Dynamic active dealer count from the database */
  dealerCount: number;
}

/**
 * Actions available to components via the context.
 */
export interface SignupPressureActions {
  /** Increment quick view counter (call when QuickView opens) */
  trackQuickView: () => void;

  /** Attempt to trigger modal for a specific action (favorite, alert, etc.) */
  triggerForAction: (context: SignupTriggerContext) => boolean;

  /** Dismiss the modal (starts cooldown) */
  dismissModal: () => void;

  /** Close modal without starting cooldown (e.g., successful signup) */
  closeModal: () => void;

  /** Mark user as signed up (disables all future triggers) */
  markAsSignedUp: () => void;

  /** Add item to local favorites (pre-signup state preservation) */
  addLocalFavorite: (listingId: string) => void;

  /** Get local favorites for migration after signup */
  getLocalFavorites: () => string[];

  /** Reset session (for testing or manual reset) */
  resetSession: () => void;
}

/**
 * Combined context value type.
 */
export interface SignupPressureContextValue
  extends SignupPressureState,
    SignupPressureActions {}

/**
 * Configuration for the signup pressure system.
 */
export interface SignupPressureConfig {
  /** Number of quick views required to trigger */
  quickViewThreshold: number;

  /** Seconds on site required to trigger */
  timeThreshold: number;

  /** Whether both thresholds must be met (AND) or either (OR) */
  requireBoth: boolean;

  /** Hours to wait after dismissal before showing again */
  cooldownHours: number;

  /** Maximum number of dismissals before giving up entirely */
  maxDismissals: number;

  /** Session timeout in minutes (new session after inactivity) */
  sessionTimeoutMinutes: number;
}

/**
 * Copy variant for the signup modal.
 */
export interface SignupModalCopy {
  headline: string;
  body: string;
  cta: string;
  dismiss: string;
  socialProof: string;
}

/**
 * All copy variants keyed by trigger context.
 */
export type SignupModalCopyVariants = Record<SignupTriggerContext, SignupModalCopy>;
