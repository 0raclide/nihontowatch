'use client';

/**
 * useViewportTracking Hook
 *
 * React hook for tracking viewport dwell time on listing cards.
 * Uses IntersectionObserver for efficient visibility detection.
 *
 * Usage:
 * ```tsx
 * function ListingGrid({ listings }) {
 *   const { trackElement, untrackElement } = useViewportTracking();
 *
 *   return listings.map(listing => (
 *     <ListingCard
 *       key={listing.id}
 *       ref={(el) => el && trackElement(el, listing.id)}
 *     />
 *   ));
 * }
 * ```
 */

import { useCallback, useEffect, useRef } from 'react';
import { DwellTracker, type DwellEvent } from './DwellTracker';
import { MIN_INTERSECTION_RATIO, FLUSH_INTERVAL_MS } from './constants';

export interface ViewportTrackingOptions {
  /** Callback when a dwell event is ready to report */
  onDwell?: (event: DwellEvent) => void;
  /** Whether tracking is enabled (respects privacy opt-out) */
  enabled?: boolean;
  /** Minimum intersection ratio to count as visible */
  threshold?: number;
  /** Custom flush interval in ms */
  flushInterval?: number;
}

export interface ViewportTrackingResult {
  /** Register an element for tracking */
  trackElement: (element: HTMLElement, listingId: number) => void;
  /** Unregister an element */
  untrackElement: (element: HTMLElement) => void;
  /** Get current dwell time for a listing */
  getDwellTime: (listingId: number) => number;
  /** Check if listing has been viewed before */
  isRevisit: (listingId: number) => boolean;
  /** Force flush all pending events */
  flush: () => DwellEvent[];
  /** Get tracking statistics */
  getStats: () => {
    totalTracked: number;
    currentlyVisible: number;
    totalReported: number;
  };
}

export function useViewportTracking(
  options: ViewportTrackingOptions = {}
): ViewportTrackingResult {
  const { onDwell, enabled = true, threshold = MIN_INTERSECTION_RATIO, flushInterval = FLUSH_INTERVAL_MS } = options;

  // Refs for stable references across renders
  const trackerRef = useRef<DwellTracker | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementMapRef = useRef<Map<HTMLElement, number>>(new Map());
  const callbackRef = useRef(onDwell);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onDwell;
  }, [onDwell]);

  // Initialize tracker
  useEffect(() => {
    if (!enabled) return;

    trackerRef.current = new DwellTracker({
      minRatio: threshold,
      onDwell: (event) => callbackRef.current?.(event),
    });

    return () => {
      trackerRef.current?.flush();
      trackerRef.current = null;
    };
  }, [enabled, threshold]);

  // Initialize IntersectionObserver
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const tracker = trackerRef.current;
        if (!tracker) return;

        for (const entry of entries) {
          const listingId = elementMapRef.current.get(
            entry.target as HTMLElement
          );
          if (listingId === undefined) continue;

          tracker.handleIntersection(
            listingId,
            entry.isIntersecting,
            entry.intersectionRatio
          );
        }
      },
      {
        threshold: [0, threshold, 1],
        rootMargin: '0px',
      }
    );

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [enabled, threshold]);

  // Set up periodic flush for long-visible elements
  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(() => {
      trackerRef.current?.flush();
    }, flushInterval);

    return () => clearInterval(intervalId);
  }, [enabled, flushInterval]);

  // Handle page visibility changes
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden - flush all pending events
        trackerRef.current?.flush();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);

  // Handle page unload
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      trackerRef.current?.flush();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);

  const trackElement = useCallback(
    (element: HTMLElement, listingId: number) => {
      if (!enabled || !observerRef.current) return;

      // Store mapping
      elementMapRef.current.set(element, listingId);
      // Start observing
      observerRef.current.observe(element);
    },
    [enabled]
  );

  const untrackElement = useCallback((element: HTMLElement) => {
    // Remove from observer
    observerRef.current?.unobserve(element);
    // Clean up mapping
    elementMapRef.current.delete(element);
  }, []);

  const getDwellTime = useCallback((listingId: number) => {
    return trackerRef.current?.getDwellTime(listingId) ?? 0;
  }, []);

  const isRevisit = useCallback((listingId: number) => {
    return trackerRef.current?.isRevisit(listingId) ?? false;
  }, []);

  const flush = useCallback(() => {
    return trackerRef.current?.flush() ?? [];
  }, []);

  const getStats = useCallback(() => {
    return (
      trackerRef.current?.getStats() ?? {
        totalTracked: 0,
        currentlyVisible: 0,
        totalReported: 0,
      }
    );
  }, []);

  return {
    trackElement,
    untrackElement,
    getDwellTime,
    isRevisit,
    flush,
    getStats,
  };
}
