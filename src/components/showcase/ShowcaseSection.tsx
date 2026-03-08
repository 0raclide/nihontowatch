'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ShowcaseSectionProps {
  id: string;
  title?: string;
  titleJa?: string;
  children: ReactNode;
  className?: string;
  /** Hide the gold rule divider above the title */
  hideDivider?: boolean;
}

/**
 * Animated wrapper for Showcase sections.
 * Uses IntersectionObserver for fade-in on scroll.
 * Once visible, stays visible (never re-hides).
 */
export function ShowcaseSection({
  id,
  title,
  titleJa,
  children,
  className = '',
  hideDivider = false,
}: ShowcaseSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id={id}
      className={`transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      {title && (
        <div className="text-center mb-8 md:mb-12">
          {!hideDivider && (
            <div className="w-10 h-[2px] bg-[var(--sc-accent-gold)] mx-auto mb-6" />
          )}
          <h2 className="text-[11px] md:text-[12px] uppercase tracking-[0.2em] font-medium text-[var(--sc-text-secondary)]">
            {title}
            {titleJa && (
              <span className="ml-3 text-[var(--sc-text-secondary)]/60">{titleJa}</span>
            )}
          </h2>
        </div>
      )}
      {children}
    </section>
  );
}
