'use client';

import Link from 'next/link';
import { getAttributionName, getAttributionSchool } from '@/lib/listing/attribution';
import { getValidatedCertInfo } from '@/lib/cert/validation';
import { generateArtisanSlug } from '@/lib/artisan/slugs';
import type { EnrichedListingDetail } from '@/lib/listing/getListingDetail';

const ITEM_TYPE_LABELS: Record<string, string> = {
  katana: 'Katana', wakizashi: 'Wakizashi', tanto: 'Tantō', tachi: 'Tachi',
  kodachi: 'Kodachi', naginata: 'Naginata', yari: 'Yari', ken: 'Ken',
  tsuba: 'Tsuba', menuki: 'Menuki', kozuka: 'Kozuka', kogai: 'Kōgai',
  fuchi_kashira: 'Fuchi-Kashira', koshirae: 'Koshirae',
  daisho: 'Daishō', 'naginata naoshi': 'Naginata-Naoshi',
};

const MEI_TYPE_LABELS: Record<string, string> = {
  zaimei: 'Signed (在銘)',
  mumei: 'Unsigned (無銘)',
  gakumei: 'Inlaid Signature (額銘)',
  orikaeshi_mei: 'Folded Signature (折返銘)',
  suriage_mei: 'Shortened Signature (磨上銘)',
  kinzogan_mei: 'Gold Inlay Signature (金象嵌銘)',
};

function getCertColorClass(tier: string): string {
  switch (tier) {
    case 'tokuju': return 'text-[var(--sc-tokuju)] bg-[var(--sc-tokuju)]/15';
    case 'jubi': return 'text-[var(--sc-jubi)] bg-[var(--sc-jubi)]/15';
    case 'juyo': return 'text-[var(--sc-juyo)] bg-[var(--sc-juyo)]/15';
    case 'tokuho': return 'text-[var(--sc-tokuho)] bg-[var(--sc-tokuho)]/15';
    case 'hozon': return 'text-[var(--sc-hozon)] bg-[var(--sc-hozon)]/15';
    default: return 'text-[var(--sc-text-secondary)] bg-white/5';
  }
}

interface ShowcaseIdentityCardProps {
  listing: EnrichedListingDetail;
}

/**
 * Museum placard — centered card showing item identity.
 * Warm dark card on the dark background.
 */
export function ShowcaseIdentityCard({ listing }: ShowcaseIdentityCardProps) {
  const certInfo = getValidatedCertInfo(listing);
  const artisanName = listing.artisan_display_name || getAttributionName(listing);
  const school = getAttributionSchool(listing);
  const era = listing.era || listing.tosogu_era;
  const itemType = listing.item_type ? (ITEM_TYPE_LABELS[listing.item_type.toLowerCase()] || listing.item_type) : null;

  // Measurements grid — only non-null values
  const measurements: Array<{ label: string; value: string }> = [];
  if (listing.nagasa_cm) measurements.push({ label: 'Nagasa', value: `${listing.nagasa_cm} cm` });
  if (listing.sori_cm) measurements.push({ label: 'Sori', value: `${listing.sori_cm} cm` });
  if (listing.motohaba_cm) measurements.push({ label: 'Motohaba', value: `${listing.motohaba_cm} cm` });
  if (listing.sakihaba_cm) measurements.push({ label: 'Sakihaba', value: `${listing.sakihaba_cm} cm` });
  if (listing.kasane_cm) measurements.push({ label: 'Kasane', value: `${listing.kasane_cm} cm` });
  if (listing.weight_g) measurements.push({ label: 'Weight', value: `${listing.weight_g} g` });

  const meiLabel = listing.mei_type ? (MEI_TYPE_LABELS[listing.mei_type] || listing.mei_type) : null;

  return (
    <div className="max-w-2xl mx-auto px-6 md:px-0">
      <div className="bg-[var(--sc-bg-card)] border border-[var(--sc-border)] rounded-lg p-8 md:p-12 text-center">
        {/* Item type */}
        {itemType && (
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--sc-accent-gold)] mb-6">
            {itemType}
          </p>
        )}

        {/* Gold rule divider */}
        <div className="w-10 h-[2px] bg-[var(--sc-accent-gold)] mx-auto mb-6" />

        {/* Attribution */}
        {artisanName && (
          <div className="mb-4">
            <p className="text-[13px] text-[var(--sc-text-secondary)] mb-1">Attributed to</p>
            <h2 className="text-xl md:text-2xl font-serif text-[var(--sc-text-heading)]">
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
              <p className="text-[15px] text-[var(--sc-text-secondary)] mt-1">
                {listing.artisan_name_kanji}
              </p>
            )}
          </div>
        )}

        {/* School / Era / Province line */}
        {(school || era || listing.province) && (
          <p className="text-[13px] text-[var(--sc-text-secondary)] mb-6">
            {[school, era, listing.province].filter(Boolean).join(' \u00B7 ')}
          </p>
        )}

        {/* Measurements grid */}
        {measurements.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 text-left">
            {measurements.map(m => (
              <div key={m.label}>
                <p className="text-[11px] uppercase tracking-wider text-[var(--sc-text-secondary)]">{m.label}</p>
                <p className="text-[14px] text-[var(--sc-text-primary)] tabular-nums">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mei type */}
        {meiLabel && (
          <p className="text-[13px] text-[var(--sc-text-secondary)] mb-6">
            {meiLabel}
            {listing.mei_text && (
              <span className="ml-2 text-[var(--sc-text-primary)]">{listing.mei_text}</span>
            )}
          </p>
        )}

        {/* Cert badge */}
        {certInfo && (
          <div className="inline-block">
            <span className={`inline-block text-[12px] uppercase tracking-wider font-medium px-4 py-2 rounded ${getCertColorClass(certInfo.tier)}`}>
              {certInfo.label}
              {listing.cert_session && (
                <span className="ml-2 opacity-70">
                  {listing.cert_session}
                  {listing.cert_organization === 'NBTHK' ? 'th Session' : ''}
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
