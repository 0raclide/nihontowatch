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

/** Metadata attached to a tracked element for impression reporting */
export interface TrackingMeta {
  position?: number;
  dealerId?: number;
}

/** Fired once per listing on first visibility */
export interface ImpressionEvent {
  listingId: number;
  position?: number;
  dealerId?: number;
}

export interface ViewportTrackingOptions {
  /** Callback when a dwell event is ready to report */
  onDwell?: (event: DwellEvent) => void;
  /** Callback when a listing becomes visible for the first time */
  onImpression?: (event: ImpressionEvent) => void;
  /** Whether tracking is enabled (respects privacy opt-out) */
  enabled?: boolean;
  /** Minimum intersection ratio to count as visible */
  threshold?: number;
  /** Custom flush interval in ms */
  flushInterval?: number;
}

export interface ViewportTrackingResult {
  /** Register an element for tracking (with optional metadata for impressions) */
  trackElement: (element: HTMLElement, listingId: number, meta?: TrackingMeta) => void;
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
  const { onDwell, onImpression, enabled = true, threshold = MIN_INTERSECTION_RATIO, flushInterval = FLUSH_INTERVAL_MS } = options;

  // Refs for stable references across renders
  const trackerRef = useRef<DwellTracker | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementMapRef = useRef<Map<HTMLElement, number>>(new Map());
  const elementMetaRef = useRef<Map<HTMLElement, TrackingMeta>>(new Map());
  const impressedRef = useRef<Set<number>>(new Set());
  const callbackRef = useRef(onDwell);
  const impressionCallbackRef = useRef(onImpression);

  // Keep callback refs updated
  useEffect(() => {
    callbackRef.current = onDwell;
  }, [onDwell]);

  useEffect(() => {
    impressionCallbackRef.current = onImpression;
  }, [onImpression]);

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
          const el = entry.target as HTMLElement;
          const listingId = elementMapRef.current.get(el);
          if (listingId === undefined) continue;

          // Fire impression on first visibility (before dwell threshold)
          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= threshold &&
            !impressedRef.current.has(listingId)
          ) {
            impressedRef.current.add(listingId);
            const meta = elementMetaRef.current.get(el);
            impressionCallbackRef.current?.({
              listingId,
              position: meta?.position,
              dealerId: meta?.dealerId,
            });
          }

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
    (element: HTMLElement, listingId: number, meta?: TrackingMeta) => {
      if (!enabled || !observerRef.current) return;

      // Store mapping
      elementMapRef.current.set(element, listingId);
      if (meta) {
        elementMetaRef.current.set(element, meta);
      }
      // Start observing
      observerRef.current.observe(element);
    },
    [enabled]
  );

  const untrackElement = useCallback((element: HTMLElement) => {
    // Remove from observer
    observerRef.current?.unobserve(element);
    // Clean up mappings
    elementMapRef.current.delete(element);
    elementMetaRef.current.delete(element);
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
