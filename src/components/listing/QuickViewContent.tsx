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

const CERT_CONFIG: Record<string, { label: string; tier: 'premier' | 'high' | 'standard' }> = {
  Juyo: { label: 'Juyo', tier: 'premier' },
  juyo: { label: 'Juyo', tier: 'premier' },
  'Tokubetsu Juyo': { label: 'Tokubetsu Juyo', tier: 'premier' },
  tokubetsu_juyo: { label: 'Tokubetsu Juyo', tier: 'premier' },
  Tokuju: { label: 'Tokubetsu Juyo', tier: 'premier' },
  tokuju: { label: 'Tokubetsu Juyo', tier: 'premier' },
  'Tokubetsu Hozon': { label: 'Tokubetsu Hozon', tier: 'high' },
  tokubetsu_hozon: { label: 'Tokubetsu Hozon', tier: 'high' },
  TokuHozon: { label: 'Tokubetsu Hozon', tier: 'high' },
  Hozon: { label: 'Hozon', tier: 'standard' },
  hozon: { label: 'Hozon', tier: 'standard' },
  'Juyo Tosogu': { label: 'Juyo Tosogu', tier: 'premier' },
  'Tokubetsu Hozon Tosogu': { label: 'Toku Hozon Tosogu', tier: 'high' },
  'Hozon Tosogu': { label: 'Hozon Tosogu', tier: 'standard' },
  'NTHK Kanteisho': { label: 'NTHK', tier: 'standard' },
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

function getCertTier(certType: string | undefined): { label: string; tier: 'premier' | 'high' | 'standard' } | null {
  if (!certType) return null;
  return CERT_CONFIG[certType] || null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuickViewContent({ listing, onClose }: QuickViewContentProps) {
  const certInfo = getCertTier(listing.cert_type);
  const { artisan, school, artisanLabel } = getArtisanInfo(listing);
  const itemTypeLabel = getItemTypeLabel(listing.item_type);
  const dealerName = listing.dealer?.name || 'Dealer';
  const isSword = isBlade(listing.item_type);
  const isTosoguItem = isTosogu(listing.item_type);

  // Determine what specs to show based on item type
  const hasSwordSpecs = isSword && (
    listing.nagasa_cm || listing.sori_cm || listing.motohaba_cm ||
    listing.sakihaba_cm || listing.kasane_cm || listing.nakago_cm || listing.weight_g
  );

  const hasTosoguSpecs = isTosoguItem && (
    listing.height_cm || listing.width_cm || listing.thickness_mm || listing.material
  );

  return (
    <div className="flex flex-col h-full max-h-[calc(85vh-60px)]">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 lg:px-6">
        {/* Header: Cert Badge + Item Type + Favorite */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Certification Badge */}
            {certInfo && (
              <span
                className={`text-[10px] lg:text-[11px] uppercase tracking-wider font-medium px-2 py-1 rounded ${
                  certInfo.tier === 'premier'
                    ? 'bg-juyo-bg text-juyo'
                    : certInfo.tier === 'high'
                    ? 'bg-toku-hozon-bg text-toku-hozon'
                    : 'bg-hozon-bg text-hozon'
                }`}
              >
                {certInfo.label}
              </span>
            )}
            {/* Item Type */}
            <span className="text-[11px] lg:text-[12px] text-muted uppercase tracking-wide">
              {itemTypeLabel}
            </span>
          </div>

          {/* Favorite Button */}
          <FavoriteButton listingId={listing.id} size="sm" />
        </div>

        {/* Title */}
        <h2 className="font-serif text-xl lg:text-2xl text-ink leading-tight mb-4">
          {listing.title}
        </h2>

        {/* Price + Dealer Row */}
        <div className="flex items-center justify-between gap-4 pb-4 mb-4 border-b border-border">
          <span className={`text-xl lg:text-2xl tabular-nums font-semibold ${
            listing.price_value ? 'text-ink' : 'text-muted'
          }`}>
            {formatPrice(listing.price_value, listing.price_currency)}
          </span>
          <span className="text-[12px] lg:text-[13px] text-muted truncate">
            {listing.dealer?.domain || dealerName}
          </span>
        </div>

        {/* Artisan & School */}
        {(artisan || school) && (
          <div className="mb-4 pb-4 border-b border-border">
            {artisan && (
              <div className="mb-2">
                <span className="text-[10px] lg:text-[11px] uppercase tracking-wider text-muted block mb-0.5">
                  {artisanLabel}
                </span>
                <p className="text-[14px] lg:text-[15px] text-ink font-medium">{artisan}</p>
              </div>
            )}
            {school && (
              <div>
                <span className="text-[10px] lg:text-[11px] uppercase tracking-wider text-muted block mb-0.5">
                  School
                </span>
                <p className="text-[14px] lg:text-[15px] text-ink font-medium">{school}</p>
              </div>
            )}
          </div>
        )}

        {/* Province & Era (swords) */}
        {isSword && (listing.province || listing.era) && (
          <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-border">
            {listing.province && (
              <div>
                <span className="text-[10px] lg:text-[11px] uppercase tracking-wider text-muted block mb-0.5">
                  Province
                </span>
                <p className="text-[14px] lg:text-[15px] text-ink">{listing.province}</p>
              </div>
            )}
            {listing.era && (
              <div>
                <span className="text-[10px] lg:text-[11px] uppercase tracking-wider text-muted block mb-0.5">
                  Era
                </span>
                <p className="text-[14px] lg:text-[15px] text-ink">{listing.era}</p>
              </div>
            )}
          </div>
        )}

        {/* Sword Specifications */}
        {hasSwordSpecs && (
          <div className="mb-4 pb-4 border-b border-border">
            <h3 className="text-[10px] lg:text-[11px] uppercase tracking-wider text-muted mb-3">
              Specifications
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {listing.nagasa_cm && (
                <SpecRow label="Nagasa" value={`${listing.nagasa_cm} cm`} />
              )}
              {listing.sori_cm && (
                <SpecRow label="Sori" value={`${listing.sori_cm} cm`} />
              )}
              {listing.motohaba_cm && (
                <SpecRow label="Motohaba" value={`${listing.motohaba_cm} cm`} />
              )}
              {listing.sakihaba_cm && (
                <SpecRow label="Sakihaba" value={`${listing.sakihaba_cm} cm`} />
              )}
              {listing.kasane_cm && (
                <SpecRow label="Kasane" value={`${listing.kasane_cm} cm`} />
              )}
              {listing.nakago_cm && (
                <SpecRow label="Nakago" value={`${listing.nakago_cm} cm`} />
              )}
              {listing.weight_g && (
                <SpecRow label="Weight" value={`${listing.weight_g} g`} />
              )}
            </div>
          </div>
        )}

        {/* Tosogu Specifications */}
        {hasTosoguSpecs && (
          <div className="mb-4 pb-4 border-b border-border">
            <h3 className="text-[10px] lg:text-[11px] uppercase tracking-wider text-muted mb-3">
              Specifications
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {listing.height_cm && (
                <SpecRow label="Height" value={`${listing.height_cm} cm`} />
              )}
              {listing.width_cm && (
                <SpecRow label="Width" value={`${listing.width_cm} cm`} />
              )}
              {listing.thickness_mm && (
                <SpecRow label="Thickness" value={`${listing.thickness_mm} mm`} />
              )}
              {listing.material && (
                <SpecRow label="Material" value={listing.material} fullWidth />
              )}
            </div>
          </div>
        )}

        {/* Mei Type (if available) */}
        {listing.mei_type && (
          <div className="mb-4">
            <span className="text-[10px] lg:text-[11px] uppercase tracking-wider text-muted block mb-0.5">
              Signature
            </span>
            <p className="text-[14px] lg:text-[15px] text-ink">{listing.mei_type}</p>
          </div>
        )}

        {/* Dealer Info Card */}
        <div className="bg-linen rounded-lg p-3 lg:p-4">
          <span className="text-[10px] lg:text-[11px] uppercase tracking-wider text-muted block mb-1">
            Listed by
          </span>
          <p className="text-[14px] lg:text-[15px] text-ink font-medium">{dealerName}</p>
          {listing.dealer?.domain && (
            <p className="text-[12px] text-muted">{listing.dealer.domain}</p>
          )}
        </div>
      </div>

      {/* Sticky CTA Button */}
      <div className="sticky bottom-0 px-4 py-3 lg:px-6 lg:py-4 bg-cream border-t border-border safe-area-bottom">
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-5 py-3 lg:py-3.5 text-[13px] lg:text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
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

interface SpecRowProps {
  label: string;
  value: string;
  fullWidth?: boolean;
}

function SpecRow({ label, value, fullWidth }: SpecRowProps) {
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <span className="text-[11px] lg:text-[12px] text-muted">{label}</span>
      <p className="text-[13px] lg:text-[14px] text-ink tabular-nums">{value}</p>
    </div>
  );
}

export default QuickViewContent;
