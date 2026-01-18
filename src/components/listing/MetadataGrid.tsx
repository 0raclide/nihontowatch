'use client';

import type { Listing } from '@/types';
import { isBlade, isTosogu } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface MetadataGridProps {
  listing: Listing;
  variant?: 'full' | 'compact';
  className?: string;
  showAttribution?: boolean;
  showMeasurements?: boolean;
  hideArtisan?: boolean; // Hide smith/maker (shown elsewhere)
  hideSchool?: boolean;  // Hide school (shown elsewhere)
}

interface MetadataItemProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  fullWidth?: boolean;
}

// =============================================================================
// CERTIFICATION CONFIG
// =============================================================================

export const CERT_CONFIG: Record<string, { label: string; shortLabel: string; tier: 'premier' | 'high' | 'standard' }> = {
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

export function getArtisanInfo(listing: Listing): {
  artisan: string | null;
  school: string | null;
  artisanLabel: string;
} {
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

export function getCertInfo(certType: string | undefined): {
  label: string;
  shortLabel: string;
  tier: 'premier' | 'high' | 'standard';
} | null {
  if (!certType) return null;
  return CERT_CONFIG[certType] || null;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function MetadataItem({ label, value, unit, fullWidth }: MetadataItemProps) {
  if (value === null || value === undefined) return null;

  const displayValue = unit ? `${value}${unit}` : value;

  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">
        {label}
      </span>
      <p className="text-[13px] text-ink">{displayValue}</p>
    </div>
  );
}

function MeasurementItem({ label, value, unit }: { label: string; value: number | string | null | undefined; unit: string }) {
  if (!value && value !== 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="text-ink tabular-nums font-medium">{value}{unit}</span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function MetadataGrid({
  listing,
  variant = 'full',
  className = '',
  showAttribution = true,
  showMeasurements = true,
  hideArtisan = false,
  hideSchool = false,
}: MetadataGridProps) {
  const { artisan, school, artisanLabel } = getArtisanInfo(listing);
  const certInfo = getCertInfo(listing.cert_type);
  const itemIsBlade = isBlade(listing.item_type);
  const itemIsTosogu = isTosogu(listing.item_type);

  // Check for available measurements
  // Note: nakago_cm, height_cm, width_cm, thickness_mm, material don't exist in DB yet
  const hasSwordMeasurements = itemIsBlade && (
    listing.nagasa_cm || listing.sori_cm || listing.motohaba_cm ||
    listing.sakihaba_cm || listing.kasane_cm || listing.weight_g
  );
  // Tosogu measurements not yet available in database
  const hasMeasurements = hasSwordMeasurements;

  // Check for attribution data (excluding hidden fields)
  const displayArtisan = !hideArtisan && artisan;
  const displaySchool = !hideSchool && school;
  const hasAttribution = displayArtisan || displaySchool || listing.era || listing.province || listing.mei_type || certInfo;

  if (variant === 'compact') {
    // Compact variant: single row of key measurements
    return (
      <div className={`flex flex-wrap gap-x-4 gap-y-1 ${className}`}>
        {itemIsBlade && listing.nagasa_cm && (
          <MeasurementItem label="Nagasa" value={listing.nagasa_cm} unit="cm" />
        )}
        {/* Tosogu compact measurements - columns not yet in database */}
      </div>
    );
  }

  // Full variant: complete metadata grid
  return (
    <div className={className}>
      {/* Attribution Section */}
      {showAttribution && hasAttribution && (
        <div className="border-b border-border">
          <div className="px-4 py-3 lg:px-5">
            {/* School + Artisan combined (e.g., "Osafune Tomomitsu") */}
            {(displayArtisan || displaySchool) && (
              <p className="text-[15px] text-ink font-medium mb-3">
                {displaySchool && school}
                {displaySchool && displayArtisan && ' '}
                {displayArtisan && artisan}
              </p>
            )}

            {/* Era / Province / Signature in a clean row */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
              {listing.era && (
                <span className="text-ink">{listing.era}</span>
              )}
              {listing.province && (
                <span className="text-ink">{listing.province}</span>
              )}
              {listing.mei_type && (
                <span className="text-muted">{listing.mei_type}</span>
              )}
            </div>

            {/* Papers on its own line if present */}
            {certInfo && (
              <p className="text-[13px] text-ink mt-2">
                {certInfo.label}
                {listing.cert_session && <span className="text-muted"> #{listing.cert_session}</span>}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Measurements Section */}
      {showMeasurements && hasMeasurements && (
        <div className="border-b border-border">
          <div className="px-4 py-3 lg:px-5">
            <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2 font-medium">
              {itemIsTosogu ? 'Specifications' : 'Measurements'}
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {/* Sword measurements */}
              {itemIsBlade && (
                <>
                  <MeasurementItem label="Nagasa" value={listing.nagasa_cm} unit="cm" />
                  <MeasurementItem label="Sori" value={listing.sori_cm} unit="cm" />
                  <MeasurementItem label="Motohaba" value={listing.motohaba_cm} unit="cm" />
                  <MeasurementItem label="Sakihaba" value={listing.sakihaba_cm} unit="cm" />
                  <MeasurementItem label="Kasane" value={listing.kasane_cm} unit="cm" />
                  <MeasurementItem label="Weight" value={listing.weight_g} unit="g" />
                </>
              )}

              {/* Tosogu measurements - columns not yet in database */}
              {/* TODO: Add when height_cm, width_cm, thickness_mm, material columns exist */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MetadataGrid;
