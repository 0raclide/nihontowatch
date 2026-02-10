'use client';

import { useState, useCallback } from 'react';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { ShareButton } from '@/components/share/ShareButton';
import { InquiryModal } from '@/components/inquiry';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { useActivityTrackerOptional } from '@/lib/tracking/ActivityTracker';
import { useCurrency, formatPriceWithConversion } from '@/hooks/useCurrency';
import { shouldShowNewBadge } from '@/lib/newListing';
import type { Listing, ListingWithEnrichment } from '@/types';
import { getItemTypeLabel, hasSetsumeiData } from '@/types';
import { MetadataGrid, getCertInfo } from './MetadataGrid';
import { AdminSetsumeiWidget } from './AdminSetsumeiWidget';
import { AdminArtisanWidget } from '@/components/artisan/AdminArtisanWidget';
import { ArtisanTooltip } from '@/components/artisan/ArtisanTooltip';
import { TranslatedDescription } from './TranslatedDescription';
import { TranslatedTitle } from './TranslatedTitle';

// =============================================================================
// TYPES
// =============================================================================

interface QuickViewContentProps {
  listing: Listing;
  onClose?: () => void;
  isStudyMode?: boolean;
  onToggleStudyMode?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuickViewContent({ listing, isStudyMode, onToggleStudyMode }: QuickViewContentProps) {
  const { currency, exchangeRates } = useCurrency();
  const { user, isAdmin } = useAuth();
  const { showPaywall, canAccess } = useSubscription();
  const quickView = useQuickViewOptional();
  const activityTracker = useActivityTrackerOptional();
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const certInfo = getCertInfo(listing.cert_type);
  const itemTypeLabel = getItemTypeLabel(listing.item_type);
  // Note: Supabase returns 'dealers' (plural) from the join, not 'dealer' (singular)
  const dealerName = listing.dealers?.name || listing.dealer?.name || 'Dealer';
  const priceDisplay = formatPriceWithConversion(
    listing.price_value,
    listing.price_currency,
    currency,
    exchangeRates
  );

  const handleInquire = () => {
    // First check subscription access - show paywall with value proposition
    if (!canAccess('inquiry_emails')) {
      showPaywall('inquiry_emails');
      return;
    }
    // User has subscription but not logged in - prompt login
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setIsInquiryModalOpen(true);
  };

  // Track when user clicks through to dealer's website
  const handleDealerLinkClick = useCallback(() => {
    if (activityTracker && listing) {
      activityTracker.trackExternalLinkClick(
        listing.url,
        Number(listing.id),
        listing.dealers?.name || listing.dealer?.name
      );
    }
  }, [activityTracker, listing]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" data-testid="quickview-scrollable-content">
        {/* Hero Section - Key info at a glance */}
        <div className="px-4 py-3 lg:px-5 lg:py-4 bg-linen/50">
          {/* Top row: Type + Cert + Watch */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-muted uppercase tracking-wide font-medium" data-testid="item-type-label">
                {itemTypeLabel}
              </span>
              {certInfo && (
                <span
                  data-testid="cert-badge"
                  className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${
                    certInfo.tier === 'premier'
                      ? 'bg-juyo-bg text-juyo'
                      : certInfo.tier === 'high'
                      ? 'bg-toku-hozon-bg text-toku-hozon'
                      : 'bg-hozon-bg text-hozon'
                  }`}
                >
                  {certInfo.shortLabel}
                </span>
              )}
              {shouldShowNewBadge(listing.first_seen_at, listing.dealer_earliest_seen_at) && (
                <span
                  data-testid="new-listing-badge"
                  className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-new-listing-bg text-new-listing"
                >
                  New this week
                </span>
              )}
              {/* Artisan badge — links to profile; admin gets edit pen with ArtisanTooltip */}
              {/* Hide tmp-prefixed provisional codes from non-admin users */}
              {listing.artisan_id &&
               listing.artisan_confidence && listing.artisan_confidence !== 'NONE' &&
               (isAdmin || !listing.artisan_id.startsWith('tmp')) ? (
                isAdmin ? (
                  <span className="inline-flex items-center gap-0.5" data-artisan-tooltip>
                    <a
                      href={`/artists/${listing.artisan_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded hover:opacity-80 transition-opacity ${
                        listing.artisan_confidence === 'HIGH'
                          ? 'bg-artisan-high-bg text-artisan-high'
                          : listing.artisan_confidence === 'MEDIUM'
                          ? 'bg-artisan-medium-bg text-artisan-medium'
                          : 'bg-artisan-low-bg text-artisan-low'
                      }`}
                    >
                      {listing.artisan_display_name || listing.artisan_id}
                    </a>
                    <ArtisanTooltip
                      listingId={listing.id}
                      artisanId={listing.artisan_id}
                      confidence={listing.artisan_confidence as 'HIGH' | 'MEDIUM' | 'LOW'}
                      method={listing.artisan_method}
                      candidates={listing.artisan_candidates}
                      verified={listing.artisan_verified}
                      onArtisanFixed={(newId) => quickView?.refreshCurrentListing({
                        artisan_id: newId,
                        artisan_confidence: newId === 'UNKNOWN' ? 'LOW' : 'HIGH',
                        artisan_method: 'ADMIN_CORRECTION',
                        artisan_verified: 'correct' as const,
                        artisan_display_name: newId === 'UNKNOWN' ? 'Unknown' : newId,
                      })}
                    >
                      <span className="text-muted hover:text-ink transition-colors p-0.5 cursor-pointer">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </span>
                    </ArtisanTooltip>
                  </span>
                ) : (
                  <a
                    href={`/artists/${listing.artisan_id}`}
                    data-artisan-tooltip
                    className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded hover:opacity-80 transition-opacity ${
                      listing.artisan_confidence === 'HIGH'
                        ? 'bg-artisan-high-bg text-artisan-high'
                        : listing.artisan_confidence === 'MEDIUM'
                        ? 'bg-artisan-medium-bg text-artisan-medium'
                        : 'bg-artisan-low-bg text-artisan-low'
                    }`}
                  >
                    {listing.artisan_display_name || listing.artisan_id}
                  </a>
                )
              ) : isAdmin && !listing.artisan_id ? (
                /* Admin: show "Set ID" badge with pen icon for unmatched listings */
                <ArtisanTooltip
                  listingId={listing.id}
                  startInSearchMode
                  onArtisanFixed={(newId) => quickView?.refreshCurrentListing({
                    artisan_id: newId,
                    artisan_confidence: newId === 'UNKNOWN' ? 'LOW' : 'HIGH',
                    artisan_method: 'ADMIN_CORRECTION',
                    artisan_verified: 'correct' as const,
                    artisan_display_name: newId === 'UNKNOWN' ? 'Unknown' : newId,
                  })}
                >
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-muted/10 text-muted hover:text-ink transition-colors" data-artisan-tooltip>
                    Set ID
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </span>
                </ArtisanTooltip>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {/* Study Setsumei button - only show when setsumei data available */}
              {hasSetsumeiData(listing as ListingWithEnrichment) && onToggleStudyMode && (
                <button
                  onClick={onToggleStudyMode}
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
              <ShareButton listingId={listing.id} title={listing.title} size="sm" ogImageUrl={listing.og_image_url} />
              <FavoriteButton listingId={listing.id} size="sm" />
            </div>
          </div>

          {/* Price - Large and prominent */}
          <div className="mb-2">
            <span className={`text-2xl lg:text-3xl font-semibold tabular-nums ${
              listing.price_value ? 'text-ink' : 'text-muted'
            }`} data-testid="price-display">
              {priceDisplay}
            </span>
          </div>

          {/* Dealer */}
          <div className="flex items-center text-[12px] text-muted">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span data-testid="dealer-name">{dealerName}</span>
            </div>
          </div>
        </div>

        {/* Attribution & Measurements via MetadataGrid */}
        <MetadataGrid
          listing={listing}
          variant="full"
          showAttribution={true}
          showMeasurements={true}
        />

        {/* Title (auto-translated if Japanese) */}
        <div className="px-4 py-3 lg:px-5 border-b border-border">
          <TranslatedTitle listing={listing} className="lg:text-xl" />
        </div>

        {/* Translated Description */}
        <TranslatedDescription listing={listing} maxLines={6} />

        {/* Admin: Manual Yuhinkai Connection Widget */}
        {isAdmin && (
          <div className="px-4 py-3 lg:px-5">
            <AdminSetsumeiWidget
              listing={listing}
              onConnectionChanged={(enrichment) => quickView?.refreshCurrentListing(
                enrichment !== undefined ? { yuhinkai_enrichment: enrichment } as unknown as Partial<Listing> : undefined
              )}
            />
            <AdminArtisanWidget
              listing={listing}
              onArtisanChanged={(newId) => quickView?.refreshCurrentListing({
                artisan_id: newId,
                artisan_confidence: newId === 'UNKNOWN' ? 'LOW' : 'HIGH',
                artisan_method: 'ADMIN_CORRECTION',
                artisan_verified: 'correct' as const,
                artisan_display_name: newId === 'UNKNOWN' ? 'Unknown' : newId,
              })}
            />
          </div>
        )}
      </div>

      {/* Sticky CTA Buttons */}
      <div className="px-4 py-3 lg:px-5 lg:py-4 bg-cream border-t border-border safe-area-bottom shrink-0">
        <div className="flex gap-2">
          {/* Inquire Button */}
          <button
            onClick={handleInquire}
            data-testid="inquire-button"
            className="flex items-center justify-center gap-2 px-4 py-3 text-[13px] lg:text-[14px] font-medium text-charcoal bg-linen hover:bg-hover border border-border rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Inquire
          </button>

          {/* View on Dealer Button */}
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleDealerLinkClick}
            data-testid="cta-button"
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-[13px] lg:text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
          >
            View on {dealerName}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
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
    </div>
  );
}

export default QuickViewContent;
