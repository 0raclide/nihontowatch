'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getAttributionName } from '@/lib/listing/attribution';
import { getValidatedCertInfo } from '@/lib/cert/validation';
import type { EnrichedListingDetail } from '@/lib/listing/getListingDetail';

interface SectionDef {
  id: string;
  label: string;
}

interface ShowcaseStickyBarProps {
  listing: EnrichedListingDetail;
  sections: SectionDef[];
}

/**
 * Sticky navigation bar that appears after scrolling past the hero.
 * Shows attribution summary + section nav links.
 * Desktop only — hidden on mobile.
 * Typography refined to match artist page SectionJumpNav patterns.
 */
export function ShowcaseStickyBar({ listing, sections }: ShowcaseStickyBarProps) {
  const [visible, setVisible] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Show/hide based on scroll past hero
  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track active section via IntersectionObserver
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );

    const observer = observerRef.current;
    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, []);

  const certInfo = getValidatedCertInfo(listing);
  const artisanName = listing.artisan_display_name || getAttributionName(listing);

  return (
    <div
      className={`hidden md:block fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
      }`}
    >
      <div className="bg-[var(--sc-bg-primary)]/95 backdrop-blur-md border-b border-[var(--sc-border)]/50">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-12">
          {/* Attribution summary */}
          <div className="flex items-center gap-3 min-w-0">
            {artisanName && (
              <span className="text-[13px] font-serif font-light text-[var(--sc-text-primary)] truncate">
                {artisanName}
              </span>
            )}
            {certInfo && (
              <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--sc-accent-gold-muted)] flex-shrink-0">
                {certInfo.label}
              </span>
            )}
          </div>

          {/* Section nav links */}
          <nav className="flex items-center gap-0.5">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`text-[11px] uppercase tracking-wider px-3 py-1.5 rounded transition-colors ${
                  activeSection === s.id
                    ? 'text-[var(--sc-accent-gold)] bg-[var(--sc-accent-gold)]/8'
                    : 'text-[var(--sc-text-muted)] hover:text-[var(--sc-text-secondary)]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
