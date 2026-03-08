'use client';

import { useState } from 'react';
import Image from 'next/image';
import { HighlightedMarkdown } from '@/components/glossary/HighlightedMarkdown';
import { getOrdinalSuffix } from '@/lib/text/ordinal';
import { isYuhinkaiCatalogImage, classifyCatalogImage } from '@/lib/images/classification';
import type { EnrichedListingDetail } from '@/lib/listing/getListingDetail';
import type { SayagakiEntry, HakogakiEntry } from '@/types';

const SAYAGAKI_AUTHOR_LABELS: Record<string, string> = {
  tanobe_michihiro: 'Tanobe Michihiro (\u7530\u91CE\u908A\u9053\u5B8F)',
  honami_koson: "Hon'ami K\u014Dson (\u672C\u963F\u5F25\u5149\u905C)",
  honami_nishu: "Hon'ami Nissh\u016B (\u672C\u963F\u5F25\u65E5\u6D32)",
  kanzan_sato: 'Sat\u014D Kanzan (\u4F50\u85E4\u5BD2\u5C71)',
  honma_junji: 'Honma Junji (\u672C\u9593\u9806\u6CBB)',
};

interface DocumentCardProps {
  title: string;
  subtitle?: string;
  text: string | null;
  textAlt?: string | null;
  imageUrl?: string | null;
  images?: string[];
  onImageClick?: (url: string) => void;
}

function DocumentCard({ title, subtitle, text, textAlt, imageUrl, images, onImageClick }: DocumentCardProps) {
  const [showAlt, setShowAlt] = useState(false);
  const allImages = images || (imageUrl ? [imageUrl] : []);
  const displayText = showAlt && textAlt ? textAlt : text;
  const hasToggle = text && textAlt;

  return (
    <div className="space-y-8">
      {/* Document image(s) — full width, natural height */}
      {allImages.length > 0 && (
        <div className="space-y-3">
          {allImages.map((url, i) => (
            <button
              key={i}
              onClick={() => onImageClick?.(url)}
              className="relative w-full rounded overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-zoom-in group"
            >
              <Image
                src={url}
                alt={`${title} document ${i + 1}`}
                width={800}
                height={600}
                className="w-full h-auto object-contain group-hover:scale-[1.01] transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, 780px"
              />
            </button>
          ))}
        </div>
      )}

      {/* Text — clean flowing prose, no box */}
      {displayText && (
        <div>
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <h3 className="text-[13px] uppercase tracking-[0.15em] font-medium text-muted">
                {title}
              </h3>
              {subtitle && (
                <p className="text-[13px] text-muted mt-1">{subtitle}</p>
              )}
            </div>
            {hasToggle && (
              <button
                onClick={() => setShowAlt(!showAlt)}
                className="text-[12px] text-muted hover:text-charcoal transition-colors tracking-wide"
              >
                {showAlt ? 'Original' : 'Translation'}
              </button>
            )}
          </div>
          <div className="prose-translation text-[15px] md:text-[17px] leading-[1.85] font-light max-w-[62ch]">
            <HighlightedMarkdown content={displayText} variant="translation" />
          </div>
        </div>
      )}
    </div>
  );
}

interface ShowcaseDocumentationProps {
  listing: EnrichedListingDetail;
  onImageClick: (url: string) => void;
}

/**
 * Documentation section — oshigata, setsumei, sayagaki, hakogaki.
 * Single-column layout: image on top, text below.
 * Order: oshigata images -> setsumei images -> setsumei text -> sayagaki -> hakogaki.
 */
export function ShowcaseDocumentation({ listing, onImageClick }: ShowcaseDocumentationProps) {
  const sections: React.ReactNode[] = [];

  // Pre-classify catalog images for use in setsumei and oshigata sections
  const allCatalogImages = [...(listing.images || []), ...(listing.stored_images || [])]
    .filter(url => url && isYuhinkaiCatalogImage(url));
  const catalogSetsumeiImages = allCatalogImages.filter(url =>
    classifyCatalogImage(url) === 'setsumei'
  );

  // 1. Oshigata — catalog images classified as oshigata or combined (visual first)
  if (allCatalogImages.length > 0) {
    const oshigataImages = allCatalogImages.filter(url => {
      const type = classifyCatalogImage(url);
      return type === 'oshigata' || type === 'combined';
    });

    if (oshigataImages.length > 0) {
      sections.push(
        <DocumentCard
          key="oshigata"
          title="Oshigata"
          subtitle="From Yuhinkai catalog"
          text={null}
          images={oshigataImages}
          onImageClick={onImageClick}
        />
      );
    }

    // Setsumei page scans — standalone card only when no setsumei text exists
    // (when text exists, these images are included in the Setsumei card below)
    if (catalogSetsumeiImages.length > 0 && !listing.setsumei_text_en && !listing.setsumei_text_ja) {
      sections.push(
        <DocumentCard
          key="setsumei-images"
          title="Setsumei"
          subtitle="From Yuhinkai catalog"
          text={null}
          images={catalogSetsumeiImages}
          onImageClick={onImageClick}
        />
      );
    }
  }

  // 2. Setsumei — include classified setsumei page scans alongside text
  if (listing.setsumei_text_en || listing.setsumei_text_ja) {
    const sessionLabel = listing.cert_session
      ? `${getOrdinalSuffix(parseInt(listing.cert_session, 10))} Session`
      : undefined;
    const setsumeiDocImages = [
      ...(listing.setsumei_image_url ? [listing.setsumei_image_url] : []),
      ...catalogSetsumeiImages,
    ];
    sections.push(
      <DocumentCard
        key="setsumei"
        title="Setsumei"
        subtitle={sessionLabel}
        text={listing.setsumei_text_en}
        textAlt={listing.setsumei_text_ja}
        images={setsumeiDocImages.length > 0 ? setsumeiDocImages : undefined}
        onImageClick={onImageClick}
      />
    );
  }

  // 3. Sayagaki
  if (listing.sayagaki && listing.sayagaki.length > 0) {
    listing.sayagaki.forEach((entry: SayagakiEntry, i: number) => {
      const authorLabel = SAYAGAKI_AUTHOR_LABELS[entry.author] || entry.author_custom || entry.author;
      sections.push(
        <DocumentCard
          key={`sayagaki-${i}`}
          title="Sayagaki"
          subtitle={authorLabel}
          text={entry.content}
          images={entry.images}
          onImageClick={onImageClick}
        />
      );
    });
  }

  // 4. Hakogaki
  if (listing.hakogaki && listing.hakogaki.length > 0) {
    listing.hakogaki.forEach((entry: HakogakiEntry, i: number) => {
      sections.push(
        <DocumentCard
          key={`hakogaki-${i}`}
          title="Hakogaki"
          subtitle={entry.author || undefined}
          text={entry.content}
          images={entry.images}
          onImageClick={onImageClick}
        />
      );
    });
  }

  if (sections.length === 0) return null;

  return (
    <div className="space-y-14 md:space-y-20 max-w-[780px] mx-auto px-4 sm:px-8">
      {sections}
    </div>
  );
}
