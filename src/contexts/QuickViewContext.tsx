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
import { useAuth } from '@/lib/auth/AuthContext';
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
  openQuickView: (listing: Listing, options?: { skipFetch?: boolean }) => void;
  /** Close the quick view modal */
  closeQuickView: () => void;
  /** Dismiss QuickView UI without history.back() — for use before router.push() navigation */
  dismissForNavigation: () => void;
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
  /** Whether QuickView is in alert carousel mode (prevents browse grid from overwriting listings) */
  isAlertMode: boolean;
  /** Enter/exit alert carousel mode */
  setAlertMode: (mode: boolean) => void;
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
  const { isAdmin } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [currentListing, setCurrentListing] = useState<Listing | null>(null);
  const [listings, setListingsState] = useState<Listing[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isAlertMode, setIsAlertMode] = useState(false);

  // Cooldown to prevent immediate re-opening after close
  const closeCooldown = useRef(false);

  // Ref for current index — avoids stale closures in async callbacks
  const currentIndexRef = useRef(-1);
  currentIndexRef.current = currentIndex;

  // Guard: when refreshCurrentListing is active, suppress fetchFullListing overwrites
  const refreshInFlightRef = useRef(false);

  // History management: pushState on open so browser back closes the modal
  const pushedHistoryRef = useRef(false);      // true if we pushed a history entry on open
  const historyBackInProgressRef = useRef(false); // guards popstate from our own history.back()

  // Update URL synchronously using history API (no React re-renders)
  const updateUrl = useCallback((listingId: number | null) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);

    if (listingId !== null) {
      url.searchParams.set('listing', String(listingId));
    } else {
      url.searchParams.delete('listing');
      // Also clean up multi-listing params (from alert email deep links)
      url.searchParams.delete('listings');
      url.searchParams.delete('alert_search');
    }

    // Use replaceState to update URL without triggering navigation
    window.history.replaceState(null, '', url.toString());
  }, []);

  // Fetch full listing data from API (includes enrichment)
  // Admin users bypass Vercel edge cache to see admin corrections immediately
  const fetchFullListing = useCallback(async (listingId: number) => {
    try {
      const url = isAdmin
        ? `/api/listing/${listingId}?nocache=1`
        : `/api/listing/${listingId}`;
      const response = await fetch(url);
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
  }, [isAdmin]);

  // Open quick view
  const openQuickView = useCallback((listing: Listing, options?: { skipFetch?: boolean }) => {
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

    // Push a history entry so browser back closes the modal instead of leaving the page.
    // Only push if no ?listing= currently in URL — avoids double-push on deep links
    // or when navigating between listings (which use replaceState via updateUrl).
    if (typeof window !== 'undefined') {
      const currentUrl = new URL(window.location.href);
      if (!currentUrl.searchParams.has('listing')) {
        // Snapshot the clean URL (without ?listing=) as a history entry first
        window.history.pushState({ quickview: true }, '', window.location.href);
        pushedHistoryRef.current = true;
      }
    }

    // Update the current history entry's URL with the listing param (replaceState)
    updateUrl(listing.id);

    // Track for signup pressure system
    signupPressure?.trackQuickView();

    // Fetch full listing data (with enrichment) asynchronously
    // Skip if caller already fetched the complete listing (e.g., DeepLinkHandler)
    if (!options?.skipFetch) {
      fetchFullListing(listing.id).then((fullListing) => {
        if (fullListing && !refreshInFlightRef.current) {
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
    }
  }, [listings, updateUrl, signupPressure, fetchFullListing]);

  // Close quick view
  const closeQuickView = useCallback(() => {
    // Set cooldown to prevent immediate re-opening from click propagation
    closeCooldown.current = true;

    setIsOpen(false);
    setCurrentListing(null);
    setCurrentIndex(-1);
    setIsAlertMode(false);

    if (pushedHistoryRef.current) {
      // We pushed a history entry on open — pop it so the URL reverts cleanly.
      // Guard so our own popstate handler doesn't double-close.
      historyBackInProgressRef.current = true;
      window.history.back();
      pushedHistoryRef.current = false;
    } else {
      // Deep link or already-open navigation — just clean up the URL via replaceState
      updateUrl(null);
    }

    // Reset cooldown after animation completes
    setTimeout(() => {
      closeCooldown.current = false;
      historyBackInProgressRef.current = false;
    }, 300);
  }, [updateUrl]);

  // Dismiss QuickView UI without calling history.back().
  // Use before router.push() to avoid the history.back() ↔ pushState race
  // that cancels navigation on mobile.
  const dismissForNavigation = useCallback(() => {
    setIsOpen(false);
    setCurrentListing(null);
    setCurrentIndex(-1);
    setIsAlertMode(false);
    // Don't pop history — router.push() will push a new entry on top.
    pushedHistoryRef.current = false;
    // Clean the ?listing= param via replaceState so the stale entry can't
    // reopen QuickView if navigation hiccups or the user presses back.
    // Without this, history was [/browse, /browse?listing=X, /artists/...]
    // and pressing back from the artist page would reopen the QuickView.
    updateUrl(null);
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
      if (fullListing && !refreshInFlightRef.current) {
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
      if (fullListing && !refreshInFlightRef.current) {
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

  // Enter/exit alert carousel mode (prevents browse grid from overwriting listings)
  const setAlertMode = useCallback((mode: boolean) => {
    setIsAlertMode(mode);
  }, []);

  // Refresh the current listing from the API
  // Used after admin actions like connecting setsumei to reload updated data
  // Accepts optional enrichment for optimistic update (instant UI feedback)
  // Pass null to clear enrichment (e.g., on disconnect)
  const refreshCurrentListing = useCallback(async (optimisticFields?: Partial<Listing>) => {
    if (!currentListing) return;

    // Prevent concurrent fetchFullListing from overwriting our data
    refreshInFlightRef.current = true;

    // Optimistic update: immediately apply fields while we fetch full listing
    if (optimisticFields) {
      const optimisticListing = {
        ...currentListing,
        ...optimisticFields,
      };
      setCurrentListing(optimisticListing);

      // Also update in listings array for consistency (use functional update to avoid stale closure)
      const idx = currentIndexRef.current;
      if (idx !== -1) {
        setListingsState(prev => {
          if (idx >= prev.length) return prev;
          const newListings = [...prev];
          newListings[idx] = optimisticListing;
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

      if (!refreshedListing) {
        console.error('Refresh returned no listing data');
        return;
      }

      // Update current listing state
      setCurrentListing(refreshedListing);

      // Also update the listing in the listings array if present
      // Use ref for current index to avoid stale closure, and functional update
      // for listings to avoid overwriting concurrent setListings() calls
      const idx = currentIndexRef.current;
      if (idx !== -1) {
        setListingsState(prev => {
          if (idx >= prev.length) return prev;
          const newListings = [...prev];
          newListings[idx] = refreshedListing;
          return newListings;
        });
      }

      // Notify any listeners (e.g. ArtisanListings) that a listing was refreshed
      window.dispatchEvent(new CustomEvent('listing-refreshed', { detail: refreshedListing }));
    } catch (error) {
      console.error('Error refreshing listing:', error);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [currentListing]);

  // Recalculate currentIndex when listings change while a listing is displayed.
  // This handles the race condition where setListings() and openQuickView() are
  // called in the same tick (e.g., DeepLinkHandler multi-listing deep links):
  // openQuickView's closure still has the old empty listings array, so findIndex
  // returns -1. Once React processes both state updates, this effect corrects it.
  useEffect(() => {
    if (isOpen && currentListing && listings.length > 0 && currentIndex === -1) {
      const index = listings.findIndex((l) => l.id === currentListing.id);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [isOpen, listings, currentListing, currentIndex]);

  // Handle browser back button (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      // Ignore popstate triggered by our own history.back() in closeQuickView
      if (historyBackInProgressRef.current) return;

      const url = new URL(window.location.href);
      const listingIdParam = url.searchParams.get('listing');

      if (!listingIdParam && isOpen) {
        // User pressed back — close the modal without further navigation
        pushedHistoryRef.current = false;
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
          // Don't poison cache on transient load failures
          // LazyImage handles actual render errors
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
      dismissForNavigation,
      listings,
      currentIndex,
      goToNext,
      goToPrevious,
      hasNext,
      hasPrevious,
      setListings,
      isAlertMode,
      setAlertMode,
      refreshCurrentListing,
    }),
    [
      isOpen,
      currentListing,
      openQuickView,
      closeQuickView,
      dismissForNavigation,
      listings,
      currentIndex,
      goToNext,
      goToPrevious,
      hasNext,
      hasPrevious,
      setListings,
      isAlertMode,
      setAlertMode,
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
