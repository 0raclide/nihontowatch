'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { Listing } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface QuickViewContextType {
  /** Whether the quick view modal is open */
  isOpen: boolean;
  /** The currently displayed listing */
  currentListing: Listing | null;
  /** Open quick view for a specific listing */
  openQuickView: (listing: Listing) => void;
  /** Close the quick view modal */
  closeQuickView: () => void;
  /** Array of listings for navigation (optional) */
  listings: Listing[];
  /** Current index in the listings array */
  currentIndex: number;
  /** Navigate to the next listing */
  goToNext: () => void;
  /** Navigate to the previous listing */
  goToPrevious: () => void;
  /** Whether there is a next listing */
  hasNext: boolean;
  /** Whether there is a previous listing */
  hasPrevious: boolean;
  /** Set the listings array for navigation */
  setListings: (listings: Listing[]) => void;
}

// ============================================================================
// Context
// ============================================================================

const QuickViewContext = createContext<QuickViewContextType | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface QuickViewProviderProps {
  children: ReactNode;
}

export function QuickViewProvider({ children }: QuickViewProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const [currentListing, setCurrentListing] = useState<Listing | null>(null);
  const [listings, setListingsState] = useState<Listing[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Track if we pushed a state to avoid double-handling
  const isProgrammaticNavigation = useRef(false);
  // Track the original URL before opening quick view
  const originalUrl = useRef<string | null>(null);
  // Cooldown to prevent immediate re-opening after close
  const closeCooldown = useRef(false);

  // Find index of listing in the listings array
  const findListingIndex = useCallback((listing: Listing) => {
    return listings.findIndex((l) => l.id === listing.id);
  }, [listings]);

  // Update URL with listing parameter
  const updateUrl = useCallback((listingId: number | null, shouldReplace = false) => {
    const params = new URLSearchParams(searchParams.toString());

    if (listingId !== null) {
      params.set('listing', String(listingId));
    } else {
      params.delete('listing');
    }

    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;

    isProgrammaticNavigation.current = true;

    if (shouldReplace) {
      router.replace(newUrl, { scroll: false });
    } else {
      router.push(newUrl, { scroll: false });
    }

    // Reset flag after navigation
    setTimeout(() => {
      isProgrammaticNavigation.current = false;
    }, 100);
  }, [pathname, searchParams, router]);

  // Open quick view
  const openQuickView = useCallback((listing: Listing) => {
    // Prevent re-opening during cooldown (after close)
    if (closeCooldown.current) {
      return;
    }

    // Store the original URL before opening
    if (!isOpen) {
      originalUrl.current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    }

    setCurrentListing(listing);
    setIsOpen(true);

    const index = findListingIndex(listing);
    setCurrentIndex(index);

    // Update URL with listing ID (push new history entry)
    updateUrl(listing.id, false);
  }, [findListingIndex, updateUrl, isOpen, pathname, searchParams]);

  // Close quick view
  const closeQuickView = useCallback(() => {
    // Set cooldown to prevent immediate re-opening from click propagation
    closeCooldown.current = true;

    setIsOpen(false);
    setCurrentListing(null);
    setCurrentIndex(-1);

    // Remove listing from URL (replace to avoid extra history entry)
    updateUrl(null, true);

    originalUrl.current = null;

    // Reset cooldown after animation completes
    setTimeout(() => {
      closeCooldown.current = false;
    }, 300);
  }, [updateUrl]);

  // Navigate to next listing
  const goToNext = useCallback(() => {
    if (listings.length === 0 || currentIndex === -1) return;

    const nextIndex = (currentIndex + 1) % listings.length;
    const nextListing = listings[nextIndex];

    setCurrentListing(nextListing);
    setCurrentIndex(nextIndex);

    // Replace URL to avoid building up history
    updateUrl(nextListing.id, true);
  }, [listings, currentIndex, updateUrl]);

  // Navigate to previous listing
  const goToPrevious = useCallback(() => {
    if (listings.length === 0 || currentIndex === -1) return;

    const prevIndex = currentIndex === 0 ? listings.length - 1 : currentIndex - 1;
    const prevListing = listings[prevIndex];

    setCurrentListing(prevListing);
    setCurrentIndex(prevIndex);

    // Replace URL to avoid building up history
    updateUrl(prevListing.id, true);
  }, [listings, currentIndex, updateUrl]);

  // Set listings array for navigation
  const setListings = useCallback((newListings: Listing[]) => {
    setListingsState(newListings);

    // Update current index if we have an open listing
    if (currentListing) {
      const index = newListings.findIndex((l) => l.id === currentListing.id);
      setCurrentIndex(index);
    }
  }, [currentListing]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const listingIdParam = searchParams.get('listing');

    // Skip if this was a programmatic navigation
    if (isProgrammaticNavigation.current) {
      return;
    }

    if (listingIdParam) {
      // URL has listing param - try to find and open it
      const listingId = parseInt(listingIdParam, 10);
      const listing = listings.find((l) => l.id === listingId);

      if (listing && (!isOpen || currentListing?.id !== listingId)) {
        setCurrentListing(listing);
        setIsOpen(true);
        setCurrentIndex(findListingIndex(listing));
      }
    } else {
      // No listing param - close if open
      if (isOpen) {
        setIsOpen(false);
        setCurrentListing(null);
        setCurrentIndex(-1);
        originalUrl.current = null;
      }
    }
  }, [searchParams, listings, isOpen, currentListing, findListingIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere with input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowRight':
        case 'j':
        case 'J':
          event.preventDefault();
          goToNext();
          break;
        case 'ArrowLeft':
        case 'k':
        case 'K':
          event.preventDefault();
          goToPrevious();
          break;
        case 'Escape':
          event.preventDefault();
          closeQuickView();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNext, goToPrevious, closeQuickView]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const hasNext = listings.length > 0 && currentIndex !== -1;
  const hasPrevious = listings.length > 0 && currentIndex !== -1;

  const value: QuickViewContextType = {
    isOpen,
    currentListing,
    openQuickView,
    closeQuickView,
    listings,
    currentIndex,
    goToNext,
    goToPrevious,
    hasNext,
    hasPrevious,
    setListings,
  };

  return (
    <QuickViewContext.Provider value={value}>
      {children}
    </QuickViewContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access the QuickView context
 * Throws an error if used outside of QuickViewProvider
 */
export function useQuickView(): QuickViewContextType {
  const context = useContext(QuickViewContext);
  if (!context) {
    throw new Error('useQuickView must be used within a QuickViewProvider');
  }
  return context;
}

/**
 * Hook to access the QuickView context optionally
 * Returns null if used outside of QuickViewProvider (useful for optional integration)
 */
export function useQuickViewOptional(): QuickViewContextType | null {
  return useContext(QuickViewContext);
}
