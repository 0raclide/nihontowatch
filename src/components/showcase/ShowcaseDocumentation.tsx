'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { EnrichedListingDetail } from '@/lib/listing/getListingDetail';
import type { SayagakiEntry, HakogakiEntry } from '@/types';

const YUHINKAI_DOMAIN = 'itbhfhyptogxcjbjfzwx.supabase.co';

const SAYAGAKI_AUTHOR_LABELS: Record<string, string> = {
  tanobe_michihiro: 'Tanobe Michihiro (田野邊道宏)',
  honami_koson: "Hon'ami Kōson (本阿弥光遜)",
  honami_nishu: "Hon'ami Nisshū (本阿弥日洲)",
  kanzan_sato: 'Satō Kanzan (佐藤寒山)',
  honma_junji: 'Honma Junji (本間順治)',
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
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8">
      {/* Document image(s) — 60% on desktop */}
      {allImages.length > 0 && (
        <div className="md:col-span-3 space-y-3">
          {allImages.map((url, i) => (
            <button
              key={i}
              onClick={() => onImageClick?.(url)}
              className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow cursor-pointer group"
            >
              <Image
                src={url}
                alt={`${title} document ${i + 1}`}
                fill
                className="object-contain bg-[#f5f0e8] group-hover:scale-[1.02] transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, 60vw"
              />
              {/* Paper-edge shadow */}
              <div className="absolute inset-0 rounded-lg shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] pointer-events-none" />
            </button>
          ))}
        </div>
      )}

      {/* Parchment text card — 40% on desktop */}
      {displayText && (
        <div className={`${allImages.length > 0 ? 'md:col-span-2' : 'md:col-span-5 max-w-2xl mx-auto'}`}>
          <div className="bg-[var(--sc-bg-document)] rounded-lg p-6 md:p-8 shadow-md">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.15em] font-medium text-[var(--sc-text-document)]/60">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-[13px] text-[var(--sc-text-document)]/80 mt-1">{subtitle}</p>
                )}
              </div>
              {hasToggle && (
                <button
                  onClick={() => setShowAlt(!showAlt)}
                  className="text-[11px] text-[var(--sc-text-document)]/50 hover:text-[var(--sc-text-document)]/80 transition-colors"
                >
                  {showAlt ? 'Original' : 'Translation'}
                </button>
              )}
            </div>
            <div className="text-[14px] leading-relaxed text-[var(--sc-text-document)] whitespace-pre-wrap">
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
    <div className="space-y-12 md:space-y-16 max-w-5xl mx-auto px-6 md:px-0">
      {sections}
    </div>
  );
}
