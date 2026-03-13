'use client';

import { useState } from 'react';
import { HighlightedMarkdown } from '@/components/glossary/HighlightedMarkdown';
import { EditableText } from '@/components/listing/EditableText';

interface ShowcaseScholarNoteProps {
  noteEn: string | null;
  noteJa: string | null;
  editable?: boolean;
  onTextSave?: (lang: 'en' | 'ja', newText: string | null) => Promise<void>;
}

/**
 * Scholar's Note section — AI-generated curator's analysis.
 * Uses prose width (65ch) for readable long-form text.
 * Container is media width (960px) so it aligns with section headers.
 */
export function ShowcaseScholarNote({ noteEn, noteJa, editable, onTextSave }: ShowcaseScholarNoteProps) {
  const [showJa, setShowJa] = useState(false);

  if (!editable && !noteEn && !noteJa) return null;

  const isShowingJa = showJa && noteJa;
  const displayText = isShowingJa ? noteJa : (noteEn || noteJa);
  const hasToggle = noteEn && noteJa;

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
