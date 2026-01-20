import { describe, it, expect } from 'vitest';
import {
  getImageUrl,
  getAllImages,
  hasStoredImages,
  getImageSource,
  getImageCount,
  hasAnyImages,
  isValidItemImage,
} from '@/lib/images';

describe('getImageUrl', () => {
  describe('basic functionality', () => {
    it('returns null for null listing', () => {
      expect(getImageUrl(null)).toBeNull();
    });

    it('returns null for undefined listing', () => {
      expect(getImageUrl(undefined)).toBeNull();
    });

    it('returns null for empty listing', () => {
      expect(getImageUrl({})).toBeNull();
    });

    it('returns null when both arrays are empty', () => {
      expect(getImageUrl({ stored_images: [], images: [] })).toBeNull();
    });

    it('returns null when both arrays are null', () => {
      expect(getImageUrl({ stored_images: null, images: null })).toBeNull();
    });
  });

  describe('returns stored_images first', () => {
    it('returns first stored image when both available', () => {
      const listing = {
        stored_images: ['https://supabase.co/storage/stored1.jpg'],
        images: ['https://dealer.com/original1.jpg'],
      };
      expect(getImageUrl(listing)).toBe('https://supabase.co/storage/stored1.jpg');
    });

    it('returns second stored image at index 1', () => {
      const listing = {
        stored_images: ['https://supabase.co/storage/stored1.jpg', 'https://supabase.co/storage/stored2.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg'],
      };
      expect(getImageUrl(listing, 1)).toBe('https://supabase.co/storage/stored2.jpg');
    });

    it('returns original images after stored images', () => {
      const listing = {
        stored_images: ['https://supabase.co/storage/stored1.jpg', 'https://supabase.co/storage/stored2.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg'],
      };
      // Index 2 is first original image (after 2 stored images)
      expect(getImageUrl(listing, 2)).toBe('https://dealer.com/original1.jpg');
      expect(getImageUrl(listing, 3)).toBe('https://dealer.com/original2.jpg');
    });
  });

  describe('fallback to original images', () => {
    it('returns original when stored_images is null', () => {
      const listing = {
        stored_images: null,
        images: ['https://dealer.com/original1.jpg'],
      };
      expect(getImageUrl(listing)).toBe('https://dealer.com/original1.jpg');
    });

    it('returns original when stored_images is empty', () => {
      const listing = {
        stored_images: [],
        images: ['https://dealer.com/original1.jpg'],
      };
      expect(getImageUrl(listing)).toBe('https://dealer.com/original1.jpg');
    });

    it('returns original when stored_images is undefined', () => {
      const listing = {
        images: ['https://dealer.com/original1.jpg'],
      };
      expect(getImageUrl(listing)).toBe('https://dealer.com/original1.jpg');
    });

    it('returns combined list at specific index when stored is shorter', () => {
      const listing = {
        stored_images: ['https://supabase.co/storage/stored1.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg', 'https://dealer.com/original3.jpg'],
      };
      // New behavior: stored first, then original
      // Index 0: stored1, Index 1: original1, Index 2: original2, Index 3: original3
      expect(getImageUrl(listing, 0)).toBe('https://supabase.co/storage/stored1.jpg');
      expect(getImageUrl(listing, 2)).toBe('https://dealer.com/original2.jpg');
      expect(getImageUrl(listing, 3)).toBe('https://dealer.com/original3.jpg');
    });
  });

  describe('edge cases', () => {
    it('returns null for out-of-bounds index', () => {
      const listing = {
        stored_images: ['https://supabase.co/storage/stored1.jpg'],
        images: ['https://dealer.com/original1.jpg'],
      };
      expect(getImageUrl(listing, 5)).toBeNull();
    });

    it('handles sparse stored_images array (skips empty strings)', () => {
      const listing = {
        stored_images: ['https://supabase.co/storage/stored1.jpg', '', 'https://supabase.co/storage/stored3.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg', 'https://dealer.com/original3.jpg'],
      };
      // New behavior: empty strings are skipped, so index 1 is stored3.jpg
      expect(getImageUrl(listing, 0)).toBe('https://supabase.co/storage/stored1.jpg');
      expect(getImageUrl(listing, 1)).toBe('https://supabase.co/storage/stored3.jpg');
    });

    it('filters out unsupported formats', () => {
      const listing = {
        stored_images: [],
        images: ['https://dealer.com/original1.tif', 'https://dealer.com/original2.jpg'],
      };
      // TIF is filtered out, so first image is the jpg
      expect(getImageUrl(listing, 0)).toBe('https://dealer.com/original2.jpg');
    });
  });
});

describe('getAllImages', () => {
  describe('basic functionality', () => {
    it('returns empty array for null listing', () => {
      expect(getAllImages(null)).toEqual([]);
    });

    it('returns empty array for undefined listing', () => {
      expect(getAllImages(undefined)).toEqual([]);
    });

    it('returns empty array for empty listing', () => {
      expect(getAllImages({})).toEqual([]);
    });
  });

  describe('combines stored and original images', () => {
    it('returns stored images when original is empty', () => {
      const listing = {
        stored_images: ['https://supabase.co/stored1.jpg', 'https://supabase.co/stored2.jpg'],
        images: [],
      };
      expect(getAllImages(listing)).toEqual([
        'https://supabase.co/stored1.jpg',
        'https://supabase.co/stored2.jpg',
      ]);
    });

    it('returns original images when stored is empty', () => {
      const listing = {
        stored_images: [],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg'],
      };
      expect(getAllImages(listing)).toEqual([
        'https://dealer.com/original1.jpg',
        'https://dealer.com/original2.jpg',
      ]);
    });

    it('falls back to all images when stored URLs are unparseable', () => {
      // When stored URLs don't match the /XX.jpg pattern, we can't determine indices
      // so we fall back to showing all stored + all original (deduplicated by URL)
      const listing = {
        stored_images: ['https://supabase.co/stored1.jpg', 'https://supabase.co/stored2.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg'],
      };
      // Fallback behavior: stored first, then original (all unique)
      expect(getAllImages(listing)).toEqual([
        'https://supabase.co/stored1.jpg',
        'https://supabase.co/stored2.jpg',
        'https://dealer.com/original1.jpg',
        'https://dealer.com/original2.jpg',
      ]);
    });

    it('merges by index when stored URLs are parseable', () => {
      // When stored URLs match the /XX.jpg pattern, merge by index
      const listing = {
        stored_images: [
          'https://supabase.co/dealer/L00001/00.jpg',
          'https://supabase.co/dealer/L00001/01.jpg',
        ],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg'],
      };
      // Merged: stored replaces original at same indices
      expect(getAllImages(listing)).toEqual([
        'https://supabase.co/dealer/L00001/00.jpg',
        'https://supabase.co/dealer/L00001/01.jpg',
      ]);
    });

    it('combines unparseable stored with all originals', () => {
      const listing = {
        stored_images: ['https://supabase.co/stored1.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg', 'https://dealer.com/original3.jpg'],
      };
      // Fallback: stored + all original
      expect(getAllImages(listing)).toEqual([
        'https://supabase.co/stored1.jpg',
        'https://dealer.com/original1.jpg',
        'https://dealer.com/original2.jpg',
        'https://dealer.com/original3.jpg',
      ]);
    });

    it('deduplicates identical URLs', () => {
      const listing = {
        stored_images: ['https://supabase.co/same.jpg', 'https://supabase.co/stored2.jpg'],
        images: ['https://supabase.co/same.jpg', 'https://dealer.com/original2.jpg'],
      };
      // Duplicate removed
      expect(getAllImages(listing)).toEqual([
        'https://supabase.co/same.jpg',
        'https://supabase.co/stored2.jpg',
        'https://dealer.com/original2.jpg',
      ]);
    });
  });

  describe('filters unsupported image formats', () => {
    it('filters out .tif files', () => {
      const listing = {
        stored_images: [],
        images: ['https://dealer.com/img1.jpg', 'https://dealer.com/img2.tif', 'https://dealer.com/img3.jpg'],
      };
      expect(getAllImages(listing)).toEqual([
        'https://dealer.com/img1.jpg',
        'https://dealer.com/img3.jpg',
      ]);
    });

    it('filters out .tiff files', () => {
      const listing = {
        stored_images: [],
        images: ['https://dealer.com/img1.tiff', 'https://dealer.com/img2.jpg'],
      };
      expect(getAllImages(listing)).toEqual([
        'https://dealer.com/img2.jpg',
      ]);
    });

    it('filters out .bmp files', () => {
      const listing = {
        stored_images: [],
        images: ['https://dealer.com/img1.bmp', 'https://dealer.com/img2.jpg'],
      };
      expect(getAllImages(listing)).toEqual([
        'https://dealer.com/img2.jpg',
      ]);
    });

    it('filters out .psd files', () => {
      const listing = {
        stored_images: [],
        images: ['https://dealer.com/img1.psd', 'https://dealer.com/img2.jpg'],
      };
      expect(getAllImages(listing)).toEqual([
        'https://dealer.com/img2.jpg',
      ]);
    });

    it('filters out raw camera formats', () => {
      const listing = {
        stored_images: [],
        images: [
          'https://dealer.com/img1.raw',
          'https://dealer.com/img2.cr2',
          'https://dealer.com/img3.nef',
          'https://dealer.com/img4.jpg',
        ],
      };
      expect(getAllImages(listing)).toEqual([
        'https://dealer.com/img4.jpg',
      ]);
    });

    it('handles case-insensitive extension matching', () => {
      const listing = {
        stored_images: [],
        images: ['https://dealer.com/img1.TIF', 'https://dealer.com/img2.Tiff', 'https://dealer.com/img3.jpg'],
      };
      expect(getAllImages(listing)).toEqual([
        'https://dealer.com/img3.jpg',
      ]);
    });

    it('allows common web formats', () => {
      const listing = {
        stored_images: [],
        images: [
          'https://dealer.com/img1.jpg',
          'https://dealer.com/img2.jpeg',
          'https://dealer.com/img3.png',
          'https://dealer.com/img4.gif',
          'https://dealer.com/img5.webp',
          'https://dealer.com/img6.avif',
        ],
      };
      expect(getAllImages(listing)).toEqual([
        'https://dealer.com/img1.jpg',
        'https://dealer.com/img2.jpeg',
        'https://dealer.com/img3.png',
        'https://dealer.com/img4.gif',
        'https://dealer.com/img5.webp',
        'https://dealer.com/img6.avif',
      ]);
    });
  });

  describe('handles empty strings and null values', () => {
    it('skips empty strings in arrays', () => {
      const listing = {
        stored_images: ['https://supabase.co/stored1.jpg', '', 'https://supabase.co/stored3.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg'],
      };
      expect(getAllImages(listing)).toEqual([
        'https://supabase.co/stored1.jpg',
        'https://supabase.co/stored3.jpg',
        'https://dealer.com/original1.jpg',
        'https://dealer.com/original2.jpg',
      ]);
    });
  });
});

describe('hasStoredImages', () => {
  it('returns false for null listing', () => {
    expect(hasStoredImages(null)).toBe(false);
  });

  it('returns false for undefined listing', () => {
    expect(hasStoredImages(undefined)).toBe(false);
  });

  it('returns false when stored_images is empty', () => {
    expect(hasStoredImages({ stored_images: [] })).toBe(false);
  });

  it('returns false when stored_images is null', () => {
    expect(hasStoredImages({ stored_images: null })).toBe(false);
  });

  it('returns true when stored_images has items', () => {
    expect(hasStoredImages({ stored_images: ['https://supabase.co/stored1.jpg'] })).toBe(true);
  });
});

describe('getImageSource', () => {
  it('returns "none" for null listing', () => {
    expect(getImageSource(null)).toBe('none');
  });

  it('returns "none" for undefined listing', () => {
    expect(getImageSource(undefined)).toBe('none');
  });

  it('returns "none" when both arrays empty', () => {
    expect(getImageSource({ stored_images: [], images: [] })).toBe('none');
  });

  it('returns "stored" when stored_images available', () => {
    expect(getImageSource({
      stored_images: ['https://supabase.co/stored1.jpg'],
      images: ['https://dealer.com/original1.jpg'],
    })).toBe('stored');
  });

  it('returns "original" when only original available', () => {
    expect(getImageSource({
      stored_images: [],
      images: ['https://dealer.com/original1.jpg'],
    })).toBe('original');
  });

  it('returns source for specific index', () => {
    const listing = {
      stored_images: ['https://supabase.co/stored1.jpg'],
      images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg'],
    };
    expect(getImageSource(listing, 0)).toBe('stored');
    expect(getImageSource(listing, 1)).toBe('original');
    expect(getImageSource(listing, 5)).toBe('none');
  });
});

describe('getImageCount', () => {
  it('returns 0 for null listing', () => {
    expect(getImageCount(null)).toBe(0);
  });

  it('returns 0 for undefined listing', () => {
    expect(getImageCount(undefined)).toBe(0);
  });

  it('returns 0 when both arrays empty', () => {
    expect(getImageCount({ stored_images: [], images: [] })).toBe(0);
  });

  it('returns total unique count (stored + original)', () => {
    expect(getImageCount({
      stored_images: ['a.jpg', 'b.jpg', 'c.jpg'],
      images: ['x.jpg'],
    })).toBe(4); // New behavior: 3 + 1 = 4
  });

  it('returns total unique count when original is larger', () => {
    expect(getImageCount({
      stored_images: ['a.jpg'],
      images: ['x.jpg', 'y.jpg', 'z.jpg'],
    })).toBe(4); // New behavior: 1 + 3 = 4
  });

  it('deduplicates when counting', () => {
    expect(getImageCount({
      stored_images: ['same.jpg', 'b.jpg'],
      images: ['same.jpg', 'y.jpg'],
    })).toBe(3); // 'same.jpg' is deduplicated
  });

  it('excludes unsupported formats from count', () => {
    expect(getImageCount({
      stored_images: [],
      images: ['a.jpg', 'b.tif', 'c.jpg'],
    })).toBe(2); // TIF is filtered out
  });
});

describe('hasAnyImages', () => {
  it('returns false for null listing', () => {
    expect(hasAnyImages(null)).toBe(false);
  });

  it('returns false for undefined listing', () => {
    expect(hasAnyImages(undefined)).toBe(false);
  });

  it('returns false when both arrays empty', () => {
    expect(hasAnyImages({ stored_images: [], images: [] })).toBe(false);
  });

  it('returns true when stored_images has items', () => {
    expect(hasAnyImages({ stored_images: ['a'], images: [] })).toBe(true);
  });

  it('returns true when images has items', () => {
    expect(hasAnyImages({ stored_images: [], images: ['a'] })).toBe(true);
  });

  it('returns true when both have items', () => {
    expect(hasAnyImages({ stored_images: ['a'], images: ['b'] })).toBe(true);
  });
});

describe('real-world scenarios', () => {
  it('handles listing before migration (no stored_images)', () => {
    const listing = {
      images: [
        'https://aoijapan.com/images/sword1.jpg',
        'https://aoijapan.com/images/sword2.jpg',
      ],
    };
    expect(getImageUrl(listing)).toBe('https://aoijapan.com/images/sword1.jpg');
    expect(getAllImages(listing)).toEqual([
      'https://aoijapan.com/images/sword1.jpg',
      'https://aoijapan.com/images/sword2.jpg',
    ]);
    expect(hasStoredImages(listing)).toBe(false);
    expect(getImageSource(listing)).toBe('original');
  });

  it('handles fully migrated listing', () => {
    const listing = {
      stored_images: [
        'https://supabase.co/storage/aoi-art/L00001/00.jpg',
        'https://supabase.co/storage/aoi-art/L00001/01.jpg',
      ],
      images: [
        'https://aoijapan.com/images/sword1.jpg',
        'https://aoijapan.com/images/sword2.jpg',
      ],
    };
    expect(getImageUrl(listing)).toBe('https://supabase.co/storage/aoi-art/L00001/00.jpg');
    // Merged by index: stored versions replace originals at same indices
    // 00.jpg replaces sword1.jpg (index 0), 01.jpg replaces sword2.jpg (index 1)
    // Result: only 2 unique images (no duplicates)
    expect(getAllImages(listing)).toEqual([
      'https://supabase.co/storage/aoi-art/L00001/00.jpg',
      'https://supabase.co/storage/aoi-art/L00001/01.jpg',
    ]);
    expect(hasStoredImages(listing)).toBe(true);
    expect(getImageSource(listing)).toBe('stored');
  });

  it('handles partially migrated listing (sparse stored_images)', () => {
    // Real case: stored_images named by original index (02.jpg = stored copy of original[2])
    // stored_images array only has some images, not all
    const listing = {
      stored_images: [
        'https://supabase.co/storage/aoi-art/L00001/02.jpg',
        'https://supabase.co/storage/aoi-art/L00001/04.jpg',
      ],
      images: [
        'https://aoijapan.com/images/sword1.jpg', // index 0 - no stored, use original
        'https://aoijapan.com/images/sword2.tif', // index 1 - TIF filtered out
        'https://aoijapan.com/images/sword3.jpg', // index 2 - replaced by stored 02.jpg
        'https://aoijapan.com/images/sword4.jpg', // index 3 - no stored, use original
        'https://aoijapan.com/images/sword5.jpg', // index 4 - replaced by stored 04.jpg
      ],
    };
    // Merged by index: stored versions replace originals at indices 2 and 4
    // Index 1 (TIF) is filtered, indices 0 and 3 use originals
    expect(getAllImages(listing)).toEqual([
      'https://aoijapan.com/images/sword1.jpg',   // index 0
      'https://supabase.co/storage/aoi-art/L00001/02.jpg', // index 2
      'https://aoijapan.com/images/sword4.jpg',   // index 3
      'https://supabase.co/storage/aoi-art/L00001/04.jpg', // index 4
    ]);
    expect(getImageCount(listing)).toBe(4);
  });

  it('handles listing with no images', () => {
    const listing = {
      stored_images: null,
      images: null,
    };
    expect(getImageUrl(listing)).toBeNull();
    expect(getAllImages(listing)).toEqual([]);
    expect(hasStoredImages(listing)).toBe(false);
    expect(hasAnyImages(listing)).toBe(false);
    expect(getImageCount(listing)).toBe(0);
  });

  it('handles iidakoendo listing with TIF file (real case)', () => {
    // Exact data from listing 9340
    const listing = {
      stored_images: [
        'https://supabase.co/storage/listing-images/iida-koendo/L09340/02.gif',
        'https://supabase.co/storage/listing-images/iida-koendo/L09340/04.gif',
      ],
      images: [
        'https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3879.gif',      // index 0 - no stored
        'https://iidakoendo.com/wp-content/uploads/2025/01/m543.tif',           // index 1 - TIF filtered
        'https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3873-1.gif',     // index 2 - replaced by 02.gif
        'https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3875-2-1.gif',   // index 3 - no stored
        'https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3876.gif',       // index 4 - replaced by 04.gif
        'https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3877.gif',       // index 5 - no stored
      ],
    };
    const result = getAllImages(listing);
    // TIF should be filtered out
    expect(result).not.toContain('https://iidakoendo.com/wp-content/uploads/2025/01/m543.tif');
    // Replaced originals should not be in result
    expect(result).not.toContain('https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3873-1.gif');
    expect(result).not.toContain('https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3876.gif');
    // Stored images should be present (replacing originals at indices 2 and 4)
    expect(result).toContain('https://supabase.co/storage/listing-images/iida-koendo/L09340/02.gif');
    expect(result).toContain('https://supabase.co/storage/listing-images/iida-koendo/L09340/04.gif');
    // Originals without stored versions should be present
    expect(result).toContain('https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3879.gif');
    expect(result).toContain('https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3875-2-1.gif');
    expect(result).toContain('https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3877.gif');
    // Total: 5 unique images (index 1 TIF filtered, indices 2 and 4 replaced by stored)
    expect(result.length).toBe(5);
    // Verify order: merged by index (0, 2, 3, 4, 5 - index 1 filtered)
    expect(result).toEqual([
      'https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3879.gif',      // index 0
      'https://supabase.co/storage/listing-images/iida-koendo/L09340/02.gif', // index 2
      'https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3875-2-1.gif',   // index 3
      'https://supabase.co/storage/listing-images/iida-koendo/L09340/04.gif', // index 4
      'https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3877.gif',       // index 5
    ]);
  });

  it('handles nearly complete migration with one missing index (listing 10751 case)', () => {
    // Simulates listing 10751: 19 stored images covering 0-16, 18, 19 (missing 17)
    // 20 original images at indices 0-19
    const stored_images = [];
    for (let i = 0; i <= 19; i++) {
      if (i !== 17) { // Missing index 17
        stored_images.push(`https://supabase.co/storage/nipponto/L10751/${String(i).padStart(2, '0')}.jpg`);
      }
    }
    const images = [];
    for (let i = 1; i <= 20; i++) {
      images.push(`https://www.nipponto.co.jp/upload/img97/2950_${String(i).padStart(2, '0')}.jpg`);
    }

    const listing = { stored_images, images };
    const result = getAllImages(listing);

    // Should have 20 images total (19 stored + 1 original at index 17)
    expect(result.length).toBe(20);

    // Index 17 should be original since no stored version exists
    expect(result[17]).toBe('https://www.nipponto.co.jp/upload/img97/2950_18.jpg');

    // Other indices should be stored versions
    expect(result[0]).toBe('https://supabase.co/storage/nipponto/L10751/00.jpg');
    expect(result[16]).toBe('https://supabase.co/storage/nipponto/L10751/16.jpg');
    expect(result[18]).toBe('https://supabase.co/storage/nipponto/L10751/18.jpg');

    // Originals at covered indices should NOT be present
    expect(result).not.toContain('https://www.nipponto.co.jp/upload/img97/2950_01.jpg');
  });

  it('handles single stored image (listing 9637 case)', () => {
    // Simulates listing 9637: 1 stored image (00.jpg), 2 originals
    const listing = {
      stored_images: [
        'https://supabase.co/storage/eirakudo/L09637/00.jpg',
      ],
      images: [
        'https://eirakudo.shop/images/kunimune_b.jpg', // index 0 - replaced by 00.jpg
        'https://eirakudo.shop/images/kunimune_z.jpg', // index 1 - no stored
      ],
    };
    const result = getAllImages(listing);

    // Should have 2 images (1 stored replacing index 0, 1 original at index 1)
    expect(result.length).toBe(2);
    expect(result[0]).toBe('https://supabase.co/storage/eirakudo/L09637/00.jpg');
    expect(result[1]).toBe('https://eirakudo.shop/images/kunimune_z.jpg');

    // Original at index 0 should NOT be present (replaced by stored)
    expect(result).not.toContain('https://eirakudo.shop/images/kunimune_b.jpg');
  });

  it('handles sparse stored images (listing 204 case)', () => {
    // Simulates listing 204: stored has indices 1,2,3,5,6,7 (missing 0,4,8)
    // originals have indices 0-8
    const listing = {
      stored_images: [
        'https://supabase.co/storage/aoi-art/L00204/01.jpg',
        'https://supabase.co/storage/aoi-art/L00204/02.jpg',
        'https://supabase.co/storage/aoi-art/L00204/03.jpg',
        'https://supabase.co/storage/aoi-art/L00204/05.jpg',
        'https://supabase.co/storage/aoi-art/L00204/06.jpg',
        'https://supabase.co/storage/aoi-art/L00204/07.jpg',
      ],
      images: [
        'https://www.aoijapan.com/img/sword/2025/25267-2.jpg',       // index 0 - no stored
        'https://www.aoijapan.com/img/sword/2025/25267-3.jpg',       // index 1 - replaced by 01.jpg
        'https://www.aoijapan.com/img/sword/2025/25267-4.jpg',       // index 2 - replaced by 02.jpg
        'https://www.aoijapan.com/img/sword/2025/25267paper-1.jpg',  // index 3 - replaced by 03.jpg
        'https://www.aoijapan.com/img/sword/2025/25267paper-2.jpg',  // index 4 - no stored
        'https://www.aoijapan.com/img/sword/2025/25267paper-4.jpg',  // index 5 - replaced by 05.jpg
        'https://www.aoijapan.com/img/sword/2025/25267paper-3.jpg',  // index 6 - replaced by 06.jpg
        'https://www.aoijapan.com/img/sword/2025/25267sayagaki.jpg', // index 7 - replaced by 07.jpg
        'https://www.aoijapan.com/img/sword/2025/25267_p.jpg',       // index 8 - no stored
      ],
    };
    const result = getAllImages(listing);

    // Should have 9 images (6 stored + 3 original at indices 0, 4, 8)
    expect(result.length).toBe(9);

    // Originals without stored should be present
    expect(result).toContain('https://www.aoijapan.com/img/sword/2025/25267-2.jpg');       // index 0
    expect(result).toContain('https://www.aoijapan.com/img/sword/2025/25267paper-2.jpg');  // index 4
    expect(result).toContain('https://www.aoijapan.com/img/sword/2025/25267_p.jpg');       // index 8

    // Stored images should be present
    expect(result).toContain('https://supabase.co/storage/aoi-art/L00204/01.jpg');
    expect(result).toContain('https://supabase.co/storage/aoi-art/L00204/07.jpg');

    // Replaced originals should NOT be present
    expect(result).not.toContain('https://www.aoijapan.com/img/sword/2025/25267-3.jpg');
    expect(result).not.toContain('https://www.aoijapan.com/img/sword/2025/25267sayagaki.jpg');
  });
});

describe('isValidItemImage', () => {
  describe('filters out tiny icons and buttons', () => {
    it('rejects images narrower than MIN_WIDTH', () => {
      const result = isValidItemImage({ width: 73, height: 200 });
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('too_narrow');
    });

    it('rejects images shorter than MIN_HEIGHT', () => {
      const result = isValidItemImage({ width: 200, height: 27 });
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('too_short');
    });

    it('rejects tiny icons (both dimensions small)', () => {
      const result = isValidItemImage({ width: 73, height: 27 });
      expect(result.isValid).toBe(false);
    });

    it('rejects very small area images', () => {
      // 120x120 = 14400, which is below MIN_AREA of 15000
      const result = isValidItemImage({ width: 120, height: 120 });
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('too_small_area');
    });
  });

  describe('accepts valid product images', () => {
    it('accepts typical product image (600x600)', () => {
      const result = isValidItemImage({ width: 600, height: 600 });
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('accepts tall sword image (415x500)', () => {
      const result = isValidItemImage({ width: 415, height: 500 });
      expect(result.isValid).toBe(true);
    });

    it('accepts wide image with decent height (962x167)', () => {
      const result = isValidItemImage({ width: 962, height: 167 });
      expect(result.isValid).toBe(true);
    });

    it('accepts borderline image (200x200)', () => {
      const result = isValidItemImage({ width: 200, height: 200 });
      expect(result.isValid).toBe(true);
    });
  });

  describe('handles extreme aspect ratios', () => {
    it('rejects extremely wide images (banners)', () => {
      // 2000x100 = 20:1 aspect ratio, exceeds MAX_ASPECT_RATIO of 15
      const result = isValidItemImage({ width: 2000, height: 100 });
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('aspect_ratio');
    });

    it('rejects extremely tall images (ribbons)', () => {
      // 100x5000 = 0.02 aspect ratio, below MIN_ASPECT_RATIO of 0.03
      const result = isValidItemImage({ width: 100, height: 5000 });
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('aspect_ratio');
    });

    it('accepts very tall sword images (common ratio)', () => {
      // 300x1500 = 0.2 aspect ratio, within acceptable range
      const result = isValidItemImage({ width: 300, height: 1500 });
      expect(result.isValid).toBe(true);
    });

    it('accepts wide detail shots', () => {
      // 1200x300 = 4:1 aspect ratio, within acceptable range
      const result = isValidItemImage({ width: 1200, height: 300 });
      expect(result.isValid).toBe(true);
    });
  });

  describe('real-world examples from listing 31135', () => {
    it('accepts main product image (600x600)', () => {
      expect(isValidItemImage({ width: 600, height: 600 }).isValid).toBe(true);
    });

    it('rejects navigation icon (73x27)', () => {
      expect(isValidItemImage({ width: 73, height: 27 }).isValid).toBe(false);
    });

    it('rejects small button (50x27)', () => {
      expect(isValidItemImage({ width: 50, height: 27 }).isValid).toBe(false);
    });

    it('rejects small icon (64x90)', () => {
      expect(isValidItemImage({ width: 64, height: 90 }).isValid).toBe(false);
    });

    it('rejects small thumbnail with small area (103x104)', () => {
      // 103x104 = 10712 area, below MIN_AREA of 15000
      expect(isValidItemImage({ width: 103, height: 104 }).isValid).toBe(false);
      expect(isValidItemImage({ width: 103, height: 104 }).reason).toBe('too_small_area');
    });

    it('rejects small square icon (79x79)', () => {
      expect(isValidItemImage({ width: 79, height: 79 }).isValid).toBe(false);
    });

    it('accepts GIF thumbnail (180x180)', () => {
      expect(isValidItemImage({ width: 180, height: 180 }).isValid).toBe(true);
    });
  });
});
