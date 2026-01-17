/**
 * Activity Tracking Components
 *
 * Exports activity tracking components and hooks for use across the application.
 *
 * The tracking system provides:
 * - Authenticated user ID integration (from AuthContext)
 * - Privacy opt-out support
 * - Session management
 * - Event batching
 * - Automatic page view tracking on route changes
 *
 * Usage:
 * ```tsx
 * import { useActivity } from '@/components/activity';
 *
 * function MyComponent() {
 *   const { trackSearch, trackListingView, isOptedOut, setOptOut } = useActivity();
 *
 *   // Track a search
 *   trackSearch('katana', 42);
 *
 *   // Allow users to opt out
 *   if (isOptedOut) {
 *     return <button onClick={() => setOptOut(false)}>Enable Analytics</button>;
 *   }
 * }
 * ```
 */

export { ActivityProvider, useActivity, useActivityOptional } from './ActivityProvider';
export { ActivityWrapper } from './ActivityWrapper';
export type { ActivityTracker } from './ActivityProvider';

// Re-export from the tracking lib for convenience
export {
  useListingViewTracker,
  hasOptedOutOfTracking,
  setTrackingOptOut,
} from '@/lib/tracking/ActivityTracker';
