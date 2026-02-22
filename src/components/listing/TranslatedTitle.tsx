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

import { containsJapanese } from '@/lib/text/japanese';

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * TranslatedTitle displays the listing title with locale-aware selection.
 *
 * Behavior:
 * - JA locale: Shows cached JP translation (title_ja) for English-source listings,
 *   otherwise shows original title. Auto-fetches JP translation if missing.
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
      // Prefer cached JP translation for English-source listings
      return listing.title_ja || listing.title || t('listing.untitled');
    }
    return listing.title_en || listing.title || t('listing.untitled');
  }, [locale, listing.title, listing.title_en, listing.title_ja, t]);

  const [displayTitle, setDisplayTitle] = useState<string>(getInitialTitle);
  const [isTranslating, setIsTranslating] = useState(false);

  // Check if title has Japanese text
  const hasJapanese = listing.title ? containsJapanese(listing.title) : false;

  // Needs translation: EN locale with Japanese source, or JA locale with English source
  const needsTranslation =
    (locale === 'en' && hasJapanese && !listing.title_en) ||
    (locale === 'ja' && !hasJapanese && !listing.title_ja);

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
