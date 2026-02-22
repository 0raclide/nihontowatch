'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useLocale } from '@/i18n/LocaleContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { useSavedSearches } from '@/hooks/useSavedSearches';
import type { SavedSearchCriteria } from '@/types';

interface MobileAlertBarProps {
  criteria: SavedSearchCriteria;
}

/**
 * Sticky mobile CTA bar between scrollable content and BottomTabBar.
 * Visible when filters are active. One-tap quick-save with instant frequency.
 */
export function MobileAlertBar({ criteria }: MobileAlertBarProps) {
  const { user } = useAuth();
  const { requireFeature } = useSubscription();
  const { t } = useLocale();
  const { createSavedSearch, isCreating } = useSavedSearches({ autoFetch: false });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('mobileAlertBarDismissed') === 'true';
  });
  const [saved, setSaved] = useState(false);

  // Check if there are any active filters worth saving
  const hasFilters =
    (criteria.itemTypes?.length ?? 0) > 0 ||
    (criteria.certifications?.length ?? 0) > 0 ||
    (criteria.dealers?.length ?? 0) > 0 ||
    (criteria.schools?.length ?? 0) > 0 ||
    criteria.askOnly ||
    criteria.query ||
    (!!criteria.category && criteria.category !== 'all') ||
    criteria.minPrice !== undefined ||
    criteria.maxPrice !== undefined;

  const handleSave = useCallback(async () => {
    if (!requireFeature('saved_searches')) return;
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    const result = await createSavedSearch({
      search_criteria: criteria,
      notification_frequency: 'instant',
    });

    if (result) {
      setSaved(true);
      setTimeout(() => {
        setDismissed(true);
        sessionStorage.setItem('mobileAlertBarDismissed', 'true');
      }, 2500);
    }
  }, [requireFeature, user, createSavedSearch, criteria]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    sessionStorage.setItem('mobileAlertBarDismissed', 'true');
  }, []);

  // Don't render on desktop, when dismissed, or when no filters
  if (!hasFilters || dismissed) return null;

  return (
    <>
      <div className="lg:hidden shrink-0 bg-cream/95 backdrop-blur-sm border-t border-border px-3 py-2">
        {saved ? (
          // Success toast state
          <div className="flex items-center justify-center gap-2 h-7">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[12px] font-medium text-green-700 dark:text-green-400">
              {t('mobileAlert.saved')}
            </span>
          </div>
        ) : (
          // Normal prompt state
          <div className="flex items-center gap-2">
            {/* Bell icon */}
            <svg className="w-4 h-4 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {/* Prompt text */}
            <span className="text-[11px] text-muted flex-1 truncate">
              {t('mobileAlert.prompt')}
            </span>
            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={isCreating}
              className="px-3 py-1 text-[11px] font-medium text-white bg-gold hover:bg-gold-light rounded-md transition-colors disabled:opacity-50 shrink-0"
            >
              {isCreating ? '...' : t('mobileAlert.save')}
            </button>
            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="p-1 text-muted/60 hover:text-muted transition-colors shrink-0"
              aria-label={t('mobileAlert.dismiss')}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
}
