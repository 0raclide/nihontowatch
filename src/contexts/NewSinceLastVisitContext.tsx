'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { NEW_SINCE_LAST_VISIT } from '@/lib/constants';

// =============================================================================
// Types
// =============================================================================

interface NewSinceLastVisitState {
  /** Number of new items since last visit (null if unknown or first visit) */
  count: number | null;
  /** Days since last visit (null if first visit) */
  daysSince: number | null;
  /** Whether this is the user's first visit (no last_visit_at recorded) */
  isFirstVisit: boolean;
  /** Whether the banner has been dismissed this session */
  isDismissed: boolean;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Last visit timestamp (ISO string) */
  lastVisitAt: string | null;
}

interface NewSinceLastVisitContextValue extends NewSinceLastVisitState {
  /** Dismiss the banner for this session */
  dismiss: () => void;
  /** Update last visit timestamp (call when user visits browse page) */
  recordVisit: () => Promise<void>;
  /** Refresh the new items count */
  refresh: () => Promise<void>;
}

// =============================================================================
// Constants
// =============================================================================

const DISMISS_KEY = 'nihontowatch_new_items_dismissed';

// =============================================================================
// Context
// =============================================================================

const NewSinceLastVisitContext = createContext<NewSinceLastVisitContextValue | undefined>(undefined);

// =============================================================================
// Provider
// =============================================================================

export function NewSinceLastVisitProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();

  const [state, setState] = useState<NewSinceLastVisitState>({
    count: null,
    daysSince: null,
    isFirstVisit: false,
    isDismissed: false,
    isLoading: true,
    lastVisitAt: null,
  });

  // Check session storage for dismissed state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = sessionStorage.getItem(DISMISS_KEY) === 'true';
      if (dismissed) {
        setState(prev => ({ ...prev, isDismissed: true }));
      }
    }
  }, []);

  // Fetch new items count when user is authenticated
  const fetchCount = useCallback(async () => {
    if (!user) {
      setState(prev => ({
        ...prev,
        count: null,
        daysSince: null,
        isFirstVisit: false,
        isLoading: false,
        lastVisitAt: null,
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch('/api/user/new-items-count');
      const data = await res.json();

      if (data.isLoggedIn) {
        setState(prev => ({
          ...prev,
          count: data.count,
          daysSince: data.daysSince ?? null,
          isFirstVisit: data.isFirstVisit || false,
          isLoading: false,
          lastVisitAt: data.lastVisitAt || null,
        }));
      } else {
        setState(prev => ({
          ...prev,
          count: null,
          daysSince: null,
          isFirstVisit: false,
          isLoading: false,
          lastVisitAt: null,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch new items count:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  // Fetch on mount and when user changes
  useEffect(() => {
    if (!authLoading) {
      fetchCount();
    }
  }, [authLoading, fetchCount]);

  // Dismiss the banner
  const dismiss = useCallback(() => {
    setState(prev => ({ ...prev, isDismissed: true }));
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(DISMISS_KEY, 'true');
    }
  }, []);

  // Record a visit (update last_visit_at)
  const recordVisit = useCallback(async () => {
    if (!user) return;

    try {
      await fetch('/api/user/update-last-visit', { method: 'POST' });
      // Refresh the count after recording visit
      await fetchCount();
    } catch (error) {
      console.error('Failed to record visit:', error);
    }
  }, [user, fetchCount]);

  // Memoize context value
  const value: NewSinceLastVisitContextValue = useMemo(
    () => ({
      ...state,
      dismiss,
      recordVisit,
      refresh: fetchCount,
    }),
    [state, dismiss, recordVisit, fetchCount]
  );

  return (
    <NewSinceLastVisitContext.Provider value={value}>
      {children}
    </NewSinceLastVisitContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useNewSinceLastVisit(): NewSinceLastVisitContextValue {
  const context = useContext(NewSinceLastVisitContext);
  if (context === undefined) {
    throw new Error('useNewSinceLastVisit must be used within a NewSinceLastVisitProvider');
  }
  return context;
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Returns whether the banner should be shown based on state and thresholds
 */
export function useShouldShowNewItemsBanner(): boolean {
  const { count, isDismissed, isLoading, isFirstVisit } = useNewSinceLastVisit();
  const { user } = useAuth();

  // Show teaser for logged-out users (not dismissed)
  if (!user && !isDismissed) {
    return true;
  }

  // Don't show while loading
  if (isLoading) {
    return false;
  }

  // Don't show if dismissed
  if (isDismissed) {
    return false;
  }

  // Don't show for first visit - wait until they have a baseline
  if (isFirstVisit) {
    return false;
  }

  // Show if count meets threshold
  return count !== null && count >= NEW_SINCE_LAST_VISIT.MIN_ITEMS_THRESHOLD;
}
