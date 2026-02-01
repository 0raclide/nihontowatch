/**
 * View Tracking Client Helper
 *
 * Client-side utility for tracking listing views.
 * Calls POST /api/track/view endpoint.
 *
 * Usage:
 *   import { trackListingView, getViewReferrer } from '@/lib/tracking/viewTracker';
 *
 *   // Track a view
 *   trackListingView(listingId, sessionId, userId, getViewReferrer());
 */

export type ViewReferrer = 'browse' | 'search' | 'direct' | 'external' | 'alert';

/**
 * Track a listing view
 *
 * @param listingId - The ID of the listing being viewed
 * @param sessionId - The user's session ID
 * @param userId - Optional user ID if authenticated
 * @param referrer - How the user arrived at this listing
 *
 * @returns Promise that resolves to true if tracking succeeded
 *
 * Note: This function never throws - tracking failures are silent
 * to avoid impacting user experience.
 */
export async function trackListingView(
  listingId: number,
  sessionId: string,
  userId?: string,
  referrer?: ViewReferrer
): Promise<boolean> {
  try {
    const response = await fetch('/api/track/view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listingId,
        sessionId,
        userId,
        referrer,
      }),
    });

    if (!response.ok) {
      // Don't throw - just return false
      return false;
    }

    const data = await response.json();
    return data.success === true;
  } catch {
    // Silent failure - tracking should never break UX
    return false;
  }
}

/**
 * Detect the referrer type from the current page context
 *
 * Returns the most likely source of how the user arrived at a listing:
 * - 'browse': From the browse/catalog page
 * - 'search': From search results
 * - 'direct': Direct link (no referrer or same-site non-browse page)
 * - 'external': From an external website
 * - 'alert': From an email alert link
 *
 * @returns The detected referrer type
 */
export function getViewReferrer(): ViewReferrer {
  // Check if we're in a browser environment
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

/**
 * Create a view tracker function with pre-configured session/user
 *
 * Useful for creating a tracker instance that can be used throughout a component
 * without having to pass session/user IDs every time.
 *
 * @param sessionId - The user's session ID
 * @param userId - Optional user ID if authenticated
 *
 * @returns A function that tracks views with just the listingId
 */
export function createViewTracker(sessionId: string, userId?: string) {
  return function trackView(listingId: number, referrer?: ViewReferrer): Promise<boolean> {
    return trackListingView(listingId, sessionId, userId, referrer ?? getViewReferrer());
  };
}
