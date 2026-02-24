'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useLocale } from '@/i18n/LocaleContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { SaveSearchModal } from './SaveSearchModal';
import type { SavedSearchCriteria } from '@/types';
import { CATEGORY_DEFAULT } from '@/lib/constants';

interface SaveSearchButtonProps {
  criteria: SavedSearchCriteria;
  currentMatchCount?: number;
  className?: string;
}

/**
 * Button to save the current search filters.
 * Shows when user has active filters.
 * Opens login modal if not authenticated.
 */
export function SaveSearchButton({
  criteria,
  currentMatchCount,
  className = '',
}: SaveSearchButtonProps) {
  const { user } = useAuth();
  const { requireFeature } = useSubscription();
  const { t } = useLocale();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Check if there are any user-chosen filters worth saving.
  // The default category ('nihonto') doesn't count — it's always set on landing.
  const hasFilters =
    (criteria.itemTypes?.length ?? 0) > 0 ||
    (criteria.certifications?.length ?? 0) > 0 ||
    (criteria.dealers?.length ?? 0) > 0 ||
    (criteria.schools?.length ?? 0) > 0 ||
    criteria.askOnly ||
    criteria.query ||
    (!!criteria.category && criteria.category !== CATEGORY_DEFAULT) ||
    criteria.minPrice !== undefined ||
    criteria.maxPrice !== undefined;

  // Don't show button if no filters
  if (!hasFilters) {
    return null;
  }

  const handleClick = () => {
    // First check subscription access - show paywall with value proposition
    if (!requireFeature('saved_searches')) {
      return;
    }

    // User has subscription but not logged in - prompt login
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    // If both checks pass, show save modal
    setShowSaveModal(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gold border border-gold/30 hover:bg-gold/5 rounded-lg transition-colors ${className}`}
        title={t('saveSearch.getAlerts')}
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {t('saveSearch.getAlerts')}
      </button>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

      {/* Save Search Modal */}
      <SaveSearchModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        criteria={criteria}
        currentMatchCount={currentMatchCount}
      />
    </>
  );
}
