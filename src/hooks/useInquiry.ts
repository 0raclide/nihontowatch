/**
 * useInquiry Hook
 *
 * React hook for generating AI-powered inquiry emails to Japanese dealers.
 * Handles API calls, loading states, and error handling.
 *
 * @example
 * ```tsx
 * const { generateEmail, isGenerating, error, clearError } = useInquiry();
 *
 * const handleSubmit = async () => {
 *   const result = await generateEmail({
 *     listingId: 123,
 *     intent: 'purchase',
 *     buyerName: 'John Smith',
 *     buyerCountry: 'United States',
 *   });
 *
 *   if (result) {
 *     // Show generated email
 *     console.log(result.email_ja);
 *   }
 * };
 * ```
 */

'use client';

import { useState, useCallback } from 'react';
import type { InquiryInput, GeneratedEmail } from '@/lib/inquiry/types';

// =============================================================================
// Types
// =============================================================================

export interface UseInquiryReturn {
  /**
   * Generate an inquiry email.
   * Returns the generated email on success, null on failure.
   */
  generateEmail: (input: InquiryInput) => Promise<GeneratedEmail | null>;

  /**
   * Whether an email is currently being generated.
   */
  isGenerating: boolean;

  /**
   * Error message from the last failed request, or null if no error.
   */
  error: string | null;

  /**
   * Clear the current error state.
   */
  clearError: () => void;
}

interface ApiErrorResponse {
  error: string;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for generating inquiry emails to dealers.
 *
 * @returns Object with generateEmail function and state
 */
export function useInquiry(): UseInquiryReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generate an inquiry email by calling the API.
   */
  const generateEmail = useCallback(
    async (input: InquiryInput): Promise<GeneratedEmail | null> => {
      setIsGenerating(true);
      setError(null);

      try {
        const response = await fetch('/api/inquiry/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        });

        const data = await response.json();

        if (!response.ok) {
          // Extract error message from response
          const errorMessage =
            (data as ApiErrorResponse).error || 'Failed to generate email';
          setError(errorMessage);
          return null;
        }

        // Success
        return data as GeneratedEmail;
      } catch (err) {
        // Network or parsing error
        const errorMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(errorMessage);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  /**
   * Clear the error state.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    generateEmail,
    isGenerating,
    error,
    clearError,
  };
}
