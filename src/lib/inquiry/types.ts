/**
 * Inquiry Email Generation Types
 *
 * Types for the AI-powered email drafting feature that helps
 * English-speaking collectors communicate with Japanese dealers.
 */

// =============================================================================
// Intent Types
// =============================================================================

/**
 * The purpose of the inquiry email
 */
export type InquiryIntent = 'purchase' | 'questions' | 'photos' | 'shipping' | 'other';

/**
 * Human-readable labels for each intent
 */
export const INTENT_LABELS: Record<InquiryIntent, string> = {
  purchase: 'I want to purchase this item',
  questions: 'I have questions about this item',
  photos: 'I need more photos',
  shipping: 'I need shipping information',
  other: 'Other inquiry',
};

/**
 * Descriptions for AI context
 */
export const INTENT_DESCRIPTIONS: Record<InquiryIntent, string> = {
  purchase: 'Expressing strong interest in purchasing. Asking about availability, purchase process, payment options, and international shipping.',
  questions: 'Asking specific questions about the item (condition, history, authenticity, provenance, measurements, etc.)',
  photos: 'Requesting additional photographs of the item (specific angles, close-ups, nakago, condition details)',
  shipping: 'Asking about international shipping options, costs, packaging methods, and delivery timeframes',
  other: 'General inquiry about the item',
};

// =============================================================================
// Input Types
// =============================================================================

/**
 * Input for generating an inquiry email
 */
export interface InquiryInput {
  /** The listing ID to inquire about */
  listingId: number;
  /** The purpose of the inquiry */
  intent: InquiryIntent;
  /** Buyer's name (for email signature) */
  buyerName: string;
  /** Buyer's country (for shipping context) */
  buyerCountry: string;
  /** Optional specific questions to include */
  specificQuestions?: string;
}

/**
 * Validated inquiry input (after validation)
 */
export interface ValidatedInquiryInput {
  listingId: number;
  intent: InquiryIntent;
  buyerName: string;
  buyerCountry: string;
  specificQuestions: string | null;
}

// =============================================================================
// Output Types
// =============================================================================

/**
 * Generated email result from the API
 */
export interface GeneratedEmail {
  /** Japanese email body (what the buyer sends) */
  email_ja: string;
  /** English translation (for buyer's reference) */
  email_en: string;
  /** Japanese subject line */
  subject_ja: string;
  /** English subject translation */
  subject_en: string;
  /** Dealer's contact email if known */
  dealer_email: string | null;
  /** Dealer name */
  dealer_name: string;
  /** Dealer's website domain */
  dealer_domain: string;
  /** Known dealer policies */
  dealer_policies: DealerPolicies | null;
}

/**
 * Dealer policies relevant to buyers
 */
export interface DealerPolicies {
  ships_international: boolean | null;
  accepts_wire_transfer: boolean | null;
  accepts_paypal: boolean | null;
  accepts_credit_card: boolean | null;
  requires_deposit: boolean | null;
  deposit_percentage: number | null;
  english_support: boolean | null;
}

// =============================================================================
// Context Types (for AI prompt building)
// =============================================================================

/**
 * Listing context for email generation
 */
export interface ListingContext {
  id: number;
  title: string;
  url: string;
  price_value: number | null;
  price_currency: string | null;
  item_type: string | null;
  cert_type: string | null;
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  era: string | null;
}

/**
 * Dealer context for email generation
 */
export interface DealerContext {
  id: number;
  name: string;
  domain: string;
  contact_email: string | null;
  ships_international: boolean | null;
  accepts_wire_transfer: boolean | null;
  accepts_paypal: boolean | null;
  accepts_credit_card: boolean | null;
  requires_deposit: boolean | null;
  deposit_percentage: number | null;
  english_support: boolean | null;
}

/**
 * Combined context for AI prompt
 */
export interface InquiryContext {
  listing: ListingContext;
  dealer: DealerContext;
  buyer: {
    name: string;
    country: string;
  };
  intent: InquiryIntent;
  specificQuestions: string | null;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Successful API response
 */
export interface InquiryApiResponse {
  success: true;
  data: GeneratedEmail;
}

/**
 * Error API response
 */
export interface InquiryApiError {
  success: false;
  error: string;
  code?: string;
}

/**
 * Combined API response type
 */
export type InquiryResponse = InquiryApiResponse | InquiryApiError;

// =============================================================================
// Validation
// =============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  data?: ValidatedInquiryInput;
}

/**
 * Valid intent values for runtime checking
 */
export const VALID_INTENTS: readonly InquiryIntent[] = [
  'purchase',
  'questions',
  'photos',
  'shipping',
  'other',
] as const;

/**
 * Check if a value is a valid intent
 */
export function isValidIntent(value: unknown): value is InquiryIntent {
  return typeof value === 'string' && VALID_INTENTS.includes(value as InquiryIntent);
}
