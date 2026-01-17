'use client';

import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import type { Listing } from '@/types';
import { isBlade, isTosogu, getItemTypeLabel } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface QuickViewContentProps {
  listing: Listing;
  onClose?: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CERT_CONFIG: Record<string, { label: string; shortLabel: string; tier: 'premier' | 'high' | 'standard' }> = {
  Juyo: { label: 'Juyo', shortLabel: 'Juyo', tier: 'premier' },
  juyo: { label: 'Juyo', shortLabel: 'Juyo', tier: 'premier' },
  'Tokubetsu Juyo': { label: 'Tokubetsu Juyo', shortLabel: 'TokuJu', tier: 'premier' },
  tokubetsu_juyo: { label: 'Tokubetsu Juyo', shortLabel: 'TokuJu', tier: 'premier' },
  Tokuju: { label: 'Tokubetsu Juyo', shortLabel: 'TokuJu', tier: 'premier' },
  tokuju: { label: 'Tokubetsu Juyo', shortLabel: 'TokuJu', tier: 'premier' },
  'Tokubetsu Hozon': { label: 'Tokubetsu Hozon', shortLabel: 'TokuHo', tier: 'high' },
  tokubetsu_hozon: { label: 'Tokubetsu Hozon', shortLabel: 'TokuHo', tier: 'high' },
  TokuHozon: { label: 'Tokubetsu Hozon', shortLabel: 'TokuHo', tier: 'high' },
  Hozon: { label: 'Hozon', shortLabel: 'Hozon', tier: 'standard' },
  hozon: { label: 'Hozon', shortLabel: 'Hozon', tier: 'standard' },
  'Juyo Tosogu': { label: 'Juyo Tosogu', shortLabel: 'Juyo', tier: 'premier' },
  'Tokubetsu Hozon Tosogu': { label: 'Toku Hozon Tosogu', shortLabel: 'TokuHo', tier: 'high' },
  'Hozon Tosogu': { label: 'Hozon Tosogu', shortLabel: 'Hozon', tier: 'standard' },
  'NTHK Kanteisho': { label: 'NTHK', shortLabel: 'NTHK', tier: 'standard' },
};

// =============================================================================
// HELPERS
// =============================================================================

function formatPrice(value: number | undefined | null, currency: string = 'JPY'): string {
  if (value === undefined || value === null) {
    return 'Price on request';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactPrice(value: number | undefined | null, currency: string = 'JPY'): { value: string; currency: string } {
  if (value === undefined || value === null) {
    return { value: 'POA', currency: '' };
  }

  const symbols: Record<string, string> = { JPY: '¥', USD: '$', EUR: '€' };
  const symbol = symbols[currency] || currency;

  if (value >= 1000000) {
    return { value: `${(value / 1000000).toFixed(1)}M`, currency: symbol };
  }
  if (value >= 1000) {
    return { value: `${Math.round(value / 1000)}K`, currency: symbol };
  }
  return { value: value.toLocaleString(), currency: symbol };
}

function getArtisanInfo(listing: Listing): { artisan: string | null; school: string | null; artisanLabel: string } {
  if (isTosogu(listing.item_type)) {
    return {
      artisan: listing.tosogu_maker || null,
      school: listing.tosogu_school || null,
      artisanLabel: 'Maker',
    };
  }
  return {
    artisan: listing.smith || null,
    school: listing.school || null,
    artisanLabel: 'Smith',
  };
}

function getCertInfo(certType: string | undefined): { label: string; shortLabel: string; tier: 'premier' | 'high' | 'standard' } | null {
  if (!certType) return null;
  return CERT_CONFIG[certType] || null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuickViewContent({ listing, onClose }: QuickViewContentProps) {
  const certInfo = getCertInfo(listing.cert_type);
  const { artisan, school, artisanLabel } = getArtisanInfo(listing);
  const itemTypeLabel = getItemTypeLabel(listing.item_type);
  const dealerName = listing.dealer?.name || 'Dealer';
  const isSword = isBlade(listing.item_type);
  const isTosoguItem = isTosogu(listing.item_type);
  const priceInfo = formatCompactPrice(listing.price_value, listing.price_currency);

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Hero Section - Key info at a glance */}
        <div className="px-4 py-3 lg:px-5 lg:py-4 bg-linen/50">
          {/* Top row: Type + Cert + Favorite */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-muted uppercase tracking-wide font-medium">
                {itemTypeLabel}
              </span>
              {certInfo && (
                <span
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
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-[11px] text-muted">{priceInfo.currency}</span>
            <span className={`text-2xl lg:text-3xl font-semibold tabular-nums ${
              listing.price_value ? 'text-ink' : 'text-muted'
            }`}>
              {listing.price_value ? formatPrice(listing.price_value, listing.price_currency) : 'Price on request'}
            </span>
          </div>

          {/* Dealer */}
          <div className="flex items-center gap-1.5 text-[12px] text-muted">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span>{dealerName}</span>
            {listing.dealer?.domain && (
              <span className="text-muted/60">({listing.dealer.domain})</span>
            )}
          </div>
        </div>

        {/* Quick Stats Grid - All key info visible */}
        <div className="px-4 py-3 lg:px-5 border-b border-border">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {/* Artisan */}
            {artisan && (
              <div className="col-span-2">
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">{artisanLabel}</span>
                <p className="text-[14px] text-ink font-medium truncate">{artisan}</p>
              </div>
            )}

            {/* School */}
            {school && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">School</span>
                <p className="text-[13px] text-ink truncate">{school}</p>
              </div>
            )}

            {/* Era */}
            {listing.era && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Era</span>
                <p className="text-[13px] text-ink truncate">{listing.era}</p>
              </div>
            )}

            {/* Province */}
            {listing.province && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Province</span>
                <p className="text-[13px] text-ink truncate">{listing.province}</p>
              </div>
            )}

            {/* Nagasa (for swords) */}
            {isSword && listing.nagasa_cm && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Nagasa</span>
                <p className="text-[13px] text-ink tabular-nums">{listing.nagasa_cm} cm</p>
              </div>
            )}

            {/* Mei Type */}
            {listing.mei_type && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Signature</span>
                <p className="text-[13px] text-ink truncate">{listing.mei_type}</p>
              </div>
            )}

            {/* Certification (full) */}
            {certInfo && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Papers</span>
                <p className="text-[13px] text-ink">{certInfo.label}</p>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Specifications */}
        {(isSword || isTosoguItem) && (
          <div className="px-4 py-3 lg:px-5 border-b border-border">
            <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2 font-medium">Measurements</h3>
            <div className="grid grid-cols-3 gap-x-3 gap-y-2">
              {/* Sword specs */}
              {isSword && (
                <>
                  {listing.nagasa_cm && <SpecPill label="Nagasa" value={`${listing.nagasa_cm}cm`} />}
                  {listing.sori_cm && <SpecPill label="Sori" value={`${listing.sori_cm}cm`} />}
                  {listing.motohaba_cm && <SpecPill label="Motohaba" value={`${listing.motohaba_cm}cm`} />}
                  {listing.sakihaba_cm && <SpecPill label="Sakihaba" value={`${listing.sakihaba_cm}cm`} />}
                  {listing.kasane_cm && <SpecPill label="Kasane" value={`${listing.kasane_cm}cm`} />}
                  {listing.nakago_cm && <SpecPill label="Nakago" value={`${listing.nakago_cm}cm`} />}
                  {listing.weight_g && <SpecPill label="Weight" value={`${listing.weight_g}g`} />}
                </>
              )}
              {/* Tosogu specs */}
              {isTosoguItem && (
                <>
                  {listing.height_cm && <SpecPill label="H" value={`${listing.height_cm}cm`} />}
                  {listing.width_cm && <SpecPill label="W" value={`${listing.width_cm}cm`} />}
                  {listing.thickness_mm && <SpecPill label="D" value={`${listing.thickness_mm}mm`} />}
                </>
              )}
            </div>
            {/* Material for tosogu */}
            {isTosoguItem && listing.material && (
              <div className="mt-2">
                <span className="text-[10px] uppercase tracking-wider text-muted">Material: </span>
                <span className="text-[12px] text-ink">{listing.material}</span>
              </div>
            )}
          </div>
        )}

        {/* Title - Searchable text */}
        <div className="px-4 py-3 lg:px-5">
          <h2 className="font-serif text-lg lg:text-xl text-ink leading-snug">
            {listing.title}
          </h2>
        </div>
      </div>

      {/* Sticky CTA Button */}
      <div className="px-4 py-3 lg:px-5 lg:py-4 bg-cream border-t border-border safe-area-bottom">
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-5 py-3 text-[13px] lg:text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
        >
          View on {dealerName}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function SpecPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="text-muted">{label}</span>
      <span className="text-ink tabular-nums font-medium">{value}</span>
    </div>
  );
}

export default QuickViewContent;
