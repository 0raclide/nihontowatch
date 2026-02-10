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
import {
  getAllImages,
  isValidItemImage,
  getCachedValidation,
  setCachedValidation,
} from '@/lib/images';

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
  /** Refresh the current listing data from the API (e.g., after admin changes)
   *  Accepts optional partial listing fields for optimistic update (instant UI feedback) */
  refreshCurrentListing: (optimisticFields?: Partial<Listing>) => Promise<void>;
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

  // Cooldown to prevent immediate re-opening after close
  const closeCooldown = useRef(false);

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

  // Fetch full listing data from API (includes enrichment)
  const fetchFullListing = useCallback(async (listingId: number) => {
    try {
      const response = await fetch(`/api/listing/${listingId}`);
      if (!response.ok) {
        console.error('Failed to fetch full listing:', response.status);
        return null;
      }
      const data = await response.json();
      return data.listing as Listing;
    } catch (error) {
      console.error('Error fetching full listing:', error);
      return null;
    }
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

    // Use the listing from our pre-mapped array if available.
    // This ensures we get the properly mapped `dealer` property (singular)
    // instead of `dealers` (plural) from the raw Supabase response.
    // The listings array is set by VirtualListingGrid with correct mapping.
    const index = listings.findIndex((l) => l.id === listing.id);
    const mappedListing = index !== -1 ? listings[index] : listing;

    setCurrentListing(mappedListing);
    setIsOpen(true);
    setCurrentIndex(index);

    // Update URL
    updateUrl(listing.id);

    // Track for signup pressure system
    signupPressure?.trackQuickView();

    // Fetch full listing data (with enrichment) asynchronously
    // This ensures YuhinkaiEnrichmentSection has the data it needs
    fetchFullListing(listing.id).then((fullListing) => {
      if (fullListing) {
        setCurrentListing(fullListing);
        // Also update in listings array if present
        if (index !== -1) {
          setListingsState((prev) => {
            const newListings = [...prev];
            newListings[index] = fullListing;
            return newListings;
          });
        }
      }
    });
  }, [listings, updateUrl, signupPressure, fetchFullListing]);

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

    // Fetch full listing data (with enrichment) asynchronously
    fetchFullListing(nextListing.id).then((fullListing) => {
      if (fullListing) {
        setCurrentListing(fullListing);
        setListingsState((prev) => {
          const newListings = [...prev];
          newListings[nextIndex] = fullListing;
          return newListings;
        });
      }
    });
  }, [listings, currentIndex, updateUrl, fetchFullListing]);

  // Navigate to previous listing
  const goToPrevious = useCallback(() => {
    if (listings.length === 0 || currentIndex === -1) return;

    const prevIndex = currentIndex === 0 ? listings.length - 1 : currentIndex - 1;
    const prevListing = listings[prevIndex];

    setCurrentListing(prevListing);
    setCurrentIndex(prevIndex);

    updateUrl(prevListing.id);

    // Fetch full listing data (with enrichment) asynchronously
    fetchFullListing(prevListing.id).then((fullListing) => {
      if (fullListing) {
        setCurrentListing(fullListing);
        setListingsState((prev) => {
          const newListings = [...prev];
          newListings[prevIndex] = fullListing;
          return newListings;
        });
      }
    });
  }, [listings, currentIndex, updateUrl, fetchFullListing]);

  // Set listings array for navigation
  const setListings = useCallback((newListings: Listing[]) => {
    setListingsState(newListings);

    // Update current index if we have an open listing
    if (currentListing) {
      const index = newListings.findIndex((l) => l.id === currentListing.id);
      setCurrentIndex(index);
    }
  }, [currentListing]);

  // Refresh the current listing from the API
  // Used after admin actions like connecting setsumei to reload updated data
  // Accepts optional enrichment for optimistic update (instant UI feedback)
  // Pass null to clear enrichment (e.g., on disconnect)
  const refreshCurrentListing = useCallback(async (optimisticFields?: Partial<Listing>) => {
    if (!currentListing) return;

    // Optimistic update: immediately apply fields while we fetch full listing
    if (optimisticFields) {
      const optimisticListing = {
        ...currentListing,
        ...optimisticFields,
      };
      setCurrentListing(optimisticListing);

      // Also update in listings array for consistency
      if (currentIndex !== -1 && listings.length > 0) {
        setListingsState(prev => {
          const newListings = [...prev];
          newListings[currentIndex] = optimisticListing;
          return newListings;
        });
      }
    }

    try {
      // CRITICAL: Add cache bypass for instant updates after admin actions
      // Without ?nocache=1, Vercel edge cache (10-min TTL) serves stale data
      const response = await fetch(
        `/api/listing/${currentListing.id}?nocache=1`,
        { cache: 'no-store' }
      );
      if (!response.ok) {
        console.error('Failed to refresh listing:', response.status);
        return;
      }

      const data = await response.json();
      const refreshedListing = data.listing as Listing;

      // Update current listing state
      setCurrentListing(refreshedListing);

      // Also update the listing in the listings array if present
      if (currentIndex !== -1 && listings.length > 0) {
        const newListings = [...listings];
        newListings[currentIndex] = refreshedListing;
        setListingsState(newListings);
      }

      // Notify any listeners (e.g. ArtisanListings) that a listing was refreshed
      window.dispatchEvent(new CustomEvent('listing-refreshed', { detail: refreshedListing }));
    } catch (error) {
      console.error('Error refreshing listing:', error);
    }
  }, [currentListing, currentIndex, listings]);

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
  // Also validates images during prefetch to populate cache
  useEffect(() => {
    if (!isOpen || currentIndex === -1 || listings.length === 0) return;

    const preloadAndValidateImages = (listing: Listing, count: number = 2) => {
      const images = getAllImages(listing);
      images.slice(0, count).forEach((url) => {
        const img = new window.Image();

        // On load, validate and cache the result
        img.onload = () => {
          if (getCachedValidation(url) === undefined) {
            const validation = isValidItemImage({
              width: img.naturalWidth,
              height: img.naturalHeight,
            });
            setCachedValidation(url, validation.isValid ? 'valid' : 'invalid');
          }
        };

        img.onerror = () => {
          if (getCachedValidation(url) === undefined) {
            setCachedValidation(url, 'invalid');
          }
        };

        img.src = url;
      });
    };

    // Preload previous listing
    if (currentIndex > 0) {
      preloadAndValidateImages(listings[currentIndex - 1]);
    }

    // Preload next listing
    if (currentIndex < listings.length - 1) {
      preloadAndValidateImages(listings[currentIndex + 1]);
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
      listings,
      currentIndex,
      goToNext,
      goToPrevious,
      hasNext,
      hasPrevious,
      setListings,
      refreshCurrentListing,
    }),
    [
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
      refreshCurrentListing,
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
