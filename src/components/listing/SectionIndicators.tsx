'use client';

import { useLocale } from '@/i18n/LocaleContext';
import type { SectionIndicator } from '@/lib/media/contentStream';

interface SectionIndicatorsProps {
  sections: SectionIndicator[];
  onSectionClick: (sectionId: string) => void;
  activeSection?: string | null;
}

/**
 * Row of tappable pills showing what rich sections a listing has.
 * Each pill scrolls the content stream to that section.
 */
export function SectionIndicators({ sections, onSectionClick, activeSection }: SectionIndicatorsProps) {
  const { t } = useLocale();

  if (sections.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {sections.map((section) => {
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionClick(section.id)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full
              border transition-colors cursor-pointer group
              ${isActive
                ? 'bg-gold/10 border-gold/30'
                : 'bg-linen hover:bg-gold/10 border-border hover:border-gold/30'
              }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isActive ? 'bg-gold' : 'bg-gold/40 group-hover:bg-gold'
            }`} />
            <span className={`text-[10px] uppercase tracking-wider transition-colors ${
              isActive ? 'text-ink font-semibold' : 'text-muted group-hover:text-ink'
            }`}>
              {t(section.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
