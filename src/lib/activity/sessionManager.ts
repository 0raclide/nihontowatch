/**
 * Session Manager for Activity Tracking
 *
 * Manages user session lifecycle including:
 * - Unique session ID generation
 * - Session start/end timestamps
 * - Last activity tracking
 * - Page unload handling with sendBeacon
 */

// Session storage key
const SESSION_KEY = 'nihontowatch_session';
const SESSION_ID_KEY = 'nihontowatch_session_id';

// =============================================================================
// Types
// =============================================================================

export interface SessionData {
  id: string;
  startedAt: number; // Unix timestamp ms
  lastActivityAt: number; // Unix timestamp ms
  pageViews: number;
}

export interface SessionEndPayload {
  sessionId: string;
  startedAt: string; // ISO string
  endedAt: string; // ISO string
  totalDurationMs: number;
  pageViews: number;
}

// =============================================================================
// Session ID Generation
// =============================================================================

/**
 * Generate a unique session ID using crypto API with timestamp prefix
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().split('-')[0]
      : Math.random().toString(36).substring(2, 10);
  return `sess_${timestamp}_${randomPart}`;
}

// =============================================================================
// Session Management
// =============================================================================

/**
 * Get the current session data from sessionStorage
 */
export function getSession(): SessionData | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Get the current session ID (creates one if doesn't exist)
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  // Try to get existing session ID
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);

  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Initialize or get the current session
 * Creates a new session if none exists
 */
export function initSession(): SessionData {
  if (typeof window === 'undefined') {
    return {
      id: '',
      startedAt: 0,
      lastActivityAt: 0,
      pageViews: 0,
    };
  }

  const existing = getSession();
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const session: SessionData = {
    id: getSessionId(),
    startedAt: now,
    lastActivityAt: now,
    pageViews: 0,
  };

  saveSession(session);
  return session;
}

/**
 * Save session data to sessionStorage
 */
export function saveSession(session: SessionData): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Silently fail if storage is full or unavailable
  }
}

/**
 * Update last activity timestamp and increment page views if applicable
 */
export function updateActivity(incrementPageViews = false): SessionData {
  const session = getSession() || initSession();

  session.lastActivityAt = Date.now();
  if (incrementPageViews) {
    session.pageViews += 1;
  }

  saveSession(session);
  return session;
}

/**
 * Calculate the total session duration in milliseconds
 */
export function getSessionDuration(): number {
  const session = getSession();
  if (!session) return 0;
  return session.lastActivityAt - session.startedAt;
}

// =============================================================================
// Session End Handling
// =============================================================================

/**
 * Build the session end payload for API submission
 */
export function buildSessionEndPayload(): SessionEndPayload | null {
  const session = getSession();
  if (!session || !session.id) return null;

  const endedAt = Date.now();

  // If page is currently hidden, include time from last hide
  let finalHiddenMs = totalHiddenMs;
  if (isPageHidden && hiddenAtTimestamp) {
    finalHiddenMs += endedAt - hiddenAtTimestamp;
  }

  const rawDuration = endedAt - session.startedAt;
  const activeDuration = Math.max(0, rawDuration - finalHiddenMs);

  return {
    sessionId: session.id,
    startedAt: new Date(session.startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    totalDurationMs: activeDuration,
    pageViews: session.pageViews,
  };
}

/**
 * Send session end data using sendBeacon for reliable delivery on page unload
 * Falls back to regular fetch if sendBeacon is not available
 */
export function endSession(): void {
  const payload = buildSessionEndPayload();
  if (!payload) return;

  const url = '/api/activity/session';
  const data = JSON.stringify({
    action: 'end',
    ...payload,
  });

  // Use sendBeacon for reliable delivery on page close
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([data], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
  } else {
    // Fallback to fetch with keepalive
    fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: data,
      keepalive: true,
    }).catch(() => {
      // Silently fail - this is best-effort
    });
  }

  // Clear session data
  clearSession();
}

/**
 * Clear session data from storage
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;

  totalHiddenMs = 0;

  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
  } catch {
    // Silently fail
  }
}

// =============================================================================
// Page Visibility Tracking
// =============================================================================

let isPageHidden = false;
let hiddenAtTimestamp: number | null = null;
let totalHiddenMs = 0;

/**
 * Track page visibility changes
 * Returns time spent hidden when page becomes visible again
 */
export function handleVisibilityChange(): { wasHidden: boolean; hiddenDurationMs: number } {
  if (typeof document === 'undefined') {
    return { wasHidden: false, hiddenDurationMs: 0 };
  }

  const wasHidden = isPageHidden;
  const now = Date.now();
  let hiddenDurationMs = 0;

  if (document.hidden) {
    // Page became hidden
    isPageHidden = true;
    hiddenAtTimestamp = now;
  } else {
    // Page became visible
    if (wasHidden && hiddenAtTimestamp) {
      hiddenDurationMs = now - hiddenAtTimestamp;
      totalHiddenMs += hiddenDurationMs;
    }
    isPageHidden = false;
    hiddenAtTimestamp = null;
  }

  return { wasHidden, hiddenDurationMs };
}

/**
 * Check if the page is currently hidden
 */
export function isHidden(): boolean {
  return isPageHidden;
}

// =============================================================================
// Setup Functions
// =============================================================================

/**
 * Set up page unload handler for session end
 * Should be called once during app initialization
 */
export function setupUnloadHandler(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = () => {
    endSession();
  };

  // Use both events for maximum compatibility
  window.addEventListener('pagehide', handler);
  window.addEventListener('beforeunload', handler);

  // Return cleanup function
  return () => {
    window.removeEventListener('pagehide', handler);
    window.removeEventListener('beforeunload', handler);
  };
}

/**
 * Set up visibility change handler
 */
export function setupVisibilityHandler(
  onVisibilityChange?: (hidden: boolean, hiddenDurationMs: number) => void
): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = () => {
    const { wasHidden, hiddenDurationMs } = handleVisibilityChange();
    if (onVisibilityChange) {
      onVisibilityChange(document.hidden, wasHidden ? hiddenDurationMs : 0);
    }
  };

  document.addEventListener('visibilitychange', handler);

  return () => {
    document.removeEventListener('visibilitychange', handler);
  };
}
