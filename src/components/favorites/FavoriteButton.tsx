'use client';

import { useState, useCallback } from 'react';
import { useFavorites } from '@/hooks/useFavorites';

interface FavoriteButtonProps {
  listingId: number;
  initialFavorited?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLoginPrompt?: () => void;
}

export function FavoriteButton({
  listingId,
  initialFavorited,
  className = '',
  size = 'md',
  showLoginPrompt,
}: FavoriteButtonProps) {
  const { isFavorited, toggleFavorite, isAuthenticated, isLoading } = useFavorites();
  const [isToggling, setIsToggling] = useState(false);

  // Use initialFavorited only if provided and hook is still loading
  const favorited = isLoading && initialFavorited !== undefined
    ? initialFavorited
    : isFavorited(listingId);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      if (showLoginPrompt) {
        showLoginPrompt();
      }
      return;
    }

    if (isToggling) return;

    setIsToggling(true);
    await toggleFavorite(listingId);
    setIsToggling(false);
  }, [isAuthenticated, isToggling, toggleFavorite, listingId, showLoginPrompt]);

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
    <button
      onClick={handleClick}
      disabled={isToggling}
      className={`
        ${sizeClasses[size]}
        flex items-center justify-center
        rounded-full
        transition-all duration-200
        ${favorited
          ? 'bg-burgundy/90 text-white hover:bg-burgundy'
          : 'bg-white/80 theme-dark:bg-gray-800/80 text-muted hover:text-burgundy hover:bg-white theme-dark:hover:bg-gray-800'
        }
        ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
        backdrop-blur-sm
        shadow-sm hover:shadow-md
        ${className}
      `}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      title={!isAuthenticated ? 'Sign in to save favorites' : favorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      {favorited ? (
        // Filled heart
        <svg
          className={`${iconSizes[size]} ${isToggling ? 'animate-pulse' : ''}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ) : (
        // Outline heart
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
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      )}
    </button>
  );
}

/**
 * A smaller inline favorite button for use in lists
 */
export function FavoriteButtonInline({
  listingId,
  initialFavorited,
  className = '',
}: Omit<FavoriteButtonProps, 'size'>) {
  const { isFavorited, toggleFavorite, isAuthenticated, isLoading } = useFavorites();
  const [isToggling, setIsToggling] = useState(false);

  const favorited = isLoading && initialFavorited !== undefined
    ? initialFavorited
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
      className={`
        p-1.5
        transition-colors duration-200
        ${favorited
          ? 'text-burgundy'
          : 'text-muted hover:text-burgundy'
        }
        ${isToggling ? 'opacity-50' : ''}
        disabled:cursor-not-allowed
        ${className}
      `}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      {favorited ? (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      )}
    </button>
  );
}
