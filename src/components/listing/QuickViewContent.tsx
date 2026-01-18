'use client';

import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { TimeOnMarketCounter } from '@/components/ui/TimeOnMarketCounter';
import { useCurrency, formatPriceWithConversion } from '@/hooks/useCurrency';
import { getMarketTimeDisplay } from '@/lib/freshness';
import type { Listing } from '@/types';
import { getItemTypeLabel } from '@/types';
import { MetadataGrid, getCertInfo } from './MetadataGrid';
import { TranslatedDescription } from './TranslatedDescription';

// =============================================================================
// TYPES
// =============================================================================

interface QuickViewContentProps {
  listing: Listing;
  onClose?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuickViewContent({ listing }: QuickViewContentProps) {
  const { currency, exchangeRates } = useCurrency();
  const certInfo = getCertInfo(listing.cert_type);
  const itemTypeLabel = getItemTypeLabel(listing.item_type);
  const dealerName = listing.dealer?.name || 'Dealer';
  const priceDisplay = formatPriceWithConversion(
    listing.price_value,
    listing.price_currency,
    currency,
    exchangeRates
  );
  const marketTime = getMarketTimeDisplay(listing);

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
            </div>
            <FavoriteButton listingId={listing.id} size="sm" />
          </div>

          {/* Price - Large and prominent */}
          <div className="mb-2">
            <span className={`text-2xl lg:text-3xl font-semibold tabular-nums ${
              listing.price_value ? 'text-ink' : 'text-muted'
            }`} data-testid="price-display">
              {priceDisplay}
            </span>
          </div>

          {/* Dealer + Time on Market */}
          <div className="flex items-center justify-between text-[12px] text-muted">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span data-testid="dealer-name">{dealerName}</span>
            </div>
            {marketTime && (
              <TimeOnMarketCounter
                startDate={marketTime.startDate}
                className="text-[11px]"
              />
            )}
          </div>
        </div>

        {/* Attribution & Measurements via MetadataGrid */}
        <MetadataGrid
          listing={listing}
          variant="full"
          showAttribution={true}
          showMeasurements={true}
        />

        {/* Title */}
        <div className="px-4 py-3 lg:px-5 border-b border-border">
          <h2 className="font-serif text-lg lg:text-xl text-ink leading-snug" data-testid="listing-title">
            {listing.title}
          </h2>
        </div>

        {/* Translated Description */}
        <TranslatedDescription listing={listing} maxLines={6} />
      </div>

      {/* Sticky CTA Button */}
      <div className="px-4 py-3 lg:px-5 lg:py-4 bg-cream border-t border-border safe-area-bottom shrink-0">
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="cta-button"
          className="flex items-center justify-center gap-2 w-full px-5 py-3 text-[13px] lg:text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
        >
          See Full Listing
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}

export default QuickViewContent;
