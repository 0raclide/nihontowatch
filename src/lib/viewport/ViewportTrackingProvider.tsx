'use client';

/**
 * ViewportTrackingProvider
 *
 * Context provider that connects viewport tracking with the activity tracking system.
 * Wrap your listing grid components with this provider to enable automatic dwell tracking.
 *
 * Usage:
 * ```tsx
 * <ViewportTrackingProvider>
 *   <VirtualListingGrid listings={listings} />
 * </ViewportTrackingProvider>
 * ```
 */

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useViewportTracking, type ViewportTrackingResult } from './useViewportTracking';
import { useActivityTrackerOptional } from '@/lib/tracking/ActivityTracker';
import type { DwellEvent } from './DwellTracker';

// =============================================================================
// Context Types
// =============================================================================

export interface ViewportTrackingContextValue {
  /** Register an element for viewport tracking */
  trackElement: (element: HTMLElement, listingId: number) => void;
  /** Unregister an element */
  untrackElement: (element: HTMLElement) => void;
  /** Get dwell time for a listing */
  getDwellTime: (listingId: number) => number;
  /** Check if a listing is a revisit */
  isRevisit: (listingId: number) => boolean;
  /** Force flush all events */
  flush: () => void;
  /** Whether tracking is enabled */
  isEnabled: boolean;
}

// =============================================================================
// Context
// =============================================================================

const ViewportTrackingContext =
  createContext<ViewportTrackingContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface ViewportTrackingProviderProps {
  children: ReactNode;
  /** Disable tracking (for testing or when user opts out) */
  disabled?: boolean;
}

export function ViewportTrackingProvider({
  children,
  disabled = false,
}: ViewportTrackingProviderProps) {
  const activityTracker = useActivityTrackerOptional();

  // Determine if tracking should be enabled
  const isEnabled = !disabled && !!activityTracker && !activityTracker.isOptedOut;

  // Handle dwell events by forwarding to activity tracker
  const handleDwell = useCallback(
    (event: DwellEvent) => {
      activityTracker?.trackViewportDwell(event.listingId, event.dwellMs, {
        intersectionRatio: event.intersectionRatio,
        isRevisit: event.isRevisit,
      });
    },
    [activityTracker]
  );

  // Use the core viewport tracking hook
  const tracking = useViewportTracking({
    enabled: isEnabled,
    onDwell: handleDwell,
  });

  // Wrap flush to be synchronous
  const flush = useCallback(() => {
    tracking.flush();
  }, [tracking]);

  // Memoize context value
  const value: ViewportTrackingContextValue = useMemo(
    () => ({
      trackElement: tracking.trackElement,
      untrackElement: tracking.untrackElement,
      getDwellTime: tracking.getDwellTime,
      isRevisit: tracking.isRevisit,
      flush,
      isEnabled,
    }),
    [tracking, flush, isEnabled]
  );

  return (
    <ViewportTrackingContext.Provider value={value}>
      {children}
    </ViewportTrackingContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Access viewport tracking context
 * Throws if not within a ViewportTrackingProvider
 */
export function useViewportTrackingContext(): ViewportTrackingContextValue {
  const context = useContext(ViewportTrackingContext);
  if (!context) {
    throw new Error(
      'useViewportTrackingContext must be used within a ViewportTrackingProvider'
    );
  }
  return context;
}

/**
 * Access viewport tracking context (optional)
 * Returns null if not within a ViewportTrackingProvider
 */
export function useViewportTrackingOptional(): ViewportTrackingContextValue | null {
  return useContext(ViewportTrackingContext);
}

/**
 * Hook for tracking a single listing card
 *
 * Usage:
 * ```tsx
 * function ListingCard({ listing }) {
 *   const { ref, dwellTime, isRevisit } = useListingCardTracking(listing.id);
 *   return <div ref={ref}>...</div>;
 * }
 * ```
 */
export function useListingCardTracking(listingId: number): {
  /** Ref callback to attach to the card element */
  ref: (element: HTMLElement | null) => void;
  /** Current accumulated dwell time */
  dwellTime: number;
  /** Whether this is a revisit */
  isRevisit: boolean;
} {
  const tracking = useViewportTrackingOptional();

  const ref = useCallback(
    (element: HTMLElement | null) => {
      if (!tracking) return;

      if (element) {
        tracking.trackElement(element, listingId);
      }
    },
    [tracking, listingId]
  );

  const dwellTime = tracking?.getDwellTime(listingId) ?? 0;
  const isRevisitResult = tracking?.isRevisit(listingId) ?? false;

  return {
    ref,
    dwellTime,
    isRevisit: isRevisitResult,
  };
}
