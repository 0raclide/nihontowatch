'use client';

import Image from 'next/image';

interface ImageLightboxProps {
  imageUrl: string | null;
  onClose: () => void;
  alt?: string;
}

/**
 * Shared full-screen image lightbox overlay.
 * Used as a fallback by section display components (Sayagaki, Hakogaki, etc.)
 * when the parent doesn't provide an `onImageClick` handler.
 */
export function ImageLightbox({ imageUrl, onClose, alt = 'Detail' }: ImageLightboxProps) {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        aria-label="Close"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="relative max-w-3xl max-h-[80vh] w-full h-full">
        <Image
          src={imageUrl}
          alt={alt}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 768px"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
