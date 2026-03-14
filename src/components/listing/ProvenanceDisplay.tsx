'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import type { ProvenanceData } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';
import { EditableText } from './EditableText';

interface ProvenanceDisplayProps {
  provenance: ProvenanceData;
  onImageClick?: (url: string) => void;
  readable?: boolean;
  editable?: boolean;
  onTextSave?: (entryIndex: number, newText: string | null) => Promise<void>;
}

export function ProvenanceDisplay({ provenance, onImageClick, readable, editable, onTextSave }: ProvenanceDisplayProps) {
  const { t } = useLocale();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!provenance || (!provenance.entries?.length && !provenance.documents?.length)) return null;

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
        <div className={`${readable ? 'text-[11px]' : 'text-[10px]'} uppercase tracking-wider text-muted font-medium mb-3`}>
          {t('dealer.provenance')}
        </div>

        {/* Timeline container */}
        {provenance.entries.length > 0 && (
          <div className="relative">
            {/* The golden thread — vertical line */}
            <div
              className="absolute left-[19px] lg:left-[23px] top-0 bottom-0 w-[1.5px]"
              style={{
                background: 'linear-gradient(to bottom, transparent 0%, var(--gold) 8%, var(--gold) 92%, transparent 100%)',
                opacity: 0.35,
              }}
            />

            <div className="space-y-0">
              {provenance.entries.map((entry, i) => {
                const hasPortrait = !!entry.portrait_image;
                const isLast = i === provenance.entries.length - 1;

                return (
                  <div key={entry.id || i} className={`relative flex gap-3 ${isLast ? '' : 'pb-5'}`}>
                    {/* Node: portrait circle or gold dot */}
                    <div className="relative z-10 flex-shrink-0">
                      {hasPortrait ? (
                        <button
                          type="button"
                          onClick={() => handleImageClick(entry.portrait_image!)}
                          className="relative w-[40px] h-[40px] lg:w-[48px] lg:h-[48px] rounded-full overflow-hidden ring-[1.5px] ring-gold/40 hover:ring-gold/70 transition-all shadow-sm"
                        >
                          <Image
                            src={entry.portrait_image!}
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

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-[2px] lg:pt-1">
                      {/* Owner name + kanji */}
                      <div className={`${readable ? 'text-[15px]' : 'text-[13px]'} font-medium text-ink leading-tight`}>
                        {entry.owner_name}
                        {entry.owner_name_ja && (
                          <span className={`ml-2 ${readable ? 'text-[13px]' : 'text-[12px]'} text-muted font-normal`}>
                            {entry.owner_name_ja}
                          </span>
                        )}
                      </div>

                      {/* Notes */}
                      {editable ? (
                        <EditableText
                          value={entry.notes ?? null}
                          onSave={(v) => onTextSave?.(i, v) ?? Promise.resolve()}
                          className={`${readable ? 'text-[14px]' : 'text-[12px]'} text-charcoal/80 whitespace-pre-wrap mt-1 leading-relaxed`}
                          placeholder="Add notes..."
                        />
                      ) : entry.notes ? (
                        <p className={`${readable ? 'text-[14px]' : 'text-[12px]'} text-charcoal/80 whitespace-pre-wrap mt-1 leading-relaxed`}>
                          {entry.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Supporting Documents (chain-level) */}
        {provenance.documents && provenance.documents.length > 0 && (
          <div className={provenance.entries.length > 0 ? 'mt-3 pt-3 border-t border-border/30' : ''}>
            <div className={`${readable ? 'text-[11px]' : 'text-[10px]'} uppercase tracking-wider text-muted font-medium mb-2`}>
              {t('dealer.provenanceSupportingDocs')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {provenance.documents.map((url, j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => handleImageClick(url)}
                  className="relative w-12 h-12 rounded-md overflow-hidden hover:ring-2 hover:ring-gold/50 transition-all opacity-90 hover:opacity-100"
                >
                  <Image
                    src={url}
                    alt={`${t('dealer.provenanceSupportingDocs')} ${j + 1}`}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!onImageClick && (
        <ImageLightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} alt="Provenance detail" />
      )}
    </>
  );
}
