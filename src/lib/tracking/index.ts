/**
 * Activity Tracking Library
 *
 * Core tracking functionality for user behavior analytics.
 *
 * Exports:
 * - ActivityTrackerProvider: Context provider with auth integration
 * - useActivityTracker: Hook to access the tracker
 * - useListingViewTracker: Hook for tracking listing view durations
 * - Privacy functions: hasOptedOutOfTracking, setTrackingOptOut
 *
 * For most use cases, import from @/components/activity instead,
 * which wraps this library with automatic page view tracking.
 */

export {
  ActivityTrackerProvider,
  useActivityTracker,
  useActivityTrackerOptional,
  useListingViewTracker,
  hasOptedOutOfTracking,
  setTrackingOptOut,
  type ActivityTracker,
  type ActivityEvent,
  type PageViewEvent,
  type ListingViewEvent,
  type SearchEvent,
  type FilterChangeEvent,
  type FavoriteEvent,
  type AlertEvent,
  type ExternalLinkClickEvent,
  type SearchFilters,
} from './ActivityTracker';
