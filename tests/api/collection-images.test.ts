/**
 * Tests for /api/collection/images and section image routes (Phase 2c)
 *
 * Tests the collection image upload/delete lifecycle across all 6 routes:
 * - Main images
 * - Sayagaki images (per-entry)
 * - Hakogaki images (per-entry)
 * - Koshirae images
 * - Provenance images (per-entry)
 * - Kanto-hibisho images
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ───────────────────────────────────────────────
// vi.hoisted() runs before vi.mock() hoisting, so these are available in mock factories
const {
  mockSelectCollectionItemSingle, mockUpdateCollectionItem,
  mockUpload, mockRemove, mockGetPublicUrl, mockGetUser, mockStorageFrom,
} = vi.hoisted(() => {
  const mockSelectCollectionItemSingle = vi.fn();
  const mockUpdateCollectionItem = vi.fn().mockResolvedValue({ error: null });
  const mockUpload = vi.fn().mockResolvedValue({ error: null });
  const mockRemove = vi.fn().mockResolvedValue({ error: null });
  const mockGetPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/user-images/user-123/uuid-1/test.jpg' },
  });
  const mockGetUser = vi.fn();
  const mockStorageFrom = vi.fn().mockReturnValue({
    upload: mockUpload,
    remove: mockRemove,
    getPublicUrl: mockGetPublicUrl,
  });
  return {
    mockSelectCollectionItemSingle, mockUpdateCollectionItem,
    mockUpload, mockRemove, mockGetPublicUrl, mockGetUser, mockStorageFrom,
  };
});

const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockAuthResponse = { data: { user: mockUser }, error: null };

vi.mock('@/lib/supabase/collectionItems', () => ({
  selectCollectionItemSingle: (...args) => mockSelectCollectionItemSingle(...args),
  updateCollectionItem: (...args) => mockUpdateCollectionItem(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
  createServiceClient: vi.fn().mockReturnValue({
    storage: { from: mockStorageFrom },
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), logError: vi.fn() },
}));

import { POST as POST_IMAGES, DELETE as DELETE_IMAGES } from '@/app/api/collection/images/route';
import { POST as POST_SAYAGAKI } from '@/app/api/collection/sayagaki-images/route';
import { POST as POST_HAKOGAKI } from '@/app/api/collection/hakogaki-images/route';
import { POST as POST_KOSHIRAE } from '@/app/api/collection/koshirae-images/route';
import { POST as POST_PROVENANCE } from '@/app/api/collection/provenance-images/route';
import { POST as POST_KANTO } from '@/app/api/collection/kanto-hibisho-images/route';
import { NextRequest } from 'next/server';

/**
 * Create a File-like object with arrayBuffer() support.
 * jsdom's File class does not implement arrayBuffer(), so the route's
 * `await file.arrayBuffer()` would throw without this polyfill.
 */
function makeFile(name = 'test.jpg', type = 'image/jpeg', size = 1024) {
  const buffer = new ArrayBuffer(size);
  const file = new File([buffer], name, { type });
  // Polyfill arrayBuffer() for jsdom
  if (typeof file.arrayBuffer !== 'function') {
    (file as File & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = () => Promise.resolve(buffer);
  }
  return file;
}

/**
 * Create a NextRequest with a mocked formData() method.
 * NextRequest.formData() hangs in jsdom when given a FormData body,
 * so we bypass it by overriding the method.
 */
function makeFormRequest(url: string, fields: Record<string, string | Blob>) {
  const req = new NextRequest(url, { method: 'POST' });
  req.formData = async () => {
    const fd = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      fd.append(key, value);
    }
    return fd;
  };
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(mockAuthResponse);
});

// ─── Main Images ─────────────────────────────────────────────────

describe('POST /api/collection/images', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Not authenticated' } });

    const req = makeFormRequest('http://localhost/api/collection/images', { file: makeFile(), itemId: 'item-1' });
    const res = await POST_IMAGES(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file provided', async () => {
    const req = makeFormRequest('http://localhost/api/collection/images', { itemId: 'item-1' });
    const res = await POST_IMAGES(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when item not owned by user', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'other-user', item_uuid: 'uuid-1', images: [] },
      error: null,
    });

    const req = makeFormRequest('http://localhost/api/collection/images', { file: makeFile(), itemId: 'item-1' });
    const res = await POST_IMAGES(req);
    expect(res.status).toBe(404);
  });

  it('uploads image and returns 201', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'user-123', item_uuid: 'uuid-1', images: [] },
      error: null,
    });

    const req = makeFormRequest('http://localhost/api/collection/images', { file: makeFile(), itemId: 'item-1' });
    const res = await POST_IMAGES(req);
    expect(res.status).toBe(201);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpdateCollectionItem).toHaveBeenCalledTimes(1);
  });

  it('rejects when at 20 images', async () => {
    const twentyImages = Array.from({ length: 20 }, (_, i) => `https://example.com/img${i}.jpg`);
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'user-123', item_uuid: 'uuid-1', images: twentyImages },
      error: null,
    });

    const req = makeFormRequest('http://localhost/api/collection/images', { file: makeFile(), itemId: 'item-1' });
    const res = await POST_IMAGES(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('20');
  });

  it('rejects oversized files', async () => {
    const bigFile = makeFile('big.jpg', 'image/jpeg', 10 * 1024 * 1024);
    const req = makeFormRequest('http://localhost/api/collection/images', { file: bigFile, itemId: 'item-1' });
    const res = await POST_IMAGES(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('5MB');
  });

  it('rejects unsupported file types', async () => {
    const gifFile = makeFile('test.gif', 'image/gif');
    const req = makeFormRequest('http://localhost/api/collection/images', { file: gifFile, itemId: 'item-1' });
    const res = await POST_IMAGES(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Unsupported');
  });

  it('rolls back upload on DB failure', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'user-123', item_uuid: 'uuid-1', images: [] },
      error: null,
    });
    mockUpdateCollectionItem.mockResolvedValueOnce({ error: { message: 'DB error' } });

    const req = makeFormRequest('http://localhost/api/collection/images', { file: makeFile(), itemId: 'item-1' });
    const res = await POST_IMAGES(req);
    expect(res.status).toBe(500);
    expect(mockRemove).toHaveBeenCalledTimes(1); // Rollback
  });
});

describe('DELETE /api/collection/images', () => {
  it('rejects path traversal', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'user-123', images: ['https://example.com/storage/v1/object/public/user-images/../secret/img.jpg'] },
      error: null,
    });

    const req = new NextRequest('http://localhost/api/collection/images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: 'https://example.com/storage/v1/object/public/user-images/../secret/img.jpg',
        itemId: 'item-1',
      }),
    });
    const res = await DELETE_IMAGES(req);
    expect(res.status).toBe(403);
  });

  it('rejects images from different user prefix', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'user-123', images: [] },
      error: null,
    });

    const req = new NextRequest('http://localhost/api/collection/images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: 'https://example.com/storage/v1/object/public/user-images/other-user/uuid-1/img.jpg',
        itemId: 'item-1',
      }),
    });
    const res = await DELETE_IMAGES(req);
    expect(res.status).toBe(403);
  });
});

// ─── Section Image Routes (smoke tests) ──────────────────────────

describe('POST /api/collection/sayagaki-images', () => {
  it('returns 400 without sayagakiId', async () => {
    const req = makeFormRequest('http://localhost/api/collection/sayagaki-images', { file: makeFile(), itemId: 'item-1' });
    const res = await POST_SAYAGAKI(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('sayagakiId');
  });

  it('uploads to sayagaki entry', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: {
        id: 'item-1', owner_id: 'user-123', item_uuid: 'uuid-1',
        sayagaki: [{ id: 'say-1', author: 'other', content: 'text', images: [] }],
      },
      error: null,
    });

    const req = makeFormRequest('http://localhost/api/collection/sayagaki-images', { file: makeFile(), itemId: 'item-1', sayagakiId: 'say-1' });
    const res = await POST_SAYAGAKI(req);
    expect(res.status).toBe(201);
  });
});

describe('POST /api/collection/hakogaki-images', () => {
  it('returns 400 without hakogakiId', async () => {
    const req = makeFormRequest('http://localhost/api/collection/hakogaki-images', { file: makeFile(), itemId: 'item-1' });
    const res = await POST_HAKOGAKI(req);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/collection/koshirae-images', () => {
  it('initializes empty koshirae if null', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'user-123', item_uuid: 'uuid-1', koshirae: null },
      error: null,
    });

    const req = makeFormRequest('http://localhost/api/collection/koshirae-images', { file: makeFile(), itemId: 'item-1' });
    const res = await POST_KOSHIRAE(req);
    expect(res.status).toBe(201);
    // Verify koshirae was initialized with the new image
    expect(mockUpdateCollectionItem).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/collection/provenance-images', () => {
  it('returns 400 without provenanceId', async () => {
    const req = makeFormRequest('http://localhost/api/collection/provenance-images', { file: makeFile(), itemId: 'item-1' });
    const res = await POST_PROVENANCE(req);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/collection/kanto-hibisho-images', () => {
  it('initializes empty kanto_hibisho if null', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'user-123', item_uuid: 'uuid-1', kanto_hibisho: null },
      error: null,
    });

    const req = makeFormRequest('http://localhost/api/collection/kanto-hibisho-images', { file: makeFile(), itemId: 'item-1' });
    const res = await POST_KANTO(req);
    expect(res.status).toBe(201);
  });
});
