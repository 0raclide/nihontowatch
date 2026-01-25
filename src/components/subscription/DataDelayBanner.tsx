'use client';

import { useSubscription } from '@/contexts/SubscriptionContext';
import { isTrialModeActive } from '@/types/subscription';

/**
 * Banner shown to free tier users indicating their data is delayed 72h
 * Includes CTA to upgrade for real-time listings
 * Hidden during trial mode when all features are free
 */
export function DataDelayBanner() {
  const { isFree, showPaywall, isLoading } = useSubscription();

  // Don't show during loading, for paid users, or during trial mode
  if (isLoading || !isFree || isTrialModeActive()) {
    return null;
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/50">
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-amber-800 dark:text-amber-200">
              <span className="font-medium">72-hour delay:</span>{' '}
              <span className="hidden sm:inline">
                Free members see listings after a 72-hour window.
              </span>
              <span className="sm:hidden">
                Listings delayed 72 hours.
              </span>
            </p>
          </div>
          <button
            onClick={() => showPaywall('fresh_data')}
            className="flex-shrink-0 text-amber-700 dark:text-amber-300 font-medium hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
          >
            See new listings first →
          </button>
        </div>
      </div>
    </div>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
