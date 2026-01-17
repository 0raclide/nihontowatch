import { describe, it, expect } from 'vitest';
import {
  getImageUrl,
  getAllImages,
  hasStoredImages,
  getImageSource,
  getImageCount,
  hasAnyImages,
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

  describe('prefers stored_images over original images', () => {
    it('returns stored_images when both available', () => {
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

    it('returns original at specific index when stored is shorter', () => {
      const listing = {
        stored_images: ['https://supabase.co/storage/stored1.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg', 'https://dealer.com/original3.jpg'],
      };
      expect(getImageUrl(listing, 2)).toBe('https://dealer.com/original3.jpg');
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

    it('handles sparse stored_images array', () => {
      const listing = {
        stored_images: ['https://supabase.co/storage/stored1.jpg', '', 'https://supabase.co/storage/stored3.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg', 'https://dealer.com/original3.jpg'],
      };
      // Empty string is falsy, should fall back to original
      expect(getImageUrl(listing, 1)).toBe('https://dealer.com/original2.jpg');
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

  describe('merges stored and original images correctly', () => {
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

    it('prefers stored over original at same index', () => {
      const listing = {
        stored_images: ['https://supabase.co/stored1.jpg', 'https://supabase.co/stored2.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg'],
      };
      expect(getAllImages(listing)).toEqual([
        'https://supabase.co/stored1.jpg',
        'https://supabase.co/stored2.jpg',
      ]);
    });

    it('merges arrays of different lengths (stored shorter)', () => {
      const listing = {
        stored_images: ['https://supabase.co/stored1.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg', 'https://dealer.com/original3.jpg'],
      };
      expect(getAllImages(listing)).toEqual([
        'https://supabase.co/stored1.jpg',
        'https://dealer.com/original2.jpg',
        'https://dealer.com/original3.jpg',
      ]);
    });

    it('merges arrays of different lengths (stored longer)', () => {
      const listing = {
        stored_images: ['https://supabase.co/stored1.jpg', 'https://supabase.co/stored2.jpg', 'https://supabase.co/stored3.jpg'],
        images: ['https://dealer.com/original1.jpg'],
      };
      expect(getAllImages(listing)).toEqual([
        'https://supabase.co/stored1.jpg',
        'https://supabase.co/stored2.jpg',
        'https://supabase.co/stored3.jpg',
      ]);
    });
  });

  describe('handles partial migration', () => {
    it('fills gaps with original images when stored has empty strings', () => {
      const listing = {
        stored_images: ['https://supabase.co/stored1.jpg', '', 'https://supabase.co/stored3.jpg'],
        images: ['https://dealer.com/original1.jpg', 'https://dealer.com/original2.jpg', 'https://dealer.com/original3.jpg'],
      };
      expect(getAllImages(listing)).toEqual([
        'https://supabase.co/stored1.jpg',
        'https://dealer.com/original2.jpg',
        'https://supabase.co/stored3.jpg',
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

  it('returns stored count when larger', () => {
    expect(getImageCount({
      stored_images: ['a', 'b', 'c'],
      images: ['x'],
    })).toBe(3);
  });

  it('returns original count when larger', () => {
    expect(getImageCount({
      stored_images: ['a'],
      images: ['x', 'y', 'z'],
    })).toBe(3);
  });

  it('returns count when arrays equal length', () => {
    expect(getImageCount({
      stored_images: ['a', 'b'],
      images: ['x', 'y'],
    })).toBe(2);
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
    expect(getAllImages(listing)).toEqual([
      'https://supabase.co/storage/aoi-art/L00001/00.jpg',
      'https://supabase.co/storage/aoi-art/L00001/01.jpg',
    ]);
    expect(hasStoredImages(listing)).toBe(true);
    expect(getImageSource(listing)).toBe('stored');
  });

  it('handles partially migrated listing (first 2 of 5 uploaded)', () => {
    const listing = {
      stored_images: [
        'https://supabase.co/storage/aoi-art/L00001/00.jpg',
        'https://supabase.co/storage/aoi-art/L00001/01.jpg',
      ],
      images: [
        'https://aoijapan.com/images/sword1.jpg',
        'https://aoijapan.com/images/sword2.jpg',
        'https://aoijapan.com/images/sword3.jpg',
        'https://aoijapan.com/images/sword4.jpg',
        'https://aoijapan.com/images/sword5.jpg',
      ],
    };
    expect(getImageUrl(listing, 0)).toBe('https://supabase.co/storage/aoi-art/L00001/00.jpg');
    expect(getImageUrl(listing, 2)).toBe('https://aoijapan.com/images/sword3.jpg');
    expect(getAllImages(listing)).toEqual([
      'https://supabase.co/storage/aoi-art/L00001/00.jpg',
      'https://supabase.co/storage/aoi-art/L00001/01.jpg',
      'https://aoijapan.com/images/sword3.jpg',
      'https://aoijapan.com/images/sword4.jpg',
      'https://aoijapan.com/images/sword5.jpg',
    ]);
    expect(getImageCount(listing)).toBe(5);
    expect(getImageSource(listing, 0)).toBe('stored');
    expect(getImageSource(listing, 2)).toBe('original');
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
});
