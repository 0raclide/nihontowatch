/**
 * Tests for saved search email notification templates
 *
 * Tests cover:
 * - Listing links point to Nihontowatch quickview (not external dealer URLs)
 * - URL helper function generates correct quickview URLs
 * - HTML and plain text templates include correct links
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateSavedSearchNotificationHtml,
  generateSavedSearchNotificationText,
  getListingQuickViewUrl,
} from '@/lib/email/templates/saved-search';
import type { SavedSearch, Listing } from '@/types';

// Mock the unsubscribe URL function
vi.mock('@/app/api/unsubscribe/route', () => ({
  getUnsubscribeUrl: vi.fn(() => 'https://nihontowatch.com/unsubscribe?token=test'),
}));

describe('Saved Search Email Templates', () => {
  const BASE_URL = 'https://nihontowatch.com';

  // Sample saved search
  const mockSavedSearch: SavedSearch = {
    id: 'search-123',
    user_id: 'user-456',
    name: 'Juyo',
    search_criteria: {
      tab: 'available',
      certifications: ['Juyo'],
    },
    notification_frequency: 'instant',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_notified_at: null,
  };

  // Sample listings with IDs and external URLs
  const mockListings: Listing[] = [
    {
      id: 39097,
      url: 'https://wakeidou.com/item/A380103',
      title: '刀 肥前国住陸奥守忠吉',
      item_type: 'katana',
      price_value: 8000000,
      price_currency: 'JPY',
      cert_type: 'Juyo',
      smith: 'Tadayoshi',
      images: ['https://example.com/image1.jpg'],
      first_seen_at: '2024-01-28T20:46:04Z',
      status: 'available',
      is_available: true,
      is_sold: false,
      dealer_id: 5,
    } as Listing,
    {
      id: 39100,
      url: 'https://aoijapan.com/katana/AS25400',
      title: 'Katana: Kuniyuki (NBTHK Juyo Token)',
      item_type: 'katana',
      price_value: 5500000,
      price_currency: 'JPY',
      cert_type: 'Juyo',
      smith: 'Kuniyuki',
      images: ['https://example.com/image2.jpg'],
      first_seen_at: '2024-01-29T10:00:00Z',
      status: 'available',
      is_available: true,
      is_sold: false,
      dealer_id: 1,
    } as Listing,
  ];

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = BASE_URL;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  describe('getListingQuickViewUrl', () => {
    it('should generate correct quickview URL with listing ID', () => {
      const url = getListingQuickViewUrl(39097);
      expect(url).toBe(`${BASE_URL}/?listing=39097`);
    });

    it('should handle different listing IDs', () => {
      expect(getListingQuickViewUrl(1)).toBe(`${BASE_URL}/?listing=1`);
      expect(getListingQuickViewUrl(99999)).toBe(`${BASE_URL}/?listing=99999`);
    });

    it('should use BASE_URL from environment', () => {
      const url = getListingQuickViewUrl(123);
      expect(url).toContain(BASE_URL);
      expect(url).not.toContain('undefined');
    });
  });

  describe('generateSavedSearchNotificationHtml', () => {
    it('should link listings to Nihontowatch quickview, not external dealer URLs', () => {
      const html = generateSavedSearchNotificationHtml(
        mockSavedSearch,
        mockListings,
        'instant'
      );

      // Should contain quickview links for each listing
      expect(html).toContain(`${BASE_URL}/?listing=39097`);
      expect(html).toContain(`${BASE_URL}/?listing=39100`);

      // Should NOT contain external dealer URLs as clickable links
      // (external URLs should not appear in href attributes)
      expect(html).not.toContain('href="https://wakeidou.com');
      expect(html).not.toContain('href="https://aoijapan.com');
    });

    it('should include listing titles as link text', () => {
      const html = generateSavedSearchNotificationHtml(
        mockSavedSearch,
        mockListings,
        'instant'
      );

      expect(html).toContain('刀 肥前国住陸奥守忠吉');
      expect(html).toContain('Katana: Kuniyuki (NBTHK Juyo Token)');
    });

    it('should include listing prices', () => {
      const html = generateSavedSearchNotificationHtml(
        mockSavedSearch,
        mockListings,
        'instant'
      );

      // JPY formatted prices
      expect(html).toContain('8,000,000');
      expect(html).toContain('5,500,000');
    });

    it('should include certification types', () => {
      const html = generateSavedSearchNotificationHtml(
        mockSavedSearch,
        mockListings,
        'instant'
      );

      expect(html).toContain('Juyo');
    });

    it('should include View All Results button with search URL', () => {
      const html = generateSavedSearchNotificationHtml(
        mockSavedSearch,
        mockListings,
        'instant'
      );

      // View All Results should link to the search criteria, not an individual listing
      expect(html).toContain('View All Results');
      // The saved search has certifications: ['Juyo'] so URL should contain cert=Juyo
      expect(html).toContain(`${BASE_URL}/?`);
      expect(html).toContain('cert=Juyo');
    });

    it('should limit displayed listings to 10', () => {
      // Create 15 listings
      const manyListings = Array.from({ length: 15 }, (_, i) => ({
        ...mockListings[0],
        id: 40000 + i,
        title: `Test Listing ${i + 1}`,
      })) as Listing[];

      const html = generateSavedSearchNotificationHtml(
        mockSavedSearch,
        manyListings,
        'instant'
      );

      // Should show "View X more matches" for items beyond 10
      expect(html).toContain('View 5 more match');
    });
  });

  describe('generateSavedSearchNotificationText', () => {
    it('should link listings to Nihontowatch quickview in plain text', () => {
      const text = generateSavedSearchNotificationText(
        mockSavedSearch,
        mockListings,
        'instant'
      );

      // Should contain quickview links
      expect(text).toContain(`${BASE_URL}/?listing=39097`);
      expect(text).toContain(`${BASE_URL}/?listing=39100`);

      // Should NOT contain external dealer URLs
      expect(text).not.toContain('wakeidou.com/item');
      expect(text).not.toContain('aoijapan.com/katana');
    });

    it('should include listing titles and prices', () => {
      const text = generateSavedSearchNotificationText(
        mockSavedSearch,
        mockListings,
        'instant'
      );

      expect(text).toContain('刀 肥前国住陸奥守忠吉');
      expect(text).toContain('Katana: Kuniyuki (NBTHK Juyo Token)');
      expect(text).toContain('8,000,000');
    });

    it('should format listings with numbered list', () => {
      const text = generateSavedSearchNotificationText(
        mockSavedSearch,
        mockListings,
        'instant'
      );

      expect(text).toContain('1. 刀 肥前国住陸奥守忠吉');
      expect(text).toContain('2. Katana: Kuniyuki');
    });

    it('should include View all results link', () => {
      const text = generateSavedSearchNotificationText(
        mockSavedSearch,
        mockListings,
        'instant'
      );

      expect(text).toContain('View all results:');
    });
  });

  describe('Edge Cases', () => {
    it('should handle listings with missing optional fields', () => {
      const minimalListing: Listing = {
        id: 12345,
        url: 'https://dealer.com/item',
        title: null as unknown as string, // Test null title
        item_type: 'katana',
        price_value: null,
        price_currency: 'JPY',
        cert_type: null,
        images: [],
        first_seen_at: '2024-01-01T00:00:00Z',
        status: 'available',
        is_available: true,
        is_sold: false,
        dealer_id: 1,
      } as Listing;

      const html = generateSavedSearchNotificationHtml(
        mockSavedSearch,
        [minimalListing],
        'instant'
      );

      // Should have quickview link even with minimal data
      expect(html).toContain(`${BASE_URL}/?listing=12345`);
      // Should show fallback for missing title
      expect(html).toContain('Untitled listing');
      // Should show "Ask" for missing price
      expect(html).toContain('Ask');
    });

    it('should handle empty listings array', () => {
      const html = generateSavedSearchNotificationHtml(
        mockSavedSearch,
        [],
        'instant'
      );

      // Should still render valid HTML
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('0 new items match');
    });
  });
});
