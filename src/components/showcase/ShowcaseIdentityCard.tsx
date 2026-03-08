'use client';

import Link from 'next/link';
import { getAttributionName, getAttributionSchool } from '@/lib/listing/attribution';
import { getValidatedCertInfo } from '@/lib/cert/validation';
import { generateArtisanSlug } from '@/lib/artisan/slugs';
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

interface ShowcaseIdentityCardProps {
  listing: EnrichedListingDetail;
}

/**
 * Museum placard — open centered layout showing item identity.
 * Matches artist page's typography and metadata grid pattern.
 */
export function ShowcaseIdentityCard({ listing }: ShowcaseIdentityCardProps) {
  const certInfo = getValidatedCertInfo(listing);
  const artisanName = listing.artisan_display_name || getAttributionName(listing);
  const school = getAttributionSchool(listing);
  const era = listing.era || listing.tosogu_era;
  const itemType = listing.item_type ? (ITEM_TYPE_LABELS[listing.item_type.toLowerCase()] || listing.item_type) : null;

  // Measurements — only non-null values
  const measurements: Array<{ label: string; value: string }> = [];
  if (listing.nagasa_cm) measurements.push({ label: 'Nagasa', value: `${listing.nagasa_cm} cm` });
  if (listing.sori_cm) measurements.push({ label: 'Sori', value: `${listing.sori_cm} cm` });
  if (listing.motohaba_cm) measurements.push({ label: 'Motohaba', value: `${listing.motohaba_cm} cm` });
  if (listing.sakihaba_cm) measurements.push({ label: 'Sakihaba', value: `${listing.sakihaba_cm} cm` });
  if (listing.kasane_cm) measurements.push({ label: 'Kasane', value: `${listing.kasane_cm} cm` });
  if (listing.weight_g) measurements.push({ label: 'Weight', value: `${listing.weight_g} g` });

  const meiLabel = listing.mei_type ? (MEI_TYPE_LABELS[listing.mei_type] || listing.mei_type) : null;

  return (
    <div className="max-w-[680px] mx-auto px-6 md:px-0 text-center">
      {/* Item type label */}
      {itemType && (
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--sc-accent-gold-muted)] mb-8">
          {itemType}
        </p>
      )}

      {/* Attribution */}
      {artisanName && (
        <div className="mb-6">
          <p className="text-[12px] text-[var(--sc-text-muted)] mb-1.5 tracking-wide">Attributed to</p>
          <h2 className="text-xl md:text-2xl font-serif font-light text-[var(--sc-text-heading)] leading-[1.1] tracking-tight">
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
          </h2>
          {listing.artisan_name_kanji && (
            <p className="text-[14px] text-[var(--sc-text-muted)] mt-1.5 font-serif font-light tracking-[0.08em]">
              {listing.artisan_name_kanji}
            </p>
          )}
        </div>
      )}

      {/* School / Era / Province line */}
      {(school || era || listing.province) && (
        <p className="text-[13px] text-[var(--sc-text-secondary)] mb-8">
          {[school, era, listing.province].filter(Boolean).join(' \u00B7 ')}
        </p>
      )}

      {/* Measurements — matching artist page grid style */}
      {measurements.length > 0 && (
        <div className="inline-grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 mb-8 text-left">
          {measurements.map(m => (
            <div key={m.label} className="flex items-baseline gap-2">
              <span className="text-[11px] uppercase tracking-wider text-[var(--sc-text-muted)]">{m.label}</span>
              <span className="text-[13px] text-[var(--sc-text-primary)] tabular-nums font-light">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Mei type */}
      {meiLabel && (
        <p className="text-[12px] text-[var(--sc-text-secondary)] mb-8">
          {meiLabel}
          {listing.mei_text && (
            <span className="ml-2 text-[var(--sc-text-primary)]">{listing.mei_text}</span>
          )}
        </p>
      )}

      {/* Cert badge */}
      {certInfo && (
        <div className="inline-block">
          <span className={`inline-block text-[11px] uppercase tracking-[0.15em] font-medium px-3.5 py-1.5 rounded ${getCertColorClass(certInfo.tier)}`}>
            {certInfo.label}
            {listing.cert_session && (
              <span className="ml-2 opacity-60">
                {listing.cert_session}
                {listing.cert_organization === 'NBTHK' ? 'th Session' : ''}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
