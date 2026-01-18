/**
 * Viewport Tracking Module
 *
 * Provides tools for tracking user engagement with listing cards in the browse grid.
 * Uses IntersectionObserver for efficient, passive detection of viewport visibility.
 *
 * Architecture:
 * - DwellTracker: Core timing logic (framework-agnostic, easily testable)
 * - useViewportTracking: React hook wrapping DwellTracker
 * - ViewportTrackingProvider: Context connecting to ActivityTracker
 * - interestScore: Utility for calculating engagement scores
 *
 * Usage:
 * ```tsx
 * // In your app layout or browse page
 * <ViewportTrackingProvider>
 *   <VirtualListingGrid listings={listings} />
 * </ViewportTrackingProvider>
 *
 * // In ListingCard
 * function ListingCard({ listing }) {
 *   const { ref } = useListingCardTracking(listing.id);
 *   return <div ref={ref}>...</div>;
 * }
 * ```
 */

// Core tracker class
export { DwellTracker } from './DwellTracker';
export type { DwellRecord, DwellEvent, DwellEventCallback } from './DwellTracker';

// React hook
export { useViewportTracking } from './useViewportTracking';
export type {
  ViewportTrackingOptions,
  ViewportTrackingResult,
} from './useViewportTracking';

// Context provider
export {
  ViewportTrackingProvider,
  useViewportTrackingContext,
  useViewportTrackingOptional,
  useListingCardTracking,
} from './ViewportTrackingProvider';
export type { ViewportTrackingContextValue } from './ViewportTrackingProvider';

// Interest scoring
export {
  calculateInterestScore,
  getInterestTier,
  mergeSignals,
} from './interestScore';
export type {
  EngagementSignals,
  InterestTier,
  InterestScoreResult,
} from './interestScore';

// Constants
export {
  MIN_DWELL_MS,
  MAX_DWELL_MS,
  MIN_INTERSECTION_RATIO,
  FLUSH_INTERVAL_MS,
  SCROLL_DEBOUNCE_MS,
  INTEREST_WEIGHTS,
  INTEREST_TIERS,
} from './constants';
