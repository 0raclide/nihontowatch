'use client';

import { useCallback, useRef, useEffect } from 'react';
import {
  getSessionId,
  updateActivity,
  isHidden,
  setupVisibilityHandler,
} from '@/lib/activity/sessionManager';
import type {
  ActivityEvent,
  PageViewEvent,
  ListingViewEvent,
  SearchEvent,
  FilterChangeEvent,
  FavoriteEvent,
  AlertEvent,
  ExternalLinkClickEvent,
  SearchFilters,
  ActivityBatchPayload,
} from '@/lib/activity/types';

// =============================================================================
// Constants
// =============================================================================

const BATCH_INTERVAL_MS = 30000; // 30 seconds
const MAX_BATCH_SIZE = 50;
const ACTIVITY_API_ENDPOINT = '/api/activity';

// =============================================================================
// Hook Return Type
// =============================================================================

export interface ActivityTracker {
  trackPageView: (path: string, searchParams?: Record<string, string>) => void;
  trackListingView: (listingId: number, durationMs: number, extra?: { scrollDepth?: number; imageViews?: number }) => void;
  trackSearch: (query: string, resultCount?: number, filters?: SearchFilters) => void;
  trackFilterChange: (filters: SearchFilters, changedFilter: string, previousValue?: unknown, newValue?: unknown) => void;
  trackFavoriteAction: (listingId: number, action: 'add' | 'remove') => void;
  trackAlertAction: (action: 'create' | 'delete', alertId?: string, alertType?: string, criteria?: Record<string, unknown>) => void;
  trackExternalLinkClick: (url: string, listingId?: number, dealerName?: string) => void;
  trackInquiryCopy: (listingId: number) => void;
  trackInquiryMailtoClick: (listingId: number) => void;
  flush: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useActivityTracker(): ActivityTracker {
  // Event queue
  const eventQueueRef = useRef<ActivityEvent[]>([]);
  // Batch timer
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Track if component is mounted
  const isMountedRef = useRef(true);
  // Track pending flush promise
  const flushingRef = useRef(false);

  // Get user ID if authenticated (placeholder - implement based on auth system)
  const getUserId = useCallback((): string | undefined => {
    // TODO: Integrate with authentication system when implemented
    // For now, return undefined for anonymous tracking
    return undefined;
  }, []);

  // Create base event properties
  const createBaseEvent = useCallback(() => {
    return {
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
      userId: getUserId(),
    };
  }, [getUserId]);

  // Add event to queue
  const queueEvent = useCallback((event: ActivityEvent) => {
    // Don't queue events when page is hidden
    if (isHidden()) return;

    eventQueueRef.current.push(event);
    updateActivity();

    // Flush if queue is getting large
    if (eventQueueRef.current.length >= MAX_BATCH_SIZE) {
      flushEvents();
    }
  }, []);

  // Send batched events to API
  const flushEvents = useCallback(async () => {
    if (flushingRef.current) return;
    if (eventQueueRef.current.length === 0) return;

    flushingRef.current = true;

    // Get events and clear queue
    const events = [...eventQueueRef.current];
    eventQueueRef.current = [];

    const payload: ActivityBatchPayload = {
      sessionId: getSessionId(),
      userId: getUserId(),
      events,
    };

    try {
      // Use sendBeacon for reliability on page unload
      if (typeof navigator !== 'undefined' && navigator.sendBeacon && !isMountedRef.current) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(ACTIVITY_API_ENDPOINT, blob);
      } else {
        await fetch(ACTIVITY_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      }
    } catch (error) {
      // Re-queue events on failure (but limit retries)
      if (isMountedRef.current) {
        // Only re-queue first 20 events to prevent memory issues
        eventQueueRef.current = [...events.slice(0, 20), ...eventQueueRef.current].slice(0, MAX_BATCH_SIZE);
      }
      console.error('Failed to send activity events:', error);
    } finally {
      flushingRef.current = false;
    }
  }, [getUserId]);

  // Set up batch timer and cleanup
  useEffect(() => {
    isMountedRef.current = true;

    // Set up periodic flush
    batchTimerRef.current = setInterval(() => {
      if (eventQueueRef.current.length > 0) {
        flushEvents();
      }
    }, BATCH_INTERVAL_MS);

    // Set up visibility change handler to flush on hide
    const cleanupVisibility = setupVisibilityHandler((hidden) => {
      if (hidden && eventQueueRef.current.length > 0) {
        flushEvents();
      }
    });

    // Cleanup
    return () => {
      isMountedRef.current = false;

      if (batchTimerRef.current) {
        clearInterval(batchTimerRef.current);
      }

      cleanupVisibility();

      // Final flush on unmount
      if (eventQueueRef.current.length > 0) {
        flushEvents();
      }
    };
  }, [flushEvents]);

  // =============================================================================
  // Tracking Methods
  // =============================================================================

  const trackPageView = useCallback(
    (path: string, searchParams?: Record<string, string>) => {
      updateActivity(true); // Increment page views

      const event: PageViewEvent = {
        ...createBaseEvent(),
        type: 'page_view',
        path,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        searchParams,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent]
  );

  const trackListingView = useCallback(
    (
      listingId: number,
      durationMs: number,
      extra?: { scrollDepth?: number; imageViews?: number }
    ) => {
      const event: ListingViewEvent = {
        ...createBaseEvent(),
        type: 'listing_view',
        listingId,
        durationMs,
        scrollDepth: extra?.scrollDepth,
        imageViews: extra?.imageViews,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent]
  );

  const trackSearch = useCallback(
    (query: string, resultCount?: number, filters?: SearchFilters) => {
      const event: SearchEvent = {
        ...createBaseEvent(),
        type: 'search',
        query,
        resultCount,
        filters,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent]
  );

  const trackFilterChange = useCallback(
    (
      filters: SearchFilters,
      changedFilter: string,
      previousValue?: unknown,
      newValue?: unknown
    ) => {
      const event: FilterChangeEvent = {
        ...createBaseEvent(),
        type: 'filter_change',
        filters,
        changedFilter,
        previousValue,
        newValue,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent]
  );

  const trackFavoriteAction = useCallback(
    (listingId: number, action: 'add' | 'remove') => {
      const event: FavoriteEvent = {
        ...createBaseEvent(),
        type: action === 'add' ? 'favorite_add' : 'favorite_remove',
        listingId,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent]
  );

  const trackAlertAction = useCallback(
    (
      action: 'create' | 'delete',
      alertId?: string,
      alertType?: string,
      criteria?: Record<string, unknown>
    ) => {
      const event: AlertEvent = {
        ...createBaseEvent(),
        type: action === 'create' ? 'alert_create' : 'alert_delete',
        alertId,
        alertType,
        criteria,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent]
  );

  const trackExternalLinkClick = useCallback(
    (url: string, listingId?: number, dealerName?: string) => {
      const event: ExternalLinkClickEvent = {
        ...createBaseEvent(),
        type: 'external_link_click',
        url,
        listingId,
        dealerName,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent]
  );

  const trackInquiryCopy = useCallback(
    (listingId: number) => {
      queueEvent({ ...createBaseEvent(), type: 'inquiry_copy' as const, listingId });
    },
    [createBaseEvent, queueEvent]
  );

  const trackInquiryMailtoClick = useCallback(
    (listingId: number) => {
      queueEvent({ ...createBaseEvent(), type: 'inquiry_mailto_click' as const, listingId });
    },
    [createBaseEvent, queueEvent]
  );

  return {
    trackPageView,
    trackListingView,
    trackSearch,
    trackFilterChange,
    trackFavoriteAction,
    trackAlertAction,
    trackExternalLinkClick,
    trackInquiryCopy,
    trackInquiryMailtoClick,
    flush: flushEvents,
  };
}

// =============================================================================
// Listing View Duration Tracker Hook
// =============================================================================

/**
 * Hook to track viewing duration for a specific listing
 * Automatically tracks when component unmounts
 */
export function useListingViewTracker(listingId: number): {
  startTracking: () => void;
  stopTracking: () => { durationMs: number };
} {
  const startTimeRef = useRef<number | null>(null);
  const tracker = useActivityTracker();

  const startTracking = useCallback(() => {
    startTimeRef.current = Date.now();
  }, []);

  const stopTracking = useCallback(() => {
    if (startTimeRef.current === null) {
      return { durationMs: 0 };
    }

    const durationMs = Date.now() - startTimeRef.current;
    startTimeRef.current = null;

    return { durationMs };
  }, []);

  // Auto-track on unmount
  useEffect(() => {
    return () => {
      if (startTimeRef.current !== null) {
        const { durationMs } = stopTracking();
        if (durationMs > 1000) {
          // Only track if viewed for at least 1 second
          tracker.trackListingView(listingId, durationMs);
        }
      }
    };
  }, [listingId, stopTracking, tracker]);

  return { startTracking, stopTracking };
}
