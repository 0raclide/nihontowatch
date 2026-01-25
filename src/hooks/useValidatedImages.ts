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
 * Uses a two-phase approach:
 * 1. Initially returns all images (assumes valid)
 * 2. As images are validated, removes invalid ones
 *
 * This prevents layout shifts while still filtering bad images.
 *
 * @param imageUrls - Array of image URLs to validate
 * @returns Object with validatedImages array and loading state
 *
 * @example
 * const { validatedImages, isValidating } = useValidatedImages(getAllImages(listing));
 */
export function useValidatedImages(imageUrls: string[]) {
  // Track which images have been validated as good
  const [validIndices, setValidIndices] = useState<Set<number>>(new Set());
  // Track which images have been checked (good or bad)
  const [checkedIndices, setCheckedIndices] = useState<Set<number>>(new Set());
  // Track validation in progress
  const [isValidating, setIsValidating] = useState(true);

  // Keep track of the URL array identity to reset on change
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    // Reset if URLs changed
    const urlsChanged = imageUrls.length !== urlsRef.current.length ||
      imageUrls.some((url, i) => url !== urlsRef.current[i]);

    if (urlsChanged) {
      urlsRef.current = imageUrls;
      setValidIndices(new Set());
      setCheckedIndices(new Set());
      setIsValidating(true);
    }

    if (imageUrls.length === 0) {
      setIsValidating(false);
      return;
    }

    // Validate all images in PARALLEL (not sequentially)
    // Uses cache to avoid re-fetching already-validated images
    let mounted = true;

    const validateImage = async (url: string, index: number): Promise<void> => {
      if (!url) {
        if (mounted) {
          setCheckedIndices(prev => new Set(prev).add(index));
        }
        return;
      }

      // Check cache first - instant result if already validated
      const cached = getCachedValidation(url);
      if (cached !== undefined) {
        if (mounted) {
          if (cached === 'valid') {
            setValidIndices(prev => new Set(prev).add(index));
          }
          setCheckedIndices(prev => new Set(prev).add(index));
        }
        return;
      }

      // Check for pending validation - wait for existing request
      const pending = getPendingValidation(url);
      if (pending) {
        const result = await pending;
        if (mounted) {
          if (result === 'valid') {
            setValidIndices(prev => new Set(prev).add(index));
          }
          setCheckedIndices(prev => new Set(prev).add(index));
        }
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
          // Treat load errors as invalid
          finish(false);
        };

        img.src = url;
      });

      // Register the pending validation so other consumers can wait for it
      setPendingValidation(url, validationPromise);

      const result = await validationPromise;
      if (mounted) {
        if (result === 'valid') {
          setValidIndices(prev => new Set(prev).add(index));
        }
        setCheckedIndices(prev => new Set(prev).add(index));
      }
    };

    // Validate all images in parallel
    Promise.all(imageUrls.map((url, index) => validateImage(url, index)))
      .then(() => {
        if (mounted) {
          setIsValidating(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [imageUrls]);

  // Return validated images (maintaining original order)
  const validatedImages = imageUrls.filter((_, i) => validIndices.has(i));

  // During initial validation, return all images to prevent flash
  // Once we've checked at least one image, start filtering
  const hasStartedValidation = checkedIndices.size > 0;

  return {
    // Return filtered images once validation starts, otherwise all images
    validatedImages: hasStartedValidation ? validatedImages : imageUrls,
    // True while still checking images
    isValidating,
    // Count of images that passed validation
    validCount: validIndices.size,
    // Count of images that have been checked
    checkedCount: checkedIndices.size,
    // Total images being validated
    totalCount: imageUrls.length,
  };
}
