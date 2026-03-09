/**
 * Tests for /api/collection/videos (Phase 2c)
 *
 * - POST: creates Bunny video + TUS creds
 * - GET: lists videos by item_uuid
 * - DELETE: Bunny cleanup + DB deletion
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ───────────────────────────────────────────────
// vi.hoisted() runs before vi.mock() hoisting, so these are available in mock factories
const {
  mockGetUser, mockSelectCollectionItemSingle,
  mockInsertItemVideo, mockSelectItemVideos, mockUpdateItemVideo,
  mockSelectItemVideoSingle, mockDeleteItemVideo,
  mockCreateUpload, mockDeleteVideo, mockGetVideoStatus, mockGetStreamUrl,
} = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockSelectCollectionItemSingle = vi.fn();
  const mockInsertItemVideo = vi.fn();
  const mockSelectItemVideos = vi.fn();
  const mockUpdateItemVideo = vi.fn();
  const mockSelectItemVideoSingle = vi.fn();
  const mockDeleteItemVideo = vi.fn();
  const mockCreateUpload = vi.fn().mockResolvedValue({
    videoId: 'bunny-123',
    uploadUrl: 'https://video.bunnycdn.com/tusupload/...',
    libraryId: '573856',
    authSignature: 'sig',
    authExpire: '1234567890',
  });
  const mockDeleteVideo = vi.fn().mockResolvedValue(undefined);
  const mockGetVideoStatus = vi.fn();
  const mockGetStreamUrl = vi.fn().mockReturnValue('https://stream.bunnycdn.com/123/video.m3u8');
  return {
    mockGetUser, mockSelectCollectionItemSingle,
    mockInsertItemVideo, mockSelectItemVideos, mockUpdateItemVideo,
    mockSelectItemVideoSingle, mockDeleteItemVideo,
    mockCreateUpload, mockDeleteVideo, mockGetVideoStatus, mockGetStreamUrl,
  };
});

const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockAuthResponse = { data: { user: mockUser }, error: null };

vi.mock('@/lib/collection/access', () => ({
  checkCollectionAccess: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
  createServiceClient: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/supabase/collectionItems', () => ({
  selectCollectionItemSingle: (...args) => mockSelectCollectionItemSingle(...args),
}));

vi.mock('@/lib/supabase/itemVideos', () => ({
  insertItemVideo: (...args) => mockInsertItemVideo(...args),
  selectItemVideos: (...args) => mockSelectItemVideos(...args),
  updateItemVideo: (...args) => mockUpdateItemVideo(...args),
  selectItemVideoSingle: (...args) => mockSelectItemVideoSingle(...args),
  deleteItemVideo: (...args) => mockDeleteItemVideo(...args),
}));

vi.mock('@/lib/video/videoProvider', () => ({
  videoProvider: {
    createUpload: (...args) => mockCreateUpload(...args),
    deleteVideo: (...args) => mockDeleteVideo(...args),
    getVideoStatus: (...args) => mockGetVideoStatus(...args),
    getStreamUrl: (...args) => mockGetStreamUrl(...args),
  },
  isVideoProviderConfigured: vi.fn().mockReturnValue(true),
}));

import { POST, GET } from '@/app/api/collection/videos/route';
import { DELETE } from '@/app/api/collection/videos/[id]/route';
import { NextRequest } from 'next/server';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(mockAuthResponse);
});

describe('POST /api/collection/videos', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Not authenticated' } });

    const req = new NextRequest('http://localhost/api/collection/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'item-1', filename: 'test.mp4' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 without itemId or filename', async () => {
    const req = new NextRequest('http://localhost/api/collection/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'item-1' }), // missing filename
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates video and returns TUS credentials', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'user-123', item_uuid: 'uuid-1' },
      error: null,
    });
    mockInsertItemVideo.mockResolvedValueOnce({
      data: { id: 'vid-1', item_uuid: 'uuid-1', provider_id: 'bunny-123' },
      error: null,
    });

    const req = new NextRequest('http://localhost/api/collection/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'item-1', filename: 'test.mp4' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.videoId).toBe('vid-1');
    expect(body.providerId).toBe('bunny-123');
    expect(body.uploadUrl).toBeTruthy();
    expect(mockCreateUpload).toHaveBeenCalledWith('test.mp4');
  });

  it('returns 404 for item not owned by user', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'other-user', item_uuid: 'uuid-1' },
      error: null,
    });

    const req = new NextRequest('http://localhost/api/collection/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'item-1', filename: 'test.mp4' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/collection/videos', () => {
  it('returns videos for owned item', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'user-123', item_uuid: 'uuid-1' },
      error: null,
    });
    mockSelectItemVideos.mockResolvedValueOnce({
      data: [{ id: 'vid-1', status: 'ready', provider_id: 'bunny-1', stream_url: null }],
      error: null,
    });

    const req = new NextRequest('http://localhost/api/collection/videos?itemId=item-1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.videos).toHaveLength(1);
    // stream_url should be computed for ready videos
    expect(body.videos[0].stream_url).toBeTruthy();
  });

  it('returns 400 without itemId', async () => {
    const req = new NextRequest('http://localhost/api/collection/videos');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/collection/videos/[id]', () => {
  it('deletes video with Bunny cleanup', async () => {
    mockSelectItemVideoSingle.mockResolvedValueOnce({
      data: { id: 'vid-1', provider_id: 'bunny-1', owner_id: 'user-123' },
      error: null,
    });
    mockDeleteItemVideo.mockResolvedValueOnce({ error: null });

    const req = new NextRequest('http://localhost/api/collection/videos/vid-1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('vid-1'));
    expect(res.status).toBe(200);
    expect(mockDeleteVideo).toHaveBeenCalledWith('bunny-1');
    expect(mockDeleteItemVideo).toHaveBeenCalledWith(expect.anything(), 'vid-1');
  });

  it('returns 403 for video not owned by user', async () => {
    mockSelectItemVideoSingle.mockResolvedValueOnce({
      data: { id: 'vid-1', provider_id: 'bunny-1', owner_id: 'other-user' },
      error: null,
    });

    const req = new NextRequest('http://localhost/api/collection/videos/vid-1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('vid-1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 for nonexistent video', async () => {
    mockSelectItemVideoSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = new NextRequest('http://localhost/api/collection/videos/nonexistent', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('nonexistent'));
    expect(res.status).toBe(404);
  });
});
