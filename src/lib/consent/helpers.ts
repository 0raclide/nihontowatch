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
import { GDPR_COOKIE } from './gdpr';

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
 * Read the GDPR region flag from the `nw-gdpr` cookie (client-side).
 * For use outside React components (ActivityTracker, visitorId, etc.).
 * Returns true if the visitor is in a GDPR jurisdiction.
 */
export function isGdprRegionFromCookie(): boolean {
  if (typeof document === 'undefined') return false;

  try {
    const match = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${GDPR_COOKIE}=`));
    return match?.split('=')[1] === '1';
  } catch {
    return false;
  }
}

/**
 * Check if analytics consent has been granted
 * Convenience function for tracking code
 *
 * - Non-GDPR visitors: defaults to TRUE (no consent needed)
 * - GDPR visitors: defaults to FALSE until explicit opt-in
 */
export function hasAnalyticsConsent(): boolean {
  return hasConsentFor('analytics', !isGdprRegionFromCookie());
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
