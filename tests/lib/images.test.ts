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

    it('returns stored first, then original (deduplicated)', () => {
      const listing = {
        stored_images: ['https://supabase.co/stored1.jpg', 'https://supabase.co/stored2.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg'],
      };
      // New behavior: stored first, then original (all unique)
      expect(getAllImages(listing)).toEqual([
        'https://supabase.co/stored1.jpg',
        'https://supabase.co/stored2.jpg',
        'https://dealer.com/original1.jpg',
        'https://dealer.com/original2.jpg',
      ]);
    });

    it('combines all images from both arrays', () => {
      const listing = {
        stored_images: ['https://supabase.co/stored1.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg', 'https://dealer.com/original3.jpg'],
      };
      // New behavior: stored first, then all original
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
    // New behavior: returns all stored, then all original (4 total)
    expect(getAllImages(listing)).toEqual([
      'https://supabase.co/storage/aoi-art/L00001/00.jpg',
      'https://supabase.co/storage/aoi-art/L00001/01.jpg',
      'https://aoijapan.com/images/sword1.jpg',
      'https://aoijapan.com/images/sword2.jpg',
    ]);
    expect(hasStoredImages(listing)).toBe(true);
    expect(getImageSource(listing)).toBe('stored');
  });

  it('handles partially migrated listing (sparse stored_images)', () => {
    // Real case: stored_images named by original index (02.gif = original[2])
    // stored_images array only has some images, not all
    const listing = {
      stored_images: [
        'https://supabase.co/storage/aoi-art/L00001/02.jpg',
        'https://supabase.co/storage/aoi-art/L00001/04.jpg',
      ],
      images: [
        'https://aoijapan.com/images/sword1.jpg',
        'https://aoijapan.com/images/sword2.tif', // TIF will be filtered
        'https://aoijapan.com/images/sword3.jpg',
        'https://aoijapan.com/images/sword4.jpg',
        'https://aoijapan.com/images/sword5.jpg',
      ],
    };
    // New behavior: stored first, then original (minus tif)
    expect(getAllImages(listing)).toEqual([
      'https://supabase.co/storage/aoi-art/L00001/02.jpg',
      'https://supabase.co/storage/aoi-art/L00001/04.jpg',
      'https://aoijapan.com/images/sword1.jpg',
      'https://aoijapan.com/images/sword3.jpg',
      'https://aoijapan.com/images/sword4.jpg',
      'https://aoijapan.com/images/sword5.jpg',
    ]);
    expect(getImageCount(listing)).toBe(6);
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
        'https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3879.gif',
        'https://iidakoendo.com/wp-content/uploads/2025/01/m543.tif',  // Should be filtered
        'https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3873-1.gif',
        'https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3875-2-1.gif',
        'https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3876.gif',
        'https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3877.gif',
      ],
    };
    const result = getAllImages(listing);
    // TIF should be filtered out
    expect(result).not.toContain('https://iidakoendo.com/wp-content/uploads/2025/01/m543.tif');
    // Should have stored images first
    expect(result[0]).toBe('https://supabase.co/storage/listing-images/iida-koendo/L09340/02.gif');
    expect(result[1]).toBe('https://supabase.co/storage/listing-images/iida-koendo/L09340/04.gif');
    // Should include all GIF images
    expect(result).toContain('https://iidakoendo.com/wp-content/uploads/2025/01/IMG_3879.gif');
    // Total count: 2 stored + 5 original GIFs = 7
    expect(result.length).toBe(7);
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
