'use client';

import Image from 'next/image';
import { VideoGalleryItem } from '@/components/video/VideoGalleryItem';
import { isYuhinkaiCatalogImage } from '@/lib/images/classification';
import type { ListingVideo } from '@/types/media';

interface ShowcaseImageGalleryProps {
  /** All listing images (validated) */
  images: string[];
  /** Images already shown in documentation/provenance sections — excluded from gallery */
  usedImages: Set<string>;
  onImageClick: (url: string, index: number) => void;
  /** Videos to display above the image grid */
  videos?: ListingVideo[];
  /** Video ID already promoted to the hero — excluded from gallery */
  heroVideoId?: string;
}

/**
 * Masonry image gallery — shows all images NOT already displayed
 * in other sections. Uses media width (960px).
 */
export function ShowcaseImageGallery({ images, usedImages, onImageClick, videos, heroVideoId }: ShowcaseImageGalleryProps) {
  // Filter out images already shown in other sections + oshigata/catalog images
  const galleryImages = images.filter(url =>
    !usedImages.has(url) && !isYuhinkaiCatalogImage(url)
  );

  // Skip video already promoted to hero
  const readyVideos = videos?.filter(v => v.stream_url && v.id !== heroVideoId) || [];
  const hasContent = galleryImages.length > 0 || readyVideos.length > 0;

  if (!hasContent) return null;

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-8">
      {/* Videos */}
      {readyVideos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {readyVideos.map(video => (
            <VideoGalleryItem
              key={video.id}
              streamUrl={video.stream_url!}
              thumbnailUrl={video.thumbnail_url}
              duration={video.duration_seconds}
              status={video.status}
              className="rounded overflow-hidden aspect-video"
            />
          ))}
        </div>
      )}

      {/* Single-column images */}
      {galleryImages.length > 0 && (
        <div className="flex flex-col gap-3 md:gap-4">
          {galleryImages.map((url, i) => (
            <button
              key={url}
              onClick={() => onImageClick(url, i)}
              className="block w-full rounded overflow-hidden group relative cursor-zoom-in"
            >
              <Image
                src={url}
                alt={`Gallery image ${i + 1}`}
                width={960}
                height={640}
                className="w-full h-auto object-contain group-hover:brightness-105 transition-all duration-300"
                sizes="(max-width: 960px) 100vw, 960px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
