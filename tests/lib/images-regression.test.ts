/**
 * Regression tests for image loading behavior.
 *
 * These tests verify that getAllImages() returns ONLY Supabase URLs
 * when stored_images are available and properly named with indices.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getAllImages, hasStoredImages, getImageSource } from '@/lib/images';

// Real listing 6759 data from production database
// This listing has ALL 9 images stored in Supabase
const listing6759 = {
  stored_images: [
    'https://itbhfhyptogxcjbjfzwx.supabase.co/storage/v1/object/public/listing-images/tsuruginoya/L06759/00.jpg',
    'https://itbhfhyptogxcjbjfzwx.supabase.co/storage/v1/object/public/listing-images/tsuruginoya/L06759/01.jpg',
    'https://itbhfhyptogxcjbjfzwx.supabase.co/storage/v1/object/public/listing-images/tsuruginoya/L06759/02.jpg',
    'https://itbhfhyptogxcjbjfzwx.supabase.co/storage/v1/object/public/listing-images/tsuruginoya/L06759/03.jpg',
    'https://itbhfhyptogxcjbjfzwx.supabase.co/storage/v1/object/public/listing-images/tsuruginoya/L06759/04.jpg',
    'https://itbhfhyptogxcjbjfzwx.supabase.co/storage/v1/object/public/listing-images/tsuruginoya/L06759/05.jpg',
    'https://itbhfhyptogxcjbjfzwx.supabase.co/storage/v1/object/public/listing-images/tsuruginoya/L06759/06.jpg',
    'https://itbhfhyptogxcjbjfzwx.supabase.co/storage/v1/object/public/listing-images/tsuruginoya/L06759/07.jpg',
    'https://itbhfhyptogxcjbjfzwx.supabase.co/storage/v1/object/public/listing-images/tsuruginoya/L06759/08.jpg',
  ],
  images: [
    'https://www.tsuruginoya.com/image_items/f00223/item01.jpg',
    'https://www.tsuruginoya.com/image_items/f00223/item14_b.jpg',
    'https://www.tsuruginoya.com/image_items/f00223/item15_b.jpg',
    'https://www.tsuruginoya.com/image_items/f00223/item22.jpg',
    'https://www.tsuruginoya.com/image_items/f00223/item23.jpg',
    'https://www.tsuruginoya.com/image_items/f00223/item24_c.jpg',
    'https://www.tsuruginoya.com/image_items/f00223/item25.jpg',
    'https://www.tsuruginoya.com/image_items/f00223/item31.jpg',
    'https://www.tsuruginoya.com/image_items/f00223/item32.jpg',
  ],
};

describe('Regression: Listing 6759 image loading', () => {
  it('has all images stored in Supabase', () => {
    expect(hasStoredImages(listing6759)).toBe(true);
    expect(listing6759.stored_images.length).toBe(9);
    expect(listing6759.images.length).toBe(9);
  });

  it('getAllImages returns ONLY Supabase URLs (no dealer URLs)', () => {
    const images = getAllImages(listing6759);

    // Should have 9 images
    expect(images.length).toBe(9);

    // None should be dealer URLs
    const dealerUrls = images.filter(url => url.includes('tsuruginoya.com'));
    expect(dealerUrls).toEqual([]);

    // All should be Supabase URLs
    const supabaseUrls = images.filter(url => url.includes('supabase.co'));
    expect(supabaseUrls.length).toBe(9);
  });

  it('getAllImages returns images in correct index order', () => {
    const images = getAllImages(listing6759);

    // Verify order matches stored image indices
    expect(images[0]).toContain('/00.jpg');
    expect(images[1]).toContain('/01.jpg');
    expect(images[2]).toContain('/02.jpg');
    expect(images[3]).toContain('/03.jpg');
    expect(images[4]).toContain('/04.jpg');
    expect(images[5]).toContain('/05.jpg');
    expect(images[6]).toContain('/06.jpg');
    expect(images[7]).toContain('/07.jpg');
    expect(images[8]).toContain('/08.jpg');
  });

  it('getImageSource reports "stored" for all indices', () => {
    for (let i = 0; i < 9; i++) {
      expect(getImageSource(listing6759, i)).toBe('stored');
    }
  });
});

describe('Regression: QuickView should only load Supabase URLs', () => {
  /**
   * This test simulates what happens when QuickView receives listing data.
   * The listing should retain stored_images through the data flow.
   */
  it('listing with stored_images should produce only Supabase URLs', () => {
    // Simulate the data transformation in VirtualListingGrid
    const apiListing = {
      ...listing6759,
      id: 6759,
      title: '太刀 備前長船倫光',
      dealers: { id: 1, name: 'Tsuruginoya', domain: 'tsuruginoya.com' },
    };

    // This is what happens in VirtualListingGrid quickViewListings memo
    const quickViewListing = {
      ...apiListing,
      id: typeof apiListing.id === 'string' ? parseInt(apiListing.id, 10) : apiListing.id,
      dealer: apiListing.dealers ? {
        id: apiListing.dealers.id,
        name: apiListing.dealers.name,
        domain: apiListing.dealers.domain,
      } : undefined,
    };

    // Verify stored_images is preserved after transformation
    expect(quickViewListing.stored_images).toBeDefined();
    expect(quickViewListing.stored_images?.length).toBe(9);

    // Verify getAllImages works correctly
    const images = getAllImages(quickViewListing);
    expect(images.length).toBe(9);

    const dealerUrls = images.filter(url => url.includes('tsuruginoya.com'));
    expect(dealerUrls).toEqual([]);
  });

  /**
   * Test that simulates full data flow: API response -> state -> grid -> QuickView
   * This mirrors exactly how data flows through the app.
   */
  it('preserves stored_images through full browse page data flow', () => {
    // Step 1: Simulated API response (what /api/browse returns)
    const apiResponse = {
      listings: [
        {
          id: '6759', // Note: browse API returns string IDs
          url: 'https://tsuruginoya.com/item/6759',
          title: '太刀 備前長船倫光',
          item_type: 'tachi',
          price_value: 5500000,
          price_currency: 'JPY',
          smith: '倫光',
          tosogu_maker: null,
          school: '長船',
          tosogu_school: null,
          cert_type: 'Tokuju',
          nagasa_cm: 72.5,
          images: listing6759.images,
          stored_images: listing6759.stored_images, // KEY: API includes this
          first_seen_at: '2025-12-01T00:00:00Z',
          status: 'available',
          is_available: true,
          is_sold: false,
          dealer_id: 1,
          dealers: { id: 1, name: 'Tsuruginoya', domain: 'tsuruginoya.com' },
        },
      ],
    };

    // Step 2: Browse page stores in state (setAllListings)
    const allListings = apiResponse.listings;
    expect(allListings[0].stored_images).toBeDefined();
    expect(allListings[0].stored_images?.length).toBe(9);

    // Step 3: ListingGrid passes to VirtualListingGrid
    const listings = allListings;
    expect(listings[0].stored_images).toBeDefined();

    // Step 4: VirtualListingGrid transforms for QuickView
    const quickViewListings = listings.map(listing => ({
      ...listing,
      id: typeof listing.id === 'string' ? parseInt(listing.id, 10) : listing.id,
      dealer: listing.dealers ? {
        id: listing.dealers.id,
        name: listing.dealers.name,
        domain: listing.dealers.domain,
      } : undefined,
    }));

    // Verify stored_images survives the transformation
    expect(quickViewListings[0].stored_images).toBeDefined();
    expect(quickViewListings[0].stored_images?.length).toBe(9);

    // Step 5: QuickView calls getAllImages
    const images = getAllImages(quickViewListings[0]);

    // Final verification: NO dealer URLs
    expect(images.length).toBe(9);
    const dealerUrls = images.filter(url => url.includes('tsuruginoya.com'));
    expect(dealerUrls).toEqual([]);
  });

  /**
   * This test verifies the edge case where stored_images might be undefined
   * (not just empty array). getAllImages should handle this gracefully.
   */
  it('handles undefined stored_images gracefully', () => {
    const listingWithoutStored = {
      images: listing6759.images,
      stored_images: undefined,
    };

    const images = getAllImages(listingWithoutStored);

    // Should fall back to original images
    expect(images.length).toBe(9);
    expect(images[0]).toContain('tsuruginoya.com');
  });

  /**
   * This test verifies that null stored_images is handled correctly.
   */
  it('handles null stored_images gracefully', () => {
    const listingWithNullStored = {
      images: listing6759.images,
      stored_images: null,
    };

    const images = getAllImages(listingWithNullStored);

    // Should fall back to original images
    expect(images.length).toBe(9);
    expect(images[0]).toContain('tsuruginoya.com');
  });
});
