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

// Japanese character detection regex
const JAPANESE_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

// =============================================================================
// COMPONENT
// =============================================================================

export function TranslatedDescription({
  listing,
  className = '',
  maxLines = 6,
}: TranslatedDescriptionProps) {
  const { t, locale } = useLocale();
  const [translation, setTranslation] = useState<string | null>(listing.description_en || null);
  const [isLoading, setIsLoading] = useState(false);
  // JA locale: default to showing original (Japanese) text
  // EN locale: default to showing translation
  const [showOriginal, setShowOriginal] = useState(locale === 'ja');
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // Check if description has Japanese text
  const hasJapanese = listing.description ? JAPANESE_REGEX.test(listing.description) : false;

  // Only fetch translation in EN locale when needed
  const fetchTranslation = useCallback(async () => {
    if (!listing.description || translation || !hasJapanese || locale === 'ja') return;

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

  // Trigger translation on mount if needed (EN locale only)
  useEffect(() => {
    if (locale === 'en' && listing.description && hasJapanese && !listing.description_en) {
      fetchTranslation();
    }
  }, [locale, listing.description, listing.description_en, hasJapanese, fetchTranslation]);

  // Sync translation state when listing.description_en becomes available
  useEffect(() => {
    if (listing.description_en && !translation) {
      setTranslation(listing.description_en);
    }
  }, [listing.description_en, translation]);

  // Reset showOriginal when locale changes
  useEffect(() => {
    setShowOriginal(locale === 'ja');
  }, [locale]);

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
        {hasJapanese && translation && translation !== listing.description && (
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
