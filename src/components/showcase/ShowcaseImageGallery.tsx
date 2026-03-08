'use client';

import Image from 'next/image';

const YUHINKAI_DOMAIN = 'itbhfhyptogxcjbjfzwx.supabase.co';

interface ShowcaseImageGalleryProps {
  /** All listing images (validated) */
  images: string[];
  /** Images already shown in documentation/provenance sections — excluded from gallery */
  usedImages: Set<string>;
  onImageClick: (url: string, index: number) => void;
}

/**
 * Masonry image gallery — shows all images NOT already displayed
 * in other sections (setsumei, sayagaki, provenance, etc.)
 */
export function ShowcaseImageGallery({ images, usedImages, onImageClick }: ShowcaseImageGalleryProps) {
  // Filter out images already shown in other sections + oshigata/catalog images
  const galleryImages = images.filter(url =>
    !usedImages.has(url) && !url.includes(YUHINKAI_DOMAIN)
  );

  if (galleryImages.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-0">
      <div className="columns-2 md:columns-3 gap-2">
        {galleryImages.map((url, i) => (
          <button
            key={url}
            onClick={() => onImageClick(url, i)}
            className="block w-full mb-2 rounded-lg overflow-hidden group relative break-inside-avoid"
          >
            <Image
              src={url}
              alt={`Gallery image ${i + 1}`}
              width={600}
              height={400}
              className="w-full h-auto object-contain bg-[var(--sc-bg-card)] group-hover:brightness-110 transition-all duration-300"
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
