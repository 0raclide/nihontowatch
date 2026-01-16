'use client';

import Image from 'next/image';
import type { SearchSuggestion } from '@/lib/search/types';

interface SearchResultPreviewProps {
  suggestion: SearchSuggestion;
  onClick: () => void;
  isHighlighted?: boolean;
}

// Item type display labels
const ITEM_TYPE_LABELS: Record<string, string> = {
  katana: 'Katana',
  wakizashi: 'Wakizashi',
  tanto: 'Tanto',
  tachi: 'Tachi',
  naginata: 'Naginata',
  yari: 'Yari',
  tsuba: 'Tsuba',
  'fuchi-kashira': 'Fuchi-Kashira',
  fuchi_kashira: 'Fuchi-Kashira',
  kozuka: 'Kozuka',
  menuki: 'Menuki',
  koshirae: 'Koshirae',
  armor: 'Armor',
  kabuto: 'Kabuto',
};

function formatItemType(type: string | null): string | null {
  if (!type) return null;
  const normalized = type.toLowerCase();
  return ITEM_TYPE_LABELS[normalized] || type;
}

function formatPrice(value: number | null, currency: string | null): string {
  if (value === null) return 'Ask';

  const curr = currency || 'JPY';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return formatter.format(Math.round(value));
}

// Tiny placeholder for blur effect
const BLUR_PLACEHOLDER =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y1ZjRmMCIvPjwvc3ZnPg==';

export function SearchResultPreview({
  suggestion,
  onClick,
  isHighlighted = false,
}: SearchResultPreviewProps) {
  const itemType = formatItemType(suggestion.item_type);
  const artisan = suggestion.smith || suggestion.tosogu_maker;

  // Truncate title for compact display
  const displayTitle =
    suggestion.title.length > 50
      ? suggestion.title.substring(0, 47) + '...'
      : suggestion.title;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
        isHighlighted
          ? 'bg-gold/10 dark:bg-gold/20'
          : 'hover:bg-linen/80 dark:hover:bg-gray-800/80'
      }`}
      role="option"
      aria-selected={isHighlighted}
    >
      {/* Image */}
      <div className="relative w-12 h-12 flex-shrink-0 bg-linen dark:bg-gray-800 overflow-hidden">
        {suggestion.image_url ? (
          <Image
            src={suggestion.image_url}
            alt={suggestion.title}
            fill
            className="object-cover"
            sizes="48px"
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-muted/30 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title row with type badge */}
        <div className="flex items-center gap-2">
          {itemType && (
            <span className="text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 bg-linen dark:bg-gray-700 text-charcoal dark:text-gray-300 flex-shrink-0">
              {itemType}
            </span>
          )}
          <span className="text-[12px] text-ink dark:text-white truncate">
            {artisan || displayTitle}
          </span>
        </div>

        {/* Dealer */}
        <div className="text-[10px] text-muted dark:text-gray-500 mt-0.5">
          {suggestion.dealer_domain}
        </div>
      </div>

      {/* Price */}
      <div className="flex-shrink-0 text-right">
        <span className="text-[12px] font-medium tabular-nums text-ink dark:text-white">
          {formatPrice(suggestion.price_value, suggestion.price_currency)}
        </span>
      </div>
    </button>
  );
}
