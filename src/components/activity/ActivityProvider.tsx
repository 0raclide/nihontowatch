'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  initSession,
  setupUnloadHandler,
  getSessionId,
} from '@/lib/activity/sessionManager';
import {
  useActivityTracker,
  type ActivityTracker,
} from '@/hooks/useActivityTracker';
import type { CreateSessionPayload } from '@/lib/activity/types';

// =============================================================================
// Context
// =============================================================================

const ActivityContext = createContext<ActivityTracker | null>(null);

// =============================================================================
// Provider Component
// =============================================================================

interface ActivityProviderProps {
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

export function ActivityProvider({
  children,
  autoTrackPageViews = true,
  trackSessions = true,
}: ActivityProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tracker = useActivityTracker();

  // Track if initial session has been created
  const sessionCreatedRef = useRef(false);
  // Track previous pathname to detect route changes
  const prevPathnameRef = useRef<string | null>(null);

  // Initialize session on mount
  useEffect(() => {
    if (!trackSessions) return;
    if (sessionCreatedRef.current) return;

    sessionCreatedRef.current = true;

    // Initialize local session
    initSession();

    // Set up page unload handler
    const cleanupUnload = setupUnloadHandler();

    // Send session create event to API
    const sessionPayload: CreateSessionPayload = {
      action: 'create',
      sessionId: getSessionId(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      screenWidth: typeof window !== 'undefined' ? window.screen.width : undefined,
      screenHeight: typeof window !== 'undefined' ? window.screen.height : undefined,
      timezone: typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined,
      language: typeof navigator !== 'undefined' ? navigator.language : undefined,
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
  }, [trackSessions]);

  // Track page views on route changes
  useEffect(() => {
    if (!autoTrackPageViews) return;

    // Skip initial mount if pathname hasn't changed
    if (prevPathnameRef.current === pathname) return;

    // Track the page view
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    tracker.trackPageView(pathname, Object.keys(params).length > 0 ? params : undefined);

    // Update previous pathname
    prevPathnameRef.current = pathname;
  }, [pathname, searchParams, autoTrackPageViews, tracker]);

  // Flush events on visibility hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tracker.flush();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tracker]);

  return (
    <ActivityContext.Provider value={tracker}>
      {children}
    </ActivityContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access the activity tracker from context
 * Must be used within an ActivityProvider
 */
export function useActivity(): ActivityTracker {
  const context = useContext(ActivityContext);

  if (!context) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }

  return context;
}

/**
 * Hook to access the activity tracker from context (optional)
 * Returns null if not within an ActivityProvider
 * Useful for components that may be used both inside and outside the provider
 */
export function useActivityOptional(): ActivityTracker | null {
  return useContext(ActivityContext);
}
