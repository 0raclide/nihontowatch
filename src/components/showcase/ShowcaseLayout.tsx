'use client';

import { useState, useCallback, useMemo } from 'react';
import { ShowcaseHero } from './ShowcaseHero';
import { ShowcaseSection } from './ShowcaseSection';
import { ShowcaseIdentityCard } from './ShowcaseIdentityCard';
import { ShowcaseCuratorNotePlaceholder } from './ShowcaseCuratorNotePlaceholder';
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
    // Open with all validated images, starting at the clicked one
    const idx = validatedImages.indexOf(url);
    setLightboxImages(validatedImages);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  }, [validatedImages]);

  const openGalleryLightbox = useCallback((url: string, _index: number) => {
    // For gallery, open with all validated images starting at the clicked one
    const idx = validatedImages.indexOf(url);
    setLightboxImages(validatedImages);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  }, [validatedImages]);

  // Collect images used in documentation/provenance sections
  const usedImages = useMemo(() => {
    const used = new Set<string>();

    // Setsumei image
    if (listing.setsumei_image_url) used.add(listing.setsumei_image_url);

    // Sayagaki images
    listing.sayagaki?.forEach(entry => {
      entry.images?.forEach(url => used.add(url));
    });

    // Hakogaki images
    listing.hakogaki?.forEach(entry => {
      entry.images?.forEach(url => used.add(url));
    });

    // Provenance images
    listing.provenance?.forEach(entry => {
      entry.images?.forEach(url => used.add(url));
    });

    // Koshirae images
    listing.koshirae?.images?.forEach(url => used.add(url));

    // Kanto Hibisho images
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

  // Build section nav items
  const navSections = useMemo(() => {
    const s = [{ id: 'identity', label: 'Overview' }];
    s.push({ id: 'scholars-note', label: "Scholar's Note" });
    if (hasDocumentation) s.push({ id: 'documentation', label: 'Documentation' });
    if (hasProvenance || hasKiwame) s.push({ id: 'provenance', label: 'Provenance' });
    if (hasKoshirae) s.push({ id: 'koshirae', label: 'Mountings' });
    s.push({ id: 'gallery', label: 'Gallery' });
    return s;
  }, [hasDocumentation, hasProvenance, hasKiwame, hasKoshirae]);

  return (
    <div className="showcase min-h-screen bg-[var(--sc-bg-primary)] text-[var(--sc-text-primary)]">
      {/* Sticky nav bar (desktop only) */}
      <ShowcaseStickyBar listing={listing} sections={navSections} />

      {/* Hero */}
      <ShowcaseHero listing={listing} />

      {/* Sections */}
      <div className="space-y-16 md:space-y-24 py-16 md:py-24">
        {/* Identity Card */}
        <ShowcaseSection id="identity" hideDivider>
          <ShowcaseIdentityCard listing={listing} />
        </ShowcaseSection>

        {/* Scholar's Note (placeholder) */}
        <ShowcaseSection id="scholars-note" title="Scholar's Note" titleJa="学術解説">
          <ShowcaseCuratorNotePlaceholder />
        </ShowcaseSection>

        {/* Documentation */}
        {hasDocumentation && (
          <ShowcaseSection id="documentation" title="Documentation" titleJa="文書">
            <ShowcaseDocumentation listing={listing} onImageClick={openLightbox} />
          </ShowcaseSection>
        )}

        {/* Provenance + Kiwame */}
        {(hasProvenance || hasKiwame) && (
          <ShowcaseSection id="provenance" title="Provenance" titleJa="伝来">
            <ShowcaseTimeline
              provenance={listing.provenance || []}
              kiwame={hasKiwame ? listing.kiwame! : undefined}
              onImageClick={openLightbox}
            />
          </ShowcaseSection>
        )}

        {/* Koshirae */}
        {hasKoshirae && (
          <ShowcaseSection id="koshirae" title="Mountings" titleJa="拵">
            <ShowcaseKoshirae koshirae={listing.koshirae!} onImageClick={openLightbox} />
          </ShowcaseSection>
        )}

        {/* Image Gallery */}
        <ShowcaseSection id="gallery" title="Gallery" titleJa="写真">
          <ShowcaseImageGallery
            images={validatedImages}
            usedImages={usedImages}
            onImageClick={openGalleryLightbox}
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
