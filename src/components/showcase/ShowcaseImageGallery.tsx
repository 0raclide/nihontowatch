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
 * in other sections (setsumei, sayagaki, provenance, etc.)
 * Videos appear above the image grid.
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
    <div className="max-w-6xl mx-auto px-6 md:px-0">
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

      {/* Image masonry grid */}
      {galleryImages.length > 0 && (
        <div className="columns-1 md:columns-2 gap-3 md:gap-4">
          {galleryImages.map((url, i) => (
            <button
              key={url}
              onClick={() => onImageClick(url, i)}
              className="block w-full mb-3 md:mb-4 rounded overflow-hidden group relative break-inside-avoid cursor-zoom-in"
            >
              <Image
                src={url}
                alt={`Gallery image ${i + 1}`}
                width={600}
                height={400}
                className="w-full h-auto object-contain group-hover:brightness-105 transition-all duration-300"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
