'use client';

import { useState } from 'react';
import type { Listing } from '@/types';
import { useCurrency, formatPriceWithConversion } from '@/hooks/useCurrency';
import { getAttributionName } from '@/lib/listing/attribution';

interface SocialPreviewCardProps {
  listing: Listing;
  platform?: 'discord' | 'twitter' | 'facebook' | 'imessage';
  className?: string;
}

/**
 * Social Preview Card
 *
 * Shows what a listing will look like when shared on various social platforms.
 * This helps users preview their share before sending and demonstrates that
 * the cache-busting solution is working.
 *
 * Supports: Discord, Twitter/X, Facebook, iMessage
 */
export function SocialPreviewCard({
  listing,
  platform = 'discord',
  className = '',
}: SocialPreviewCardProps) {
  const { currency, exchangeRates } = useCurrency();
  const [imageError, setImageError] = useState(false);

  // Get the OG image URL (pre-generated or fallback)
  const ogImageUrl =
    listing.og_image_url ||
    `${typeof window !== 'undefined' ? window.location.origin : ''}/api/og?id=${listing.id}`;

  // Format price for display
  const priceDisplay = formatPriceWithConversion(
    listing.price_value,
    listing.price_currency,
    currency,
    exchangeRates
  );

  // Get artisan name
  const artisan = getAttributionName(listing);

  // Build description
  let description = `${priceDisplay}`;
  if (artisan) description += ` - ${artisan}`;
  if (listing.cert_type) description += ` - ${listing.cert_type}`;

  // Platform-specific rendering
  switch (platform) {
    case 'discord':
      return (
        <div
          className={`bg-[#2b2d31] rounded-lg overflow-hidden max-w-[520px] shadow-lg ${className}`}
          data-testid="social-preview-discord"
        >
          {/* Link header */}
          <div className="px-4 py-2 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center">
              <span className="text-gold text-xs font-bold">N</span>
            </div>
            <span className="text-[#00b0f4] text-sm font-medium">nihontowatch.com</span>
          </div>

          {/* Embed card */}
          <div className="mx-3 mb-3 bg-[#2b2d31] rounded border-l-4 border-gold">
            {/* Text content */}
            <div className="p-3">
              <div className="text-[#00a8fc] font-medium text-base hover:underline cursor-pointer">
                {listing.title}
              </div>
              <div className="text-[#b5bac1] text-sm mt-1 line-clamp-2">{description}</div>
            </div>

            {/* OG Image */}
            {!imageError && (
              <div className="relative aspect-[1200/630] w-full">
                <img
                  src={ogImageUrl}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              </div>
            )}
          </div>
        </div>
      );

    case 'twitter':
      return (
        <div
          className={`bg-white dark:bg-[#15202b] rounded-2xl overflow-hidden max-w-[506px] shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}
          data-testid="social-preview-twitter"
        >
          {/* OG Image */}
          {!imageError && (
            <div className="relative aspect-[1200/630] w-full bg-gray-100 dark:bg-gray-800">
              <img
                src={ogImageUrl}
                alt={listing.title}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            </div>
          )}

          {/* Card content */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-gray-500 dark:text-gray-400 text-sm">nihontowatch.com</div>
            <div className="text-gray-900 dark:text-white font-bold text-base mt-0.5">
              {listing.title}
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-sm mt-0.5 line-clamp-2">
              {description}
            </div>
          </div>
        </div>
      );

    case 'facebook':
      return (
        <div
          className={`bg-[#f0f2f5] dark:bg-[#242526] rounded-lg overflow-hidden max-w-[500px] shadow-lg ${className}`}
          data-testid="social-preview-facebook"
        >
          {/* OG Image */}
          {!imageError && (
            <div className="relative aspect-[1200/630] w-full bg-gray-200 dark:bg-gray-700">
              <img
                src={ogImageUrl}
                alt={listing.title}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            </div>
          )}

          {/* Card content */}
          <div className="p-3 bg-white dark:bg-[#3a3b3c]">
            <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
              nihontowatch.com
            </div>
            <div className="text-gray-900 dark:text-white font-semibold text-base mt-1">
              {listing.title}
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-sm mt-1 line-clamp-2">
              {description}
            </div>
          </div>
        </div>
      );

    case 'imessage':
      return (
        <div
          className={`bg-[#e5e5ea] dark:bg-[#3a3a3c] rounded-2xl overflow-hidden max-w-[280px] shadow-lg ${className}`}
          data-testid="social-preview-imessage"
        >
          {/* OG Image */}
          {!imageError && (
            <div className="relative aspect-[1200/630] w-full">
              <img
                src={ogImageUrl}
                alt={listing.title}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            </div>
          )}

          {/* Card content */}
          <div className="p-2">
            <div className="text-gray-900 dark:text-white font-semibold text-sm line-clamp-2">
              {listing.title}
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
              nihontowatch.com
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

/**
 * Social Preview Panel
 *
 * Shows previews for multiple platforms with a platform selector.
 * Used in listing detail pages or share modals.
 */
interface SocialPreviewPanelProps {
  listing: Listing;
  className?: string;
}

export function SocialPreviewPanel({ listing, className = '' }: SocialPreviewPanelProps) {
  const [platform, setPlatform] = useState<'discord' | 'twitter' | 'facebook' | 'imessage'>(
    'discord'
  );

  const platforms = [
    { id: 'discord' as const, label: 'Discord', icon: DiscordIcon },
    { id: 'twitter' as const, label: 'X/Twitter', icon: TwitterIcon },
    { id: 'facebook' as const, label: 'Facebook', icon: FacebookIcon },
    { id: 'imessage' as const, label: 'iMessage', icon: IMessageIcon },
  ];

  return (
    <div className={`bg-paper rounded-xl overflow-hidden ${className}`} data-testid="social-preview-panel">
      {/* Platform selector */}
      <div className="flex border-b border-border">
        {platforms.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPlatform(id)}
            className={`flex-1 px-3 py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
              platform === id
                ? 'text-gold border-b-2 border-gold bg-gold/5'
                : 'text-muted hover:text-ink hover:bg-linen/50'
            }`}
            data-testid={`platform-tab-${id}`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="p-4 bg-[#36393f] flex items-center justify-center min-h-[300px]">
        <SocialPreviewCard listing={listing} platform={platform} />
      </div>

      {/* Info footer */}
      <div className="px-4 py-3 bg-linen/50 border-t border-border">
        <p className="text-xs text-muted text-center">
          This is a preview of how your shared link will appear. Actual appearance may vary.
        </p>
      </div>
    </div>
  );
}

// Platform icons
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function IMessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.936 1.444 5.544 3.697 7.252.147.111.24.291.24.488l-.002 2.227c-.002.396.453.622.767.38l2.134-1.64c.129-.1.296-.14.457-.108.836.172 1.705.258 2.607.258 5.523 0 10-4.145 10-9.243S17.523 2 12 2z" />
    </svg>
  );
}
