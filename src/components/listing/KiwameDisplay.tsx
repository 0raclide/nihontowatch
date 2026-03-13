'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import type { KiwameEntry } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';
import { EditableText } from './EditableText';

const KIWAME_TYPE_KEYS: Record<string, string> = {
  origami: 'dealer.kiwameTypeOrigami',
  kinzogan: 'dealer.kiwameTypeKinzogan',
  shumei: 'dealer.kiwameTypeShumei',
  kinpunmei: 'dealer.kiwameTypeKinpunmei',
  saya_mei: 'dealer.kiwameTypeSayaMei',
  other: 'dealer.kiwameTypeOther',
};

interface KiwameDisplayProps {
  kiwame: KiwameEntry[];
  onImageClick?: (url: string) => void;
  readable?: boolean;
  editable?: boolean;
  onTextSave?: (entryIndex: number, newText: string | null) => Promise<void>;
}

export function KiwameDisplay({ kiwame, onImageClick, readable, editable, onTextSave }: KiwameDisplayProps) {
  const { t } = useLocale();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!kiwame || kiwame.length === 0) return null;

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
        <div className={`${readable ? 'text-[11px]' : 'text-[10px]'} uppercase tracking-wider text-muted font-medium mb-2`}>
          {t('dealer.kiwame')}
        </div>
        <div className="space-y-3">
          {kiwame.map((entry, i) => (
            <div key={entry.id || i}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`${readable ? 'text-[15px] leading-relaxed' : 'text-[13px]'} font-medium text-ink`}>
                  {entry.judge_name}
                  {entry.judge_name_ja && (
                    <span className={`ml-2 ${readable ? 'text-[13px]' : 'text-[12px]'} text-muted font-normal`}>{entry.judge_name_ja}</span>
                  )}
                </span>
                <span className="inline-block px-2 py-0.5 bg-gold/10 text-gold text-[10px] rounded-full border border-gold/20">
                  {t(KIWAME_TYPE_KEYS[entry.kiwame_type] || 'dealer.kiwameTypeOther')}
                </span>
              </div>
              {editable ? (
                <EditableText
                  value={entry.notes ?? null}
                  onSave={(v) => onTextSave?.(i, v) ?? Promise.resolve()}
                  className={`${readable ? 'text-[15px] leading-relaxed' : 'text-[13px]'} text-charcoal whitespace-pre-wrap`}
                  placeholder="Add notes..."
                />
              ) : entry.notes ? (
                <p className={`${readable ? 'text-[15px] leading-relaxed' : 'text-[13px]'} text-charcoal whitespace-pre-wrap`}>
                  {entry.notes}
                </p>
              ) : null}
              {entry.images && entry.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {entry.images.map((url, j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => handleImageClick(url)}
                      className="relative w-16 h-16 rounded-lg overflow-hidden hover:ring-2 hover:ring-gold/50 transition-all"
                    >
                      <Image
                        src={url}
                        alt={`${t('dealer.kiwame')} ${i + 1} photo ${j + 1}`}
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
        <ImageLightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} alt="Kiwame detail" />
      )}
    </>
  );
}
