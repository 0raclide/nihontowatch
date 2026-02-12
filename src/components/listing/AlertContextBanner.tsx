'use client';

import { useEffect, useState } from 'react';
import { useQuickView } from '@/contexts/QuickViewContext';

interface AlertContext {
  searchName: string;
  totalMatches: number;
}

/**
 * Displays "Match 1 of 5 — Juyo Katana" banner inside QuickView
 * when the user arrived via an alert email multi-listing deep link.
 *
 * Reads context from sessionStorage (set by DeepLinkHandler).
 * Auto-clears when QuickView closes.
 * Returns null when no alert context exists (zero visual impact in normal browsing).
 */
export function AlertContextBanner() {
  const { isOpen, currentIndex, listings } = useQuickView();
  const [alertContext, setAlertContext] = useState<AlertContext | null>(null);

  // Read alert context from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('quickview_alert_context');
      if (stored) {
        setAlertContext(JSON.parse(stored));
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

  return (
    <div className="flex items-center justify-center gap-2 px-3 py-2 bg-gold/10 border-b border-gold/20 text-sm">
      <svg
        className="w-4 h-4 text-gold flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
      </svg>
      <span className="text-ink/70 tabular-nums">
        Match {currentIndex + 1} of {listings.length}
        {alertContext.searchName && (
          <span className="text-ink/50"> — {alertContext.searchName}</span>
        )}
      </span>
    </div>
  );
}
