'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
 * Fixed vertical sidebar index for showcase pages.
 * Left-aligned with a thin border line, gold active state.
 * Appears after scrolling past the hero. Desktop only.
 */
export function ShowcaseStickyBar({ listing: _listing, sections }: ShowcaseStickyBarProps) {
  const [visible, setVisible] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id || '');
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

  return (
    <nav
      className={`hidden lg:flex fixed left-8 top-1/2 -translate-y-1/2 z-40 transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Vertical border line */}
      <div className="w-px bg-border/40 flex-shrink-0" />

      {/* Section links */}
      <div className="flex flex-col gap-1 pl-5">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => scrollToSection(s.id)}
            className={`text-left text-[12px] uppercase tracking-[0.16em] py-1.5 transition-colors duration-200 ${
              activeSection === s.id
                ? 'text-gold'
                : 'text-muted/50 hover:text-muted'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
