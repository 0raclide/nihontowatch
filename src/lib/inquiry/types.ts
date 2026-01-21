/**
 * Inquiry Email Generation Types
 *
 * Types for the AI-powered email drafting feature that helps
 * English-speaking collectors communicate with Japanese dealers.
 */

// =============================================================================
// Input Types
// =============================================================================

/**
 * Input for generating an inquiry email
 */
export interface InquiryInput {
  /** The listing ID to inquire about */
  listingId: number;
  /** Buyer's name (for email signature) */
  buyerName: string;
  /** Buyer's country (for shipping context) */
  buyerCountry: string;
  /** The buyer's message (what they want to communicate) */
  message: string;
}

/**
 * Validated inquiry input (after validation)
 */
export interface ValidatedInquiryInput {
  listingId: number;
  buyerName: string;
  buyerCountry: string;
  message: string;
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
  /** The buyer's message/request in their own words */
  message: string;
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
