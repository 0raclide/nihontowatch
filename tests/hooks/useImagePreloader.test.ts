import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImagePreloader, clearPreloadCache } from '@/hooks/useImagePreloader';
import { getCachedValidation, clearValidationCache } from '@/lib/images';

// Mock Image constructor — includes naturalWidth/Height for validation cache tests
const mockImageInstances: {
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  naturalWidth: number;
  naturalHeight: number;
}[] = [];

beforeEach(() => {
  mockImageInstances.length = 0;
  clearPreloadCache();
  clearValidationCache();

  // Mock window.Image
  vi.stubGlobal('Image', class MockImage {
    src = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 800;
    naturalHeight = 600;

    constructor() {
      mockImageInstances.push(this as unknown as typeof mockImageInstances[number]);
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useImagePreloader', () => {
  describe('preloadImage', () => {
    it('creates an Image object with the given URL', () => {
      const { result } = renderHook(() => useImagePreloader());

      act(() => {
        result.current.preloadImage('https://example.com/image.jpg');
      });

      expect(mockImageInstances.length).toBe(1);
      expect(mockImageInstances[0].src).toBe('https://example.com/image.jpg');
    });

    it('skips preloading empty URLs', () => {
      const { result } = renderHook(() => useImagePreloader());

      act(() => {
        result.current.preloadImage('');
      });

      expect(mockImageInstances.length).toBe(0);
    });

    it('skips preloading already preloaded URLs', () => {
      const { result } = renderHook(() => useImagePreloader());

      act(() => {
        result.current.preloadImage('https://example.com/image.jpg');
        result.current.preloadImage('https://example.com/image.jpg');
      });

      expect(mockImageInstances.length).toBe(1);
    });

    it('preloads different URLs', () => {
      const { result } = renderHook(() => useImagePreloader());

      act(() => {
        result.current.preloadImage('https://example.com/image1.jpg');
        result.current.preloadImage('https://example.com/image2.jpg');
      });

      expect(mockImageInstances.length).toBe(2);
    });
  });

  describe('preloadListing', () => {
    it('preloads images from stored_images when available', () => {
      const { result } = renderHook(() => useImagePreloader());

      const listing = {
        stored_images: ['https://cdn.com/stored1.jpg', 'https://cdn.com/stored2.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg'],
      };

      act(() => {
        result.current.preloadListing(listing);
      });

      // getAllImages now returns stored + original (4 total), limited to default of 3
      expect(mockImageInstances.length).toBe(3);
      expect(mockImageInstances[0].src).toBe('https://cdn.com/stored1.jpg');
      expect(mockImageInstances[1].src).toBe('https://cdn.com/stored2.jpg');
      expect(mockImageInstances[2].src).toBe('https://dealer.com/original1.jpg');
    });

    it('falls back to original images when no stored_images', () => {
      const { result } = renderHook(() => useImagePreloader());

      const listing = {
        stored_images: null,
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg'],
      };

      act(() => {
        result.current.preloadListing(listing);
      });

      expect(mockImageInstances.length).toBe(2);
      expect(mockImageInstances[0].src).toBe('https://dealer.com/original1.jpg');
      expect(mockImageInstances[1].src).toBe('https://dealer.com/original2.jpg');
    });

    it('limits preload count to specified value', () => {
      const { result } = renderHook(() => useImagePreloader());

      const listing = {
        stored_images: [
          'https://cdn.com/stored1.jpg',
          'https://cdn.com/stored2.jpg',
          'https://cdn.com/stored3.jpg',
          'https://cdn.com/stored4.jpg',
          'https://cdn.com/stored5.jpg',
        ],
        images: null,
      };

      act(() => {
        result.current.preloadListing(listing, 2);
      });

      // Should only preload first 2
      expect(mockImageInstances.length).toBe(2);
    });

    it('handles null listing gracefully', () => {
      const { result } = renderHook(() => useImagePreloader());

      act(() => {
        result.current.preloadListing(null);
      });

      expect(mockImageInstances.length).toBe(0);
    });

    it('handles undefined listing gracefully', () => {
      const { result } = renderHook(() => useImagePreloader());

      act(() => {
        result.current.preloadListing(undefined);
      });

      expect(mockImageInstances.length).toBe(0);
    });

    it('handles listing with no images', () => {
      const { result } = renderHook(() => useImagePreloader());

      const listing = {
        stored_images: null,
        images: null,
      };

      act(() => {
        result.current.preloadListing(listing);
      });

      expect(mockImageInstances.length).toBe(0);
    });
  });

  describe('cancelPreloads', () => {
    it('clears src of active preload requests', () => {
      const { result } = renderHook(() => useImagePreloader());

      act(() => {
        result.current.preloadImage('https://example.com/image1.jpg');
        result.current.preloadImage('https://example.com/image2.jpg');
      });

      // Before cancel, both have src set
      expect(mockImageInstances[0].src).toBe('https://example.com/image1.jpg');
      expect(mockImageInstances[1].src).toBe('https://example.com/image2.jpg');

      act(() => {
        result.current.cancelPreloads();
      });

      // After cancel, src should be cleared
      expect(mockImageInstances[0].src).toBe('');
      expect(mockImageInstances[1].src).toBe('');
    });
  });

  describe('isPreloaded', () => {
    it('returns true for preloaded URLs', () => {
      const { result } = renderHook(() => useImagePreloader());

      act(() => {
        result.current.preloadImage('https://example.com/image.jpg');
      });

      expect(result.current.isPreloaded('https://example.com/image.jpg')).toBe(true);
    });

    it('returns false for non-preloaded URLs', () => {
      const { result } = renderHook(() => useImagePreloader());

      expect(result.current.isPreloaded('https://example.com/image.jpg')).toBe(false);
    });
  });

  describe('getPreloadedCount', () => {
    it('returns the count of preloaded URLs', () => {
      const { result } = renderHook(() => useImagePreloader());

      expect(result.current.getPreloadedCount()).toBe(0);

      act(() => {
        result.current.preloadImage('https://example.com/image1.jpg');
        result.current.preloadImage('https://example.com/image2.jpg');
      });

      expect(result.current.getPreloadedCount()).toBe(2);
    });
  });

  describe('cleanup on image load/error', () => {
    it('removes from active preloads on successful load', () => {
      const { result } = renderHook(() => useImagePreloader());

      act(() => {
        result.current.preloadImage('https://example.com/image.jpg');
      });

      // Simulate image load
      act(() => {
        mockImageInstances[0].onload?.();
      });

      // Should be able to cancel without affecting anything
      act(() => {
        result.current.cancelPreloads();
      });

      // The image src was already handled, shouldn't be cleared again
      // (This tests internal cleanup, not visible behavior)
    });

    it('removes from active preloads on error', () => {
      const { result } = renderHook(() => useImagePreloader());

      act(() => {
        result.current.preloadImage('https://example.com/image.jpg');
      });

      // Simulate image error
      act(() => {
        mockImageInstances[0].onerror?.();
      });

      // Should be able to cancel without affecting anything
      act(() => {
        result.current.cancelPreloads();
      });
    });
  });
});

describe('clearPreloadCache', () => {
  it('clears all preloaded URLs', () => {
    const { result } = renderHook(() => useImagePreloader());

    act(() => {
      result.current.preloadImage('https://example.com/image1.jpg');
      result.current.preloadImage('https://example.com/image2.jpg');
    });

    expect(result.current.getPreloadedCount()).toBe(2);

    clearPreloadCache();

    // After clear, count should be 0
    expect(result.current.getPreloadedCount()).toBe(0);
  });

  it('allows re-preloading previously cached URLs', () => {
    const { result } = renderHook(() => useImagePreloader());

    act(() => {
      result.current.preloadImage('https://example.com/image.jpg');
    });

    expect(mockImageInstances.length).toBe(1);

    clearPreloadCache();

    act(() => {
      result.current.preloadImage('https://example.com/image.jpg');
    });

    // Should create a new Image instance
    expect(mockImageInstances.length).toBe(2);
  });
});

/**
 * GOLDEN TESTS: Cache Poisoning Prevention (BUG-011)
 *
 * These tests guard the invariant that transient preload failures must NEVER
 * write 'invalid' to the shared validation cache. Violating this invariant
 * causes images to permanently disappear in QuickView.
 *
 * History: This bug was fixed in commit 20b6662 in two locations
 * (QuickViewContext, useValidatedImages) but missed in useImagePreloader.
 * The third location was the most dangerous because it fires on hover,
 * before the user even clicks. See:
 * docs/SESSION_20260213_IMAGE_CACHE_POISONING_POSTMORTEM.md
 */
describe('cache poisoning prevention (BUG-011 golden tests)', () => {
  const TEST_URL = 'https://cdn.example.com/listing-1277/image1.jpg';

  it('onerror must NOT cache image as invalid', () => {
    const { result } = renderHook(() => useImagePreloader());

    act(() => {
      result.current.preloadImage(TEST_URL);
    });

    // Simulate a transient load failure (network timeout, Vercel optimizer error, etc.)
    act(() => {
      mockImageInstances[0].onerror?.();
    });

    // The validation cache must NOT contain 'invalid' for this URL.
    // If this assertion fails, QuickView will permanently hide this image.
    expect(getCachedValidation(TEST_URL)).toBeUndefined();
  });

  it('cancelPreloads must NOT trigger cache poisoning', () => {
    const { result } = renderHook(() => useImagePreloader());

    act(() => {
      result.current.preloadImage(TEST_URL);
    });

    // Cancel simulates user moving mouse away from the listing card.
    // Internally this sets img.src = '' which triggers onerror in most browsers.
    act(() => {
      result.current.cancelPreloads();
    });

    // Even after cancellation, the cache must not be poisoned.
    expect(getCachedValidation(TEST_URL)).toBeUndefined();
  });

  it('cancelPreloads detaches event handlers before aborting', () => {
    const { result } = renderHook(() => useImagePreloader());

    act(() => {
      result.current.preloadImage(TEST_URL);
    });

    const img = mockImageInstances[0];
    expect(img.onload).not.toBeNull();
    expect(img.onerror).not.toBeNull();

    act(() => {
      result.current.cancelPreloads();
    });

    // Handlers must be detached BEFORE src is cleared, so the browser's
    // onerror event (fired by setting src='') finds no handler to call.
    expect(img.onload).toBeNull();
    expect(img.onerror).toBeNull();
  });

  it('full scenario: hover → transient error → click → images must survive', () => {
    // This test reproduces the exact user flow from BUG-011:
    // 1. User hovers over listing card (triggers preload of 3 images)
    // 2. Image 2 gets a transient network error during preload
    // 3. User clicks → QuickView opens → checks validation cache
    // 4. Image 2 must NOT be cached as 'invalid'

    const { result } = renderHook(() => useImagePreloader());

    const listing = {
      stored_images: [
        'https://cdn.example.com/listing-1277/image1.jpg',
        'https://cdn.example.com/listing-1277/image2.jpg',
        'https://cdn.example.com/listing-1277/cert.jpg',
      ],
      images: null,
    };

    // Step 1: Hover triggers preload
    act(() => {
      result.current.preloadListing(listing);
    });

    expect(mockImageInstances.length).toBe(3);

    // Step 2: Image 1 loads OK, image 2 fails, image 3 (cert) loads OK
    act(() => {
      mockImageInstances[0].onload?.(); // image1 — success
      mockImageInstances[1].onerror?.(); // image2 — transient failure
      mockImageInstances[2].onload?.(); // cert   — success
    });

    // Step 3: Simulate QuickView checking the validation cache
    // Image 1: should be 'valid' (loaded successfully, dimensions are 800x600)
    expect(getCachedValidation(listing.stored_images[0])).toBe('valid');

    // Image 2: must NOT be 'invalid' — transient error must not poison cache
    expect(getCachedValidation(listing.stored_images[1])).toBeUndefined();

    // Image 3: should be 'valid'
    expect(getCachedValidation(listing.stored_images[2])).toBe('valid');
  });

  it('successful preload caches valid images correctly', () => {
    // Sanity check: onload DOES cache valid images (we only removed
    // the onerror poisoning, not the onload caching)
    const { result } = renderHook(() => useImagePreloader());

    act(() => {
      result.current.preloadImage(TEST_URL);
    });

    // Simulate successful load with valid dimensions
    act(() => {
      mockImageInstances[0].naturalWidth = 1200;
      mockImageInstances[0].naturalHeight = 900;
      mockImageInstances[0].onload?.();
    });

    expect(getCachedValidation(TEST_URL)).toBe('valid');
  });
});
