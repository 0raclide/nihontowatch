/**
 * Tests for dealer video API routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/dealer/auth', () => ({
  verifyDealer: vi.fn(),
}));

vi.mock('@/lib/video/videoProvider', () => ({
  videoProvider: {
    createUpload: vi.fn(),
    deleteVideo: vi.fn(),
    getVideoStatus: vi.fn(),
    getStreamUrl: vi.fn((id: string) => `https://cdn/${id}/playlist.m3u8`),
  },
  isVideoProviderConfigured: vi.fn(() => true),
}));

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { videoProvider } from '@/lib/video/videoProvider';

describe('POST /api/dealer/videos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    (createClient as any).mockResolvedValue({});
    (verifyDealer as any).mockResolvedValue({ isDealer: false, error: 'unauthorized' });

    const { POST } = await import('@/app/api/dealer/videos/route');
    const request = new Request('http://localhost/api/dealer/videos', {
      method: 'POST',
      body: JSON.stringify({ listingId: 1, filename: 'test.mp4' }),
    });
    const response = await POST(request as any);
    expect(response.status).toBe(401);
  });

  it('returns 400 when listingId is missing', async () => {
    (createClient as any).mockResolvedValue({});
    (verifyDealer as any).mockResolvedValue({
      isDealer: true,
      user: { id: 'user-1' },
      dealerId: 10,
    });

    const { POST } = await import('@/app/api/dealer/videos/route');
    const request = new Request('http://localhost/api/dealer/videos', {
      method: 'POST',
      body: JSON.stringify({ filename: 'test.mp4' }),
    });
    const response = await POST(request as any);
    expect(response.status).toBe(400);
  });

  it('returns 404 when listing does not belong to dealer', async () => {
    (createClient as any).mockResolvedValue({});
    (verifyDealer as any).mockResolvedValue({
      isDealer: true,
      user: { id: 'user-1' },
      dealerId: 10,
    });
    const mockServiceClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 1, dealer_id: 999 }, // Different dealer
        error: null,
      }),
    };
    (createServiceClient as any).mockReturnValue(mockServiceClient);

    const { POST } = await import('@/app/api/dealer/videos/route');
    const request = new Request('http://localhost/api/dealer/videos', {
      method: 'POST',
      body: JSON.stringify({ listingId: 1, filename: 'test.mp4' }),
    });
    const response = await POST(request as any);
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/dealer/videos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    (createClient as any).mockResolvedValue({});
    (verifyDealer as any).mockResolvedValue({ isDealer: false, error: 'unauthorized' });

    const { DELETE } = await import('@/app/api/dealer/videos/[id]/route');
    const request = new Request('http://localhost/api/dealer/videos/abc', { method: 'DELETE' });
    const response = await DELETE(request as any, { params: Promise.resolve({ id: 'abc' }) });
    expect(response.status).toBe(401);
  });

  it('returns 404 when video does not exist', async () => {
    (createClient as any).mockResolvedValue({});
    (verifyDealer as any).mockResolvedValue({
      isDealer: true,
      user: { id: 'user-1' },
      dealerId: 10,
    });
    const mockServiceClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (createServiceClient as any).mockReturnValue(mockServiceClient);

    const { DELETE } = await import('@/app/api/dealer/videos/[id]/route');
    const request = new Request('http://localhost/api/dealer/videos/abc', { method: 'DELETE' });
    const response = await DELETE(request as any, { params: Promise.resolve({ id: 'abc' }) });
    expect(response.status).toBe(404);
  });
});
