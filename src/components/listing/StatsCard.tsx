'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { saveListingReturnContext } from '@/lib/listing/returnContext';
import { useCurrency, formatPriceWithConversion } from '@/hooks/useCurrency';
import { shouldShowNewBadge } from '@/lib/newListing';
import type { Listing } from '@/types';
import type { CollectionItemRow } from '@/types/collectionItem';
import { getItemTypeLabel } from '@/types';
import { MetadataGrid, getCertInfo, getArtisanInfo } from './MetadataGrid';
import { TranslatedTitle } from './TranslatedTitle';
import { SectionIndicators } from './SectionIndicators';
import { VisibilityBadge } from './VisibilityBadge';
import { useLocale } from '@/i18n/LocaleContext';
import type { SectionIndicator } from '@/lib/media/contentStream';

// ============================================================================
// Types
// ============================================================================

interface StatsCardProps {
  listing: Listing;
  sections: SectionIndicator[];
  onSectionClick: (sectionId: string) => void;
  activeSection?: string | null;
  collectionItem?: CollectionItemRow | null;
  actionBarSlot?: ReactNode;
  dealerSlot?: ReactNode;
  ctaSlot?: ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export function StatsCard({
  listing,
  sections,
  onSectionClick,
  activeSection,
  collectionItem,
  actionBarSlot,
  dealerSlot,
  ctaSlot,
}: StatsCardProps) {
  const router = useRouter();
  const { currency, exchangeRates } = useCurrency();
  const { isAdmin } = useAuth();
  const quickView = useQuickViewOptional();
  const { t, locale } = useLocale();
  const [navigatingToArtist, setNavigatingToArtist] = useState(false);

  const certInfo = getCertInfo(listing.cert_type);
  const rawItemTypeLabel = getItemTypeLabel(listing.item_type);
  const itemTypeLabel = (() => { const k = `itemType.${listing.item_type?.toLowerCase()}`; const r = t(k); return r === k ? rawItemTypeLabel : r; })();
  const isSold = listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold';
  const priceDisplay = isSold
    ? t('listing.sold')
    : formatPriceWithConversion(
        listing.price_value,
        listing.price_currency,
        currency,
        exchangeRates
      );

  const hasArtistBlock = !!(
    listing.artisan_id &&
    listing.artisan_id !== 'UNKNOWN' &&
    listing.artisan_confidence && listing.artisan_confidence !== 'NONE' &&
    (isAdmin || !listing.artisan_id.startsWith('tmp'))
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" data-testid="stats-card-content">
        {/* Hero Section — type, cert, action bar */}
        <div className="px-4 py-3 lg:px-5 lg:py-4 bg-linen/50">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-muted uppercase tracking-wide font-medium">
                {itemTypeLabel}
              </span>
              {certInfo && (
                <span
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
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-new-listing-bg text-new-listing">
                  {t('quickview.newThisWeek')}
                </span>
              )}
              {isAdmin && listing.admin_hidden && (
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {t('quickview.hidden')}
                </span>
              )}
              <VisibilityBadge collectionItem={collectionItem} />
            </div>
            <div className="flex items-center gap-2">
              {actionBarSlot}
            </div>
          </div>

          {/* Artist identity block */}
          {hasArtistBlock && (
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
                  >
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

          {/* Price (hidden for collection items) */}
          {!collectionItem && (
            <div className="mb-2">
              <span className={`text-2xl lg:text-3xl font-semibold tabular-nums ${
                listing.price_value ? 'text-ink' : 'text-muted'
              }`}>
                {priceDisplay}
              </span>
            </div>
          )}

          {/* Dealer slot */}
          <div className="flex items-center text-[12px] text-muted">
            {dealerSlot}
          </div>
        </div>

        {/* MetadataGrid */}
        <MetadataGrid
          listing={listing}
          variant="full"
          showAttribution={true}
          showMeasurements={true}
        />

        {/* Title */}
        <div className="px-4 py-3 lg:px-5 border-b border-border">
          <TranslatedTitle listing={listing} className="lg:text-xl" />
        </div>

        {/* Section indicators */}
        {sections.length > 0 && (
          <div className="px-4 py-3 lg:px-5 border-b border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2">
              {collectionItem ? t('quickview.thisItemHas') : t('quickview.thisListingHas')}
            </div>
            <SectionIndicators sections={sections} onSectionClick={onSectionClick} activeSection={activeSection} />
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="px-4 py-3 lg:px-5 lg:py-4 bg-cream border-t border-border safe-area-bottom shrink-0">
        {ctaSlot}
      </div>
    </div>
  );
}
