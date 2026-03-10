/**
 * Tests for "I Own This" prefill flow:
 * - sessionStorage.collection_prefill is read on mount
 * - Fields are mapped to DealerListingForm initialData
 * - sessionStorage is cleared after reading
 * - Tosogu items get correct category inference
 * - source_listing_id flows through to form
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Track what initialData gets passed to DealerListingForm
// ---------------------------------------------------------------------------

let capturedInitialData: Record<string, unknown> | undefined;

vi.mock('@/components/dealer/DealerListingForm', () => ({
  DealerListingForm: (props: Record<string, unknown>) => {
    capturedInitialData = props.initialData as Record<string, unknown> | undefined;
    return <div data-testid="dealer-listing-form" data-mode={props.mode} data-context={props.context} />;
  },
}));

vi.mock('@/i18n/LocaleContext', () => ({
  useLocale: () => ({
    t: (key: string) => key,
    locale: 'en',
  }),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function setPrefill(data: Record<string, unknown>) {
  sessionStorage.setItem('collection_prefill', JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Collection Add Page — "I Own This" prefill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedInitialData = undefined;
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('renders form without initialData when no prefill exists', async () => {
    const Page = (await import('@/app/vault/add/page')).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByTestId('dealer-listing-form')).toBeDefined();
    });

    expect(capturedInitialData).toBeUndefined();
  });

  it('reads prefill from sessionStorage and passes as initialData', async () => {
    setPrefill({
      source_listing_id: 42,
      item_type: 'katana',
      title: 'Katana by Masamune',
      artisan_id: 'MAS590',
      artisan_display_name: 'Masamune',
      cert_type: 'juyo',
      cert_session: 55,
      smith: 'Masamune',
      school: 'Soshu',
      province: 'Sagami',
      era: 'Kamakura',
      mei_type: 'zaimei',
      nagasa_cm: 70.5,
      sori_cm: 2.1,
      motohaba_cm: 3.2,
      sakihaba_cm: 2.1,
      price_paid: 5000000,
      price_paid_currency: 'JPY',
      images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
    });

    const Page = (await import('@/app/vault/add/page')).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByTestId('dealer-listing-form')).toBeDefined();
    });

    expect(capturedInitialData).toBeDefined();
    expect(capturedInitialData!.source_listing_id).toBe(42);
    expect(capturedInitialData!.item_type).toBe('katana');
    expect(capturedInitialData!.item_category).toBe('nihonto');
    expect(capturedInitialData!.title).toBe('Katana by Masamune');
    expect(capturedInitialData!.artisan_id).toBe('MAS590');
    expect(capturedInitialData!.artisan_display_name).toBe('Masamune');
    expect(capturedInitialData!.cert_type).toBe('juyo');
    expect(capturedInitialData!.cert_session).toBe(55);
    expect(capturedInitialData!.smith).toBe('Masamune');
    expect(capturedInitialData!.school).toBe('Soshu');
    expect(capturedInitialData!.province).toBe('Sagami');
    expect(capturedInitialData!.era).toBe('Kamakura');
    expect(capturedInitialData!.mei_type).toBe('zaimei');
    expect(capturedInitialData!.nagasa_cm).toBe(70.5);
    expect(capturedInitialData!.sori_cm).toBe(2.1);
    expect(capturedInitialData!.motohaba_cm).toBe(3.2);
    expect(capturedInitialData!.sakihaba_cm).toBe(2.1);
    expect(capturedInitialData!.price_value).toBe(5000000);
    expect(capturedInitialData!.price_currency).toBe('JPY');
    expect(capturedInitialData!.images).toEqual([
      'https://example.com/img1.jpg',
      'https://example.com/img2.jpg',
    ]);
  });

  it('clears sessionStorage after reading prefill', async () => {
    setPrefill({ item_type: 'katana', title: 'Test' });

    const Page = (await import('@/app/vault/add/page')).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByTestId('dealer-listing-form')).toBeDefined();
    });

    expect(sessionStorage.getItem('collection_prefill')).toBeNull();
  });

  it('infers tosogu category for tsuba item type', async () => {
    setPrefill({
      item_type: 'tsuba',
      smith: 'Goto Ichijo',
      school: 'Goto',
    });

    const Page = (await import('@/app/vault/add/page')).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByTestId('dealer-listing-form')).toBeDefined();
    });

    expect(capturedInitialData!.item_category).toBe('tosogu');
    // Smith/school should be routed to tosogu fields
    expect(capturedInitialData!.tosogu_maker).toBe('Goto Ichijo');
    expect(capturedInitialData!.tosogu_school).toBe('Goto');
    expect(capturedInitialData!.smith).toBeNull();
    expect(capturedInitialData!.school).toBeNull();
  });

  it('infers tosogu category for fuchi_kashira', async () => {
    setPrefill({ item_type: 'fuchi_kashira' });

    const Page = (await import('@/app/vault/add/page')).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByTestId('dealer-listing-form')).toBeDefined();
    });

    expect(capturedInitialData!.item_category).toBe('tosogu');
  });

  it('infers nihonto category for tanto', async () => {
    setPrefill({ item_type: 'tanto' });

    const Page = (await import('@/app/vault/add/page')).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByTestId('dealer-listing-form')).toBeDefined();
    });

    expect(capturedInitialData!.item_category).toBe('nihonto');
  });

  it('handles malformed sessionStorage gracefully', async () => {
    sessionStorage.setItem('collection_prefill', 'not-json');

    const Page = (await import('@/app/vault/add/page')).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByTestId('dealer-listing-form')).toBeDefined();
    });

    expect(capturedInitialData).toBeUndefined();
    // sessionStorage should still be cleared
    expect(sessionStorage.getItem('collection_prefill')).toBeNull();
  });

  it('passes mode="add" and context="collection" to form', async () => {
    const Page = (await import('@/app/vault/add/page')).default;
    render(<Page />);

    await waitFor(() => {
      const form = screen.getByTestId('dealer-listing-form');
      expect(form.getAttribute('data-mode')).toBe('add');
      expect(form.getAttribute('data-context')).toBe('collection');
    });
  });
});
