'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { CatalogueEntry, CatalogueImage } from '@/lib/supabase/yuhinkai';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const COLLECTION_LABELS: Record<string, string> = {
  'Tokuju': 'Tokubetsu Jūyō',
  'Juyo': 'Jūyō',
  'Kokuho': 'Kokuhō',
  'JuBun': 'Jūyō Bunkazai',
  'Jubi': 'Jūyō Bijutsuhin',
};

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface CatalogueShowcaseProps {
  entry: CatalogueEntry;
  totalEntries: number;
  artisanName: string | null;
}

// ─── GALLERY LIGHTBOX ───────────────────────────────────────────────────────

function GalleryLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: CatalogueImage[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);

  const goPrev = useCallback(() => {
    setIndex(i => (i > 0 ? i - 1 : images.length - 1));
  }, [images.length]);

  const goNext = useCallback(() => {
    setIndex(i => (i < images.length - 1 ? i + 1 : 0));
  }, [images.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose, goPrev, goNext]);

  const current = images[index];
  if (!current) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full
          bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Prev button */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center
            w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
          aria-label="Previous image"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center
            w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
          aria-label="Next image"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={`Gallery image ${index + 1} of ${images.length}`}
        className="max-h-[85vh] max-w-[90vw] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* Counter */}
      <p className="mt-3 text-[11px] text-white/40 tracking-wider uppercase text-center tabular-nums">
        {index + 1} / {images.length}
      </p>
    </div>,
    document.body
  );
}

// ─── SUB-SECTION HEADER ─────────────────────────────────────────────────────

function SubHeader({ title }: { title: string }) {
  return (
    <div className="mt-10 mb-4">
      <div className="h-px bg-border/20 mb-4" />
      <h3 className="text-[12px] uppercase tracking-[0.15em] text-ink/50 font-medium">
        {title}
      </h3>
    </div>
  );
}

// ─── TEXT BLOCK ──────────────────────────────────────────────────────────────

function TextBlock({ text }: { text: string }) {
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  return (
    <div className="text-[13.5px] text-ink/80 leading-[1.9] font-light space-y-4">
      {paragraphs.map((p, i) => (
        <p key={i}>{p.trim()}</p>
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export function CatalogueShowcase({ entry, totalEntries, artisanName }: CatalogueShowcaseProps) {
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  // Build flat image array for gallery navigation:
  // cover → photos → provenance (catalog + sayagaki images excluded from display)
  const galleryImages = useMemo(() => {
    const shown = new Set<CatalogueImage['category']>(['cover', 'photo', 'provenance']);
    const order: CatalogueImage['category'][] = ['cover', 'photo', 'provenance'];
    return entry.images
      .filter(img => shown.has(img.category))
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  }, [entry.images]);

  // Separate images by category for display
  const coverImage = entry.coverImage;
  const photoImages = useMemo(() => entry.images.filter(img => img.category === 'photo'), [entry.images]);
  const provenanceImages = useMemo(() => entry.images.filter(img => img.category === 'provenance'), [entry.images]);

  const openGallery = useCallback((image: CatalogueImage) => {
    const idx = galleryImages.findIndex(img => img.url === image.url);
    setGalleryIndex(idx >= 0 ? idx : 0);
  }, [galleryImages]);

  const collectionLabel = COLLECTION_LABELS[entry.collection] || entry.collection;
  const publishedDate = new Date(entry.publishedAt).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <div>
      {/* ─── COVER / HERO IMAGE ──────────────────────────────────────── */}
      {coverImage && (
        <figure className="mb-6">
          <button
            type="button"
            onClick={() => openGallery(coverImage)}
            className="block w-full border border-border/20 shadow-sm cursor-zoom-in
              hover:shadow-md hover:border-border/30 transition-all duration-200 bg-black/5"
            aria-label="View full-size cover image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage.url}
              alt={`${collectionLabel} — ${artisanName || 'Artisan'}`}
              className="w-full h-auto object-contain"
              loading="eager"
            />
          </button>
          <figcaption className="mt-2 text-center">
            <span className="text-[10px] uppercase tracking-[0.15em] text-gold/50 font-medium">
              {collectionLabel}
            </span>
            <span className="text-[10px] text-ink/25 ml-1.5">
              &mdash; Vol. {entry.volume}, No. {entry.itemNumber}
              {entry.formType && <> &middot; {entry.formType.toLowerCase()}</>}
            </span>
          </figcaption>
        </figure>
      )}

      {/* Caption when no cover image */}
      {!coverImage && (
        <p className="mb-6 text-[10px] uppercase tracking-[0.15em] text-gold/50 font-medium">
          {collectionLabel} &mdash; Vol. {entry.volume}, No. {entry.itemNumber}
          {entry.formType && <> &middot; {entry.formType.toLowerCase()}</>}
        </p>
      )}

      {/* ─── PHOTO GRID ──────────────────────────────────────────────── */}
      {photoImages.length > 0 && (() => {
        const maxVisible = 6;
        const visible = photoImages.slice(0, maxVisible);
        const overflow = photoImages.length - maxVisible;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {visible.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => openGallery(img)}
                className="aspect-[4/3] overflow-hidden border border-border/15 cursor-zoom-in
                  hover:border-border/30 transition-all duration-150 bg-black/5"
                aria-label={`Photo ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
            {overflow > 0 && (
              <button
                type="button"
                onClick={() => openGallery(photoImages[maxVisible])}
                className="aspect-[4/3] overflow-hidden border border-border/15 cursor-zoom-in
                  hover:border-border/30 transition-all duration-150 bg-black/5
                  flex items-center justify-center"
                aria-label={`View ${overflow} more photos`}
              >
                <span className="text-sm text-ink/40 font-light">+{overflow} more</span>
              </button>
            )}
          </div>
        );
      })()}

      {/* ─── SAYAGAKI ────────────────────────────────────────────────── */}
      {entry.sayagakiEn && (
        <div>
          <SubHeader title="Sayagaki" />
          <TextBlock text={entry.sayagakiEn} />
        </div>
      )}

      {/* ─── PROVENANCE ──────────────────────────────────────────────── */}
      {(entry.provenanceEn || provenanceImages.length > 0) && (
        <div>
          <SubHeader title="Provenance" />
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_280px] gap-6">
            <div>
              {entry.provenanceEn && <TextBlock text={entry.provenanceEn} />}
            </div>
            {provenanceImages.length > 0 && (
              <div className="flex flex-col gap-2 order-first sm:order-last">
                {provenanceImages.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => openGallery(img)}
                    className="border border-border/15 cursor-zoom-in hover:border-border/30
                      transition-all duration-150 bg-black/5"
                    aria-label={`Provenance document ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={`Provenance document ${i + 1}`}
                      className="w-full h-auto object-contain"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── CONTRIBUTOR CREDIT ──────────────────────────────────────── */}
      <div className="mt-10 pt-4 border-t border-border/15">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {entry.contributor.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entry.contributor.avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center">
                <span className="text-[11px] text-gold/60 font-medium">
                  {entry.contributor.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-[12px] text-ink/60">
              Documented by <span className="text-ink/80 font-medium">{entry.contributor.displayName}</span>
            </span>
          </div>
          <span className="text-[11px] text-ink/30 tabular-nums">
            {publishedDate}
          </span>
        </div>
      </div>

      {/* ─── GALLERY LIGHTBOX ────────────────────────────────────────── */}
      {galleryIndex !== null && (
        <GalleryLightbox
          images={galleryImages}
          initialIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      )}
    </div>
  );
}
