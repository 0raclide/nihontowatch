'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { useActivityTrackerOptional } from '@/lib/tracking/ActivityTracker';
import { mapListingToCollectionItem } from '@/lib/collection/listingImport';
import { useLocale } from '@/i18n/LocaleContext';
import { getDealerDisplayName } from '@/lib/dealers/displayName';
import { LoginModal } from '@/components/auth/LoginModal';
import type { Listing } from '@/types';

const InquiryModal = dynamic(
  () => import('@/components/inquiry/InquiryModal').then(m => ({ default: m.InquiryModal })),
  { ssr: false }
);

interface BrowseCTAProps {
  listing: Listing;
}

export function BrowseCTA({ listing }: BrowseCTAProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showPaywall, canAccess } = useSubscription();
  const quickView = useQuickViewOptional();
  const activityTracker = useActivityTrackerOptional();
  const { t, locale } = useLocale();
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const dealerObj = listing.dealers || listing.dealer;
  const dealerName = dealerObj ? getDealerDisplayName(dealerObj as { name: string; name_ja?: string | null }, locale) : 'Dealer';

  const handleInquire = () => {
    if (!canAccess('inquiry_emails')) {
      showPaywall('inquiry_emails');
      return;
    }
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setIsInquiryModalOpen(true);
  };

  const handleIOwn = useCallback(() => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    const prefill = mapListingToCollectionItem(listing as Listing);
    sessionStorage.setItem('collection_prefill', JSON.stringify(prefill));
    quickView?.dismissForNavigation?.();
    router.push('/collection?add=listing');
  }, [user, listing, quickView, router]);

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
            data-testid="inquire-button"
            title={t('listing.inquire')}
            className="flex items-center justify-center px-3 py-3 text-[13px] font-medium text-charcoal bg-linen hover:bg-hover border border-border rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>
        )}

        {/* I Own This Button */}
        {user && process.env.NEXT_PUBLIC_COLLECTION_ENABLED === 'true' && (
          <button
            onClick={handleIOwn}
            title={t('listing.iOwnThis')}
            className="flex items-center justify-center px-3 py-3 text-[13px] font-medium text-charcoal bg-linen hover:bg-hover border border-border rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </button>
        )}

        {/* View on Dealer Button */}
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={handleDealerLinkClick}
          data-testid="cta-button"
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-[13px] lg:text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
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
