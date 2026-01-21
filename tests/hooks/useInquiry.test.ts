/**
 * useInquiry Hook Unit Tests
 *
 * Tests the useInquiry hook for generating inquiry emails.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useInquiry } from '@/hooks/useInquiry';
import type { InquiryInput, GeneratedEmail } from '@/lib/inquiry/types';

// Mock fetch
const originalFetch = global.fetch;
let mockFetchResponse: Response | null = null;

const VALID_EMAIL_RESPONSE: GeneratedEmail = {
  email_ja: '日本語のメール本文',
  email_en: 'English email body',
  subject_ja: '【お問い合わせ】テスト',
  subject_en: 'Inquiry: Test',
  dealer_email: 'test@dealer.com',
  dealer_name: 'Test Dealer',
  dealer_domain: 'test-dealer.com',
  dealer_policies: {
    ships_international: true,
    accepts_wire_transfer: true,
    accepts_paypal: false,
    accepts_credit_card: false,
    requires_deposit: true,
    deposit_percentage: 30,
    english_support: false,
  },
};

beforeEach(() => {
  mockFetchResponse = null;

  global.fetch = vi.fn(async () => {
    if (mockFetchResponse) {
      return mockFetchResponse;
    }

    return new Response(JSON.stringify(VALID_EMAIL_RESPONSE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

// =============================================================================
// BASIC FUNCTIONALITY TESTS
// =============================================================================

describe('useInquiry - Basic Functionality', () => {
  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useInquiry());

    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.generateEmail).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
  });

  it('generates email successfully', async () => {
    const { result } = renderHook(() => useInquiry());

    const input: InquiryInput = {
      listingId: 123,
      intent: 'purchase',
      buyerName: 'John Smith',
      buyerCountry: 'United States',
    };

    let email: GeneratedEmail | null = null;

    await act(async () => {
      email = await result.current.generateEmail(input);
    });

    expect(email).not.toBeNull();
    expect(email?.email_ja).toBe(VALID_EMAIL_RESPONSE.email_ja);
    expect(email?.email_en).toBe(VALID_EMAIL_RESPONSE.email_en);
    expect(email?.subject_ja).toBe(VALID_EMAIL_RESPONSE.subject_ja);
    expect(email?.dealer_email).toBe(VALID_EMAIL_RESPONSE.dealer_email);
  });

  it('sets isGenerating during API call', async () => {
    // Use a delayed response to observe the loading state
    let resolveResponse: (value: Response) => void;
    const responsePromise = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });

    global.fetch = vi.fn(() => responsePromise);

    const { result } = renderHook(() => useInquiry());

    const input: InquiryInput = {
      listingId: 123,
      intent: 'purchase',
      buyerName: 'John Smith',
      buyerCountry: 'United States',
    };

    // Start generating
    let generatePromise: Promise<GeneratedEmail | null>;
    act(() => {
      generatePromise = result.current.generateEmail(input);
    });

    // Should be generating
    expect(result.current.isGenerating).toBe(true);

    // Resolve the response
    await act(async () => {
      resolveResponse!(
        new Response(JSON.stringify(VALID_EMAIL_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      await generatePromise;
    });

    // Should no longer be generating
    expect(result.current.isGenerating).toBe(false);
  });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe('useInquiry - Error Handling', () => {
  it('handles 401 authentication error', async () => {
    mockFetchResponse = new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );

    const { result } = renderHook(() => useInquiry());

    const input: InquiryInput = {
      listingId: 123,
      intent: 'purchase',
      buyerName: 'John Smith',
      buyerCountry: 'United States',
    };

    let email: GeneratedEmail | null = null;

    await act(async () => {
      email = await result.current.generateEmail(input);
    });

    expect(email).toBeNull();
    expect(result.current.error).toBe('Authentication required');
    expect(result.current.isGenerating).toBe(false);
  });

  it('handles 400 validation error', async () => {
    mockFetchResponse = new Response(
      JSON.stringify({ error: 'buyerName is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );

    const { result } = renderHook(() => useInquiry());

    const input: InquiryInput = {
      listingId: 123,
      intent: 'purchase',
      buyerName: '',
      buyerCountry: 'United States',
    };

    let email: GeneratedEmail | null = null;

    await act(async () => {
      email = await result.current.generateEmail(input);
    });

    expect(email).toBeNull();
    expect(result.current.error).toBe('buyerName is required');
  });

  it('handles 404 listing not found error', async () => {
    mockFetchResponse = new Response(
      JSON.stringify({ error: 'Listing not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );

    const { result } = renderHook(() => useInquiry());

    const input: InquiryInput = {
      listingId: 999999,
      intent: 'purchase',
      buyerName: 'John Smith',
      buyerCountry: 'United States',
    };

    let email: GeneratedEmail | null = null;

    await act(async () => {
      email = await result.current.generateEmail(input);
    });

    expect(email).toBeNull();
    expect(result.current.error).toBe('Listing not found');
  });

  it('handles 500 server error', async () => {
    mockFetchResponse = new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );

    const { result } = renderHook(() => useInquiry());

    const input: InquiryInput = {
      listingId: 123,
      intent: 'purchase',
      buyerName: 'John Smith',
      buyerCountry: 'United States',
    };

    let email: GeneratedEmail | null = null;

    await act(async () => {
      email = await result.current.generateEmail(input);
    });

    expect(email).toBeNull();
    expect(result.current.error).toBeDefined();
  });

  it('handles network error', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const { result } = renderHook(() => useInquiry());

    const input: InquiryInput = {
      listingId: 123,
      intent: 'purchase',
      buyerName: 'John Smith',
      buyerCountry: 'United States',
    };

    let email: GeneratedEmail | null = null;

    await act(async () => {
      email = await result.current.generateEmail(input);
    });

    expect(email).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('clears error with clearError', async () => {
    mockFetchResponse = new Response(
      JSON.stringify({ error: 'Some error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );

    const { result } = renderHook(() => useInquiry());

    const input: InquiryInput = {
      listingId: 123,
      intent: 'purchase',
      buyerName: 'John Smith',
      buyerCountry: 'United States',
    };

    await act(async () => {
      await result.current.generateEmail(input);
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});

// =============================================================================
// API CALL TESTS
// =============================================================================

describe('useInquiry - API Calls', () => {
  it('sends correct request body', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(VALID_EMAIL_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    global.fetch = fetchSpy;

    const { result } = renderHook(() => useInquiry());

    const input: InquiryInput = {
      listingId: 123,
      intent: 'questions',
      buyerName: 'Jane Doe',
      buyerCountry: 'Germany',
      specificQuestions: 'Is there any rust?',
    };

    await act(async () => {
      await result.current.generateEmail(input);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];

    expect(url).toBe('/api/inquiry/generate');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });

    const body = JSON.parse(options.body as string);
    expect(body.listingId).toBe(123);
    expect(body.intent).toBe('questions');
    expect(body.buyerName).toBe('Jane Doe');
    expect(body.buyerCountry).toBe('Germany');
    expect(body.specificQuestions).toBe('Is there any rust?');
  });

  it('clears previous error on new request', async () => {
    // First request fails
    mockFetchResponse = new Response(
      JSON.stringify({ error: 'First error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );

    const { result } = renderHook(() => useInquiry());

    const input: InquiryInput = {
      listingId: 123,
      intent: 'purchase',
      buyerName: 'John Smith',
      buyerCountry: 'United States',
    };

    await act(async () => {
      await result.current.generateEmail(input);
    });

    expect(result.current.error).toBe('First error');

    // Second request succeeds
    mockFetchResponse = null; // Will use default success response

    await act(async () => {
      await result.current.generateEmail(input);
    });

    expect(result.current.error).toBeNull();
  });
});
