'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ShowcaseSectionProps {
  id: string;
  title?: string;
  titleJa?: string;
  children: ReactNode;
  className?: string;
  /** Hide the divider above the title */
  hideDivider?: boolean;
}

/**
 * Animated wrapper for Showcase sections.
 * Uses IntersectionObserver for fade-in on scroll.
 * Once visible, stays visible (never re-hides).
 *
 * Section header spans the MEDIA tier width (960px) so divider lines
 * feel spacious. Content sections control their own widths internally.
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
      className={`scroll-mt-24 transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${className}`}
    >
      {title && (
        <div className="max-w-[960px] mx-auto px-4 sm:px-8 mb-10 md:mb-14">
          {!hideDivider && (
            <div className="h-px bg-border/30 mb-5" />
          )}
          <h2 className="text-[13px] uppercase tracking-[0.18em] font-medium text-charcoal">
            {title}
            {titleJa && (
              <span className="ml-3 text-muted">{titleJa}</span>
            )}
          </h2>
        </div>
      )}
      {children}
    </section>
  );
}
