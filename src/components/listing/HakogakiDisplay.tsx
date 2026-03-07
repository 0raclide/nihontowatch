'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { HakogakiEntry } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';

interface HakogakiDisplayProps {
  hakogaki: HakogakiEntry[];
}

export function HakogakiDisplay({ hakogaki }: HakogakiDisplayProps) {
  const { t } = useLocale();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!hakogaki || hakogaki.length === 0) return null;

  return (
    <>
      <div className="px-4 py-3 lg:px-5 border-b border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2">
          {t('dealer.hakogaki')}
        </div>
        <div className="space-y-3">
          {hakogaki.map((entry, i) => (
            <div key={entry.id || i}>
              {entry.author && (
                <div className="text-[13px] font-medium text-ink mb-0.5">
                  {entry.author}
                </div>
              )}
              {entry.content && (
                <p className="text-[13px] text-charcoal whitespace-pre-wrap mb-2">
                  {entry.content}
                </p>
              )}
              {entry.images && entry.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {entry.images.map((url, j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setLightboxUrl(url)}
                      className="relative w-16 h-16 rounded-lg overflow-hidden hover:ring-2 hover:ring-gold/50 transition-all"
                    >
                      <Image
                        src={url}
                        alt={`${t('dealer.hakogaki')} ${i + 1} — ${j + 1}`}
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

      {/* Simple lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative max-w-3xl max-h-[80vh] w-full h-full">
            <Image
              src={lightboxUrl}
              alt="Hakogaki detail"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 768px"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
