const STORAGE_KEY = 'listing_return_context';
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export interface ListingReturnContext {
  listingId: number;
  title: string;
  thumbnailUrl: string | null;
  dealerName: string | null;
  timestamp: number;
}

/**
 * Save minimal listing context to sessionStorage before navigating away.
 * Called from QuickView before router.push to artist pages.
 */
export function saveListingReturnContext(listing: {
  id: number | string;
  title?: string | null;
  images?: string[] | null;
  dealers?: { name?: string } | null;
  dealer?: { name?: string } | null;
}) {
  try {
    const ctx: ListingReturnContext = {
      listingId: Number(listing.id),
      title: listing.title || 'Listing',
      thumbnailUrl: listing.images?.[0] || null,
      dealerName: listing.dealers?.name || listing.dealer?.name || null,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // sessionStorage may be unavailable (private browsing, etc.)
  }
}

/**
 * Read listing return context from sessionStorage.
 * Returns null if missing, expired (>30 min), or invalid.
 */
export function getListingReturnContext(): ListingReturnContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const ctx: ListingReturnContext = JSON.parse(raw);
    if (Date.now() - ctx.timestamp > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Clear listing return context from sessionStorage.
 */
export function clearListingReturnContext() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
