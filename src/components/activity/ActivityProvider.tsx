'use client';

/**
 * Activity Provider with Auth Integration
 *
 * This provider wraps the ActivityTrackerProvider from /lib/tracking/ActivityTracker.tsx
 * and adds automatic page view tracking on route changes.
 *
 * Features:
 * - Authenticated user ID integration (from AuthContext)
 * - Privacy opt-out support
 * - Session management
 * - Event batching
 * - Automatic page view tracking on route changes
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  ActivityTrackerProvider,
  useActivityTracker as useTrackerFromLib,
  useActivityTrackerOptional as useTrackerOptionalFromLib,
  type ActivityTracker,
} from '@/lib/tracking/ActivityTracker';

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

/**
 * Inner component that handles automatic page view tracking
 * Separated to ensure it has access to the tracker context
 */
function PageViewTracker({
  children,
  autoTrackPageViews,
}: {
  children: ReactNode;
  autoTrackPageViews: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tracker = useTrackerFromLib();

  // Track previous pathname to detect route changes
  const prevPathnameRef = useRef<string | null>(null);

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

    tracker.trackPageView(
      pathname,
      Object.keys(params).length > 0 ? params : undefined
    );

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

  return <>{children}</>;
}

export function ActivityProvider({
  children,
  autoTrackPageViews = true,
  trackSessions = true,
}: ActivityProviderProps) {
  return (
    <ActivityTrackerProvider
      autoTrackPageViews={false} // We handle this in PageViewTracker
      trackSessions={trackSessions}
    >
      <PageViewTracker autoTrackPageViews={autoTrackPageViews}>
        {children}
      </PageViewTracker>
    </ActivityTrackerProvider>
  );
}

// =============================================================================
// Hook Re-exports
// =============================================================================

/**
 * Hook to access the activity tracker from context
 * Must be used within an ActivityProvider
 */
export function useActivity(): ActivityTracker {
  return useTrackerFromLib();
}

/**
 * Hook to access the activity tracker from context (optional)
 * Returns null if not within an ActivityProvider
 * Useful for components that may be used both inside and outside the provider
 */
export function useActivityOptional(): ActivityTracker | null {
  return useTrackerOptionalFromLib();
}

// Re-export types for convenience
export type { ActivityTracker } from '@/lib/tracking/ActivityTracker';
