'use client';

import { useEffect, useState } from 'react';

/**
 * SectionJumpNav — Refined sticky nav with understated typography.
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

  if (sections.length < 2) return null;

  return (
    <nav className="sticky top-0 z-20 bg-surface/97 backdrop-blur-sm border-b border-border/40 -mx-4 px-4 py-2.5 flex gap-4 overflow-x-auto scrollbar-none">
      {sections.map((section, i) => (
        <span key={section.id} className="flex items-center gap-0">
          <a
            href={`#${section.id}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  );
}
