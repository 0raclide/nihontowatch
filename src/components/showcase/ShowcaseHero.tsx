'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getAttributionName, getAttributionSchool } from '@/lib/listing/attribution';
import { getValidatedCertInfo } from '@/lib/cert/validation';
import { getOrdinalSuffix } from '@/lib/text/ordinal';
import { generateArtisanSlug } from '@/lib/artisan/slugs';
import { getHeroImage } from '@/lib/images/classification';
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

function getCertTextClass(tier: string): string {
  switch (tier) {
    case 'tokuju': return 'text-tokuju';
    case 'jubi': return 'text-jubi';
    case 'juyo': return 'text-juyo';
    case 'tokuho': return 'text-toku-hozon';
    case 'hozon': return 'text-hozon';
    default: return 'text-muted';
  }
}

interface ShowcaseHeroProps {
  listing: EnrichedListingDetail;
  onImageClick?: (url: string) => void;
}

/**
 * Two-column hero: image left, metadata right.
 * Matches artist page's museum-catalog pattern — gold accent bar,
 * elegant cert text under image, sentence-case metadata labels.
 */
export function ShowcaseHero({ listing, onImageClick }: ShowcaseHeroProps) {
  const heroImage = getHeroImage(listing);
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

  // Cert caption under image (artist-page figcaption style)
  const certCaption = certInfo ? (
    <figcaption className="mt-2.5 text-center">
      <div className={`text-[10px] uppercase tracking-[0.15em] font-medium ${getCertTextClass(certInfo.tier)}`}>
        {certInfo.label}
      </div>
      {listing.cert_session && (
        <div className="text-[10px] text-ink/25 tabular-nums mt-0.5">
          {getOrdinalSuffix(parseInt(listing.cert_session, 10))} Session
        </div>
      )}
    </figcaption>
  ) : null;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-12 md:pt-16 md:pb-16">
      {/* Mobile title above image */}
      <div className="md:hidden mb-6">
        <div className="w-8 h-[2px] bg-gold/50 mb-3" />
        {itemType && (
          <p className="text-[11px] uppercase tracking-[0.18em] text-gold/50 mb-3">
            {itemType}
          </p>
        )}
        {artisanName && (
          <h1 className="text-2xl font-serif font-light text-ink leading-[1.1] tracking-tight">
            {listing.artisan_id && listing.artisan_display_name ? (
              <Link
                href={`/artists/${generateArtisanSlug(listing.artisan_display_name, listing.artisan_id)}`}
                className="hover:text-gold transition-colors"
              >
                {artisanName}
              </Link>
            ) : (
              artisanName
            )}
          </h1>
        )}
        {listing.artisan_name_kanji && (
          <p className="text-base text-ink/35 font-serif font-light mt-1 tracking-[0.08em]">
            {listing.artisan_name_kanji}
          </p>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-start gap-8 lg:gap-12">
        {/* Image — left column */}
        <div className="w-full md:w-[400px] lg:w-[500px] flex-shrink-0">
          <figure>
            {heroImage ? (
              <button
                onClick={() => onImageClick?.(heroImage)}
                className="relative w-full aspect-[3/4] rounded overflow-hidden cursor-zoom-in group border border-border"
              >
                <Image
                  src={heroImage}
                  alt={listing.title}
                  fill
                  className="object-contain bg-surface-elevated group-hover:scale-[1.01] transition-transform duration-300"
                  sizes="(max-width: 768px) 100vw, 500px"
                  priority
                />
              </button>
            ) : (
              <div className="w-full aspect-[3/4] rounded bg-surface-elevated border border-border" />
            )}
            {certCaption}
          </figure>
        </div>

        {/* Metadata — right column */}
        <div className="flex-1 min-w-0 pt-0 md:pt-2">
          {/* Desktop title */}
          <div className="hidden md:block mb-8">
            <div className="w-10 h-[2px] bg-gold/50 mb-4" />
            {itemType && (
              <p className="text-[11px] uppercase tracking-[0.18em] text-gold/50 mb-3">
                {itemType}
              </p>
            )}
            {artisanName && (
              <h1 className="text-[2.5rem] font-serif font-light text-ink leading-[1.1] tracking-tight">
                {listing.artisan_id && listing.artisan_display_name ? (
                  <Link
                    href={`/artists/${generateArtisanSlug(listing.artisan_display_name, listing.artisan_id)}`}
                    className="hover:text-gold transition-colors"
                  >
                    {artisanName}
                  </Link>
                ) : (
                  artisanName
                )}
              </h1>
            )}
            {listing.artisan_name_kanji && (
              <p className="text-lg text-ink/35 font-serif font-light mt-1.5 tracking-[0.08em]">
                {listing.artisan_name_kanji}
              </p>
            )}
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-[auto_1fr] gap-x-3 sm:gap-x-6 gap-y-1 sm:gap-y-1.5 text-[12px] sm:text-[13px] leading-snug">
            {school && (
              <>
                <span className="text-ink/50">School</span>
                <span className="text-ink">{school}</span>
              </>
            )}
            {era && (
              <>
                <span className="text-ink/50">Period</span>
                <span className="text-ink">{era}</span>
              </>
            )}
            {listing.province && (
              <>
                <span className="text-ink/50">Province</span>
                <span className="text-ink">{listing.province}</span>
              </>
            )}
            {meiLabel && (
              <>
                <span className="text-ink/50">Signature</span>
                <span className="text-ink">
                  {meiLabel}
                  {listing.mei_text && (
                    <span className="ml-2 text-ink/40">{listing.mei_text}</span>
                  )}
                </span>
              </>
            )}
            {measurements.map(m => (
              <React.Fragment key={m.label}>
                <span className="text-ink/50">{m.label}</span>
                <span className="text-ink tabular-nums">{m.value}</span>
              </React.Fragment>
            ))}
          </div>

          {/* Description */}
          {listing.description && (
            <div className="border-t border-border-subtle pt-5 mt-6">
              <p className="text-[13px] leading-[1.8] text-charcoal font-light">
                {listing.description_en || listing.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
