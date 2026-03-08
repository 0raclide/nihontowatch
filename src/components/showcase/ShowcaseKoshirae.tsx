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
  if (lower.includes('tokubetsu juyo') || lower === 'tokuju') return 'text-tokuju bg-tokuju-bg';
  if (lower.includes('juyo')) return 'text-juyo bg-juyo-bg';
  if (lower.includes('tokubetsu hozon')) return 'text-toku-hozon bg-toku-hozon-bg';
  if (lower.includes('hozon')) return 'text-hozon bg-hozon-bg';
  return 'text-muted bg-surface-elevated';
}

interface ShowcaseKoshiraeProps {
  koshirae: KoshiraeData;
  onImageClick: (url: string) => void;
}

/**
 * Koshirae (mountings) section.
 * Vertical stacked images, cert if separate, maker attributions, setsumei text.
 * Container matches artist page width (780px).
 */
export function ShowcaseKoshirae({ koshirae, onImageClick }: ShowcaseKoshiraeProps) {
  const isSingleMaker = !!koshirae.artisan_id;
  const hasComponents = koshirae.components && koshirae.components.length > 0;
  const hasCert = koshirae.cert_type && !koshirae.cert_in_blade_paper;

  return (
    <div className="max-w-[780px] mx-auto px-4 sm:px-8">
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

      {/* Era / Province / School */}
      {(koshirae.era || koshirae.province || koshirae.school) && (
        <p className="text-center text-[13px] tracking-wide text-muted mb-8">
          {[koshirae.era, koshirae.province, koshirae.school].filter(Boolean).join(' \u00B7 ')}
        </p>
      )}

      {/* Single maker (issaku) */}
      {isSingleMaker && koshirae.artisan_name && (
        <div className="text-center mb-8">
          <p className="text-[13px] text-muted mb-1 tracking-wide">All fittings by</p>
          <p className="text-lg font-serif font-light text-ink leading-[1.1]">
            {koshirae.artisan_id ? (
              <Link
                href={`/artists/${generateArtisanSlug(koshirae.artisan_name, koshirae.artisan_id)}`}
                className="hover:text-gold transition-colors"
              >
                {koshirae.artisan_name}
              </Link>
            ) : (
              koshirae.artisan_name
            )}
          </p>
          {koshirae.artisan_kanji && (
            <p className="text-[14px] text-muted mt-1 font-serif font-light tracking-[0.08em]">
              {koshirae.artisan_kanji}
            </p>
          )}
        </div>
      )}

      {/* Multi-maker component cards */}
      {hasComponents && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {koshirae.components.map((comp: KoshiraeComponentEntry) => (
            <div
              key={comp.id}
              className="py-4 border-b md:border-b-0 md:border-r border-border-subtle last:border-0 md:px-5 md:first:pl-0 md:last:pr-0"
            >
              <p className="text-[11px] uppercase tracking-[0.15em] text-gold/50 mb-1.5">
                {COMPONENT_LABELS[comp.component_type] || comp.component_type}
              </p>
              {comp.artisan_name && (
                <p className="text-[15px] font-medium text-ink leading-snug">
                  {comp.artisan_id ? (
                    <Link
                      href={`/artists/${generateArtisanSlug(comp.artisan_name, comp.artisan_id)}`}
                      className="hover:text-gold transition-colors"
                    >
                      {comp.artisan_name}
                    </Link>
                  ) : (
                    comp.artisan_name
                  )}
                </p>
              )}
              {comp.artisan_kanji && (
                <p className="text-[12px] text-muted mt-0.5">
                  {comp.artisan_kanji}
                </p>
              )}
              {comp.signed && comp.mei_text && (
                <p className="text-[12px] text-charcoal mt-0.5 italic">
                  {comp.mei_text}
                </p>
              )}
              {comp.description && (
                <p className="text-[13px] text-muted mt-2 leading-relaxed">
                  {comp.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Koshirae setsumei (if exists) — clean prose, no box */}
      {(koshirae.setsumei_text_en || koshirae.setsumei_text_ja) && (
        <div className="mb-10">
          <h4 className="text-[13px] uppercase tracking-[0.15em] font-medium text-muted mb-5">
            Koshirae Setsumei
          </h4>
          <div className="prose-translation text-[15px] md:text-[17px] leading-[1.85] font-light max-w-[62ch]">
            <HighlightedMarkdown content={koshirae.setsumei_text_en || koshirae.setsumei_text_ja!} variant="translation" />
          </div>
        </div>
      )}

      {/* Koshirae images — vertical stack, natural height */}
      {koshirae.images && koshirae.images.length > 0 && (
        <div className="space-y-4">
          {koshirae.images.map((url, i) => (
            <button
              key={i}
              onClick={() => onImageClick(url)}
              className="relative w-full rounded overflow-hidden group cursor-zoom-in shadow-sm hover:shadow-md transition-shadow"
            >
              <Image
                src={url}
                alt={`Koshirae image ${i + 1}`}
                width={800}
                height={600}
                className="w-full h-auto object-contain group-hover:scale-[1.02] transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, 780px"
              />
            </button>
          ))}
        </div>
      )}

      {/* Koshirae description */}
      {koshirae.description && (
        <p className="text-[15px] text-charcoal mt-8 leading-[1.8] max-w-[62ch] font-light">
          {koshirae.description}
        </p>
      )}
    </div>
  );
}
