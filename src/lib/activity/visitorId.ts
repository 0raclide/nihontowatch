/**
 * Persistent Visitor ID for Anonymous User Tracking
 *
 * Generates and stores a unique visitor ID that persists across sessions.
 * This allows tracking user behavior over time without requiring login.
 *
 * The visitor ID is:
 * - Stored in localStorage (persists across sessions)
 * - Generated once per browser/device
 * - Used to link all activity events to a single anonymous user
 */

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
 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';

  try {
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);

    if (!visitorId) {
      visitorId = generateVisitorId();
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
      localStorage.setItem(VISITOR_CREATED_KEY, new Date().toISOString());
    }

    return visitorId;
  } catch {
    // localStorage blocked (private browsing, etc.)
    // Fall back to session-only ID
    return generateVisitorId();
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
