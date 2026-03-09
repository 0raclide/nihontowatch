'use client';

import { useState } from 'react';
import Image from 'next/image';
import { HighlightedMarkdown } from '@/components/glossary/HighlightedMarkdown';
import { useLightbox } from '@/contexts/LightboxContext';
import { useLocale } from '@/i18n/LocaleContext';

interface SetsumeiBlockProps {
  textEn: string | null;
  textJa: string | null;
  images?: string[];
}

export function SetsumeiBlock({
  textEn,
  textJa,
  images,
}: SetsumeiBlockProps) {
  const { locale, t } = useLocale();
  const { openLightbox } = useLightbox();
  const [showAlternate, setShowAlternate] = useState(false);

  const isJaLocale = locale === 'ja';
  const showingJa = textJa ? (isJaLocale ? !showAlternate : showAlternate) : false;
  const hasToggle = !!(textEn && textJa);
  const displayText = showingJa ? textJa : (textEn || textJa);

  return (
    <div className="px-4 py-3 lg:px-5">
      {hasToggle && (
        <div className="flex justify-end mb-1">
          <button
            type="button"
            onClick={() => setShowAlternate(!showAlternate)}
            className="text-[11px] text-gold hover:text-gold/80 font-medium transition-colors"
          >
            {showingJa ? t('dealer.setsumeiShowEnglish') : t('dealer.setsumeiShowOriginal')}
          </button>
        </div>
      )}
      {showingJa ? (
        <p className="text-[13px] text-ink/80 leading-[1.85] whitespace-pre-line font-jp">
          {displayText}
        </p>
      ) : (
        <article className="prose-translation text-[14px]">
          <HighlightedMarkdown content={displayText || ''} variant="translation" />
        </article>
      )}
      {images && images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {images.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => openLightbox(url)}
              className="relative w-20 h-20 rounded-lg overflow-hidden hover:ring-2 hover:ring-gold/50 transition-all"
            >
              <Image
                src={url}
                alt="Setsumei document"
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
