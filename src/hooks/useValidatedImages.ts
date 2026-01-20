'use client';

import { useState, useEffect, useRef } from 'react';
import { isValidItemImage } from '@/lib/images';

/**
 * Hook that validates image URLs by checking their dimensions.
 *
 * Filters out invalid images (icons, buttons, tiny UI elements) that may have
 * been accidentally scraped from dealer pages alongside actual product images.
 *
 * Uses a two-phase approach:
 * 1. Initially returns all images (assumes valid)
 * 2. As images are validated in parallel, removes invalid ones
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
    // This prevents race conditions where component re-renders interrupt validation
    let mounted = true;

    const validateImage = (url: string, index: number): Promise<void> => {
      return new Promise((resolve) => {
        if (!url) {
          if (mounted) {
            setCheckedIndices(prev => new Set(prev).add(index));
          }
          resolve();
          return;
        }

        const img = new Image();
        let resolved = false;

        const finish = (isValid: boolean) => {
          if (resolved || !mounted) return;
          resolved = true;

          if (isValid) {
            setValidIndices(prev => new Set(prev).add(index));
          }
          setCheckedIndices(prev => new Set(prev).add(index));
          resolve();
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
