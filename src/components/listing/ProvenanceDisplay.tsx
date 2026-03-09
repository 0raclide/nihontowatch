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

  return (
    <>
      <div className="px-4 py-3 lg:px-5 border-b border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2">
          {t('dealer.provenance')}
        </div>
        <div className="space-y-3">
          {provenance.map((entry, i) => (
            <div key={entry.id || i}>
              <div className="text-[13px] font-medium text-ink mb-0.5">
                {entry.owner_name}
                {entry.owner_name_ja && (
                  <span className="ml-2 text-[12px] text-muted font-normal">{entry.owner_name_ja}</span>
                )}
              </div>
              {entry.notes && (
                <p className="text-[13px] text-charcoal whitespace-pre-wrap mb-2">
                  {entry.notes}
                </p>
              )}
              {entry.images && entry.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {entry.images.map((url, j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => onImageClick ? onImageClick(url) : setLightboxUrl(url)}
                      className="relative w-16 h-16 rounded-lg overflow-hidden hover:ring-2 hover:ring-gold/50 transition-all"
                    >
                      <Image
                        src={url}
                        alt={`${t('dealer.provenance')} ${i + 1} — ${j + 1}`}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {!onImageClick && (
        <ImageLightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} alt="Provenance detail" />
      )}
    </>
  );
}
