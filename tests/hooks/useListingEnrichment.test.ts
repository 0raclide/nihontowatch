import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useListingEnrichment } from '@/hooks/useListingEnrichment';
import { clearApiCache } from '@/hooks/useApiCache';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useListingEnrichment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
    // Default mock to prevent unhandled rejections
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ enrichment: null }),
      })
    );
    clearApiCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Eligibility detection', () => {
    it('should be eligible for Juyo tsuba', () => {
      const { result } = renderHook(() =>
        useListingEnrichment(123, 'tsuba', 'Juyo')
      );
      expect(result.current.isEligible).toBe(true);
    });

    it('should be eligible for Tokubetsu Juyo tosogu', () => {
      const { result } = renderHook(() =>
        useListingEnrichment(123, 'tsuba', 'Tokubetsu Juyo')
      );
      expect(result.current.isEligible).toBe(true);
    });

    it('should be eligible for Juyo fuchi_kashira', () => {
      const { result } = renderHook(() =>
        useListingEnrichment(123, 'fuchi_kashira', 'Juyo')
      );
      expect(result.current.isEligible).toBe(true);
    });

    it('should be eligible for katana (nihonto) with Juyo', () => {
      const { result } = renderHook(() =>
        useListingEnrichment(123, 'katana', 'Juyo')
      );
      expect(result.current.isEligible).toBe(true);
    });

    it('should NOT be eligible for Hozon tsuba (lower certification)', () => {
      const { result } = renderHook(() =>
        useListingEnrichment(123, 'tsuba', 'Hozon')
      );
      expect(result.current.isEligible).toBe(false);
    });

    it('should NOT be eligible for uncertified tsuba', () => {
      const { result } = renderHook(() =>
        useListingEnrichment(123, 'tsuba', undefined)
      );
      expect(result.current.isEligible).toBe(false);
    });

    it('should NOT be eligible for undefined item type', () => {
      const { result } = renderHook(() =>
        useListingEnrichment(123, undefined, 'Juyo')
      );
      expect(result.current.isEligible).toBe(false);
    });
  });

  describe('Fetching behavior', () => {
    it('should fetch enrichment for eligible listing', async () => {
      const mockEnrichment = {
        enrichment_id: 1,
        listing_id: 123,
        setsumei_en: 'Test translation',
        match_confidence: 'DEFINITIVE',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ enrichment: mockEnrichment }),
      });

      const { result } = renderHook(() =>
        useListingEnrichment(123, 'tsuba', 'Juyo')
      );

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.enrichment).toEqual(mockEnrichment);
      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith('/api/listing/123/enrichment');
    });

    it('should NOT fetch for non-eligible listing', () => {
      renderHook(() => useListingEnrichment(123, 'katana', 'Hozon'));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should NOT fetch when listing ID is undefined', () => {
      renderHook(() => useListingEnrichment(undefined, 'tsuba', 'Juyo'));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should NOT fetch when enabled is false', () => {
      renderHook(() =>
        useListingEnrichment(123, 'tsuba', 'Juyo', { enabled: false })
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return null enrichment when API returns null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ enrichment: null }),
      });

      const { result } = renderHook(() =>
        useListingEnrichment(123, 'tsuba', 'Juyo')
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.enrichment).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Loading states', () => {
    it('should show loading only when eligible and fetching', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ enrichment: null }),
      });

      // Non-eligible (Hozon cert) should not be loading
      const { result: nonEligible } = renderHook(() =>
        useListingEnrichment(123, 'katana', 'Hozon')
      );
      expect(nonEligible.current.isLoading).toBe(false);

      // Eligible should be loading initially
      const { result: eligible } = renderHook(() =>
        useListingEnrichment(456, 'tsuba', 'Juyo')
      );
      expect(eligible.current.isLoading).toBe(true);

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(eligible.current.isLoading).toBe(false);
    });
  });

  describe('Caching', () => {
    it('should use cached enrichment for same listing', async () => {
      const mockEnrichment = {
        enrichment_id: 1,
        listing_id: 123,
        setsumei_en: 'Cached translation',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ enrichment: mockEnrichment }),
      });

      const { result: result1 } = renderHook(() =>
        useListingEnrichment(123, 'tsuba', 'Juyo')
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result1.current.enrichment).toEqual(mockEnrichment);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second hook should use cache
      mockFetch.mockClear();
      const { result: result2 } = renderHook(() =>
        useListingEnrichment(123, 'tsuba', 'Juyo')
      );

      expect(result2.current.enrichment).toEqual(mockEnrichment);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useListingEnrichment(123, 'tsuba', 'Juyo')
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.enrichment).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() =>
        useListingEnrichment(123, 'tsuba', 'Juyo')
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.enrichment).toBeNull();
    });
  });

  describe('Different tosogu types', () => {
    const tosoguTypes = ['tsuba', 'fuchi_kashira', 'kozuka', 'menuki', 'kogai'];

    tosoguTypes.forEach((itemType) => {
      it(`should be eligible for Juyo ${itemType}`, () => {
        const { result } = renderHook(() =>
          useListingEnrichment(123, itemType, 'Juyo')
        );
        expect(result.current.isEligible).toBe(true);
      });
    });
  });

  describe('Different certification formats', () => {
    const certFormats = ['Juyo', 'juyo', 'Tokubetsu Juyo', 'Tokuju', 'tokuju'];

    certFormats.forEach((certType) => {
      it(`should be eligible for ${certType} certification`, () => {
        const { result } = renderHook(() =>
          useListingEnrichment(123, 'tsuba', certType)
        );
        expect(result.current.isEligible).toBe(true);
      });
    });
  });
});
