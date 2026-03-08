'use client';

import { useState } from 'react';
import { HighlightedMarkdown } from '@/components/glossary/HighlightedMarkdown';

interface ShowcaseScholarNoteProps {
  noteEn: string | null;
  noteJa: string | null;
}

/**
 * Scholar's Note section — AI-generated curator's analysis.
 * Clean flowing prose (no box) matching artist page biography typography.
 * Shows translation toggle when both EN and JA are available.
 */
export function ShowcaseScholarNote({ noteEn, noteJa }: ShowcaseScholarNoteProps) {
  const [showJa, setShowJa] = useState(false);

  if (!noteEn && !noteJa) return null;

  const displayText = showJa && noteJa ? noteJa : (noteEn || noteJa);
  const hasToggle = noteEn && noteJa;

  return (
    <div className="max-w-[780px] mx-auto px-4 sm:px-8">
      {hasToggle && (
        <div className="flex justify-end mb-5">
          <button
            onClick={() => setShowJa(!showJa)}
            className="text-[12px] text-muted hover:text-charcoal transition-colors tracking-wide"
          >
            {showJa ? 'Original' : '\u7FFB\u8A33'}
          </button>
        </div>
      )}
      <div className="prose-translation text-[15px] md:text-[17px] leading-[1.85] font-light max-w-[62ch]">
        <HighlightedMarkdown content={displayText || ''} variant="translation" />
      </div>
    </div>
  );
}
