'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { KoshiraeData, KoshiraeComponentType } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';

const COMPONENT_TYPE_LABELS: Record<KoshiraeComponentType, string> = {
  tsuba: 'dealer.componentTsuba',
  menuki: 'dealer.componentMenuki',
  fuchi_kashira: 'dealer.componentFuchiKashira',
  kozuka: 'dealer.componentKozuka',
  kogai: 'dealer.componentKogai',
  other: 'dealer.componentOther',
};

interface KoshiraeDisplayProps {
  koshirae: KoshiraeData;
}

export function KoshiraeDisplay({ koshirae }: KoshiraeDisplayProps) {
  const { t } = useLocale();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  return (
    <>
      <div className="px-4 py-3 lg:px-5 border-b border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2">
          {t('dealer.koshirae')}
        </div>

        {/* Certification info */}
        {(koshirae.cert_type || koshirae.cert_in_blade_paper) && (
          <div className="mb-2">
            {koshirae.cert_type && (
              <span className="inline-block px-2 py-0.5 text-[11px] font-medium rounded-full bg-gold/10 text-gold border border-gold/20 mr-2">
                {koshirae.cert_type}
              </span>
            )}
            {koshirae.cert_in_blade_paper && (
              <span className="text-[12px] text-muted italic">
                {t('dealer.certInBladePaper')}
              </span>
            )}
          </div>
        )}

        {/* Single maker (issaku) */}
        {koshirae.artisan_id && (
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted shrink-0">
              {t('dealer.koshiraeMaker')}
            </span>
            <Link
              href={`/artists/${koshirae.artisan_name?.toLowerCase().replace(/\s+/g, '-')}-${koshirae.artisan_id}`}
              className="text-[13px] text-gold hover:underline"
            >
              {koshirae.artisan_name}
              {koshirae.artisan_kanji && koshirae.artisan_kanji !== koshirae.artisan_name && (
                <span className="text-muted ml-1">({koshirae.artisan_kanji})</span>
              )}
            </Link>
          </div>
        )}

        {/* Components (multi-maker) */}
        {koshirae.components.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {koshirae.components.map((comp) => (
              <div key={comp.id} className="flex items-baseline gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted shrink-0">
                  {t(COMPONENT_TYPE_LABELS[comp.component_type] || 'dealer.componentOther')}
                </span>
                {comp.artisan_id ? (
                  <Link
                    href={`/artists/${comp.artisan_name?.toLowerCase().replace(/\s+/g, '-')}-${comp.artisan_id}`}
                    className="text-[13px] text-gold hover:underline"
                  >
                    {comp.artisan_name}
                    {comp.artisan_kanji && comp.artisan_kanji !== comp.artisan_name && (
                      <span className="text-muted ml-1">({comp.artisan_kanji})</span>
                    )}
                  </Link>
                ) : comp.artisan_name ? (
                  <span className="text-[13px] text-ink">
                    {comp.artisan_name}
                    {comp.artisan_kanji && comp.artisan_kanji !== comp.artisan_name && (
                      <span className="text-muted ml-1">({comp.artisan_kanji})</span>
                    )}
                  </span>
                ) : null}
                {comp.description && (
                  <span className="text-[12px] text-charcoal">— {comp.description}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        {koshirae.description && (
          <p className="text-[13px] text-charcoal whitespace-pre-wrap mb-2">
            {koshirae.description}
          </p>
        )}

        {/* Images */}
        {koshirae.images && koshirae.images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {koshirae.images.map((url, j) => (
              <button
                key={j}
                type="button"
                onClick={() => setLightboxUrl(url)}
                className="relative w-16 h-16 rounded-lg overflow-hidden hover:ring-2 hover:ring-gold/50 transition-all"
              >
                <Image
                  src={url}
                  alt={`${t('dealer.koshirae')} — ${j + 1}`}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </button>
            ))}
          </div>
        )}
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
              alt="Koshirae detail"
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
