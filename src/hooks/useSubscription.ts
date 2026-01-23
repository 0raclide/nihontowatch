/**
 * Subscription Hook
 *
 * Convenience re-export from SubscriptionContext.
 * Provides access to subscription state and feature gating.
 *
 * @example
 * ```tsx
 * const { tier, canAccess, requireFeature, checkout } = useSubscription();
 *
 * // Check feature access
 * if (canAccess('setsumei_translation')) {
 *   // User has access
 * }
 *
 * // Gate a feature (shows paywall if no access)
 * if (!requireFeature('saved_searches')) {
 *   return; // Paywall was shown
 * }
 *
 * // Start checkout
 * await checkout('enthusiast', 'monthly');
 * ```
 */

export {
  useSubscription,
  FeatureGate,
  type SubscriptionProvider,
} from '@/contexts/SubscriptionContext';
