'use client';

import { useState, useCallback, useMemo } from 'react';
import { ShowcaseHero } from './ShowcaseHero';
import { ShowcaseSection } from './ShowcaseSection';
import { ShowcaseDocumentation } from './ShowcaseDocumentation';
import { ShowcaseTimeline } from './ShowcaseTimeline';
import { ShowcaseKoshirae } from './ShowcaseKoshirae';
import { ShowcaseImageGallery } from './ShowcaseImageGallery';
import { ShowcaseStickyBar } from './ShowcaseStickyBar';
import { ShowcaseLightbox } from './ShowcaseLightbox';
import { getAllImages } from '@/lib/images';
import { useValidatedImages } from '@/hooks/useValidatedImages';
import type { EnrichedListingDetail } from '@/lib/listing/getListingDetail';

interface ShowcaseLayoutProps {
  listing: EnrichedListingDetail;
}

/**
 * Immersive museum-grade Showcase layout.
 * Uses the standard NihontoWatch theme (light/dark mode).
 * Orchestrates all showcase sections, manages lightbox state,
 * and computes which images are "used" to avoid duplicates in the gallery.
 */
export function ShowcaseLayout({ listing }: ShowcaseLayoutProps) {
  const rawImages = getAllImages(listing);
  const { validatedImages } = useValidatedImages(rawImages);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = useCallback((url: string) => {
    const idx = validatedImages.indexOf(url);
    setLightboxImages(validatedImages);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  }, [validatedImages]);

  const openGalleryLightbox = useCallback((url: string, _index: number) => {
    const idx = validatedImages.indexOf(url);
    setLightboxImages(validatedImages);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  }, [validatedImages]);

  // Collect images used in documentation/provenance sections
  const usedImages = useMemo(() => {
    const used = new Set<string>();
    if (listing.setsumei_image_url) used.add(listing.setsumei_image_url);
    listing.sayagaki?.forEach(entry => {
      entry.images?.forEach(url => used.add(url));
    });
    listing.hakogaki?.forEach(entry => {
      entry.images?.forEach(url => used.add(url));
    });
    listing.provenance?.forEach(entry => {
      entry.images?.forEach(url => used.add(url));
    });
    listing.koshirae?.images?.forEach(url => used.add(url));
    listing.kanto_hibisho?.images?.forEach(url => used.add(url));
    return used;
  }, [listing]);

  // Determine which sections exist
  const hasDocumentation = !!(
    listing.setsumei_text_en || listing.setsumei_text_ja ||
    (listing.sayagaki && listing.sayagaki.length > 0) ||
    (listing.hakogaki && listing.hakogaki.length > 0)
  );
  const hasProvenance = !!(listing.provenance && listing.provenance.length > 0);
  const hasKiwame = !!(listing.kiwame && listing.kiwame.length > 0);
  const hasKoshirae = !!(listing.koshirae && (
    listing.koshirae.artisan_id ||
    listing.koshirae.components?.length > 0 ||
    listing.koshirae.cert_type ||
    listing.koshirae.images?.length > 0
  ));

  // Build section nav items — hero IS the overview (id="identity")
  const navSections = useMemo(() => {
    const s = [{ id: 'identity', label: 'Overview' }];
    if (hasDocumentation) s.push({ id: 'documentation', label: 'Documentation' });
    if (hasProvenance || hasKiwame) s.push({ id: 'provenance', label: 'Provenance' });
    if (hasKoshirae) s.push({ id: 'koshirae', label: 'Mountings' });
    s.push({ id: 'gallery', label: 'Gallery' });
    return s;
  }, [hasDocumentation, hasProvenance, hasKiwame, hasKoshirae]);

  return (
    <div className="min-h-screen bg-background text-ink">
      {/* Sticky nav bar (desktop only) */}
      <ShowcaseStickyBar listing={listing} sections={navSections} />

      {/* Hero — two-column with image + metadata */}
      <div id="identity">
        <ShowcaseHero listing={listing} onImageClick={openLightbox} />
      </div>

      {/* Sections */}
      <div className="space-y-16 md:space-y-20 pb-20 md:pb-24">
        {hasDocumentation && (
          <ShowcaseSection id="documentation" title="Documentation" titleJa="文書">
            <ShowcaseDocumentation listing={listing} onImageClick={openLightbox} />
          </ShowcaseSection>
        )}

        {(hasProvenance || hasKiwame) && (
          <ShowcaseSection id="provenance" title="Provenance" titleJa="伝来">
            <ShowcaseTimeline
              provenance={listing.provenance || []}
              kiwame={hasKiwame ? listing.kiwame! : undefined}
              onImageClick={openLightbox}
            />
          </ShowcaseSection>
        )}

        {hasKoshirae && (
          <ShowcaseSection id="koshirae" title="Mountings" titleJa="拵">
            <ShowcaseKoshirae koshirae={listing.koshirae!} onImageClick={openLightbox} />
          </ShowcaseSection>
        )}

        <ShowcaseSection id="gallery" title="Gallery" titleJa="写真">
          <ShowcaseImageGallery
            images={validatedImages}
            usedImages={usedImages}
            onImageClick={openGalleryLightbox}
            videos={listing.videos}
          />
        </ShowcaseSection>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <ShowcaseLightbox
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={(i) => setLightboxIndex(i)}
        />
      )}
    </div>
  );
}
