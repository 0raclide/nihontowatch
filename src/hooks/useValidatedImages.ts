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

    // Validate each image
    let mounted = true;
    const validateImages = async () => {
      for (let i = 0; i < imageUrls.length; i++) {
        if (!mounted) break;

        const url = imageUrls[i];
        if (!url) {
          setCheckedIndices(prev => new Set(prev).add(i));
          continue;
        }

        try {
          const img = new Image();

          await new Promise<void>((resolve) => {
            img.onload = () => {
              if (!mounted) {
                resolve();
                return;
              }

              const validation = isValidItemImage({
                width: img.naturalWidth,
                height: img.naturalHeight,
              });

              if (validation.isValid) {
                setValidIndices(prev => new Set(prev).add(i));
              }

              setCheckedIndices(prev => new Set(prev).add(i));
              resolve();
            };

            img.onerror = () => {
              // Treat load errors as invalid
              setCheckedIndices(prev => new Set(prev).add(i));
              resolve();
            };

            // Set a timeout for slow images
            const timeout = setTimeout(() => {
              // If image takes too long, assume it's valid (benefit of the doubt)
              if (!mounted) return;
              setValidIndices(prev => new Set(prev).add(i));
              setCheckedIndices(prev => new Set(prev).add(i));
              resolve();
            }, 5000);

            img.src = url;

            // Clean up timeout if image loads
            img.onload = () => {
              clearTimeout(timeout);
              if (!mounted) {
                resolve();
                return;
              }

              const validation = isValidItemImage({
                width: img.naturalWidth,
                height: img.naturalHeight,
              });

              if (validation.isValid) {
                setValidIndices(prev => new Set(prev).add(i));
              }

              setCheckedIndices(prev => new Set(prev).add(i));
              resolve();
            };
          });
        } catch {
          // On error, mark as checked but not valid
          setCheckedIndices(prev => new Set(prev).add(i));
        }
      }

      if (mounted) {
        setIsValidating(false);
      }
    };

    validateImages();

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
