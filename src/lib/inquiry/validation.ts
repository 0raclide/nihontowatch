/**
 * Input Validation for Inquiry Generation
 *
 * Validates and sanitizes user input before processing.
 * Returns typed, validated data or descriptive errors.
 */

import type {
  InquiryInput,
  ValidatedInquiryInput,
  ValidationResult,
} from './types';

// =============================================================================
// Constants
// =============================================================================

/** Maximum length for buyer name */
export const MAX_NAME_LENGTH = 100;

/** Maximum length for country */
export const MAX_COUNTRY_LENGTH = 100;

/** Maximum length for message */
export const MAX_MESSAGE_LENGTH = 2000;

/** Minimum listing ID */
export const MIN_LISTING_ID = 1;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate and sanitize inquiry input
 *
 * @param input - Raw input from request body
 * @returns Validation result with errors or validated data
 */
export function validateInquiryInput(input: unknown): ValidationResult {
  const errors: string[] = [];

  // Check that input is an object
  if (!input || typeof input !== 'object') {
    return {
      valid: false,
      errors: ['Request body must be a JSON object'],
    };
  }

  const data = input as Record<string, unknown>;

  // Validate listingId
  if (data.listingId === undefined || data.listingId === null) {
    errors.push('listingId is required');
  } else if (typeof data.listingId !== 'number') {
    errors.push('listingId must be a number');
  } else if (!Number.isInteger(data.listingId) || data.listingId < MIN_LISTING_ID) {
    errors.push(`listingId must be a positive integer (minimum ${MIN_LISTING_ID})`);
  }

  // Validate buyerName
  if (!data.buyerName) {
    errors.push('buyerName is required');
  } else if (typeof data.buyerName !== 'string') {
    errors.push('buyerName must be a string');
  } else {
    const trimmedName = data.buyerName.trim();
    if (trimmedName.length === 0) {
      errors.push('buyerName cannot be empty');
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      errors.push(`buyerName cannot exceed ${MAX_NAME_LENGTH} characters`);
    }
  }

  // Validate buyerCountry
  if (!data.buyerCountry) {
    errors.push('buyerCountry is required');
  } else if (typeof data.buyerCountry !== 'string') {
    errors.push('buyerCountry must be a string');
  } else {
    const trimmedCountry = data.buyerCountry.trim();
    if (trimmedCountry.length === 0) {
      errors.push('buyerCountry cannot be empty');
    } else if (trimmedCountry.length > MAX_COUNTRY_LENGTH) {
      errors.push(`buyerCountry cannot exceed ${MAX_COUNTRY_LENGTH} characters`);
    }
  }

  // Validate message (required)
  if (!data.message) {
    errors.push('message is required');
  } else if (typeof data.message !== 'string') {
    errors.push('message must be a string');
  } else {
    const trimmedMessage = data.message.trim();
    if (trimmedMessage.length === 0) {
      errors.push('message cannot be empty');
    } else if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      errors.push(`message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
    }
  }

  // Return errors if any
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Build validated input (safe to cast after validation)
  const typedInput = data as unknown as InquiryInput;
  const validated: ValidatedInquiryInput = {
    listingId: typedInput.listingId,
    buyerName: typedInput.buyerName.trim(),
    buyerCountry: typedInput.buyerCountry.trim(),
    message: typedInput.message.trim(),
  };

  return {
    valid: true,
    errors: [],
    data: validated,
  };
}

/**
 * Sanitize text for inclusion in prompts
 * Removes potentially harmful content while preserving meaning
 *
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
export function sanitizeForPrompt(text: string): string {
  return text
    // Remove any HTML/script tags
    .replace(/<[^>]*>/g, '')
    // Remove potential prompt injection attempts
    .replace(/^(system|assistant|user):/gim, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format validation errors for API response
 *
 * @param errors - Array of error messages
 * @returns Formatted error string
 */
export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 1) {
    return errors[0];
  }
  return `Validation failed: ${errors.join('; ')}`;
}
