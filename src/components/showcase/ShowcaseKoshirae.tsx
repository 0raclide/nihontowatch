'use client';

import Image from 'next/image';
import Link from 'next/link';
import { HighlightedMarkdown } from '@/components/glossary/HighlightedMarkdown';
import { getOrdinalSuffix } from '@/lib/text/ordinal';
import { generateArtisanSlug } from '@/lib/artisan/slugs';
import type { KoshiraeData, KoshiraeComponentEntry } from '@/types';

const COMPONENT_LABELS: Record<string, string> = {
  tsuba: 'Tsuba',
  menuki: 'Menuki',
  fuchi_kashira: 'Fuchi-Kashira',
  kozuka: 'Kozuka',
  kogai: 'K\u014Dgai',
  other: 'Fitting',
};

function getCertColorClass(certType: string): string {
  const lower = certType.toLowerCase();
  if (lower.includes('tokubetsu juyo') || lower === 'tokuju') return 'text-[var(--sc-tokuju)] bg-[var(--sc-tokuju)]/12';
  if (lower.includes('juyo')) return 'text-[var(--sc-juyo)] bg-[var(--sc-juyo)]/12';
  if (lower.includes('tokubetsu hozon')) return 'text-[var(--sc-tokuho)] bg-[var(--sc-tokuho)]/12';
  if (lower.includes('hozon')) return 'text-[var(--sc-hozon)] bg-[var(--sc-hozon)]/12';
  return 'text-[var(--sc-text-secondary)] bg-white/5';
}

interface ShowcaseKoshiraeProps {
  koshirae: KoshiraeData;
  onImageClick: (url: string) => void;
}

/**
 * Koshirae (mountings) section.
 * Shows koshirae images, cert if separate, and maker attributions.
 * Styling refined to match artist page patterns.
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
              className="relative flex-shrink-0 w-64 md:w-80 aspect-[4/3] rounded overflow-hidden group cursor-zoom-in"
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
        <div className="text-center mb-8">
          <span className={`inline-block text-[11px] uppercase tracking-[0.15em] font-medium px-3.5 py-1.5 rounded ${getCertColorClass(koshirae.cert_type!)}`}>
            {koshirae.cert_type}
            {koshirae.cert_session && (
              <span className="ml-2 opacity-60">{getOrdinalSuffix(koshirae.cert_session)} Session</span>
            )}
          </span>
        </div>
      )}

      {/* Single maker (issaku) */}
      {isSingleMaker && koshirae.artisan_name && (
        <div className="text-center mb-8">
          <p className="text-[12px] text-[var(--sc-text-muted)] mb-1 tracking-wide">All fittings by</p>
          <p className="text-lg font-serif font-light text-[var(--sc-text-heading)] leading-[1.1]">
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
            <p className="text-[13px] text-[var(--sc-text-muted)] mt-1 font-serif font-light tracking-[0.08em]">
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
              className="py-4 border-b md:border-b-0 md:border-r border-[var(--sc-divider)] last:border-0 md:px-5 md:first:pl-0 md:last:pr-0"
            >
              <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--sc-accent-gold-muted)] mb-1.5">
                {COMPONENT_LABELS[comp.component_type] || comp.component_type}
              </p>
              {comp.artisan_name && (
                <p className="text-[14px] font-medium text-[var(--sc-text-primary)] leading-snug">
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
                <p className="text-[11px] text-[var(--sc-text-muted)] mt-0.5">
                  {comp.artisan_kanji}
                </p>
              )}
              {comp.description && (
                <p className="text-[11px] text-[var(--sc-text-muted)] mt-2 leading-relaxed">
                  {comp.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Koshirae description */}
      {koshirae.description && (
        <p className="text-[13px] text-[var(--sc-text-secondary)] mt-8 leading-[1.8] max-w-2xl mx-auto text-center font-light">
          {koshirae.description}
        </p>
      )}

      {/* Koshirae setsumei (if exists) */}
      {(koshirae.setsumei_text_en || koshirae.setsumei_text_ja) && (
        <div className="mt-10 max-w-2xl mx-auto">
          <div className="bg-[var(--sc-bg-card)] rounded p-6 border border-[var(--sc-border)]">
            <h4 className="text-[11px] uppercase tracking-[0.15em] font-medium text-[var(--sc-text-muted)] mb-3">
              Koshirae Setsumei
            </h4>
            <div className="prose-translation text-[13px] leading-[1.8] text-[var(--sc-text-primary)] font-light">
              <HighlightedMarkdown content={koshirae.setsumei_text_en || koshirae.setsumei_text_ja!} variant="translation" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
