'use client';

/**
 * Activity Tracker with Auth Integration
 *
 * This module provides activity tracking with:
 * - Authenticated user ID integration
 * - Privacy opt-out support
 * - Session management
 * - Event batching
 *
 * The core tracking logic is in:
 * - /lib/activity/sessionManager.ts - Session lifecycle
 * - /hooks/useActivityTracker.ts - Event tracking hook
 * - /components/activity/ActivityProvider.tsx - Context provider
 *
 * This file adds auth integration and privacy controls.
 */

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  getSessionId,
  updateActivity,
  isHidden,
  setupVisibilityHandler,
  initSession,
  setupUnloadHandler,
} from '@/lib/activity/sessionManager';
import { getVisitorId, getDeviceInfo } from '@/lib/activity/visitorId';
import { hasAnalyticsConsent } from '@/lib/consent';
import type {
  ActivityEvent,
  PageViewEvent,
  ListingViewEvent,
  ListingDetailViewEvent,
  SearchEvent,
  SearchClickEvent,
  FilterChangeEvent,
  FavoriteEvent,
  AlertEvent,
  ExternalLinkClickEvent,
  DealerClickEvent,
  ViewportDwellEvent,
  QuickViewPanelToggleEvent,
  QuickViewOpenEvent,
  ImagePinchZoomEvent,
  SearchFilters,
  ActivityBatchPayload,
  CreateSessionPayload,
} from '@/lib/activity/types';

// =============================================================================
// Constants
// =============================================================================

const BATCH_INTERVAL_MS = 30000; // 30 seconds
const MAX_BATCH_SIZE = 50;
const ACTIVITY_API_ENDPOINT = '/api/activity';
const PRIVACY_OPT_OUT_KEY = 'nihontowatch_tracking_opt_out';

// =============================================================================
// Privacy Management
// =============================================================================

/**
 * Check if user has opted out of tracking
 * This checks both the legacy opt-out key AND the new GDPR consent system.
 * User is opted out if:
 * 1. Legacy opt-out is enabled, OR
 * 2. User explicitly declined analytics consent
 *
 * Note: Tracking is ON by default until user explicitly declines.
 */
export function hasOptedOutOfTracking(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // Check legacy opt-out
    const legacyOptOut = localStorage.getItem(PRIVACY_OPT_OUT_KEY) === 'true';
    if (legacyOptOut) return true;

    // Check GDPR consent - hasAnalyticsConsent returns true by default
    // Only returns false if user explicitly declined
    if (!hasAnalyticsConsent()) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Set tracking opt-out preference
 */
export function setTrackingOptOut(optOut: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    if (optOut) {
      localStorage.setItem(PRIVACY_OPT_OUT_KEY, 'true');
    } else {
      localStorage.removeItem(PRIVACY_OPT_OUT_KEY);
    }
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

// =============================================================================
// Tracker Types
// =============================================================================

export interface ActivityTracker {
  trackPageView: (path: string, searchParams?: Record<string, string>) => void;
  trackListingView: (
    listingId: number,
    durationMs: number,
    extra?: { scrollDepth?: number; imageViews?: number }
  ) => void;
  trackListingDetailView: (
    listingId: number,
    referrer?: 'browse' | 'search' | 'direct' | 'external' | 'alert'
  ) => void;
  trackSearch: (
    query: string,
    resultCount?: number,
    filters?: SearchFilters
  ) => void;
  trackSearchQuery: (
    query: string,
    filters: SearchFilters | undefined,
    resultCount: number
  ) => string;
  trackSearchClickThrough: (correlationId: string, listingId: number) => void;
  trackFilterChange: (
    filters: SearchFilters,
    changedFilter: string,
    previousValue?: unknown,
    newValue?: unknown
  ) => void;
  trackFavoriteAction: (listingId: number, action: 'add' | 'remove') => void;
  trackAlertAction: (
    action: 'create' | 'delete',
    alertId?: string,
    alertType?: string,
    criteria?: Record<string, unknown>
  ) => void;
  trackExternalLinkClick: (
    url: string,
    listingId?: number,
    dealerName?: string
  ) => void;
  trackDealerClick: (
    listingId: number,
    dealerId: number,
    dealerName: string,
    url: string,
    source: 'listing_card' | 'quickview' | 'listing_detail' | 'dealer_page',
    extra?: { priceAtClick?: number; currencyAtClick?: string }
  ) => void;
  trackViewportDwell: (
    listingId: number,
    dwellMs: number,
    extra?: { intersectionRatio?: number; isRevisit?: boolean }
  ) => void;
  trackQuickViewPanelToggle: (
    listingId: number,
    action: 'collapse' | 'expand',
    dwellMs?: number
  ) => void;
  trackQuickViewOpen: (
    listingId: number,
    dealerName?: string,
    source?: 'listing_card' | 'search_results' | 'favorites'
  ) => void;
  trackImagePinchZoom: (
    listingId: number,
    imageIndex: number,
    extra?: { zoomScale?: number; durationMs?: number }
  ) => void;
  trackInquiryCopy: (listingId: number) => void;
  trackInquiryMailtoClick: (listingId: number) => void;
  flush: () => Promise<void>;
  isOptedOut: boolean;
  setOptOut: (optOut: boolean) => void;
}

// =============================================================================
// Context
// =============================================================================

const ActivityTrackerContext = createContext<ActivityTracker | null>(null);

// =============================================================================
// Provider Component
// =============================================================================

interface ActivityTrackerProviderProps {
  children: ReactNode;
  /**
   * Whether to track page views automatically on route changes
   * @default true
   */
  autoTrackPageViews?: boolean;
  /**
   * Whether to create/track sessions
   * @default true
   */
  trackSessions?: boolean;
}

export function ActivityTrackerProvider({
  children,
  autoTrackPageViews = true,
  trackSessions = true,
}: ActivityTrackerProviderProps) {
  // Get user from auth context
  const { user, isAdmin, isLoading } = useAuth();

  // Track opt-out state
  const [isOptedOut, setIsOptedOut] = useState(() => hasOptedOutOfTracking());

  // Suppress all tracking for opted-out users AND admin users
  const isSuppressed = isOptedOut || isAdmin;

  // Event queue
  const eventQueueRef = useRef<ActivityEvent[]>([]);
  // Batch timer
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Track if component is mounted
  const isMountedRef = useRef(true);
  // Track pending flush promise
  const flushingRef = useRef(false);
  // Track if initial session has been created
  const sessionCreatedRef = useRef(false);

  // Set opt-out preference
  const setOptOut = useCallback((optOut: boolean) => {
    setTrackingOptOut(optOut);
    setIsOptedOut(optOut);
  }, []);

  // Get user ID from auth context
  const getUserId = useCallback((): string | undefined => {
    return user?.id;
  }, [user]);

  // Create base event properties
  const createBaseEvent = useCallback(() => {
    return {
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
      userId: getUserId(),
      visitorId: getVisitorId(),
    };
  }, [getUserId]);

  // Send batched events to API
  const flushEvents = useCallback(async () => {
    if (flushingRef.current) return;
    if (eventQueueRef.current.length === 0) return;
    if (isSuppressed) {
      eventQueueRef.current = [];
      return;
    }

    flushingRef.current = true;

    // Get events and clear queue
    const events = [...eventQueueRef.current];
    eventQueueRef.current = [];

    const payload: ActivityBatchPayload = {
      sessionId: getSessionId(),
      userId: getUserId(),
      visitorId: getVisitorId(),
      events,
    };

    try {
      // Use sendBeacon for reliability on page unload
      if (
        typeof navigator !== 'undefined' &&
        navigator.sendBeacon &&
        !isMountedRef.current
      ) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: 'application/json',
        });
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
        eventQueueRef.current = [
          ...events.slice(0, 20),
          ...eventQueueRef.current,
        ].slice(0, MAX_BATCH_SIZE);
      }
      console.error('Failed to send activity events:', error);
    } finally {
      flushingRef.current = false;
    }
  }, [getUserId, isSuppressed]);

  // Add event to queue
  const queueEvent = useCallback(
    (event: ActivityEvent) => {
      // Don't queue events when suppressed (opted out or admin) or page is hidden
      if (isSuppressed) return;
      if (isHidden()) return;

      eventQueueRef.current.push(event);
      updateActivity();

      // Flush if queue is getting large
      if (eventQueueRef.current.length >= MAX_BATCH_SIZE) {
        flushEvents();
      }
    },
    [flushEvents, isSuppressed]
  );

  // Initialize session on mount
  useEffect(() => {
    if (!trackSessions) return;
    if (sessionCreatedRef.current) return;
    if (isSuppressed) return;
    if (isLoading) return; // Wait for auth to resolve before deciding

    sessionCreatedRef.current = true;

    // Initialize local session
    initSession();

    // Set up page unload handler
    const cleanupUnload = setupUnloadHandler();

    // Send session create event to API
    const sessionPayload: CreateSessionPayload = {
      action: 'create',
      sessionId: getSessionId(),
      userId: getUserId(),
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      screenWidth:
        typeof window !== 'undefined' ? window.screen.width : undefined,
      screenHeight:
        typeof window !== 'undefined' ? window.screen.height : undefined,
      timezone:
        typeof Intl !== 'undefined'
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : undefined,
      language:
        typeof navigator !== 'undefined' ? navigator.language : undefined,
    };

    // Fire and forget session creation
    fetch('/api/activity/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionPayload),
    }).catch(() => {
      // Silently fail - session tracking is best-effort
    });

    return cleanupUnload;
  }, [trackSessions, isSuppressed, isLoading, getUserId]);

  // Set up batch timer and cleanup
  useEffect(() => {
    if (isSuppressed) return;

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
  }, [flushEvents, isSuppressed]);

  // =============================================================================
  // Tracking Methods
  // =============================================================================

  const trackPageView = useCallback(
    (path: string, searchParams?: Record<string, string>) => {
      if (isSuppressed) return;

      updateActivity(true); // Increment page views

      const event: PageViewEvent = {
        ...createBaseEvent(),
        type: 'page_view',
        path,
        referrer:
          typeof document !== 'undefined' ? document.referrer : undefined,
        searchParams,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackListingView = useCallback(
    (
      listingId: number,
      durationMs: number,
      extra?: { scrollDepth?: number; imageViews?: number }
    ) => {
      if (isSuppressed) return;

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
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackSearch = useCallback(
    (query: string, resultCount?: number, filters?: SearchFilters) => {
      if (isSuppressed) return;

      const event: SearchEvent = {
        ...createBaseEvent(),
        type: 'search',
        query,
        resultCount,
        filters,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackFilterChange = useCallback(
    (
      filters: SearchFilters,
      changedFilter: string,
      previousValue?: unknown,
      newValue?: unknown
    ) => {
      if (isSuppressed) return;

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
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackFavoriteAction = useCallback(
    (listingId: number, action: 'add' | 'remove') => {
      if (isSuppressed) return;

      const event: FavoriteEvent = {
        ...createBaseEvent(),
        type: action === 'add' ? 'favorite_add' : 'favorite_remove',
        listingId,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackAlertAction = useCallback(
    (
      action: 'create' | 'delete',
      alertId?: string,
      alertType?: string,
      criteria?: Record<string, unknown>
    ) => {
      if (isSuppressed) return;

      const event: AlertEvent = {
        ...createBaseEvent(),
        type: action === 'create' ? 'alert_create' : 'alert_delete',
        alertId,
        alertType,
        criteria,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackExternalLinkClick = useCallback(
    (url: string, listingId?: number, dealerName?: string) => {
      if (isSuppressed) return;

      const event: ExternalLinkClickEvent = {
        ...createBaseEvent(),
        type: 'external_link_click',
        url,
        listingId,
        dealerName,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackViewportDwell = useCallback(
    (
      listingId: number,
      dwellMs: number,
      extra?: { intersectionRatio?: number; isRevisit?: boolean }
    ) => {
      if (isSuppressed) return;

      const event: ViewportDwellEvent = {
        ...createBaseEvent(),
        type: 'viewport_dwell',
        listingId,
        dwellMs,
        intersectionRatio: extra?.intersectionRatio,
        isRevisit: extra?.isRevisit,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackQuickViewPanelToggle = useCallback(
    (
      listingId: number,
      action: 'collapse' | 'expand',
      dwellMs?: number
    ) => {
      if (isSuppressed) return;

      const event: QuickViewPanelToggleEvent = {
        ...createBaseEvent(),
        type: 'quickview_panel_toggle',
        listingId,
        action,
        dwellMs,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackQuickViewOpen = useCallback(
    (
      listingId: number,
      dealerName?: string,
      source: 'listing_card' | 'search_results' | 'favorites' = 'listing_card'
    ) => {
      if (isSuppressed) return;

      const event: QuickViewOpenEvent = {
        ...createBaseEvent(),
        type: 'quickview_open',
        listingId,
        dealerName,
        source,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackImagePinchZoom = useCallback(
    (
      listingId: number,
      imageIndex: number,
      extra?: { zoomScale?: number; durationMs?: number }
    ) => {
      if (isSuppressed) return;

      const event: ImagePinchZoomEvent = {
        ...createBaseEvent(),
        type: 'image_pinch_zoom',
        listingId,
        imageIndex,
        zoomScale: extra?.zoomScale,
        durationMs: extra?.durationMs,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackInquiryCopy = useCallback(
    (listingId: number) => {
      if (isSuppressed) return;
      queueEvent({ ...createBaseEvent(), type: 'inquiry_copy' as const, listingId });
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackInquiryMailtoClick = useCallback(
    (listingId: number) => {
      if (isSuppressed) return;
      queueEvent({ ...createBaseEvent(), type: 'inquiry_mailto_click' as const, listingId });
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackDealerClick = useCallback(
    (
      listingId: number,
      dealerId: number,
      dealerName: string,
      url: string,
      source: 'listing_card' | 'quickview' | 'listing_detail' | 'dealer_page',
      extra?: { priceAtClick?: number; currencyAtClick?: string }
    ) => {
      if (isSuppressed) return;

      const event: DealerClickEvent = {
        ...createBaseEvent(),
        type: 'dealer_click',
        listingId,
        dealerId,
        dealerName,
        url,
        source,
        priceAtClick: extra?.priceAtClick,
        currencyAtClick: extra?.currencyAtClick,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackListingDetailView = useCallback(
    (
      listingId: number,
      referrer?: 'browse' | 'search' | 'direct' | 'external' | 'alert'
    ) => {
      if (isSuppressed) return;

      const event: ListingDetailViewEvent = {
        ...createBaseEvent(),
        type: 'listing_detail_view',
        listingId,
        referrer,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackSearchQuery = useCallback(
    (
      query: string,
      filters: SearchFilters | undefined,
      resultCount: number
    ): string => {
      // Generate a client-side correlation ID for CTR linking
      const correlationId = crypto.randomUUID();

      if (!isSuppressed) {
        const event: SearchEvent & { correlationId: string } = {
          ...createBaseEvent(),
          type: 'search',
          query,
          resultCount,
          filters,
          correlationId,
        };

        queueEvent(event as unknown as SearchEvent);
      }

      return correlationId;
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  const trackSearchClickThrough = useCallback(
    (correlationId: string, listingId: number) => {
      if (isSuppressed) return;

      const event: SearchClickEvent = {
        ...createBaseEvent(),
        type: 'search_click',
        correlationId,
        listingId,
      };

      queueEvent(event);
    },
    [createBaseEvent, queueEvent, isSuppressed]
  );

  // Memoize the tracker object to prevent unnecessary re-renders in consumers
  const tracker: ActivityTracker = useMemo(
    () => ({
      trackPageView,
      trackListingView,
      trackListingDetailView,
      trackSearch,
      trackSearchQuery,
      trackSearchClickThrough,
      trackFilterChange,
      trackFavoriteAction,
      trackAlertAction,
      trackExternalLinkClick,
      trackDealerClick,
      trackViewportDwell,
      trackQuickViewPanelToggle,
      trackQuickViewOpen,
      trackImagePinchZoom,
      trackInquiryCopy,
      trackInquiryMailtoClick,
      flush: flushEvents,
      isOptedOut,
      setOptOut,
    }),
    [
      trackPageView,
      trackListingView,
      trackListingDetailView,
      trackSearch,
      trackSearchQuery,
      trackSearchClickThrough,
      trackFilterChange,
      trackFavoriteAction,
      trackAlertAction,
      trackExternalLinkClick,
      trackDealerClick,
      trackViewportDwell,
      trackQuickViewPanelToggle,
      trackQuickViewOpen,
      trackImagePinchZoom,
      trackInquiryCopy,
      trackInquiryMailtoClick,
      flushEvents,
      isOptedOut,
      setOptOut,
    ]
  );

  return (
    <ActivityTrackerContext.Provider value={tracker}>
      {children}
    </ActivityTrackerContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access the activity tracker
 * Must be used within an ActivityTrackerProvider
 */
export function useActivityTracker(): ActivityTracker {
  const context = useContext(ActivityTrackerContext);

  if (!context) {
    throw new Error(
      'useActivityTracker must be used within an ActivityTrackerProvider'
    );
  }

  return context;
}

/**
 * Hook to access the activity tracker (optional)
 * Returns null if not within an ActivityTrackerProvider
 * Useful for components that may be used both inside and outside the provider
 */
export function useActivityTrackerOptional(): ActivityTracker | null {
  return useContext(ActivityTrackerContext);
}

/**
 * Hook to track viewing duration for a specific listing
 * Automatically tracks when component unmounts
 */
export function useListingViewTracker(listingId: number): {
  startTracking: () => void;
  stopTracking: () => { durationMs: number };
} {
  const startTimeRef = useRef<number | null>(null);
  const tracker = useActivityTrackerOptional();

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
      if (startTimeRef.current !== null && tracker) {
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

// =============================================================================
// Re-exports for convenience
// =============================================================================

export type {
  ActivityEvent,
  PageViewEvent,
  ListingViewEvent,
  SearchEvent,
  FilterChangeEvent,
  FavoriteEvent,
  AlertEvent,
  ExternalLinkClickEvent,
  ViewportDwellEvent,
  QuickViewPanelToggleEvent,
  ImagePinchZoomEvent,
  SearchFilters,
} from '@/lib/activity/types';
