'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import type { KoshiraeData, KoshiraeComponentType } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';
import { EditableText } from './EditableText';

const COMPONENT_TYPE_LABELS: Record<KoshiraeComponentType, string> = {
  tsuba: 'dealer.componentTsuba',
  menuki: 'dealer.componentMenuki',
  fuchi_kashira: 'dealer.componentFuchiKashira',
  kozuka: 'dealer.componentKozuka',
  kogai: 'dealer.componentKogai',
  other: 'dealer.componentOther',
};

function KoshiraeSetsumei({ textEn, textJa }: { textEn: string; textJa: string | null }) {
  const { t, locale } = useLocale();
  const [showAlternate, setShowAlternate] = useState(false);
  const isJaLocale = locale === 'ja';
  const showingJa = textJa ? (isJaLocale ? !showAlternate : showAlternate) : false;
  const hasToggle = !!(textEn && textJa);

  return (
    <div className="mt-2">
      <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">
        {t('dealer.koshiraeSetsumei')}
      </div>
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
          {textJa}
        </p>
      ) : (
        <article className="prose-translation">
          <ReactMarkdown>{textEn}</ReactMarkdown>
        </article>
      )}
    </div>
  );
}

interface KoshiraeDisplayProps {
  koshirae: KoshiraeData;
  hideHeading?: boolean;
  onImageClick?: (url: string) => void;
  onNavigate?: () => void;
  readable?: boolean;
  editable?: boolean;
  onTextSave?: (entryIndex: number, newText: string | null) => Promise<void>;
}

export function KoshiraeDisplay({ koshirae, hideHeading, onImageClick, onNavigate, readable, editable, onTextSave }: KoshiraeDisplayProps) {
  const { t } = useLocale();
  const router = useRouter();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  function navigateToArtist(e: React.MouseEvent, artisanId: string, artisanName?: string | null) {
    e.preventDefault();
    e.stopPropagation();
    onNavigate?.();
    const slug = artisanName ? `${artisanName.toLowerCase().replace(/\s+/g, '-')}-${artisanId}` : artisanId;
    router.push(`/artists/${slug}`);
  }

  return (
    <>
      <div className="px-4 py-3 lg:px-5 border-b border-border">
        {!hideHeading && (
          <div className={`${readable ? 'text-[11px]' : 'text-[10px]'} uppercase tracking-wider text-muted font-medium mb-2`}>
            {t('dealer.koshirae')}
          </div>
        )}

        {/* Certification info */}
        {(koshirae.cert_type || koshirae.cert_in_blade_paper) && (
          <div className="mb-2">
            {koshirae.cert_type && (
              <span className="inline-block px-2 py-0.5 text-[11px] font-medium rounded-full bg-gold/10 text-gold border border-gold/20 mr-2">
                {koshirae.cert_type}
                {koshirae.cert_session != null && ` #${koshirae.cert_session}`}
              </span>
            )}
            {koshirae.cert_in_blade_paper && (
              <span className="text-[12px] text-muted italic">
                {t('dealer.certInBladePaper')}
              </span>
            )}
          </div>
        )}

        {/* Era / Province / School metadata */}
        {(koshirae.era || koshirae.province || koshirae.school) && (
          <p className="text-[12px] text-muted mb-2">
            {[koshirae.era, koshirae.province, koshirae.school].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Single maker (issaku) */}
        {koshirae.artisan_id && (
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted shrink-0">
              {t('dealer.koshiraeMaker')}
            </span>
            <a
              href={`/artists/${koshirae.artisan_name?.toLowerCase().replace(/\s+/g, '-')}-${koshirae.artisan_id}`}
              onClick={(e) => navigateToArtist(e, koshirae.artisan_id!, koshirae.artisan_name)}
              className="text-[13px] text-gold hover:underline cursor-pointer"
            >
              {koshirae.artisan_name}
              {koshirae.artisan_kanji && koshirae.artisan_kanji !== koshirae.artisan_name && (
                <span className="text-muted ml-1">({koshirae.artisan_kanji})</span>
              )}
            </a>
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
                  <a
                    href={`/artists/${comp.artisan_name?.toLowerCase().replace(/\s+/g, '-')}-${comp.artisan_id}`}
                    onClick={(e) => navigateToArtist(e, comp.artisan_id!, comp.artisan_name)}
                    className="text-[13px] text-gold hover:underline cursor-pointer"
                  >
                    {comp.artisan_name}
                    {comp.artisan_kanji && comp.artisan_kanji !== comp.artisan_name && (
                      <span className="text-muted ml-1">({comp.artisan_kanji})</span>
                    )}
                  </a>
                ) : comp.artisan_name ? (
                  <span className="text-[13px] text-ink">
                    {comp.artisan_name}
                    {comp.artisan_kanji && comp.artisan_kanji !== comp.artisan_name && (
                      <span className="text-muted ml-1">({comp.artisan_kanji})</span>
                    )}
                  </span>
                ) : null}
                {comp.signed && comp.mei_text && (
                  <span className="text-[12px] text-ink italic">({comp.mei_text})</span>
                )}
                {comp.description && (
                  <span className="text-[12px] text-charcoal">— {comp.description}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        {editable ? (
          <EditableText
            value={koshirae.description ?? null}
            onSave={(v) => onTextSave?.(0, v) ?? Promise.resolve()}
            className={`${readable ? 'text-[15px] leading-relaxed' : 'text-[13px]'} text-charcoal whitespace-pre-wrap mb-2`}
            placeholder="Add description..."
          />
        ) : koshirae.description ? (
          <p className={`${readable ? 'text-[15px] leading-relaxed' : 'text-[13px]'} text-charcoal whitespace-pre-wrap mb-2`}>
            {koshirae.description}
          </p>
        ) : null}

        {/* Setsumei (NBTHK Zufu commentary) */}
        {koshirae.setsumei_text_en && (
          <KoshiraeSetsumei textEn={koshirae.setsumei_text_en} textJa={koshirae.setsumei_text_ja} />
        )}

        {/* Catalog thumbnails (oshigata/setsumei scans) — after text, consistent with blade setsumei */}
        {koshirae.images && koshirae.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {koshirae.images.map((url, j) => (
              <button
                key={j}
                type="button"
                onClick={() => onImageClick ? onImageClick(url) : setLightboxUrl(url)}
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

      {!onImageClick && (
        <ImageLightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} alt="Koshirae detail" />
      )}
    </>
  );
}
