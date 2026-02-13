'use client';

import { useEffect, useState } from 'react';
import { useQuickView } from '@/contexts/QuickViewContext';

interface AlertContext {
  searchName: string;
  totalMatches: number;
}

/**
 * Displays alert context banner with inline prev/next navigation inside QuickView
 * when the user arrived via an alert email multi-listing deep link.
 *
 * Pattern: Gmail/VS Code "1 of N" with < > arrows for immediate discoverability.
 *
 * Reads context from sessionStorage (set by DeepLinkHandler).
 * Auto-clears when QuickView closes.
 * Returns null when no alert context exists (zero visual impact in normal browsing).
 */
export function AlertContextBanner() {
  const {
    isOpen,
    currentIndex,
    listings,
    goToNext,
    goToPrevious,
    hasNext,
    hasPrevious,
  } = useQuickView();
  const [alertContext, setAlertContext] = useState<AlertContext | null>(null);

  // Read alert context from sessionStorage on mount.
  // Only use it if the URL still has multi-listing params — prevents stale
  // sessionStorage from showing the banner during normal browsing (e.g., if
  // the user hard-navigated away while QuickView was open from an alert link).
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('quickview_alert_context');
      if (stored) {
        const url = new URL(window.location.href);
        if (url.searchParams.has('listings') || url.searchParams.has('alert_search')) {
          setAlertContext(JSON.parse(stored));
        } else {
          sessionStorage.removeItem('quickview_alert_context');
        }
      }
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  // Clear sessionStorage when QuickView closes
  useEffect(() => {
    if (!isOpen && alertContext) {
      try {
        sessionStorage.removeItem('quickview_alert_context');
      } catch {
        // ignore
      }
      setAlertContext(null);
    }
  }, [isOpen, alertContext]);

  if (!alertContext || currentIndex === -1 || listings.length === 0) {
    return null;
  }

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === listings.length - 1;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gold/10 border-b border-gold/20 text-sm shrink-0">
      {/* Left: bell icon + search name context */}
      <div className="flex items-center gap-2 min-w-0">
        <svg
          className="w-4 h-4 text-gold flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        {alertContext.searchName ? (
          <span className="text-ink/60 truncate">{alertContext.searchName}</span>
        ) : (
          <span className="text-ink/60">Alert matches</span>
        )}
      </div>

      {/* Right: prev + counter + next */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          disabled={isFirst}
          className={`w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150 ${
            isFirst
              ? 'text-ink/20 cursor-not-allowed'
              : 'text-ink/60 hover:text-ink hover:bg-gold/20 active:bg-gold/30'
          }`}
          aria-label="Previous match"
          title="Previous match (K / Left arrow)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-ink/70 tabular-nums text-[13px] font-medium min-w-[3.5rem] text-center select-none">
          {currentIndex + 1} of {listings.length}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          disabled={isLast}
          className={`w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150 ${
            isLast
              ? 'text-ink/20 cursor-not-allowed'
              : 'text-ink/60 hover:text-ink hover:bg-gold/20 active:bg-gold/30'
          }`}
          aria-label="Next match"
          title="Next match (J / Right arrow)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
