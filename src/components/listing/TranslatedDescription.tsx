'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Listing } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';

// =============================================================================
// TYPES
// =============================================================================

interface TranslatedDescriptionProps {
  listing: Listing;
  className?: string;
  maxLines?: number;
}

import { isPredominantlyJapanese } from '@/lib/text/japanese';

// =============================================================================
// COMPONENT
// =============================================================================

export function TranslatedDescription({
  listing,
  className = '',
  maxLines = 6,
}: TranslatedDescriptionProps) {
  const { t, locale } = useLocale();

  // Check if description has Japanese text
  const hasJapanese = listing.description ? isPredominantlyJapanese(listing.description) : false;

  // Initialize translation state based on locale and direction
  const getInitialTranslation = useCallback(() => {
    if (locale === 'ja' && !hasJapanese) {
      // EN→JP: use cached JP translation
      return listing.description_ja || null;
    }
    // JP→EN: use cached EN translation
    return listing.description_en || null;
  }, [locale, hasJapanese, listing.description_en, listing.description_ja]);

  const [translation, setTranslation] = useState<string | null>(getInitialTranslation);
  const [isLoading, setIsLoading] = useState(false);
  // Show original text by default ONLY when locale matches source language:
  // JA locale + JP-source → show original (Japanese)
  // JA locale + EN-source → show translation (Japanese), not the English original
  // EN locale → show translation (English)
  const [showOriginal, setShowOriginal] = useState(locale === 'ja' && hasJapanese);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // Fetch translation when needed (both directions)
  const fetchTranslation = useCallback(async () => {
    if (!listing.description || translation) return;

    // EN locale: only fetch if source is Japanese
    if (locale === 'en' && !hasJapanese) return;
    // JA locale: only fetch if source is English
    if (locale === 'ja' && hasJapanese) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id }),
      });

      const data = await response.json();

      if (data.translation) {
        setTranslation(data.translation);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error('Translation fetch error:', err);
      setError('Failed to load translation');
    } finally {
      setIsLoading(false);
    }
  }, [listing.id, listing.description, translation, hasJapanese, locale]);

  // Trigger translation on mount if needed (both directions)
  useEffect(() => {
    if (locale === 'en' && listing.description && hasJapanese && !listing.description_en) {
      fetchTranslation();
    } else if (locale === 'ja' && listing.description && !hasJapanese && !listing.description_ja) {
      fetchTranslation();
    }
  }, [locale, listing.description, listing.description_en, listing.description_ja, hasJapanese, fetchTranslation]);

  // Sync translation state when cached translation becomes available
  useEffect(() => {
    if (locale === 'ja' && !hasJapanese && listing.description_ja && !translation) {
      setTranslation(listing.description_ja);
    } else if (listing.description_en && !translation) {
      setTranslation(listing.description_en);
    }
  }, [locale, hasJapanese, listing.description_en, listing.description_ja, translation]);

  // Reset showOriginal when locale changes
  useEffect(() => {
    setShowOriginal(locale === 'ja' && hasJapanese);
  }, [locale, hasJapanese]);

  // Reset expanded state when listing changes or when toggling original/translation
  useEffect(() => {
    setIsExpanded(false);
    setIsTruncated(false);
  }, [listing.id, showOriginal]);

  // Detect if text is truncated (needs "Read more")
  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current && !isExpanded) {
        const { scrollHeight, clientHeight } = textRef.current;
        setIsTruncated(scrollHeight > clientHeight + 1);
      }
    };

    checkTruncation();
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [translation, showOriginal, isLoading, isExpanded]);

  // No description to show
  if (!listing.description) {
    return null;
  }

  // Determine which text to display
  const displayText = showOriginal ? listing.description : (translation || listing.description);

  // Toggle label depends on current state and locale:
  // When showing original → offer "Show translation" (EN) or "翻訳を表示" (JA)
  // When showing translation → offer "Show original" (EN) or "原文を表示" (JA)
  const toggleLabel = showOriginal ? t('listing.showTranslation') : t('listing.showOriginal');

  return (
    <div className={`px-4 py-3 lg:px-5 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-wider text-muted font-medium">
          {t('listing.description')}
        </h3>
        {/* Show toggle only if we have both original and translation */}
        {translation && translation !== listing.description && (
          <button
            type="button"
            onClick={() => setShowOriginal(!showOriginal)}
            className="text-[10px] text-gold hover:text-gold-light transition-colors"
          >
            {toggleLabel}
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-border rounded w-full" />
          <div className="h-3 bg-border rounded w-[90%]" />
          <div className="h-3 bg-border rounded w-[75%]" />
        </div>
      )}

      {/* Error state - show original */}
      {error && !isLoading && (
        <>
          <p
            ref={textRef}
            className="text-[13px] text-ink/80 leading-relaxed whitespace-pre-line"
            style={isExpanded ? {} : {
              display: '-webkit-box',
              WebkitLineClamp: maxLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {listing.description}
          </p>
          <p className="text-[10px] text-muted mt-1">{t('listing.translationUnavailable')}</p>
          {(isTruncated || isExpanded) && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[12px] text-gold hover:text-gold-light transition-colors mt-2 font-medium"
            >
              {isExpanded ? t('listing.showLess') : t('listing.readMore')}
            </button>
          )}
        </>
      )}

      {/* Normal display */}
      {!isLoading && !error && (
        <>
          <p
            ref={textRef}
            className="text-[13px] text-ink/80 leading-relaxed whitespace-pre-line"
            style={isExpanded ? {} : {
              display: '-webkit-box',
              WebkitLineClamp: maxLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {displayText}
          </p>
          {(isTruncated || isExpanded) && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[12px] text-gold hover:text-gold-light transition-colors mt-2 font-medium"
            >
              {isExpanded ? t('listing.showLess') : t('listing.readMore')}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default TranslatedDescription;
