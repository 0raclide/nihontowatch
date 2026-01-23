'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { SaveSearchModal } from './SaveSearchModal';
import type { SavedSearchCriteria } from '@/types';

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
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Check if there are any active filters worth saving
  const hasFilters =
    (criteria.itemTypes?.length ?? 0) > 0 ||
    (criteria.certifications?.length ?? 0) > 0 ||
    (criteria.dealers?.length ?? 0) > 0 ||
    (criteria.schools?.length ?? 0) > 0 ||
    criteria.askOnly ||
    criteria.query ||
    (criteria.category && criteria.category !== 'all');

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
        title="Save this search"
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
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        Save Search
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
