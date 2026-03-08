'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { getAttributionName } from '@/lib/listing/attribution';
import { getValidatedCertInfo } from '@/lib/cert/validation';
import { getAllImages } from '@/lib/images';
import type { EnrichedListingDetail } from '@/lib/listing/getListingDetail';

interface ShowcaseHeroProps {
  listing: EnrichedListingDetail;
}

/**
 * Full-bleed hero section.
 * Shows muted autoplay video if available, otherwise the first image.
 */
export function ShowcaseHero({ listing }: ShowcaseHeroProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const firstVideo = listing.videos?.find(v => v.stream_url);
  const heroImage = getAllImages(listing)[0];
  const certInfo = getValidatedCertInfo(listing);
  const artisanName = listing.artisan_display_name || getAttributionName(listing);

  return (
    <div className="relative w-full h-[70vh] md:h-[85vh] bg-black overflow-hidden">
      {/* Video or Image */}
      {firstVideo?.stream_url ? (
        <div className="absolute inset-0">
          <VideoPlayer
            streamUrl={firstVideo.stream_url}
            posterUrl={firstVideo.thumbnail_url || heroImage}
            autoPlay
            muted
            loop
            controls={false}
            className="w-full h-full [&_video]:object-contain [&_video]:w-full [&_video]:h-full"
          />
        </div>
      ) : heroImage ? (
        <div className="absolute inset-0">
          <Image
            src={heroImage}
            alt={listing.title}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
        </div>
      ) : null}

      {/* Radial vignette overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)]" />

      {/* Bottom gradient for attribution text */}
      <div className="absolute inset-x-0 bottom-0 h-48 pointer-events-none bg-gradient-to-t from-[var(--sc-bg-primary)] via-[var(--sc-bg-primary)]/60 to-transparent" />

      {/* Attribution text at bottom */}
      <div className="absolute inset-x-0 bottom-0 px-6 pb-8 md:pb-12 text-center">
        {artisanName && (
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-serif text-[var(--sc-text-heading)] mb-2 leading-tight">
            {artisanName}
          </h1>
        )}
        {listing.artisan_name_kanji && (
          <p className="text-lg md:text-xl text-[var(--sc-text-secondary)] mb-3">
            {listing.artisan_name_kanji}
          </p>
        )}
        {certInfo && (
          <p className="text-[11px] md:text-[12px] uppercase tracking-[0.2em] text-[var(--sc-accent-gold)]">
            {certInfo.label}
            {listing.cert_session && ` \u00B7 ${listing.cert_session}`}
          </p>
        )}
      </div>

      {/* Scroll indicator — fades on scroll */}
      <div
        className={`absolute bottom-3 left-1/2 -translate-x-1/2 transition-opacity duration-500 ${
          scrolled ? 'opacity-0' : 'opacity-50'
        }`}
      >
        <svg className="w-5 h-5 text-[var(--sc-text-secondary)] animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7" />
        </svg>
      </div>
    </div>
  );
}
