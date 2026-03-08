'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getAttributionName, getAttributionSchool } from '@/lib/listing/attribution';
import { getValidatedCertInfo } from '@/lib/cert/validation';
import { getOrdinalSuffix } from '@/lib/text/ordinal';
import { generateArtisanSlug } from '@/lib/artisan/slugs';
import { getAllImages } from '@/lib/images';
import type { EnrichedListingDetail } from '@/lib/listing/getListingDetail';

const ITEM_TYPE_LABELS: Record<string, string> = {
  katana: 'Katana', wakizashi: 'Wakizashi', tanto: 'Tant\u014D', tachi: 'Tachi',
  kodachi: 'Kodachi', naginata: 'Naginata', yari: 'Yari', ken: 'Ken',
  tsuba: 'Tsuba', menuki: 'Menuki', kozuka: 'Kozuka', kogai: 'K\u014Dgai',
  fuchi_kashira: 'Fuchi-Kashira', koshirae: 'Koshirae',
  daisho: 'Daish\u014D', 'naginata naoshi': 'Naginata-Naoshi',
};

const MEI_TYPE_LABELS: Record<string, string> = {
  zaimei: 'Signed (\u5728\u9298)',
  mumei: 'Unsigned (\u7121\u9298)',
  gakumei: 'Inlaid Signature (\u984D\u9298)',
  orikaeshi_mei: 'Folded Signature (\u6298\u8FD4\u9298)',
  suriage_mei: 'Shortened Signature (\u78E8\u4E0A\u9298)',
  kinzogan_mei: 'Gold Inlay Signature (\u91D1\u8C61\u5D4C\u9298)',
};

function getCertColorClass(tier: string): string {
  switch (tier) {
    case 'tokuju': return 'text-[var(--sc-tokuju)] bg-[var(--sc-tokuju)]/12';
    case 'jubi': return 'text-[var(--sc-jubi)] bg-[var(--sc-jubi)]/12';
    case 'juyo': return 'text-[var(--sc-juyo)] bg-[var(--sc-juyo)]/12';
    case 'tokuho': return 'text-[var(--sc-tokuho)] bg-[var(--sc-tokuho)]/12';
    case 'hozon': return 'text-[var(--sc-hozon)] bg-[var(--sc-hozon)]/12';
    default: return 'text-[var(--sc-text-secondary)] bg-white/5';
  }
}

interface ShowcaseHeroProps {
  listing: EnrichedListingDetail;
  onImageClick?: (url: string) => void;
}

/**
 * Two-column hero: image left, metadata right.
 * Matches artist page's museum-catalog pattern.
 */
export function ShowcaseHero({ listing, onImageClick }: ShowcaseHeroProps) {
  const heroImage = getAllImages(listing)[0];
  const certInfo = getValidatedCertInfo(listing);
  const artisanName = listing.artisan_display_name || getAttributionName(listing);
  const school = getAttributionSchool(listing);
  const era = listing.era || listing.tosogu_era;
  const itemType = listing.item_type ? (ITEM_TYPE_LABELS[listing.item_type.toLowerCase()] || listing.item_type) : null;
  const meiLabel = listing.mei_type ? (MEI_TYPE_LABELS[listing.mei_type] || listing.mei_type) : null;

  // Measurements — only non-null values
  const measurements: Array<{ label: string; value: string }> = [];
  if (listing.nagasa_cm) measurements.push({ label: 'Nagasa', value: `${listing.nagasa_cm} cm` });
  if (listing.sori_cm) measurements.push({ label: 'Sori', value: `${listing.sori_cm} cm` });
  if (listing.motohaba_cm) measurements.push({ label: 'Motohaba', value: `${listing.motohaba_cm} cm` });
  if (listing.sakihaba_cm) measurements.push({ label: 'Sakihaba', value: `${listing.sakihaba_cm} cm` });
  if (listing.kasane_cm) measurements.push({ label: 'Kasane', value: `${listing.kasane_cm} cm` });
  if (listing.weight_g) measurements.push({ label: 'Weight', value: `${listing.weight_g} g` });

  const eliteFactor = listing.artisan_elite_factor;
  const totalItems = listing.artisan_total_items;
  const elitePercentile = listing.artisan_elite_percentile;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-12 md:pt-16 md:pb-16">
      {/* Mobile title above image */}
      <div className="md:hidden mb-6">
        {itemType && (
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--sc-accent-gold-muted)] mb-3">
            {itemType}
          </p>
        )}
        {artisanName && (
          <h1 className="text-2xl font-serif font-light text-[var(--sc-text-heading)] leading-[1.1] tracking-tight">
            {listing.artisan_id && listing.artisan_display_name ? (
              <Link
                href={`/artists/${generateArtisanSlug(listing.artisan_display_name, listing.artisan_id)}`}
                className="hover:text-[var(--sc-accent-gold)] transition-colors"
              >
                {artisanName}
              </Link>
            ) : (
              artisanName
            )}
          </h1>
        )}
        {listing.artisan_name_kanji && (
          <p className="text-[14px] text-[var(--sc-text-muted)] mt-1.5 font-serif font-light tracking-[0.08em]">
            {listing.artisan_name_kanji}
          </p>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-start gap-8 lg:gap-12">
        {/* Image — left column */}
        <div className="w-full md:w-[400px] lg:w-[500px] flex-shrink-0">
          {heroImage ? (
            <button
              onClick={() => onImageClick?.(heroImage)}
              className="relative w-full aspect-[3/4] rounded overflow-hidden cursor-zoom-in group border border-[var(--sc-border)]"
            >
              <Image
                src={heroImage}
                alt={listing.title}
                fill
                className="object-contain bg-[var(--sc-bg-card)] group-hover:scale-[1.01] transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, 500px"
                priority
              />
            </button>
          ) : (
            <div className="w-full aspect-[3/4] rounded bg-[var(--sc-bg-card)] border border-[var(--sc-border)]" />
          )}
        </div>

        {/* Metadata — right column */}
        <div className="flex-1 min-w-0 pt-0 md:pt-2">
          {/* Desktop title */}
          <div className="hidden md:block mb-8">
            {itemType && (
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--sc-accent-gold-muted)] mb-3">
                {itemType}
              </p>
            )}
            {artisanName && (
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-serif font-light text-[var(--sc-text-heading)] leading-[1.1] tracking-tight">
                {listing.artisan_id && listing.artisan_display_name ? (
                  <Link
                    href={`/artists/${generateArtisanSlug(listing.artisan_display_name, listing.artisan_id)}`}
                    className="hover:text-[var(--sc-accent-gold)] transition-colors"
                  >
                    {artisanName}
                  </Link>
                ) : (
                  artisanName
                )}
              </h1>
            )}
            {listing.artisan_name_kanji && (
              <p className="text-[14px] text-[var(--sc-text-muted)] mt-2 font-serif font-light tracking-[0.08em]">
                {listing.artisan_name_kanji}
              </p>
            )}
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-[auto_1fr] gap-x-3 sm:gap-x-6 gap-y-1 sm:gap-y-1.5 mb-6">
            {school && (
              <>
                <span className="text-[11px] uppercase tracking-wider text-[var(--sc-text-muted)]">School</span>
                <span className="text-[13px] text-[var(--sc-text-primary)] font-light">{school}</span>
              </>
            )}
            {era && (
              <>
                <span className="text-[11px] uppercase tracking-wider text-[var(--sc-text-muted)]">Period</span>
                <span className="text-[13px] text-[var(--sc-text-primary)] font-light">{era}</span>
              </>
            )}
            {listing.province && (
              <>
                <span className="text-[11px] uppercase tracking-wider text-[var(--sc-text-muted)]">Province</span>
                <span className="text-[13px] text-[var(--sc-text-primary)] font-light">{listing.province}</span>
              </>
            )}
            {meiLabel && (
              <>
                <span className="text-[11px] uppercase tracking-wider text-[var(--sc-text-muted)]">Signature</span>
                <span className="text-[13px] text-[var(--sc-text-primary)] font-light">
                  {meiLabel}
                  {listing.mei_text && (
                    <span className="ml-2 text-[var(--sc-text-secondary)]">{listing.mei_text}</span>
                  )}
                </span>
              </>
            )}
            {measurements.map(m => (
              <React.Fragment key={m.label}>
                <span className="text-[11px] uppercase tracking-wider text-[var(--sc-text-muted)]">{m.label}</span>
                <span className="text-[13px] text-[var(--sc-text-primary)] tabular-nums font-light">{m.value}</span>
              </React.Fragment>
            ))}
          </div>

          {/* Cert badge */}
          {certInfo && (
            <div className="mb-6">
              <span className={`inline-block text-[11px] uppercase tracking-[0.15em] font-medium px-3.5 py-1.5 rounded ${getCertColorClass(certInfo.tier)}`}>
                {certInfo.label}
                {listing.cert_session && (
                  <span className="ml-2 opacity-60">
                    {getOrdinalSuffix(parseInt(listing.cert_session, 10))} Session
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Elite factor bar */}
          {eliteFactor !== undefined && eliteFactor > 0 && totalItems !== undefined && totalItems > 0 && (
            <div className="border-t border-[var(--sc-divider)] pt-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider text-[var(--sc-text-muted)]">
                  Designation Factor
                </span>
                <span className="text-[13px] text-[var(--sc-text-primary)] tabular-nums font-light">
                  {eliteFactor.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[var(--sc-bg-card)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--sc-accent-gold)] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((eliteFactor / 2.0) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-[var(--sc-text-muted)] mt-1.5">
                {eliteFactor.toFixed(2)} across {totalItems} designated work{totalItems !== 1 ? 's' : ''}
                {elitePercentile !== undefined && (
                  <span className="ml-1">
                    &middot; Top {100 - elitePercentile}%
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Description */}
          {listing.description && (
            <div className="border-t border-[var(--sc-divider)] pt-5">
              <p className="text-[13px] leading-[1.8] text-[var(--sc-text-secondary)] font-light">
                {listing.description_en || listing.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
