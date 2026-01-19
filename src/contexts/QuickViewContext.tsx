'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import type { Listing } from '@/types';
import { useSignupPressureOptional } from './SignupPressureContext';
import { getAllImages } from '@/lib/images';
import { captureScrollPosition, getCapturedScrollPosition } from '@/hooks/useBodyScrollLock';

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
  /** Scroll position saved when modal opened (for restoration) */
  savedScrollPosition: number;
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
  const pathname = usePathname();
  const signupPressure = useSignupPressureOptional();

  const [isOpen, setIsOpen] = useState(false);
  const [currentListing, setCurrentListing] = useState<Listing | null>(null);
  const [listings, setListingsState] = useState<Listing[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  // Store scroll position as STATE so it's properly passed through context
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);

  // Cooldown to prevent immediate re-opening after close
  const closeCooldown = useRef(false);

  // Ref to capture scroll position on mousedown (before any state changes)
  const mousedownScrollPosition = useRef(0);

  // Track isOpen state in a ref for use in event handlers
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;

  // Capture scroll position on mousedown - uses global capture for reliability
  // This ensures we have the scroll position before any React updates or
  // browser-initiated scrolling (like scrollIntoView)
  useEffect(() => {
    const handleMouseDown = () => {
      // captureScrollPosition checks if scroll lock is active internally
      captureScrollPosition();
      // Also store locally for backward compatibility
      if (!isOpenRef.current) {
        mousedownScrollPosition.current = window.scrollY;
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Find index of listing in the listings array
  const findListingIndex = useCallback((listing: Listing) => {
    return listings.findIndex((l) => l.id === listing.id);
  }, [listings]);

  // Update URL synchronously using history API (no React re-renders)
  const updateUrl = useCallback((listingId: number | null) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);

    if (listingId !== null) {
      url.searchParams.set('listing', String(listingId));
    } else {
      url.searchParams.delete('listing');
    }

    // Use replaceState to update URL without triggering navigation
    window.history.replaceState(null, '', url.toString());
  }, []);

  // Open quick view
  const openQuickView = useCallback((listing: Listing) => {
    // Prevent re-opening during cooldown (after close)
    if (closeCooldown.current) {
      return;
    }

    // Set global scroll lock flag SYNCHRONOUSLY before any React state updates
    // This prevents virtual scroll from reacting to any scroll events during the transition
    if (typeof window !== 'undefined') {
      window.__scrollLockActive = true;
    }

    // Get scroll position from global capture (set on mousedown) or local ref
    // The global capture is the most reliable as it's set synchronously on mousedown
    const scrollPos = getCapturedScrollPosition() || mousedownScrollPosition.current || window.scrollY;
    setSavedScrollPosition(scrollPos);

    setCurrentListing(listing);
    setIsOpen(true);

    const index = findListingIndex(listing);
    setCurrentIndex(index);

    // Update URL
    updateUrl(listing.id);

    // Track for signup pressure system
    signupPressure?.trackQuickView();
  }, [findListingIndex, updateUrl, signupPressure]);

  // Close quick view
  const closeQuickView = useCallback(() => {
    // Set cooldown to prevent immediate re-opening from click propagation
    closeCooldown.current = true;

    setIsOpen(false);
    setCurrentListing(null);
    setCurrentIndex(-1);

    // Remove listing from URL
    updateUrl(null);

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

    updateUrl(nextListing.id);
  }, [listings, currentIndex, updateUrl]);

  // Navigate to previous listing
  const goToPrevious = useCallback(() => {
    if (listings.length === 0 || currentIndex === -1) return;

    const prevIndex = currentIndex === 0 ? listings.length - 1 : currentIndex - 1;
    const prevListing = listings[prevIndex];

    setCurrentListing(prevListing);
    setCurrentIndex(prevIndex);

    updateUrl(prevListing.id);
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

  // Handle browser back button (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const url = new URL(window.location.href);
      const listingIdParam = url.searchParams.get('listing');

      if (!listingIdParam && isOpen) {
        // User pressed back, close the modal
        setIsOpen(false);
        setCurrentListing(null);
        setCurrentIndex(-1);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen]);

  // Keyboard navigation (arrow keys only - Escape is handled by QuickViewModal)
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
        // NOTE: Escape key handling is done in QuickViewModal.tsx to ensure
        // proper animation sequencing. Do NOT add Escape handling here.
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNext, goToPrevious]);

  // NOTE: Body scroll locking is handled by useBodyScrollLock in QuickViewModal
  // Don't duplicate it here - that causes race conditions and scroll jump issues

  // Prefetch images for adjacent listings when navigating
  // This makes J/K navigation feel instant
  useEffect(() => {
    if (!isOpen || currentIndex === -1 || listings.length === 0) return;

    const preloadImages = (listing: Listing, count: number = 2) => {
      const images = getAllImages(listing);
      images.slice(0, count).forEach((url) => {
        const img = new window.Image();
        img.src = url;
      });
    };

    // Preload previous listing
    if (currentIndex > 0) {
      preloadImages(listings[currentIndex - 1]);
    }

    // Preload next listing
    if (currentIndex < listings.length - 1) {
      preloadImages(listings[currentIndex + 1]);
    }
  }, [isOpen, currentIndex, listings]);

  const hasNext = listings.length > 0 && currentIndex !== -1;
  const hasPrevious = listings.length > 0 && currentIndex !== -1;

  // Memoize the context value to prevent unnecessary re-renders in consumers
  const value: QuickViewContextType = useMemo(
    () => ({
      isOpen,
      currentListing,
      openQuickView,
      closeQuickView,
      savedScrollPosition, // Now a state variable, properly triggers re-render
      listings,
      currentIndex,
      goToNext,
      goToPrevious,
      hasNext,
      hasPrevious,
      setListings,
    }),
    [
      isOpen,
      currentListing,
      openQuickView,
      closeQuickView,
      savedScrollPosition, // Added to dependencies
      listings,
      currentIndex,
      goToNext,
      goToPrevious,
      hasNext,
      hasPrevious,
      setListings,
    ]
  );

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
