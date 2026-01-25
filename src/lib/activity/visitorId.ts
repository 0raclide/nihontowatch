/**
 * Persistent Visitor ID for Anonymous User Tracking
 *
 * Generates and stores a unique visitor ID that persists across sessions.
 * This allows tracking user behavior over time without requiring login.
 *
 * The visitor ID is:
 * - Stored in localStorage (persists across sessions) ONLY if analytics consent is given
 * - Generated once per browser/device
 * - Used to link all activity events to a single anonymous user
 *
 * GDPR Compliance:
 * - If no analytics consent, returns session-only ID (not persisted)
 * - Existing IDs are respected (consent was given when they were created)
 */

import { hasAnalyticsConsent } from '@/lib/consent';

const VISITOR_ID_KEY = 'nihontowatch_visitor_id';
const VISITOR_CREATED_KEY = 'nihontowatch_visitor_created';

/**
 * Generate a unique visitor ID
 * Format: vis_<timestamp>_<random>
 */
function generateVisitorId(): string {
  const timestamp = Date.now().toString(36);
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').substring(0, 12)
    : Math.random().toString(36).substring(2, 14);
  return `vis_${timestamp}_${random}`;
}

/**
 * Get or create the persistent visitor ID
 *
 * GDPR Compliance:
 * - Returns existing ID if one exists (consent was given when created)
 * - Only creates NEW persistent ID if analytics consent is given
 * - Falls back to session-only ID if no consent
 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';

  try {
    // Check if we already have a visitor ID (consent was given when it was created)
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);

    if (visitorId) {
      return visitorId;
    }

    // No existing ID - check if we have consent to create one
    if (!hasAnalyticsConsent()) {
      // No consent - return session-only ID (not persisted)
      return generateSessionOnlyId();
    }

    // Have consent - create and persist a new visitor ID
    visitorId = generateVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
    localStorage.setItem(VISITOR_CREATED_KEY, new Date().toISOString());

    return visitorId;
  } catch {
    // localStorage blocked (private browsing, etc.)
    // Fall back to session-only ID
    return generateSessionOnlyId();
  }
}

/**
 * Generate a session-only visitor ID (not persisted)
 * Uses sessionStorage so it persists within the tab but not across sessions
 */
const SESSION_VISITOR_KEY = 'nihontowatch_session_visitor';

function generateSessionOnlyId(): string {
  if (typeof window === 'undefined') return '';

  try {
    let sessionId = sessionStorage.getItem(SESSION_VISITOR_KEY);
    if (!sessionId) {
      sessionId = `anon_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
      sessionStorage.setItem(SESSION_VISITOR_KEY, sessionId);
    }
    return sessionId;
  } catch {
    // sessionStorage blocked - generate ephemeral ID
    return `anon_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

/**
 * Get visitor creation timestamp
 */
export function getVisitorCreatedAt(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(VISITOR_CREATED_KEY);
  } catch {
    return null;
  }
}

/**
 * Check if this is a new visitor (first time on this device)
 */
export function isNewVisitor(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return !localStorage.getItem(VISITOR_ID_KEY);
  } catch {
    return true;
  }
}

/**
 * Get device fingerprint data (non-invasive)
 * This helps identify unique devices without using invasive fingerprinting
 */
export function getDeviceInfo(): {
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  timezone: string;
  language: string;
  platform: string;
  touchSupport: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      screenWidth: 0,
      screenHeight: 0,
      pixelRatio: 1,
      timezone: '',
      language: '',
      platform: '',
      touchSupport: false,
    };
  }

  return {
    screenWidth: window.screen?.width || 0,
    screenHeight: window.screen?.height || 0,
    pixelRatio: window.devicePixelRatio || 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    language: navigator.language || '',
    platform: navigator.platform || '',
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  };
}

/**
 * Get a simple device hash for grouping similar devices
 * Not meant for precise identification, just rough categorization
 */
export function getDeviceHash(): string {
  const info = getDeviceInfo();
  const str = `${info.screenWidth}x${info.screenHeight}@${info.pixelRatio}_${info.platform}_${info.language}`;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}
