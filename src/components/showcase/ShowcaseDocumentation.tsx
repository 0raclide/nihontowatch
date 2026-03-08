'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { EnrichedListingDetail } from '@/lib/listing/getListingDetail';
import type { SayagakiEntry, HakogakiEntry } from '@/types';

const YUHINKAI_DOMAIN = 'itbhfhyptogxcjbjfzwx.supabase.co';

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
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-10">
      {/* Document image(s) — 60% on desktop */}
      {allImages.length > 0 && (
        <div className="md:col-span-3 space-y-3">
          {allImages.map((url, i) => (
            <button
              key={i}
              onClick={() => onImageClick?.(url)}
              className="relative w-full aspect-[4/3] rounded overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-zoom-in group"
            >
              <Image
                src={url}
                alt={`${title} document ${i + 1}`}
                fill
                className="object-contain bg-[var(--sc-bg-document)] group-hover:scale-[1.01] transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, 60vw"
              />
            </button>
          ))}
        </div>
      )}

      {/* Parchment text card — 40% on desktop */}
      {displayText && (
        <div className={`${allImages.length > 0 ? 'md:col-span-2' : 'md:col-span-5 max-w-2xl mx-auto'}`}>
          <div className="bg-[var(--sc-bg-document)] rounded p-6 md:p-8 shadow-sm">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.15em] font-medium text-[var(--sc-text-document)]/50">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-[12px] text-[var(--sc-text-document)]/60 mt-1">{subtitle}</p>
                )}
              </div>
              {hasToggle && (
                <button
                  onClick={() => setShowAlt(!showAlt)}
                  className="text-[11px] text-[var(--sc-text-document)]/40 hover:text-[var(--sc-text-document)]/70 transition-colors tracking-wide"
                >
                  {showAlt ? 'Original' : 'Translation'}
                </button>
              )}
            </div>
            <div className="text-[13px] leading-[1.8] text-[var(--sc-text-document)] whitespace-pre-wrap font-light">
              {displayText}
            </div>
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
 * Documentation section — setsumei, sayagaki, hakogaki, oshigata.
 * Each document type shows as side-by-side (image + parchment card).
 */
export function ShowcaseDocumentation({ listing, onImageClick }: ShowcaseDocumentationProps) {
  const sections: React.ReactNode[] = [];

  // Setsumei
  if (listing.setsumei_text_en || listing.setsumei_text_ja) {
    sections.push(
      <DocumentCard
        key="setsumei"
        title="Setsumei"
        subtitle={listing.cert_session ? `${listing.cert_session}th Session` : undefined}
        text={listing.setsumei_text_en}
        textAlt={listing.setsumei_text_ja}
        imageUrl={listing.setsumei_image_url}
        onImageClick={onImageClick}
      />
    );
  }

  // Sayagaki
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

  // Hakogaki
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

  // Oshigata — catalog images (identified by Yuhinkai storage domain)
  const allImages = [...(listing.images || []), ...(listing.stored_images || [])].filter(Boolean);
  const oshigataImages = allImages.filter(url => url.includes(YUHINKAI_DOMAIN));
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

  if (sections.length === 0) return null;

  return (
    <div className="space-y-14 md:space-y-20 max-w-5xl mx-auto px-6 md:px-0">
      {sections}
    </div>
  );
}
