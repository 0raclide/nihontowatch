import { useState, useCallback } from 'react';

interface UseDelistActionOptions {
  listingId: number;
  onDelisted?: () => void;
}

/**
 * Shared hook for delist action (remove listing from sale, return to collection).
 * Handles fetch, error state with auto-clear, and CustomEvent dispatch.
 */
export function useDelistAction({ listingId, onDelisted }: UseDelistActionOptions) {
  const [isDelisting, setIsDelisting] = useState(false);
  const [delistError, setDelistError] = useState<string | null>(null);

  const handleDelist = useCallback(async () => {
    setIsDelisting(true);
    setDelistError(null);
    try {
      const res = await fetch(`/api/listings/${listingId}/delist`, { method: 'POST' });
      if (res.ok) {
        onDelisted?.();
        window.dispatchEvent(new CustomEvent('dealer-listing-delisted', { detail: { listingId } }));
      } else {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        setDelistError(data.error || 'Request failed');
        setTimeout(() => setDelistError(null), 3000);
      }
    } catch {
      setDelistError('Network error');
      setTimeout(() => setDelistError(null), 3000);
    } finally {
      setIsDelisting(false);
    }
  }, [listingId, onDelisted]);

  return { isDelisting, delistError, handleDelist };
}
