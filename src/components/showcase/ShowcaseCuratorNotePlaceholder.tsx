'use client';

import { useState } from 'react';
import { HighlightedMarkdown } from '@/components/glossary/HighlightedMarkdown';

interface ShowcaseScholarNoteProps {
  noteEn: string | null;
  noteJa: string | null;
}

/**
 * Scholar's Note section — AI-generated curator's analysis.
 * Renders markdown through HighlightedMarkdown (same as DocumentCard in ShowcaseDocumentation).
 * Shows translation toggle when both EN and JA are available.
 */
export function ShowcaseScholarNote({ noteEn, noteJa }: ShowcaseScholarNoteProps) {
  const [showJa, setShowJa] = useState(false);

  if (!noteEn && !noteJa) return null;

  const displayText = showJa && noteJa ? noteJa : (noteEn || noteJa);
  const hasToggle = noteEn && noteJa;

  return (
    <div className="max-w-2xl mx-auto px-6 md:px-0">
      <div className="bg-surface-elevated rounded p-6 md:p-8 border border-border">
        {hasToggle && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowJa(!showJa)}
              className="text-[11px] text-muted hover:text-charcoal transition-colors tracking-wide"
            >
              {showJa ? 'Original' : '翻訳'}
            </button>
          </div>
        )}
        <div className="prose-translation text-[13px] leading-[1.8] font-light">
          <HighlightedMarkdown content={displayText || ''} variant="translation" />
        </div>
      </div>
    </div>
  );
}
