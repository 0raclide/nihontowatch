/**
 * Consent Helpers
 *
 * Standalone functions to check consent status from localStorage.
 * These can be used outside of React components (e.g., in tracking code).
 */

import {
  type ConsentCategory,
  type ConsentRecord,
  CONSENT_STORAGE_KEY,
} from './types';

/**
 * Get stored consent from localStorage
 * Can be called from anywhere (not just React components)
 */
export function getStoredConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as ConsentRecord;

    // Validate structure
    if (!parsed.preferences || !parsed.timestamp || !parsed.version) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Check if a specific consent category has been granted
 * Can be called from anywhere (not just React components)
 *
 * @param category - The consent category to check
 * @param defaultIfNoChoice - What to return if user hasn't made a choice yet
 * @returns true if consent is granted, false otherwise
 */
export function hasConsentFor(
  category: ConsentCategory,
  defaultIfNoChoice: boolean = false
): boolean {
  // Essential is always allowed
  if (category === 'essential') return true;

  const consent = getStoredConsent();

  // If no consent record exists, return the default
  // (allows analytics to default ON while others default OFF)
  if (!consent) return defaultIfNoChoice;

  return consent.preferences[category] === true;
}

/**
 * Check if analytics consent has been granted
 * Convenience function for tracking code
 *
 * IMPORTANT: Defaults to TRUE if user hasn't made a choice yet.
 * Tracking is ON by default, only OFF if user explicitly declines.
 */
export function hasAnalyticsConsent(): boolean {
  return hasConsentFor('analytics', true);
}

/**
 * Check if functional consent has been granted
 * Convenience function for preference storage
 */
export function hasFunctionalConsent(): boolean {
  return hasConsentFor('functional');
}

/**
 * Check if marketing consent has been granted
 */
export function hasMarketingConsent(): boolean {
  return hasConsentFor('marketing');
}

/**
 * Check if user has made any consent choice
 */
export function hasUserConsented(): boolean {
  return getStoredConsent() !== null;
}
