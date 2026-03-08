'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocale } from '@/i18n/LocaleContext';

interface SetsumeiPreviewProps {
  textEn: string;
  textJa: string | null;
  /** i18n key for the section label. Defaults to 'dealer.setsumeiCommentary'. */
  label?: string;
}

/** Read-only preview of NBTHK Zufu commentary auto-filled from catalog. */
export function SetsumeiPreview({ textEn, textJa, label = 'dealer.setsumeiCommentary' }: SetsumeiPreviewProps) {
  const { t, locale } = useLocale();
  // Default to the user's locale: JA users see Japanese first, EN users see English first
  const [showAlternate, setShowAlternate] = useState(false);
  const isJaLocale = locale === 'ja';
  const showingJa = textJa ? (isJaLocale ? !showAlternate : showAlternate) : false;
  const hasToggle = !!(textEn && textJa);
  return (
    <section>
      <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
        {t(label)}
      </label>
      <div className="rounded-lg border border-gold/20 bg-gold/5 dark:bg-gold/5">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gold/10">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-green-600 dark:text-green-400 font-medium">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t('dealer.setsumeiAutoFilled')}
          </span>
          {hasToggle && (
            <button
              type="button"
              onClick={() => setShowAlternate(!showAlternate)}
              className="text-[11px] text-gold hover:text-gold/80 font-medium transition-colors"
            >
              {showingJa ? t('dealer.setsumeiShowEnglish') : t('dealer.setsumeiShowOriginal')}
            </button>
          )}
        </div>
        <div className="px-3 py-2 max-h-[300px] overflow-y-auto">
          {showingJa ? (
            <p className="text-[13px] text-ink/80 leading-[1.85] whitespace-pre-line font-jp">
              {textJa}
            </p>
          ) : (
            <article className="prose-translation">
              <ReactMarkdown>{textEn}</ReactMarkdown>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
