/**
 * Cookie Consent System Type Definitions
 *
 * Types for GDPR-compliant cookie consent management.
 * Categories follow the IAB TCF 2.0 framework conceptually.
 */

// =============================================================================
// CONSENT CATEGORIES
// =============================================================================

/**
 * Cookie consent categories
 * - essential: Required for site to function (auth, security) - always on
 * - functional: Preferences like theme, currency, recently viewed
 * - analytics: Activity tracking, visitor IDs, dwell time
 * - marketing: Reserved for future use (ads, retargeting)
 */
export type ConsentCategory = 'essential' | 'functional' | 'analytics' | 'marketing';

/**
 * All consent categories for iteration
 */
export const CONSENT_CATEGORIES: ConsentCategory[] = [
  'essential',
  'functional',
  'analytics',
  'marketing',
];

/**
 * Categories that require explicit consent (non-essential)
 */
export const OPTIONAL_CATEGORIES: Exclude<ConsentCategory, 'essential'>[] = [
  'functional',
  'analytics',
  'marketing',
];

// =============================================================================
// CONSENT PREFERENCES
// =============================================================================

/**
 * User's consent preferences for each category
 */
export interface ConsentPreferences {
  /** Essential cookies - always true, cannot be changed */
  essential: true;
  /** Functional cookies - theme, currency, preferences */
  functional: boolean;
  /** Analytics cookies - activity tracking, visitor ID */
  analytics: boolean;
  /** Marketing cookies - future use */
  marketing: boolean;
}

/**
 * Full consent record with metadata
 */
export interface ConsentRecord {
  /** User's consent choices */
  preferences: ConsentPreferences;
  /** ISO timestamp of when consent was given/updated */
  timestamp: string;
  /** Version of the cookie policy consented to */
  version: string;
  /** How consent was given */
  method: ConsentMethod;
}

/**
 * Method by which consent was given
 */
export type ConsentMethod = 'banner' | 'preferences' | 'api' | 'implicit';

// =============================================================================
// CONSENT STATE
// =============================================================================

/**
 * Full consent state for the application
 */
export interface ConsentState {
  /** Whether user has made any consent choice */
  hasConsented: boolean;
  /** The consent record (null if no consent given yet) */
  consent: ConsentRecord | null;
  /** Whether consent banner should be shown */
  showBanner: boolean;
  /** Whether preferences modal is open */
  showPreferences: boolean;
}

// =============================================================================
// CATEGORY METADATA
// =============================================================================

/**
 * Human-readable information about each consent category
 */
export interface CategoryInfo {
  id: ConsentCategory;
  name: string;
  description: string;
  required: boolean;
  /** Examples of what this category covers */
  examples: string[];
}

/**
 * Information about each consent category for display
 */
export const CATEGORY_INFO: Record<ConsentCategory, CategoryInfo> = {
  essential: {
    id: 'essential',
    name: 'Essential',
    description: 'Required for the website to function. These cannot be disabled.',
    required: true,
    examples: [
      'Authentication and login sessions',
      'Security features',
      'Cookie consent preferences',
    ],
  },
  functional: {
    id: 'functional',
    name: 'Functional',
    description: 'Enable personalized features and remember your preferences.',
    required: false,
    examples: [
      'Theme preference (light/dark mode)',
      'Currency preference (JPY/USD/EUR)',
      'Recently viewed items',
    ],
  },
  analytics: {
    id: 'analytics',
    name: 'Analytics',
    description: 'Help us understand how visitors use our website to improve the experience.',
    required: false,
    examples: [
      'Page view tracking',
      'Search analytics',
      'Feature usage statistics',
    ],
  },
  marketing: {
    id: 'marketing',
    name: 'Marketing',
    description: 'Used to deliver relevant advertisements and track campaign effectiveness.',
    required: false,
    examples: [
      'Currently not used',
      'Reserved for future advertising features',
    ],
  },
};

// =============================================================================
// STORAGE KEYS
// =============================================================================

/**
 * localStorage key for consent preferences
 */
export const CONSENT_STORAGE_KEY = 'nihontowatch_consent';

/**
 * Current cookie policy version - increment when policy changes
 */
export const CONSENT_VERSION = '1.0';

// =============================================================================
// DEFAULT VALUES
// =============================================================================

/**
 * Default consent preferences (all optional disabled)
 */
export const DEFAULT_PREFERENCES: ConsentPreferences = {
  essential: true,
  functional: false,
  analytics: false,
  marketing: false,
};

/**
 * "Accept all" consent preferences
 */
export const ACCEPT_ALL_PREFERENCES: ConsentPreferences = {
  essential: true,
  functional: true,
  analytics: true,
  marketing: true,
};

/**
 * "Reject non-essential" consent preferences
 */
export const REJECT_NON_ESSENTIAL_PREFERENCES: ConsentPreferences = {
  essential: true,
  functional: false,
  analytics: false,
  marketing: false,
};

// =============================================================================
// DATABASE TYPES
// =============================================================================

/**
 * Consent history record for database storage
 */
export interface ConsentHistoryRecord {
  id: string;
  user_id: string | null;
  visitor_id: string | null;
  preferences: ConsentPreferences;
  version: string;
  method: ConsentMethod;
  ip_hash: string | null;
  created_at: string;
}

/**
 * Insert type for consent history
 */
export interface ConsentHistoryInsert {
  user_id?: string | null;
  visitor_id?: string | null;
  preferences: ConsentPreferences;
  version: string;
  method: ConsentMethod;
  ip_hash?: string | null;
}

/**
 * Data deletion request record
 */
export interface DataDeletionRequest {
  id: string;
  user_id: string;
  email: string;
  reason: string | null;
  feedback: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requested_at: string;
  processed_at: string | null;
}

/**
 * Insert type for deletion request
 */
export interface DataDeletionRequestInsert {
  user_id: string;
  email: string;
  reason?: string | null;
  feedback?: string | null;
}

// =============================================================================
// API TYPES
// =============================================================================

/**
 * Request body for updating consent preferences
 */
export interface ConsentUpdateRequest {
  preferences: Partial<Omit<ConsentPreferences, 'essential'>>;
}

/**
 * Response from consent API
 */
export interface ConsentResponse {
  success: boolean;
  consent: ConsentRecord;
}

/**
 * Request body for data deletion API
 */
export interface DataDeletionRequestBody {
  confirmEmail: string;
  reason?: 'privacy' | 'not_using' | 'switching_service' | 'other';
  feedback?: string;
}
