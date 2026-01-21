/**
 * Inquiry Email Generation Module
 *
 * AI-powered email drafting for Japanese sword dealer communication.
 * Helps English-speaking collectors compose culturally-appropriate
 * Japanese business emails.
 *
 * @module lib/inquiry
 */

// Types
export * from './types';

// Validation
export {
  validateInquiryInput,
  sanitizeForPrompt,
  formatValidationErrors,
  MAX_NAME_LENGTH,
  MAX_COUNTRY_LENGTH,
  MAX_QUESTIONS_LENGTH,
} from './validation';

// Seasonal greetings
export {
  getSeasonalGreeting,
  getFormalGreeting,
  getGreetingContext,
  getAllGreetings,
  type SeasonalGreeting,
} from './seasonal';

// AI Prompts
export {
  SYSTEM_PROMPT,
  buildUserPrompt,
  getIntentInstructions,
} from './prompts';
