'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import type { ProvenanceEntry } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';

interface ProvenanceDisplayProps {
  provenance: ProvenanceEntry[];
  onImageClick?: (url: string) => void;
}

export function ProvenanceDisplay({ provenance, onImageClick }: ProvenanceDisplayProps) {
  const { t } = useLocale();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!provenance || provenance.length === 0) return null;

  const handleImageClick = (url: string) => {
    if (onImageClick) {
      onImageClick(url);
    } else {
      setLightboxUrl(url);
    }
  };

  return (
    <>
      <div className="px-4 py-3 lg:px-5 border-b border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-3">
          {t('dealer.provenance')}
        </div>

        {/* Timeline container */}
        <div className="relative">
          {/* The golden thread — vertical line */}
          <div
            className="absolute left-[19px] lg:left-[23px] top-0 bottom-0 w-[1.5px]"
            style={{
              background: 'linear-gradient(to bottom, transparent 0%, var(--gold) 6%, var(--gold) 94%, transparent 100%)',
              opacity: 0.5,
            }}
          />

          <div>
            {provenance.map((entry, i) => {
              const hasPortrait = entry.images && entry.images.length > 0;
              const portraitUrl = hasPortrait ? entry.images[0] : null;
              const documentImages = hasPortrait ? entry.images.slice(1) : [];
              const isLast = i === provenance.length - 1;

              return (
                <div key={entry.id || i}>
                  {/* Entry row */}
                  <div className="relative flex items-center gap-3">
                    {/* Node: portrait circle or gold dot */}
                    <div className="relative z-10 flex-shrink-0">
                      {portraitUrl ? (
                        <button
                          type="button"
                          onClick={() => handleImageClick(portraitUrl)}
                          className="relative w-[40px] h-[40px] lg:w-[48px] lg:h-[48px] rounded-full overflow-hidden ring-[1.5px] ring-gold/50 hover:ring-gold/80 transition-all shadow-sm"
                        >
                          <Image
                            src={portraitUrl}
                            alt={entry.owner_name}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        </button>
                      ) : (
                        <div className="w-[40px] h-[40px] lg:w-[48px] lg:h-[48px] flex items-center justify-center">
                          <div
                            className="w-[9px] h-[9px] rounded-full border-[1.5px] shadow-sm"
                            style={{
                              borderColor: 'var(--gold)',
                              backgroundColor: 'color-mix(in srgb, var(--gold) 25%, transparent)',
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Name + kanji — vertically centered with portrait */}
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-ink">
                        {entry.owner_name}
                      </span>
                      {entry.owner_name_ja && (
                        <span className="ml-2 text-[12px] text-muted/80 font-normal">
                          {entry.owner_name_ja}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Notes + document images — indented to align with text */}
                  {(entry.notes || documentImages.length > 0) && (
                    <div className="ml-[52px] lg:ml-[60px] mt-1">
                      {entry.notes && (
                        <p className="text-[12px] text-charcoal/80 whitespace-pre-wrap leading-relaxed">
                          {entry.notes}
                        </p>
                      )}
                      {documentImages.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {documentImages.map((url, j) => (
                            <button
                              key={j}
                              type="button"
                              onClick={() => handleImageClick(url)}
                              className="relative w-12 h-12 rounded-md overflow-hidden hover:ring-2 hover:ring-gold/50 transition-all opacity-90 hover:opacity-100"
                            >
                              <Image
                                src={url}
                                alt={`${entry.owner_name} — ${j + 1}`}
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Directional chevron between entries */}
                  {!isLast && (
                    <div className="relative h-5 flex items-center">
                      <div className="absolute left-[19px] lg:left-[23px] -translate-x-1/2">
                        <svg width="7" height="8" viewBox="0 0 7 8" fill="none" className="opacity-40">
                          <path d="M1 1.5L3.5 4.5L6 1.5" stroke="var(--gold)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {!onImageClick && (
        <ImageLightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} alt="Provenance detail" />
      )}
    </>
  );
}
