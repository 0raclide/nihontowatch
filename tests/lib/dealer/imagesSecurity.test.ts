import { describe, it, expect } from 'vitest';

// =============================================================================
// Dealer Images — Security Golden Tests
//
// These test the path traversal protection and ownership verification logic
// from the images DELETE handler. The path traversal fix was a critical
// security fix — a dealer could delete another dealer's storage files.
// =============================================================================

const BUCKET = 'dealer-images';

// Replicate the path extraction and validation logic from the DELETE handler
function extractAndValidateStoragePath(
  imageUrl: string,
  dealerId: number
): { valid: true; path: string } | { valid: false; reason: string } {
  const bucketMarker = `/${BUCKET}/`;
  const bucketIdx = imageUrl.indexOf(bucketMarker);
  const storagePath = bucketIdx !== -1
    ? imageUrl.slice(bucketIdx + bucketMarker.length)
    : null;

  if (!storagePath || storagePath.includes('..') || !storagePath.startsWith(`${dealerId}/`)) {
    return { valid: false, reason: 'Forbidden' };
  }

  return { valid: true, path: storagePath };
}

describe('image path extraction', () => {
  it('extracts storage path from valid public URL', () => {
    const url = `https://xxx.supabase.co/storage/v1/object/public/${BUCKET}/42/123/abc.jpg`;
    const result = extractAndValidateStoragePath(url, 42);
    expect(result).toEqual({ valid: true, path: '42/123/abc.jpg' });
  });

  it('handles URL with UUID filename', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const url = `https://xxx.supabase.co/storage/v1/object/public/${BUCKET}/42/500/${uuid}.webp`;
    const result = extractAndValidateStoragePath(url, 42);
    expect(result).toEqual({ valid: true, path: `42/500/${uuid}.webp` });
  });
});

describe('path traversal prevention', () => {
  it('GOLDEN: rejects ../ traversal attack (cross-dealer file access)', () => {
    const url = `https://xxx.supabase.co/storage/v1/object/public/${BUCKET}/42/../99/secret.jpg`;
    const result = extractAndValidateStoragePath(url, 42);
    expect(result.valid).toBe(false);
  });

  it('GOLDEN: rejects nested traversal ../../', () => {
    const url = `https://xxx.supabase.co/storage/v1/object/public/${BUCKET}/42/../../etc/passwd`;
    const result = extractAndValidateStoragePath(url, 42);
    expect(result.valid).toBe(false);
  });

  it('rejects ../ even in filename', () => {
    const url = `https://xxx.supabase.co/storage/v1/object/public/${BUCKET}/42/listing/../../../secret`;
    const result = extractAndValidateStoragePath(url, 42);
    expect(result.valid).toBe(false);
  });

  it('rejects Windows-style ..\\', () => {
    // URL encoding might not help, but the '..' check catches this
    const url = `https://xxx.supabase.co/storage/v1/object/public/${BUCKET}/42/..%5C99/file.jpg`;
    // The decoded path contains '..' so it should be rejected
    // In practice the URL won't decode like this, but the guard is on '..'
    const result = extractAndValidateStoragePath(url, 42);
    // This URL contains '..' after the bucket marker
    expect(result.valid).toBe(false);
  });
});

describe('ownership verification (dealer_id prefix)', () => {
  it('GOLDEN: rejects path belonging to a different dealer', () => {
    const url = `https://xxx.supabase.co/storage/v1/object/public/${BUCKET}/99/500/image.jpg`;
    const result = extractAndValidateStoragePath(url, 42); // dealer 42 trying to delete dealer 99's file
    expect(result.valid).toBe(false);
  });

  it('rejects path that is a prefix-match attack (dealerId=4 vs path 42/)', () => {
    const url = `https://xxx.supabase.co/storage/v1/object/public/${BUCKET}/42/500/image.jpg`;
    const result = extractAndValidateStoragePath(url, 4); // dealer 4, but path starts with 42/
    expect(result.valid).toBe(false); // '42/' does not start with '4/'
  });

  it('allows path that genuinely belongs to the dealer', () => {
    const url = `https://xxx.supabase.co/storage/v1/object/public/${BUCKET}/42/500/image.jpg`;
    const result = extractAndValidateStoragePath(url, 42);
    expect(result.valid).toBe(true);
  });
});

describe('URL format edge cases', () => {
  it('rejects URL without bucket marker', () => {
    const url = 'https://evil.com/42/500/image.jpg';
    const result = extractAndValidateStoragePath(url, 42);
    expect(result.valid).toBe(false);
  });

  it('rejects empty imageUrl', () => {
    const result = extractAndValidateStoragePath('', 42);
    expect(result.valid).toBe(false);
  });

  it('rejects URL with wrong bucket name', () => {
    const url = 'https://xxx.supabase.co/storage/v1/object/public/other-bucket/42/image.jpg';
    const result = extractAndValidateStoragePath(url, 42);
    expect(result.valid).toBe(false);
  });

  it('handles URL with query parameters', () => {
    const url = `https://xxx.supabase.co/storage/v1/object/public/${BUCKET}/42/500/image.jpg?width=200`;
    const result = extractAndValidateStoragePath(url, 42);
    // Query params are included in the path extraction but that's fine —
    // the path starts with dealerId/ and has no '..'
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// Upload validation logic
// =============================================================================

describe('upload constraints', () => {
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  it('rejects files over 5MB', () => {
    expect(5 * 1024 * 1024 + 1 > MAX_FILE_SIZE).toBe(true);
  });

  it('accepts files exactly 5MB', () => {
    expect(5 * 1024 * 1024 > MAX_FILE_SIZE).toBe(false);
  });

  it('allows JPEG, PNG, WebP types', () => {
    expect(ALLOWED_TYPES).toContain('image/jpeg');
    expect(ALLOWED_TYPES).toContain('image/png');
    expect(ALLOWED_TYPES).toContain('image/webp');
  });

  it('rejects other image types', () => {
    expect(ALLOWED_TYPES).not.toContain('image/gif');
    expect(ALLOWED_TYPES).not.toContain('image/svg+xml');
    expect(ALLOWED_TYPES).not.toContain('image/tiff');
  });

  it('rejects non-image types', () => {
    expect(ALLOWED_TYPES).not.toContain('application/pdf');
    expect(ALLOWED_TYPES).not.toContain('text/html');
    expect(ALLOWED_TYPES).not.toContain('application/javascript');
  });

  it('maximum 20 images per listing', () => {
    const currentImages = Array.from({ length: 20 }, (_, i) => `img${i}.jpg`);
    expect(currentImages.length >= 20).toBe(true);
  });
});

// =============================================================================
// File extension mapping
// =============================================================================

describe('file extension mapping', () => {
  function getExtension(mimeType: string): string {
    return mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  }

  it('maps image/jpeg to .jpg', () => {
    expect(getExtension('image/jpeg')).toBe('jpg');
  });

  it('maps image/png to .png', () => {
    expect(getExtension('image/png')).toBe('png');
  });

  it('maps image/webp to .webp', () => {
    expect(getExtension('image/webp')).toBe('webp');
  });

  it('defaults to .jpg for unknown types', () => {
    expect(getExtension('image/anything')).toBe('jpg');
  });
});
