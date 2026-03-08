'use client';

import Image from 'next/image';
import Link from 'next/link';
import { generateArtisanSlug } from '@/lib/artisan/slugs';
import type { KoshiraeData, KoshiraeComponentEntry } from '@/types';

const COMPONENT_LABELS: Record<string, string> = {
  tsuba: 'Tsuba',
  menuki: 'Menuki',
  fuchi_kashira: 'Fuchi-Kashira',
  kozuka: 'Kozuka',
  kogai: 'Kōgai',
  other: 'Fitting',
};

function getCertColorClass(certType: string): string {
  const lower = certType.toLowerCase();
  if (lower.includes('tokubetsu juyo') || lower === 'tokuju') return 'text-[var(--sc-tokuju)] bg-[var(--sc-tokuju)]/15';
  if (lower.includes('juyo')) return 'text-[var(--sc-juyo)] bg-[var(--sc-juyo)]/15';
  if (lower.includes('tokubetsu hozon')) return 'text-[var(--sc-tokuho)] bg-[var(--sc-tokuho)]/15';
  if (lower.includes('hozon')) return 'text-[var(--sc-hozon)] bg-[var(--sc-hozon)]/15';
  return 'text-[var(--sc-text-secondary)] bg-white/5';
}

interface ShowcaseKoshiraeProps {
  koshirae: KoshiraeData;
  onImageClick: (url: string) => void;
}

/**
 * Koshirae (mountings) section.
 * Shows koshirae images, cert if separate, and maker attributions.
 */
export function ShowcaseKoshirae({ koshirae, onImageClick }: ShowcaseKoshiraeProps) {
  const isSingleMaker = !!koshirae.artisan_id;
  const hasComponents = koshirae.components && koshirae.components.length > 0;
  const hasCert = koshirae.cert_type && !koshirae.cert_in_blade_paper;

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-0">
      {/* Koshirae images */}
      {koshirae.images && koshirae.images.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-4 mb-8 snap-x">
          {koshirae.images.map((url, i) => (
            <button
              key={i}
              onClick={() => onImageClick(url)}
              className="relative flex-shrink-0 w-64 md:w-80 aspect-[4/3] rounded-lg overflow-hidden group"
            >
              <Image
                src={url}
                alt={`Koshirae image ${i + 1}`}
                fill
                className="object-contain bg-[var(--sc-bg-card)] group-hover:scale-[1.02] transition-transform duration-300"
                sizes="(max-width: 768px) 256px, 320px"
              />
            </button>
          ))}
        </div>
      )}

      {/* Cert badge for separate koshirae cert */}
      {hasCert && (
        <div className="text-center mb-6">
          <span className={`inline-block text-[11px] uppercase tracking-wider font-medium px-3 py-1.5 rounded ${getCertColorClass(koshirae.cert_type!)}`}>
            {koshirae.cert_type}
            {koshirae.cert_session && (
              <span className="ml-2 opacity-70">{koshirae.cert_session}th Session</span>
            )}
          </span>
        </div>
      )}

      {/* Single maker (issaku) */}
      {isSingleMaker && koshirae.artisan_name && (
        <div className="text-center mb-8">
          <p className="text-[13px] text-[var(--sc-text-secondary)] mb-1">All fittings by</p>
          <p className="text-lg font-serif text-[var(--sc-text-heading)]">
            {koshirae.artisan_id ? (
              <Link
                href={`/artists/${generateArtisanSlug(koshirae.artisan_name, koshirae.artisan_id)}`}
                className="hover:text-[var(--sc-accent-gold)] transition-colors"
              >
                {koshirae.artisan_name}
              </Link>
            ) : (
              koshirae.artisan_name
            )}
          </p>
          {koshirae.artisan_kanji && (
            <p className="text-[14px] text-[var(--sc-text-secondary)] mt-1">
              {koshirae.artisan_kanji}
            </p>
          )}
        </div>
      )}

      {/* Multi-maker component cards */}
      {hasComponents && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {koshirae.components.map((comp: KoshiraeComponentEntry) => (
            <div
              key={comp.id}
              className="p-4 rounded-lg bg-[var(--sc-bg-card)] border border-[var(--sc-border)]"
            >
              <p className="text-[11px] uppercase tracking-[0.15em] text-[var(--sc-accent-gold)] mb-2">
                {COMPONENT_LABELS[comp.component_type] || comp.component_type}
              </p>
              {comp.artisan_name && (
                <p className="text-[14px] font-medium text-[var(--sc-text-primary)]">
                  {comp.artisan_id ? (
                    <Link
                      href={`/artists/${generateArtisanSlug(comp.artisan_name, comp.artisan_id)}`}
                      className="hover:text-[var(--sc-accent-gold)] transition-colors"
                    >
                      {comp.artisan_name}
                    </Link>
                  ) : (
                    comp.artisan_name
                  )}
                </p>
              )}
              {comp.artisan_kanji && (
                <p className="text-[12px] text-[var(--sc-text-secondary)] mt-0.5">
                  {comp.artisan_kanji}
                </p>
              )}
              {comp.description && (
                <p className="text-[12px] text-[var(--sc-text-secondary)]/70 mt-2">
                  {comp.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Koshirae description */}
      {koshirae.description && (
        <p className="text-[14px] text-[var(--sc-text-secondary)] mt-6 leading-relaxed max-w-2xl mx-auto text-center">
          {koshirae.description}
        </p>
      )}

      {/* Koshirae setsumei (if exists) */}
      {(koshirae.setsumei_text_en || koshirae.setsumei_text_ja) && (
        <div className="mt-8 max-w-2xl mx-auto">
          <div className="bg-[var(--sc-bg-document)] rounded-lg p-6 shadow-md">
            <h4 className="text-[11px] uppercase tracking-[0.15em] font-medium text-[var(--sc-text-document)]/60 mb-3">
              Koshirae Setsumei
            </h4>
            <div className="text-[14px] leading-relaxed text-[var(--sc-text-document)] whitespace-pre-wrap">
              {koshirae.setsumei_text_en || koshirae.setsumei_text_ja}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
