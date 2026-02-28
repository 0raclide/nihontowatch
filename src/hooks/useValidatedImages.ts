'use client';

import { useState, useEffect, useRef } from 'react';
import {
  isValidItemImage,
  getCachedValidation,
  getPendingValidation,
  setCachedValidation,
  setPendingValidation,
} from '@/lib/images';

/**
 * Hook that validates image URLs by checking their dimensions.
 *
 * Filters out invalid images (icons, buttons, tiny UI elements) that may have
 * been accidentally scraped from dealer pages alongside actual product images.
 *
 * Uses a global cache to prevent double-loading:
 * - If an image was already validated (e.g., during preload), uses cached result
 * - If validation is pending, waits for existing promise
 * - Only fetches images that haven't been seen before
 *
 * Uses an "optimistic valid" approach to prevent layout shifts:
 * - All images are assumed valid until proven otherwise
 * - Invalid images are removed one at a time as they fail validation
 * - This avoids the dramatic list-shrink that caused jumpy behavior
 *
 * @param imageUrls - Array of image URLs to validate
 * @returns Object with validatedImages array and loading state
 *
 * @example
 * const { validatedImages, isValidating } = useValidatedImages(getAllImages(listing));
 */
export function useValidatedImages(imageUrls: string[]) {
  // Track which images have been confirmed invalid (to remove)
  const [invalidIndices, setInvalidIndices] = useState<Set<number>>(new Set());
  // Track validation in progress
  const [isValidating, setIsValidating] = useState(true);
  // Count of validated images (for stats)
  const [validCount, setValidCount] = useState(0);
  const [checkedCount, setCheckedCount] = useState(0);

  // Keep track of the URL array identity to reset on change
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    // Reset if URLs changed (compare by content, not reference)
    const urlsChanged = imageUrls.length !== urlsRef.current.length ||
      imageUrls.some((url, i) => url !== urlsRef.current[i]);

    if (!urlsChanged) return;

    urlsRef.current = imageUrls;
    setInvalidIndices(new Set());
    setIsValidating(true);
    setValidCount(0);
    setCheckedCount(0);

    if (imageUrls.length === 0) {
      setIsValidating(false);
      return;
    }

    // Validate images in throttled batches to limit memory pressure.
    // Mobile Safari can crash (OOM) when decoding many large images simultaneously.
    // Cached images resolve instantly, so only uncached ones consume memory.
    const CONCURRENCY = 3;
    let mounted = true;

    // Batch state updates: collect all results, then apply once
    const results: Array<{ index: number; valid: boolean }> = [];
    let resultsCount = 0;

    const applyResults = () => {
      if (!mounted) return;

      const newInvalid = new Set<number>();
      let newValidCount = 0;
      for (const r of results) {
        if (!r.valid) newInvalid.add(r.index);
        else newValidCount++;
      }

      setInvalidIndices(newInvalid);
      setValidCount(newValidCount);
      setCheckedCount(results.length);
      setIsValidating(false);
    };

    const recordResult = (index: number, valid: boolean) => {
      results.push({ index, valid });
      resultsCount++;

      // Apply incrementally for invalid images (remove them as they're found)
      // but only if we've checked at least a few images to avoid single-item flickers
      if (!valid && resultsCount >= 3 && mounted) {
        setInvalidIndices(prev => new Set(prev).add(index));
      }
    };

    const validateImage = async (url: string, index: number): Promise<void> => {
      if (!url) {
        recordResult(index, false);
        return;
      }

      // Check cache first - instant result if already validated
      const cached = getCachedValidation(url);
      if (cached !== undefined) {
        recordResult(index, cached === 'valid');
        return;
      }

      // Check for pending validation - wait for existing request
      const pending = getPendingValidation(url);
      if (pending) {
        const result = await pending;
        recordResult(index, result === 'valid');
        return;
      }

      // No cache hit - need to validate by loading the image
      const validationPromise = new Promise<'valid' | 'invalid'>((resolve) => {
        const img = new Image();
        let resolved = false;

        const finish = (isValid: boolean) => {
          if (resolved) return;
          resolved = true;

          const result = isValid ? 'valid' : 'invalid';
          setCachedValidation(url, result);
          resolve(result);
        };

        // Set a timeout for slow images (5 seconds)
        const timeout = setTimeout(() => {
          // If image takes too long, assume it's valid (benefit of the doubt)
          finish(true);
        }, 5000);

        img.onload = () => {
          clearTimeout(timeout);
          const validation = isValidItemImage({
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
          finish(validation.isValid);
        };

        img.onerror = () => {
          clearTimeout(timeout);
          // Load errors ≠ dimension failures. Give benefit of doubt
          // (matches timeout behavior). LazyImage handles render failures.
          finish(true);
        };

        img.src = url;
      });

      // Register the pending validation so other consumers can wait for it
      setPendingValidation(url, validationPromise);

      const result = await validationPromise;
      recordResult(index, result === 'valid');
    };

    // Validate in throttled batches, apply final results once all complete
    const runThrottled = async () => {
      for (let i = 0; i < imageUrls.length; i += CONCURRENCY) {
        if (!mounted) return;
        const batch = imageUrls.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map((url, j) => validateImage(url, i + j)));
      }
      applyResults();
    };
    runThrottled();

    return () => {
      mounted = false;
    };
  }, [imageUrls]);

  // Optimistic: show all images except those confirmed invalid
  const validatedImages = imageUrls.filter((_, i) => !invalidIndices.has(i));

  return {
    validatedImages,
    isValidating,
    validCount,
    checkedCount,
    totalCount: imageUrls.length,
  };
}
