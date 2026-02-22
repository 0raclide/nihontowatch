'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Listing } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';

// =============================================================================
// TYPES
// =============================================================================

interface TranslatedTitleProps {
  listing: Listing;
  className?: string;
}

// Japanese character detection regex
const JAPANESE_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * TranslatedTitle displays the listing title with locale-aware selection.
 *
 * Behavior:
 * - JA locale: Shows original title (listing.title). No auto-translate.
 * - EN locale: Shows cached translation (title_en) if available, otherwise
 *   fetches translation for Japanese titles. Falls back to original title.
 */
export function TranslatedTitle({
  listing,
  className = '',
}: TranslatedTitleProps) {
  const { t, locale } = useLocale();

  // Select initial display title based on locale
  const getInitialTitle = useCallback(() => {
    if (locale === 'ja') {
      return listing.title || t('listing.untitled');
    }
    return listing.title_en || listing.title || t('listing.untitled');
  }, [locale, listing.title, listing.title_en, t]);

  const [displayTitle, setDisplayTitle] = useState<string>(getInitialTitle);
  const [isTranslating, setIsTranslating] = useState(false);

  // Check if title has Japanese text that needs translation
  const hasJapanese = listing.title ? JAPANESE_REGEX.test(listing.title) : false;
  const needsTranslation = locale === 'en' && hasJapanese && !listing.title_en;

  // Fetch translation if needed (EN locale only)
  const fetchTranslation = useCallback(async () => {
    if (!listing.title || !needsTranslation || isTranslating) return;

    setIsTranslating(true);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          type: 'title',
        }),
      });

      const data = await response.json();

      if (data.translation) {
        setDisplayTitle(data.translation);
      }
    } catch (err) {
      console.error('Title translation fetch error:', err);
      // Keep original title on error
    } finally {
      setIsTranslating(false);
    }
  }, [listing.id, listing.title, needsTranslation, isTranslating]);

  // Trigger translation on mount if needed
  useEffect(() => {
    if (needsTranslation) {
      fetchTranslation();
    }
  }, [needsTranslation, fetchTranslation]);

  // Update display title if listing or locale changes
  useEffect(() => {
    setDisplayTitle(getInitialTitle());
  }, [getInitialTitle]);

  // No title to show
  if (!listing.title) {
    return null;
  }

  return (
    <h2 className={`font-serif text-lg text-ink leading-snug ${className}`}>
      {displayTitle}
    </h2>
  );
}

export default TranslatedTitle;
