'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import type { KantoHibishoData } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';
import { EditableText } from './EditableText';

interface KantoHibishoDisplayProps {
  kantoHibisho: KantoHibishoData;
  onImageClick?: (url: string) => void;
  readable?: boolean;
  editable?: boolean;
  onTextSave?: (entryIndex: number, newText: string | null) => Promise<void>;
}

export function KantoHibishoDisplay({ kantoHibisho, onImageClick, readable, editable, onTextSave }: KantoHibishoDisplayProps) {
  const { t } = useLocale();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!kantoHibisho) return null;

  const { volume, entry_number, text, images } = kantoHibisho;

  return (
    <>
      <div className="px-4 py-3 lg:px-5 border-b border-border">
        <div className={`${readable ? 'text-[11px]' : 'text-[10px]'} uppercase tracking-wider text-muted font-medium mb-2`}>
          {t('dealer.kantoHibisho')}
        </div>

        {/* Reference line */}
        {(volume || entry_number) && (
          <div className={`${readable ? 'text-[15px] leading-relaxed' : 'text-[13px]'} font-medium text-ink mb-1`}>
            {volume && `Vol. ${volume}`}
            {volume && entry_number && ', '}
            {entry_number && `No. ${entry_number}`}
          </div>
        )}

        {/* Text body */}
        {editable ? (
          <EditableText
            value={text ?? null}
            onSave={(v) => onTextSave?.(0, v) ?? Promise.resolve()}
            className={`${readable ? 'text-[15px] leading-relaxed' : 'text-[13px]'} text-charcoal whitespace-pre-wrap mb-2`}
            placeholder="Add text..."
          />
        ) : text ? (
          <p className={`${readable ? 'text-[15px] leading-relaxed' : 'text-[13px]'} text-charcoal whitespace-pre-wrap mb-2`}>
            {text}
          </p>
        ) : null}

        {/* Image thumbnails */}
        {images && images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((url, j) => (
              <button
                key={j}
                type="button"
                onClick={() => onImageClick ? onImageClick(url) : setLightboxUrl(url)}
                className="relative w-16 h-16 rounded-lg overflow-hidden hover:ring-2 hover:ring-gold/50 transition-all"
              >
                <Image
                  src={url}
                  alt={`${t('dealer.kantoHibisho')} — ${j + 1}`}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {!onImageClick && (
        <ImageLightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} alt="Kanto Hibisho detail" />
      )}
    </>
  );
}
