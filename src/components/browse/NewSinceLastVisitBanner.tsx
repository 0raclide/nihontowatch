'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { useConsent } from '@/contexts/ConsentContext';
import { hasFunctionalConsent } from '@/lib/consent';
import {
  useNewSinceLastVisit,
  useShouldShowNewItemsBanner,
} from '@/contexts/NewSinceLastVisitContext';
import { NEW_SINCE_LAST_VISIT } from '@/lib/constants';

/**
 * Banner shown to users indicating new items since their last visit.
 * - Logged in: "X new items since your last visit Y days ago"
 * - Logged out: Teaser to log in for tracking
 */
export function NewSinceLastVisitBanner() {
  const { user } = useAuth();
  const { count, daysSince, dismiss, isLoading } = useNewSinceLastVisit();
  const shouldShow = useShouldShowNewItemsBanner();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { openPreferences } = useConsent();

  if (!shouldShow || isLoading) {
    return null;
  }

  // Logged-in user without functional consent - show consent upsell
  if (user && !hasFunctionalConsent()) {
    return (
      <div className="bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800/50">
        <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <p className="text-purple-800 dark:text-purple-200">
                <span className="hidden sm:inline">
                  <strong>Enable personalization</strong> to track new items, save currency preference, and more
                </span>
                <span className="sm:hidden">
                  <strong>Enable personalization</strong> for cool features
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={openPreferences}
                className="flex-shrink-0 text-purple-700 dark:text-purple-300 font-medium hover:text-purple-900 dark:hover:text-purple-100 transition-colors"
              >
                Enable
              </button>
              <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="p-1 -mr-1 text-purple-400 hover:text-purple-600 dark:hover:text-purple-200 transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged-out user teaser
  if (!user) {
    return (
      <>
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800/50">
          <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <p className="text-blue-800 dark:text-blue-200">
                  <span className="hidden sm:inline">
                    Log in to track new items since your last visit
                  </span>
                  <span className="sm:hidden">
                    Log in to track new items
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="flex-shrink-0 text-blue-700 dark:text-blue-300 font-medium hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
                >
                  Log in
                </button>
                <button
                  onClick={dismiss}
                  aria-label="Dismiss"
                  className="p-1 -mr-1 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 transition-colors"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Login Modal */}
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      </>
    );
  }

  // Logged-in user with new items
  const daysDisplay = formatDaysSince(daysSince);

  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800/50">
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-800 dark:text-emerald-200">
              <span className="font-medium">{count?.toLocaleString()} new item{count !== 1 ? 's' : ''}</span>
              {daysDisplay && (
                <span className="hidden sm:inline"> since your last visit {daysDisplay}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // Scroll to top to see the new items (already sorted by newest)
                window.scrollTo({ top: 0, behavior: 'smooth' });
                // Dismiss the banner
                dismiss();
              }}
              className="flex-shrink-0 text-emerald-700 dark:text-emerald-300 font-medium hover:text-emerald-900 dark:hover:text-emerald-100 transition-colors"
            >
              View new items
            </button>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="p-1 -mr-1 text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-200 transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Format days since last visit for display
 */
function formatDaysSince(daysSince: number | null): string | null {
  if (daysSince === null) return null;

  if (daysSince > NEW_SINCE_LAST_VISIT.MAX_DAYS_DISPLAY) {
    return `${NEW_SINCE_LAST_VISIT.MAX_DAYS_DISPLAY}+ days ago`;
  }

  if (daysSince === 0) {
    return 'today';
  }

  if (daysSince === 1) {
    return 'yesterday';
  }

  return `${daysSince} days ago`;
}

// =============================================================================
// Icons
// =============================================================================

function SparklesIcon({ className }: { className?: string }) {
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
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
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
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
