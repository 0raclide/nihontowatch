'use client';

import { useState, useCallback } from 'react';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { ShareButton } from '@/components/share/ShareButton';
import dynamic from 'next/dynamic';

const InquiryModal = dynamic(
  () => import('@/components/inquiry/InquiryModal').then(m => ({ default: m.InquiryModal })),
  { ssr: false }
);
import { LoginModal } from '@/components/auth/LoginModal';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { mapListingToCollectionItem } from '@/lib/collection/listingImport';
import { saveListingReturnContext } from '@/lib/listing/returnContext';
import { useActivityTrackerOptional } from '@/lib/tracking/ActivityTracker';
import { useCurrency, formatPriceWithConversion } from '@/hooks/useCurrency';
import { shouldShowNewBadge } from '@/lib/newListing';
import type { Listing, ListingWithEnrichment } from '@/types';
import { getItemTypeLabel, hasSetsumeiData } from '@/types';
import { MetadataGrid, getCertInfo, getArtisanInfo } from './MetadataGrid';
const AdminScoreInspector = dynamic(
  () => import('./AdminScoreInspector').then(m => ({ default: m.AdminScoreInspector })),
  { ssr: false }
);
import { AdminSetsumeiWidget } from './AdminSetsumeiWidget';
import { TranslatedDescription } from './TranslatedDescription';
import { TranslatedTitle } from './TranslatedTitle';
import { useLocale } from '@/i18n/LocaleContext';
import { SocialShareButtons } from '@/components/share/SocialShareButtons';
import { getDealerDisplayName } from '@/lib/dealers/displayName';

// =============================================================================
// TYPES
// =============================================================================

interface QuickViewContentProps {
  listing: Listing;
  onClose?: () => void;
  isStudyMode?: boolean;
  onToggleStudyMode?: () => void;
  isAdminEditMode?: boolean;
  onToggleAdminEditMode?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuickViewContent({ listing, isStudyMode, onToggleStudyMode, onToggleAdminEditMode }: QuickViewContentProps) {
  const router = useRouter();
  const { currency, exchangeRates } = useCurrency();
  const { user, isAdmin } = useAuth();
  const { showPaywall, canAccess } = useSubscription();
  const quickView = useQuickViewOptional();
  const detailLoaded = quickView?.detailLoaded ?? true;
  const activityTracker = useActivityTrackerOptional();
  const { t, locale } = useLocale();
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [navigatingToArtist, setNavigatingToArtist] = useState(false);

  const certInfo = getCertInfo(listing.cert_type);
  const rawItemTypeLabel = getItemTypeLabel(listing.item_type);
  const itemTypeLabel = (() => { const k = `itemType.${listing.item_type?.toLowerCase()}`; const r = t(k); return r === k ? rawItemTypeLabel : r; })();
  // Note: Supabase returns 'dealers' (plural) from the join, not 'dealer' (singular)
  const dealerObj = listing.dealers || listing.dealer;
  const dealerName = dealerObj ? getDealerDisplayName(dealerObj as { name: string; name_ja?: string | null }, locale) : 'Dealer';
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

  const handleIOwn = useCallback(() => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    // Map listing data to collection prefill and navigate to collection page
    const prefill = mapListingToCollectionItem(listing as import('@/types').Listing);
    // Store prefill in sessionStorage for the collection page to pick up
    sessionStorage.setItem('collection_prefill', JSON.stringify(prefill));
    // Use dismissForNavigation (not closeQuickView) to avoid
    // history.back() racing with router.push()
    quickView?.dismissForNavigation?.();
    router.push('/collection?add=listing');
  }, [user, listing, quickView, router]);

  const handleToggleHidden = useCallback(async () => {
    const newHidden = !listing.admin_hidden;

    try {
      const res = await fetch(`/api/listing/${listing.id}/hide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: newHidden }),
      });
      if (res.ok) {
        quickView?.refreshCurrentListing({ admin_hidden: newHidden } as Partial<Listing>);
      }
    } catch {
      // silently fail
    }
  }, [listing.id, listing.admin_hidden, quickView]);

  const handleToggleSold = useCallback(async () => {
    const markAsSold = listing.is_available; // if available, mark sold; if sold, mark available

    try {
      const res = await fetch(`/api/listing/${listing.id}/set-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sold: markAsSold }),
      });
      if (res.ok) {
        quickView?.refreshCurrentListing({
          status: markAsSold ? 'sold' : 'available',
          is_available: !markAsSold,
          is_sold: markAsSold,
          status_admin_locked: true,
        } as Partial<Listing>);
      }
    } catch {
      // silently fail
    }
  }, [listing.id, listing.is_available, quickView]);

  // Track when user clicks through to dealer's website
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
                  className={`text-[10px] uppercase tracking-wider font-bold ${
                    certInfo.tier === 'tokuju' ? 'text-tokuju'
                      : certInfo.tier === 'jubi' ? 'text-jubi'
                      : certInfo.tier === 'juyo' ? 'text-juyo'
                      : certInfo.tier === 'tokuho' ? 'text-toku-hozon'
                      : 'text-hozon'
                  }`}
                >
                  {t(certInfo.certKey)}
                </span>
              )}
              {shouldShowNewBadge(listing.first_seen_at, listing.dealer_earliest_seen_at, listing.is_initial_import) && (
                <span
                  data-testid="new-listing-badge"
                  className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-new-listing-bg text-new-listing"
                >
                  {t('quickview.newThisWeek')}
                </span>
              )}
              {isAdmin && listing.admin_hidden && (
                <span
                  data-testid="hidden-badge"
                  className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                >
                  {t('quickview.hidden')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Admin: Toggle sold/available status */}
              {isAdmin && (
                <button
                  onClick={handleToggleSold}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
                    listing.is_sold
                      ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30'
                      : 'text-muted hover:text-ink hover:bg-border/50'
                  }`}
                  aria-label={listing.is_sold ? t('quickview.markAvailable') : t('quickview.markSold')}
                  title={listing.is_sold ? t('quickview.markAvailable') : t('quickview.markSold')}
                >
                  {listing.is_sold ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  )}
                </button>
              )}
              {/* Admin: Hide/unhide listing button */}
              {isAdmin && (
                <button
                  onClick={handleToggleHidden}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
                    listing.admin_hidden
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'text-muted hover:text-ink hover:bg-border/50'
                  }`}
                  aria-label={listing.admin_hidden ? t('quickview.unhide') : t('quickview.hide')}
                  title={listing.admin_hidden ? t('quickview.unhide') : t('quickview.hide')}
                >
                  {listing.admin_hidden ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              )}
              {/* Admin: Edit fields (pen icon) */}
              {isAdmin && onToggleAdminEditMode && (
                <button
                  onClick={onToggleAdminEditMode}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-border/50 transition-all duration-200"
                  aria-label="Edit fields"
                  title="Edit fields"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
              )}
              {/* Study Setsumei button - only show when setsumei data available. Hidden for JA locale (they can read setsumei natively). */}
              {locale !== 'ja' && hasSetsumeiData(listing as ListingWithEnrichment) && onToggleStudyMode && (
                <button
                  onClick={onToggleStudyMode}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
                    isStudyMode
                      ? 'bg-gold text-white shadow-lg'
                      : 'magical-book'
                  }`}
                  aria-label={isStudyMode ? t('quickview.viewPhotos') : t('quickview.studySetsumei')}
                  title={isStudyMode ? t('quickview.viewPhotos') : t('quickview.studySetsumei')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </button>
              )}
              <SocialShareButtons
                path={`/listing/${listing.id}`}
                title={listing.title || 'NihontoWatch'}
                size="sm"
              />
              <ShareButton listingId={listing.id} title={listing.title} size="sm" ogImageUrl={listing.og_image_url} />
              <FavoriteButton listingId={listing.id} size="sm" />
            </div>
          </div>

          {/* Artist identity block — auction-house style: artist as headline above price */}
          {listing.artisan_id &&
           listing.artisan_id !== 'UNKNOWN' &&
           listing.artisan_confidence && listing.artisan_confidence !== 'NONE' &&
           (isAdmin || !listing.artisan_id.startsWith('tmp')) && (
            <div className="flex items-center gap-3 mb-2 py-2">
              <a
                href={`/artists/${listing.artisan_id}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (navigatingToArtist) return;
                  setNavigatingToArtist(true);
                  window.dispatchEvent(new Event('nav-progress-start'));
                  saveListingReturnContext(listing);
                  // Dismiss QuickView BEFORE navigating — releasing body scroll lock
                  // and cleaning URL state so the modal doesn't interfere with the transition.
                  quickView?.dismissForNavigation?.();
                  router.push(`/artists/${listing.artisan_id}`);
                }}
                className={`group flex items-center gap-3 flex-1 min-w-0 cursor-pointer ${navigatingToArtist ? 'opacity-70' : ''}`}
              >
                <svg className="w-5 h-5 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-gold font-medium leading-tight">{t('quickview.artistProfile')}</div>
                  <div className="text-[16px] font-semibold text-ink group-hover:text-gold transition-colors truncate">
                    {(locale === 'ja' && listing.artisan_name_kanji)
                      ? listing.artisan_name_kanji
                      : (listing.artisan_display_name
                        || getArtisanInfo(listing, locale).artisan
                        || listing.artisan_id)}
                  </div>
                </div>
                {listing.artisan_tier && (
                  <svg
                    className={`w-4 h-4 shrink-0 ${
                      listing.artisan_tier === 'kokuho' ? 'text-amber-400' :
                      listing.artisan_tier === 'elite' ? 'text-purple-400' :
                      'text-blue-400'
                    }`}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-label={
                      listing.artisan_tier === 'kokuho' ? t('artisan.tierKokuhoLabel') :
                      listing.artisan_tier === 'elite' ? t('artisan.tierEliteLabel') :
                      t('artisan.tierJuyoLabel')
                    }
                  >
                    <title>{
                      listing.artisan_tier === 'kokuho' ? t('artisan.tierKokuho') :
                      listing.artisan_tier === 'elite' ? t('artisan.tierElite') :
                      t('artisan.tierJuyo')
                    }</title>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                )}
                {navigatingToArtist ? (
                  <svg className="w-4 h-4 text-gold animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gold/60 group-hover:text-gold group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </a>
            </div>
          )}

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
              {listing.dealer_id ? (
                <a
                  href={`/?dealer=${listing.dealer_id}`}
                  data-testid="dealer-name"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Use dismissForNavigation (not closeQuickView) to avoid
                    // history.back() racing with router.push()
                    quickView?.dismissForNavigation?.();
                    router.push(`/?dealer=${listing.dealer_id}`);
                  }}
                  className="hover:text-accent hover:underline transition-colors"
                >
                  {dealerName}
                </a>
              ) : (
                <span data-testid="dealer-name">{dealerName}</span>
              )}
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

        {/* Translated Description — skeleton until detail API loads */}
        {detailLoaded ? (
          <TranslatedDescription listing={listing} maxLines={6} />
        ) : (
          <div className="px-4 py-3 lg:px-5 space-y-2 animate-pulse">
            <div className="h-4 bg-muted/20 rounded w-full" />
            <div className="h-4 bg-muted/20 rounded w-5/6" />
            <div className="h-4 bg-muted/20 rounded w-4/6" />
          </div>
        )}

        {/* Admin: Score Inspector + Manual Yuhinkai Connection Widget */}
        {isAdmin && (
          <div className="px-4 py-3 lg:px-5">
            <AdminScoreInspector
              listing={listing}
              onScoreRecomputed={(newScore) => quickView?.refreshCurrentListing({ featured_score: newScore } as Partial<Listing>)}
            />
            <AdminSetsumeiWidget
              listing={listing}
              onConnectionChanged={(enrichment) => quickView?.refreshCurrentListing(
                enrichment !== undefined ? { yuhinkai_enrichment: enrichment } as unknown as Partial<Listing> : undefined
              )}
            />
          </div>
        )}
      </div>

      {/* Sticky CTA Buttons */}
      <div className="px-4 py-3 lg:px-5 lg:py-4 bg-cream border-t border-border safe-area-bottom shrink-0">
        <div className="flex gap-2">
          {/* Inquire Button — icon-only (panel is always narrow). Hidden for JA locale (no EN→JA translation needed). */}
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

          {/* I Own This Button — icon-only (panel is always narrow) */}
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
