/**
 * Inquiry Email Generation API
 *
 * POST /api/inquiry/generate
 *
 * Generates culturally-appropriate Japanese business emails for
 * English-speaking collectors to contact Japanese sword dealers.
 *
 * Requires authentication.
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  validateInquiryInput,
  formatValidationErrors,
  buildUserPrompt,
  SYSTEM_PROMPT,
  type ValidatedInquiryInput,
  type GeneratedEmail,
  type ListingContext,
  type DealerContext,
  type InquiryContext,
  type DealerPolicies,
} from '@/lib/inquiry';

export const dynamic = 'force-dynamic';

// =============================================================================
// Types
// =============================================================================

interface ListingWithDealer {
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
  dealers: {
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
  };
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface GeneratedEmailJson {
  subject_ja: string;
  subject_en: string;
  email_ja: string;
  email_en: string;
}

// =============================================================================
// Main Handler
// =============================================================================

/**
 * POST /api/inquiry/generate
 *
 * Generate a Japanese business email for contacting a dealer.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // ---------------------------------------------------------------------
    // 1. Verify authentication
    // ---------------------------------------------------------------------
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------------------
    // 2. Parse and validate input
    // ---------------------------------------------------------------------
    const body = await request.json();
    const validation = validateInquiryInput(body);

    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { error: formatValidationErrors(validation.errors) },
        { status: 400 }
      );
    }

    const input: ValidatedInquiryInput = validation.data;

    // ---------------------------------------------------------------------
    // 3. Fetch listing with dealer information
    // ---------------------------------------------------------------------
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select(`
        id, title, url, price_value, price_currency, item_type, cert_type,
        smith, tosogu_maker, school, tosogu_school, era,
        dealers (
          id, name, domain, contact_email, ships_international,
          accepts_wire_transfer, accepts_paypal, accepts_credit_card,
          requires_deposit, deposit_percentage, english_support
        )
      `)
      .eq('id', input.listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    const typedListing = listing as unknown as ListingWithDealer;

    // ---------------------------------------------------------------------
    // 4. Check for API key
    // ---------------------------------------------------------------------
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('[Inquiry API] OPENROUTER_API_KEY not configured');
      return NextResponse.json(
        { error: 'Email generation service unavailable (API key not configured)' },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------------------
    // 5. Build context and generate email
    // ---------------------------------------------------------------------
    const context = buildInquiryContext(typedListing, input);
    const generatedEmail = await generateEmailWithAI(context, apiKey);

    // ---------------------------------------------------------------------
    // 6. Log inquiry to history (non-blocking)
    // ---------------------------------------------------------------------
    logInquiryHistory(supabase, {
      userId: user.id,
      listingId: input.listingId,
      dealerId: typedListing.dealers.id,
      intent: input.intent,
      buyerCountry: input.buyerCountry,
    });

    // ---------------------------------------------------------------------
    // 7. Return generated email with dealer info
    // ---------------------------------------------------------------------
    const response: GeneratedEmail = {
      ...generatedEmail,
      dealer_email: typedListing.dealers.contact_email,
      dealer_name: typedListing.dealers.name,
      dealer_domain: typedListing.dealers.domain,
      dealer_policies: buildDealerPolicies(typedListing.dealers),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Inquiry API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate inquiry email' },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build the inquiry context from listing and input data
 */
function buildInquiryContext(
  listing: ListingWithDealer,
  input: ValidatedInquiryInput
): InquiryContext {
  const listingContext: ListingContext = {
    id: listing.id,
    title: listing.title,
    url: listing.url,
    price_value: listing.price_value,
    price_currency: listing.price_currency,
    item_type: listing.item_type,
    cert_type: listing.cert_type,
    smith: listing.smith,
    tosogu_maker: listing.tosogu_maker,
    school: listing.school,
    tosogu_school: listing.tosogu_school,
    era: listing.era,
  };

  const dealerContext: DealerContext = {
    id: listing.dealers.id,
    name: listing.dealers.name,
    domain: listing.dealers.domain,
    contact_email: listing.dealers.contact_email,
    ships_international: listing.dealers.ships_international,
    accepts_wire_transfer: listing.dealers.accepts_wire_transfer,
    accepts_paypal: listing.dealers.accepts_paypal,
    accepts_credit_card: listing.dealers.accepts_credit_card,
    requires_deposit: listing.dealers.requires_deposit,
    deposit_percentage: listing.dealers.deposit_percentage,
    english_support: listing.dealers.english_support,
  };

  return {
    listing: listingContext,
    dealer: dealerContext,
    buyer: {
      name: input.buyerName,
      country: input.buyerCountry,
    },
    intent: input.intent,
    specificQuestions: input.specificQuestions,
  };
}

/**
 * Build dealer policies object for response
 */
function buildDealerPolicies(dealer: ListingWithDealer['dealers']): DealerPolicies {
  return {
    ships_international: dealer.ships_international,
    accepts_wire_transfer: dealer.accepts_wire_transfer,
    accepts_paypal: dealer.accepts_paypal,
    accepts_credit_card: dealer.accepts_credit_card,
    requires_deposit: dealer.requires_deposit,
    deposit_percentage: dealer.deposit_percentage,
    english_support: dealer.english_support,
  };
}

/**
 * Generate email using OpenRouter API (Claude model)
 */
async function generateEmailWithAI(
  context: InquiryContext,
  apiKey: string
): Promise<Omit<GeneratedEmail, 'dealer_email' | 'dealer_name' | 'dealer_domain' | 'dealer_policies'>> {
  const userPrompt = buildUserPrompt(context);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://nihontowatch.com',
      'X-Title': 'Nihontowatch Inquiry',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-20250514',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      max_tokens: 3000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Inquiry API] OpenRouter error:', response.status, errorText);
    throw new Error(`AI service error: ${response.status}`);
  }

  const data: OpenRouterResponse = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    console.error('[Inquiry API] Empty AI response');
    throw new Error('Empty response from AI service');
  }

  // Parse JSON from response
  const parsed = parseEmailJson(content);

  return {
    email_ja: parsed.email_ja,
    email_en: parsed.email_en,
    subject_ja: parsed.subject_ja,
    subject_en: parsed.subject_en,
  };
}

/**
 * Parse the JSON email response from the AI
 */
function parseEmailJson(content: string): GeneratedEmailJson {
  // Try to extract JSON from the response
  // The AI might return just JSON or JSON wrapped in other text
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    console.error('[Inquiry API] No JSON found in response:', content.substring(0, 200));
    throw new Error('Invalid AI response format');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as GeneratedEmailJson;

    // Validate required fields
    if (!parsed.email_ja || !parsed.email_en || !parsed.subject_ja || !parsed.subject_en) {
      throw new Error('Missing required fields in AI response');
    }

    return parsed;
  } catch (parseError) {
    console.error('[Inquiry API] JSON parse error:', parseError);
    throw new Error('Failed to parse AI response');
  }
}

/**
 * Log inquiry to history table (non-blocking)
 */
function logInquiryHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: {
    userId: string;
    listingId: number;
    dealerId: number;
    intent: string;
    buyerCountry: string;
  }
): void {
  // Fire and forget - don't await
  // Type assertion needed until database types are regenerated
  (supabase.from('inquiry_history' as 'dealers') as unknown as {
    insert: (data: Record<string, unknown>) => { then: (fn: () => void) => { catch: (fn: (e: Error) => void) => void } }
  })
    .insert({
      user_id: data.userId,
      listing_id: data.listingId,
      dealer_id: data.dealerId,
      intent: data.intent,
      buyer_country: data.buyerCountry,
    })
    .then(() => {
      // Success - no action needed
    })
    .catch((error) => {
      // Log but don't fail the request
      console.error('[Inquiry API] Failed to log inquiry history:', error);
    });
}
