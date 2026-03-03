import { useState, useCallback } from 'react';

interface UseDealerStatusChangeOptions {
  listingId: number;
  onStatusChange?: (status: string) => void;
}

/**
 * Shared hook for dealer status change actions (Mark Sold, Withdraw, Relist).
 * Handles fetch, error state, and optimistic callback.
 */
export function useDealerStatusChange({ listingId, onStatusChange }: UseDealerStatusChangeOptions) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    setIsUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/dealer/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        onStatusChange?.(newStatus);
      } else {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        setError(data.error || 'Request failed');
        // Auto-clear error after 3s
        setTimeout(() => setError(null), 3000);
      }
    } catch {
      setError('Network error');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsUpdating(false);
    }
  }, [listingId, onStatusChange]);

  return { isUpdating, error, handleStatusChange };
}
