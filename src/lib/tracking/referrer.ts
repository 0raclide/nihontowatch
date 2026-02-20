/**
 * View Referrer Detection
 *
 * Pure utility to detect how a user arrived at a listing.
 * Extracted from viewTracker.ts for reuse across tracking systems.
 */

export type ViewReferrer = 'browse' | 'search' | 'direct' | 'external' | 'alert';

/**
 * Detect the referrer type from the current page context
 *
 * Returns the most likely source of how the user arrived at a listing:
 * - 'browse': From the browse/catalog page
 * - 'search': From search results
 * - 'direct': Direct link (no referrer or same-site non-browse page)
 * - 'external': From an external website
 * - 'alert': From an email alert link
 */
export function getViewReferrer(): ViewReferrer {
  if (typeof window === 'undefined') {
    return 'direct';
  }

  // Check URL parameters for alert tracking
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('utm_source') === 'alert' || urlParams.get('from') === 'alert') {
    return 'alert';
  }

  // Check URL parameters for search tracking
  if (urlParams.get('from') === 'search' || urlParams.get('q')) {
    return 'search';
  }

  // Check document.referrer
  const referrer = document.referrer;

  if (!referrer) {
    return 'direct';
  }

  try {
    const referrerUrl = new URL(referrer);
    const currentUrl = new URL(window.location.href);

    // Same origin - check the path
    if (referrerUrl.origin === currentUrl.origin) {
      const path = referrerUrl.pathname.toLowerCase();

      if (path.includes('/browse')) {
        return 'browse';
      }

      if (path.includes('/search')) {
        return 'search';
      }

      // Same-site but not from browse/search
      return 'direct';
    }

    // Different origin - external referrer
    return 'external';
  } catch {
    // Invalid URL - treat as direct
    return 'direct';
  }
}
