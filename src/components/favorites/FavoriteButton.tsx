'use client';

import { useState, useCallback } from 'react';
import { useFavorites } from '@/hooks/useFavorites';

interface WatchButtonProps {
  listingId: number;
  initialFavorited?: boolean;
  initialWatched?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onSignupPrompt?: () => void;
}

/**
 * Watch button (star icon) for adding items to watchlist.
 * Shows signup prompt for unauthenticated users.
 */
export function FavoriteButton({
  listingId,
  initialFavorited,
  initialWatched,
  className = '',
  size = 'md',
  onSignupPrompt,
}: WatchButtonProps) {
  const { isFavorited, toggleFavorite, isAuthenticated, isLoading } = useFavorites();
  const [isToggling, setIsToggling] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // Support both prop names for backwards compatibility
  const initialValue = initialWatched ?? initialFavorited;

  // Use initial value only if provided and hook is still loading
  const watched = isLoading && initialValue !== undefined
    ? initialValue
    : isFavorited(listingId);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      if (onSignupPrompt) {
        onSignupPrompt();
      } else {
        setShowPrompt(true);
        setTimeout(() => setShowPrompt(false), 3000);
      }
      return;
    }

    if (isToggling) return;

    setIsToggling(true);
    await toggleFavorite(listingId);
    setIsToggling(false);
  }, [isAuthenticated, isToggling, toggleFavorite, listingId, onSignupPrompt]);

  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isToggling}
        data-watch-button
        className={`
          ${sizeClasses[size]}
          flex items-center justify-center
          rounded-full
          transition-all duration-200
          ${watched
            ? 'bg-gold text-white hover:opacity-90'
            : 'bg-paper/80 text-muted hover:text-gold hover:bg-paper'
          }
          ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
          backdrop-blur-sm
          shadow-sm hover:shadow-md
          ${className}
        `}
        aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
        title={!isAuthenticated ? 'Sign up to track items' : watched ? 'Remove from watchlist' : 'Add to watchlist'}
      >
        {watched ? (
          // Filled star
          <svg
            className={`${iconSizes[size]} ${isToggling ? 'animate-pulse' : ''}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ) : (
          // Outline star
          <svg
            className={`${iconSizes[size]} ${isToggling ? 'animate-pulse' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
        )}
      </button>

      {/* Inline signup prompt */}
      {showPrompt && (
        <div className="absolute top-full right-0 mt-2 z-50 w-64 p-3 bg-cream rounded-lg shadow-lg border border-border animate-fadeIn">
          <p className="text-[12px] text-ink leading-relaxed">
            <span className="font-medium">Sign up</span> to create a watchlist and get alerts when prices drop.
          </p>
          <a
            href="/auth/login"
            className="mt-2 block text-center text-[11px] font-medium text-gold hover:underline"
          >
            Sign up free
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * A smaller inline watch button for use in lists
 */
export function FavoriteButtonInline({
  listingId,
  initialFavorited,
  initialWatched,
  className = '',
}: Omit<WatchButtonProps, 'size'>) {
  const { isFavorited, toggleFavorite, isAuthenticated, isLoading } = useFavorites();
  const [isToggling, setIsToggling] = useState(false);

  const initialValue = initialWatched ?? initialFavorited;
  const watched = isLoading && initialValue !== undefined
    ? initialValue
    : isFavorited(listingId);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated || isToggling) return;

    setIsToggling(true);
    await toggleFavorite(listingId);
    setIsToggling(false);
  }, [isAuthenticated, isToggling, toggleFavorite, listingId]);

  return (
    <button
      onClick={handleClick}
      disabled={isToggling || !isAuthenticated}
      data-watch-button
      className={`
        p-1.5
        transition-colors duration-200
        ${watched
          ? 'text-gold'
          : 'text-muted hover:text-gold'
        }
        ${isToggling ? 'opacity-50' : ''}
        disabled:cursor-not-allowed
        ${className}
      `}
      aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      {watched ? (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      )}
    </button>
  );
}
