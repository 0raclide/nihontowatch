'use client';

import { useState } from 'react';
import { HighlightedMarkdown } from '@/components/glossary/HighlightedMarkdown';
import { EditableText } from '@/components/listing/EditableText';

interface ShowcaseScholarNoteProps {
  noteEn: string | null;
  noteJa: string | null;
  headlineEn?: string | null;
  headlineJa?: string | null;
  listingTitle?: string | null;
  editable?: boolean;
  onTextSave?: (lang: 'en' | 'ja', newText: string | null) => Promise<void>;
  onHeadlineSave?: (lang: 'en' | 'ja', newText: string | null) => Promise<void>;
}

/**
 * Scholar's Note section — AI-generated curator's analysis.
 * Uses prose width (65ch) for readable long-form text.
 * Container is media width (960px) so it aligns with section headers.
 *
 * Hero section: centered listing title + headline above the full note body.
 */
export function ShowcaseScholarNote({
  noteEn, noteJa, headlineEn, headlineJa, listingTitle,
  editable, onTextSave, onHeadlineSave,
}: ShowcaseScholarNoteProps) {
  const [showJa, setShowJa] = useState(false);

  if (!editable && !noteEn && !noteJa) return null;

  const isShowingJa = showJa && noteJa;
  const displayText = isShowingJa ? noteJa : (noteEn || noteJa);
  const displayHeadline = isShowingJa ? (headlineJa || headlineEn) : (headlineEn || headlineJa);
  const hasToggle = noteEn && noteJa;
  const hasHeroContent = listingTitle || displayHeadline;

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-8">
      <div className="max-w-[65ch] mx-auto">
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

        {/* Hero section: centered title + headline */}
        {listingTitle && (
          <h3 className="text-center font-serif text-xl md:text-2xl text-ink font-light tracking-tight mb-4">
            {listingTitle}
          </h3>
        )}

        {listingTitle && displayHeadline && (
          <div className="w-64 h-px bg-gradient-to-r from-transparent via-amber-600/60 to-transparent mx-auto mb-4" />
        )}

        {displayHeadline && (
          editable && onHeadlineSave ? (
            <EditableText
              value={displayHeadline}
              onSave={(v) => onHeadlineSave(isShowingJa ? 'ja' : 'en', v)}
              className="text-center text-[17px] md:text-[19px] leading-[1.7] italic text-ink/80 mb-4"
              placeholder="Add headline..."
            >
              <p className="text-center text-[17px] md:text-[19px] leading-[1.7] italic text-ink/80 mb-4">
                {displayHeadline}
              </p>
            </EditableText>
          ) : (
            <p className="text-center text-[17px] md:text-[19px] leading-[1.7] italic text-ink/80 mb-4">
              {displayHeadline}
            </p>
          )
        )}

        {hasHeroContent && (
          <div className="w-64 h-px bg-gradient-to-r from-transparent via-amber-600/60 to-transparent mx-auto mb-5" />
        )}

        {/* Full note body */}
        {editable ? (
          <EditableText
            value={displayText || null}
            onSave={(v) => onTextSave?.(isShowingJa ? 'ja' : 'en', v) ?? Promise.resolve()}
            className="prose-translation text-[15px] md:text-[17px] leading-[1.85] font-light whitespace-pre-wrap"
            placeholder="Add scholar's note..."
          >
            {displayText ? (
              <div className="prose-translation text-[15px] md:text-[17px] leading-[1.85] font-light">
                <HighlightedMarkdown content={displayText} variant="translation" />
              </div>
            ) : undefined}
          </EditableText>
        ) : (
          <div className="prose-translation text-[15px] md:text-[17px] leading-[1.85] font-light">
            <HighlightedMarkdown content={displayText || ''} variant="translation" />
          </div>
        )}
      </div>
    </div>
  );
}
