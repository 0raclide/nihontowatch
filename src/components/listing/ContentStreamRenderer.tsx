'use client';

import { LazyImage } from '@/components/ui/LazyImage';
import { MediaGroupDivider } from './MediaGroupDivider';
import { SetsumeiBlock } from './SetsumeiBlock';
import { SayagakiDisplay } from './SayagakiDisplay';
import { HakogakiDisplay } from './HakogakiDisplay';
import { KoshiraeDisplay } from './KoshiraeDisplay';
import { ProvenanceDisplay } from './ProvenanceDisplay';
import { KiwameDisplay } from './KiwameDisplay';
import { KantoHibishoDisplay } from './KantoHibishoDisplay';
import { VideoGalleryItem } from '@/components/video/VideoGalleryItem';
import { ShowcaseScholarNote } from '@/components/showcase/ShowcaseCuratorNotePlaceholder';
import { useLightbox } from '@/contexts/LightboxContext';
import { useLocale } from '@/i18n/LocaleContext';
import { getCachedDimensions } from '@/lib/images';
import type { ContentBlock } from '@/lib/media/contentStream';
import type { Listing } from '@/types';

// ============================================================================
// Main renderer
// ============================================================================

interface ContentStreamRendererProps {
  blocks: ContentBlock[];
  listing: Listing;
  onImageVisible: (index: number) => void;
  onImageLoadFailed: (index: number, url: string) => void;
  visibleImages: Set<number>;
  hasScrolled: boolean;
  failedImageUrls: Set<string>;
  totalMediaCount: number;
  onNavigate?: () => void;
}

export function ContentStreamRenderer({
  blocks,
  listing,
  onImageVisible,
  onImageLoadFailed,
  visibleImages,
  hasScrolled,
  failedImageUrls,
  totalMediaCount,
  onNavigate,
}: ContentStreamRendererProps) {
  const { t } = useLocale();
  const { openLightbox } = useLightbox();

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'hero_image':
            return (
              <div key={`hero-${block.src}`} className="cursor-pointer" onClick={() => openLightbox(block.src)}>
                <LazyImage
                  src={block.src}
                  index={0}
                  totalImages={totalMediaCount}
                  isVisible={true}
                  onVisible={onImageVisible}
                  onLoadFailed={onImageLoadFailed}
                  isFirst={true}
                  showScrollHint={totalMediaCount > 1 && !hasScrolled}
                  title={listing.title}
                  itemType={listing.item_type}
                  certType={listing.cert_type}
                  cachedDimensions={getCachedDimensions(block.src)}
                />
              </div>
            );

          case 'curator_note':
            return (
              <div key="curator-note" className="py-4">
                <ShowcaseScholarNote noteEn={block.noteEn} noteJa={block.noteJa} />
              </div>
            );

          case 'video':
            return (
              <div key={`video-${block.videoId || i}`}>
                <VideoGalleryItem
                  streamUrl={block.streamUrl}
                  thumbnailUrl={block.thumbnailUrl}
                  duration={block.duration}
                  status={block.status as 'processing' | 'ready' | 'failed' | undefined}
                  className="aspect-video"
                />
              </div>
            );

          case 'image':
            return (
              <div
                key={`img-${block.src}`}
                className="cursor-pointer"
                onClick={() => openLightbox(block.src)}
              >
                <LazyImage
                  src={block.src}
                  index={block.globalIndex}
                  totalImages={totalMediaCount}
                  isVisible={visibleImages.has(block.globalIndex)}
                  onVisible={onImageVisible}
                  onLoadFailed={onImageLoadFailed}
                  isFirst={false}
                  showScrollHint={false}
                  title={listing.title}
                  itemType={listing.item_type}
                  certType={listing.cert_type}
                  cachedDimensions={getCachedDimensions(block.src)}
                />
              </div>
            );

          case 'section_divider':
            return (
              <div key={`divider-${block.sectionId}`} id={block.sectionId}>
                <MediaGroupDivider label={t(block.labelKey)} />
              </div>
            );

          case 'setsumei':
            return (
              <SetsumeiBlock
                key="setsumei"
                textEn={block.textEn}
                textJa={block.textJa}
                images={block.images}
              />
            );

          case 'sayagaki':
            return <SayagakiDisplay key="sayagaki" sayagaki={block.data} onImageClick={openLightbox} />;

          case 'hakogaki':
            return <HakogakiDisplay key="hakogaki" hakogaki={block.data} onImageClick={openLightbox} />;

          case 'provenance':
            return <ProvenanceDisplay key="provenance" provenance={block.data} onImageClick={openLightbox} />;

          case 'kiwame':
            return <KiwameDisplay key="kiwame" kiwame={block.data} />;

          case 'koshirae':
            return <KoshiraeDisplay key="koshirae" koshirae={block.data} hideHeading={block.hideHeading} onImageClick={openLightbox} onNavigate={onNavigate} />;

          case 'kanto_hibisho':
            return <KantoHibishoDisplay key="kanto-hibisho" kantoHibisho={block.data} onImageClick={openLightbox} />;

          default:
            return null;
        }
      })}
    </>
  );
}
