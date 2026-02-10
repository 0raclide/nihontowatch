'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * SectionJumpNav — Desktop: sticky top bar. Mobile: fixed bottom pill.
 *
 * On mobile the thin top bar is easy to lose, so we show a compact
 * fixed-bottom navigator instead — current section + tap to expand
 * full section list.
 */

interface Section {
  id: string;
  label: string;
}

interface SectionJumpNavProps {
  sections: Section[];
}

export function SectionJumpNav({ sections }: SectionJumpNavProps) {
  const [activeId, setActiveId] = useState<string>('');
  const scrollRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Intersection observer — tracks which section is in view ──
  useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  // ── Desktop scroll fade indicators ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [sections]);

  // ── Offset-aware scroll helper ──
  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const headerOffset = 96; // ~6rem — clears sticky header + breathing room
    const y = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }, []);

  // ── Mobile: navigate to section ──
  const navigateTo = useCallback((sectionId: string) => {
    setMobileMenuOpen(false);
    // Small delay so the menu closes before scroll starts
    requestAnimationFrame(() => {
      scrollToSection(sectionId);
    });
  }, [scrollToSection]);

  // ── Mobile: prev/next section ──
  const activeIndex = sections.findIndex(s => s.id === activeId);
  const goToPrev = useCallback(() => {
    if (activeIndex > 0) navigateTo(sections[activeIndex - 1].id);
  }, [activeIndex, sections, navigateTo]);
  const goToNext = useCallback(() => {
    if (activeIndex < sections.length - 1) navigateTo(sections[activeIndex + 1].id);
  }, [activeIndex, sections, navigateTo]);

  // ── Close mobile menu on Escape ──
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileMenuOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileMenuOpen]);

  if (sections.length < 2) return null;

  const activeLabel = sections.find(s => s.id === activeId)?.label || sections[0].label;

  return (
    <>
      {/* ═══ DESKTOP: Sticky top bar (hidden on mobile) ═══ */}
      <div className="hidden sm:block xl:hidden sticky top-0 lg:top-[77px] z-20 -mx-4 relative">
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-surface to-transparent z-10 pointer-events-none" />
        )}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-surface to-transparent z-10 pointer-events-none" />
        )}
        <nav
          ref={scrollRef}
          className="bg-surface/97 backdrop-blur-sm border-b border-border/40 px-4 py-2.5 flex gap-4 overflow-x-auto scrollbar-none"
        >
          {sections.map((section, i) => (
            <span key={section.id} className="flex items-center gap-0">
              <a
                href={`#${section.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(section.id);
                }}
                className={`whitespace-nowrap text-xs transition-colors pb-1 ${
                  activeId === section.id
                    ? 'text-ink border-b border-gold/60'
                    : 'text-ink/40 hover:text-ink/60 border-b border-transparent'
                }`}
              >
                {section.label}
              </a>
              {i < sections.length - 1 && (
                <span className="mx-3 text-border/60 select-none" aria-hidden>·</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* ═══ XL+: Fixed left-margin sidebar (hidden below xl) ═══ */}
      <nav
        className="hidden xl:flex flex-col gap-1 fixed top-[96px] z-20"
        style={{ left: 'max(24px, calc(50vw - 540px))' }}
        aria-label="Section navigation"
      >
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection(section.id);
            }}
            className={`block text-[11px] uppercase tracking-[0.14em] py-1.5 pl-3 border-l-[2px] transition-colors ${
              activeId === section.id
                ? 'text-gold border-gold/70'
                : 'text-ink/25 border-transparent hover:text-ink/45 hover:border-ink/15'
            }`}
          >
            {section.label}
          </a>
        ))}
      </nav>

      {/* ═══ MOBILE: Fixed bottom section nav, above BottomTabBar (hidden on sm+) ═══ */}
      <div
        className="sm:hidden fixed left-0 right-0 z-30"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Backdrop overlay when menu is open */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Expanded section list */}
        {mobileMenuOpen && (
          <div className="relative z-30 mx-4 mb-2 bg-surface/98 backdrop-blur-xl border border-border/50 shadow-lg rounded-lg overflow-hidden animate-fadeIn">
            <div className="py-1.5">
              {sections.map((section, i) => (
                <button
                  key={section.id}
                  onClick={() => navigateTo(section.id)}
                  className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${
                    section.id === activeId
                      ? 'text-gold font-medium bg-gold/5'
                      : 'text-ink/60 hover:text-ink hover:bg-hover/50'
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span>{section.label}</span>
                    {section.id === activeId && (
                      <span className="w-1.5 h-1.5 rounded-full bg-gold/70" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Compact bottom bar */}
        <div className="relative z-30 bg-surface/95 backdrop-blur-md border-t border-border/40">
          <div className="flex items-center h-11">
            {/* Prev */}
            <button
              onClick={goToPrev}
              disabled={activeIndex <= 0}
              className="flex items-center justify-center w-11 h-full text-ink/40 disabled:text-ink/15 transition-colors"
              aria-label="Previous section"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {/* Section name — tap to expand */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex-1 flex items-center justify-center gap-2 h-full min-w-0"
              aria-expanded={mobileMenuOpen}
              aria-label="Jump to section"
            >
              <span className="text-[12px] text-ink/70 font-medium tracking-wide truncate">
                {activeLabel}
              </span>
              <svg
                className={`w-2.5 h-2.5 text-ink/35 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </button>

            {/* Next */}
            <button
              onClick={goToNext}
              disabled={activeIndex >= sections.length - 1}
              className="flex items-center justify-center w-11 h-full text-ink/40 disabled:text-ink/15 transition-colors"
              aria-label="Next section"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
