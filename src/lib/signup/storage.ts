/**
 * Signup Pressure System - Storage Utilities
 *
 * Handles localStorage persistence for the signup pressure state.
 * Manages session detection, cooldown tracking, and pre-signup favorites.
 */

import type { SignupPressurePersistedState } from './types';
import { STORAGE_KEY, SIGNUP_PRESSURE_CONFIG } from './config';

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get the default initial state.
 */
export function getDefaultPersistedState(): SignupPressurePersistedState {
  return {
    quickViewCount: 0,
    sessionStartTime: Date.now(),
    lastDismissedAt: null,
    dismissCount: 0,
    hasSignedUp: false,
    localFavorites: [],
    sessionId: generateSessionId(),
  };
}

/**
 * Load persisted state from localStorage.
 * Handles missing/corrupted data gracefully.
 */
export function loadPersistedState(): SignupPressurePersistedState {
  if (typeof window === 'undefined') {
    return getDefaultPersistedState();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultPersistedState();
    }

    const parsed = JSON.parse(stored) as Partial<SignupPressurePersistedState>;

    // Validate and merge with defaults
    const state: SignupPressurePersistedState = {
      quickViewCount:
        typeof parsed.quickViewCount === 'number' ? parsed.quickViewCount : 0,
      sessionStartTime:
        typeof parsed.sessionStartTime === 'number'
          ? parsed.sessionStartTime
          : Date.now(),
      lastDismissedAt:
        typeof parsed.lastDismissedAt === 'number' ? parsed.lastDismissedAt : null,
      dismissCount: typeof parsed.dismissCount === 'number' ? parsed.dismissCount : 0,
      hasSignedUp: typeof parsed.hasSignedUp === 'boolean' ? parsed.hasSignedUp : false,
      localFavorites: Array.isArray(parsed.localFavorites)
        ? parsed.localFavorites.filter((id) => typeof id === 'string')
        : [],
      sessionId:
        typeof parsed.sessionId === 'string' ? parsed.sessionId : generateSessionId(),
    };

    // Check if session has expired (creates new session)
    if (isSessionExpired(state.sessionStartTime)) {
      return {
        ...state,
        quickViewCount: 0,
        sessionStartTime: Date.now(),
        sessionId: generateSessionId(),
      };
    }

    return state;
  } catch {
    // Corrupted data - start fresh
    return getDefaultPersistedState();
  }
}

/**
 * Save persisted state to localStorage.
 */
export function savePersistedState(state: SignupPressurePersistedState): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable - fail silently
    console.warn('Failed to persist signup pressure state');
  }
}

/**
 * Clear all persisted state (for testing or user request).
 */
export function clearPersistedState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Fail silently
  }
}

/**
 * Check if the session has expired based on timeout.
 */
export function isSessionExpired(sessionStartTime: number): boolean {
  const timeoutMs = SIGNUP_PRESSURE_CONFIG.sessionTimeoutMinutes * 60 * 1000;
  const timeSinceStart = Date.now() - sessionStartTime;
  return timeSinceStart > timeoutMs;
}

/**
 * Check if the modal is currently on cooldown.
 */
export function isOnCooldown(lastDismissedAt: number | null): boolean {
  if (lastDismissedAt === null) {
    return false;
  }

  const cooldownMs = SIGNUP_PRESSURE_CONFIG.cooldownHours * 60 * 60 * 1000;
  const timeSinceDismissal = Date.now() - lastDismissedAt;
  return timeSinceDismissal < cooldownMs;
}

/**
 * Check if maximum dismissals have been reached.
 */
export function hasExceededMaxDismissals(dismissCount: number): boolean {
  return dismissCount >= SIGNUP_PRESSURE_CONFIG.maxDismissals;
}

/**
 * Check if engagement thresholds have been met.
 */
export function checkThresholds(quickViewCount: number, timeOnSite: number): boolean {
  const { quickViewThreshold, timeThreshold, requireBoth } = SIGNUP_PRESSURE_CONFIG;

  const viewsMet = quickViewCount >= quickViewThreshold;
  const timeMet = timeOnSite >= timeThreshold;

  return requireBoth ? viewsMet && timeMet : viewsMet || timeMet;
}

/**
 * Calculate time on site in seconds.
 */
export function calculateTimeOnSite(sessionStartTime: number): number {
  return Math.floor((Date.now() - sessionStartTime) / 1000);
}
