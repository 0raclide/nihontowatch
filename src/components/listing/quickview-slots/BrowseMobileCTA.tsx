'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth/AuthContext';
import { useActivityTrackerOptional } from '@/lib/tracking/ActivityTracker';
import { useLocale } from '@/i18n/LocaleContext';
import { getDealerDisplayName } from '@/lib/dealers/displayName';
import { LoginModal } from '@/components/auth/LoginModal';
import type { Listing } from '@/types';

const InquiryModal = dynamic(
  () => import('@/components/inquiry/InquiryModal').then(m => ({ default: m.InquiryModal })),
  { ssr: false }
);

interface BrowseMobileCTAProps {
  listing: Listing;
}

export function BrowseMobileCTA({ listing }: BrowseMobileCTAProps) {
  const { user } = useAuth();
  const activityTracker = useActivityTrackerOptional();
  const { t, locale } = useLocale();
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const dealerObj = listing.dealers || listing.dealer;
  const dealerName = dealerObj ? getDealerDisplayName(dealerObj as { name: string; name_ja?: string | null }, locale) : 'Dealer';

  const handleInquire = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setIsInquiryModalOpen(true);
  }, [user]);

  const handleDealerLinkClick = useCallback(() => {
    if (activityTracker && listing) {
      activityTracker.trackDealerClick(
        Number(listing.id),
        listing.dealer_id ?? 0,
        listing.dealers?.name || listing.dealer?.name || 'Unknown',
        listing.url,
        'quickview',
        { priceAtClick: listing.price_value ?? undefined, currencyAtClick: listing.price_currency ?? undefined }
      );
    }
  }, [activityTracker, listing]);

  return (
    <>
      <div className="flex gap-2">
        {/* Inquire Button — hidden for JA locale */}
        {locale !== 'ja' && (
          <button
            onClick={handleInquire}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            data-testid="inquire-button-mobile"
            className="flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-charcoal bg-linen hover:bg-hover border border-border rounded-lg transition-colors active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Inquire
          </button>
        )}

        {/* View on Dealer Button */}
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleDealerLinkClick();
          }}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-[13px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors active:scale-[0.98]"
        >
          {t('quickview.viewOn', { dealer: dealerName })}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Inquiry Modal */}
      <InquiryModal
        isOpen={isInquiryModalOpen}
        onClose={() => setIsInquiryModalOpen(false)}
        listing={listing}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
}
