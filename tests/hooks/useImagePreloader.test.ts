import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImagePreloader, clearPreloadCache } from '@/hooks/useImagePreloader';

// Mock Image constructor
const mockImageInstances: { src: string; onload?: () => void; onerror?: () => void }[] = [];

beforeEach(() => {
  mockImageInstances.length = 0;
  clearPreloadCache();

  // Mock window.Image
  vi.stubGlobal('Image', class MockImage {
    src = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor() {
      mockImageInstances.push(this);
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

      // Should preload first 3 images (default), but listing only has 2
      expect(mockImageInstances.length).toBe(2);
      expect(mockImageInstances[0].src).toBe('https://cdn.com/stored1.jpg');
      expect(mockImageInstances[1].src).toBe('https://cdn.com/stored2.jpg');
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
