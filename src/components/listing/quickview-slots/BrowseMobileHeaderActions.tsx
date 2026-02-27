'use client';

import { useState } from 'react';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { ShareButton } from '@/components/share/ShareButton';
import { ReportModal } from '@/components/feedback/ReportModal';
import { useAuth } from '@/lib/auth/AuthContext';
import { useLocale } from '@/i18n/LocaleContext';
import type { Listing, ListingWithEnrichment } from '@/types';
import { hasSetsumeiData } from '@/types';

interface BrowseMobileHeaderActionsProps {
  listing: Listing;
  isStudyMode?: boolean;
  onToggleStudyMode?: () => void;
  isAdminEditMode?: boolean;
  onToggleAdminEditMode?: () => void;
}

export function BrowseMobileHeaderActions({
  listing,
  isStudyMode,
  onToggleStudyMode,
  isAdminEditMode,
  onToggleAdminEditMode,
}: BrowseMobileHeaderActionsProps) {
  const { user, isAdmin } = useAuth();
  const { locale } = useLocale();
  const [showReportModal, setShowReportModal] = useState(false);

  return (
    <>
      {/* Study Setsumei button - hidden for JA locale */}
      {locale !== 'ja' && hasSetsumeiData(listing as ListingWithEnrichment) && onToggleStudyMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStudyMode();
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
            isStudyMode
              ? 'bg-gold text-white shadow-lg'
              : 'magical-book'
          }`}
          aria-label={isStudyMode ? 'View photos' : 'Study setsumei'}
          title={isStudyMode ? 'View photos' : 'Read NBTHK evaluation'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </button>
      )}
      {/* Admin Edit button */}
      {isAdmin && onToggleAdminEditMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleAdminEditMode();
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
            isAdminEditMode
              ? 'bg-gold text-white shadow-lg'
              : 'text-muted hover:text-ink hover:bg-border/50'
          }`}
          aria-label={isAdminEditMode ? 'View photos' : 'Admin edit'}
          title={isAdminEditMode ? 'View photos' : 'Edit listing (admin)'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
        </button>
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <ShareButton
          listingId={listing.id}
          title={listing.title}
          size="sm"
          ogImageUrl={listing.og_image_url}
        />
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <FavoriteButton
          listingId={listing.id}
          size="sm"
        />
      </div>
      {/* Report flag button - auth gated */}
      {user && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowReportModal(true);
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-red-500 hover:bg-red-50/50 transition-all duration-200"
          aria-label="Report an issue"
          title="Report an issue"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
        </button>
      )}
      {showReportModal && (
        <ReportModal
          isOpen
          onClose={() => setShowReportModal(false)}
          targetType="listing"
          targetId={String(listing.id)}
          targetLabel={listing.title || `Listing ${listing.id}`}
        />
      )}
    </>
  );
}
