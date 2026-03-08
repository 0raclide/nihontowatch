/**
 * Tests for getMediaItems() — combined image/video gallery utility
 */

import { describe, it, expect } from 'vitest';
import { getMediaItems, getMediaItemsFromImages, hasReadyVideos } from '@/lib/media';
import type { ListingVideo } from '@/types/media';

function makeVideo(overrides: Partial<ListingVideo> = {}): ListingVideo {
  return {
    id: 'v1',
    listing_id: 1,
    provider: 'bunny',
    provider_id: 'bunny-guid-1',
    status: 'ready',
    sort_order: 0,
    created_at: '2026-01-01',
    stream_url: 'https://cdn.example.com/bunny-guid-1/playlist.m3u8',
    ...overrides,
  };
}

describe('getMediaItems', () => {
  it('returns empty array for null listing', () => {
    expect(getMediaItems(null)).toEqual([]);
    expect(getMediaItems(undefined)).toEqual([]);
  });

  it('returns images only when no videos', () => {
    const listing = {
      images: ['https://dealer.com/img1.jpg', 'https://dealer.com/img2.jpg'],
    };
    const items = getMediaItems(listing);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ type: 'image', url: 'https://dealer.com/img1.jpg', index: 0 });
    expect(items[1]).toMatchObject({ type: 'image', url: 'https://dealer.com/img2.jpg', index: 1 });
  });

  it('returns videos only when no images', () => {
    const listing = {
      images: [],
      videos: [makeVideo({ id: 'v1', sort_order: 0 })],
    };
    const items = getMediaItems(listing);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'video',
      url: 'https://cdn.example.com/bunny-guid-1/playlist.m3u8',
      videoId: 'v1',
      index: 0,
    });
  });

  it('puts images before videos in combined gallery', () => {
    const listing = {
      images: ['https://dealer.com/img1.jpg'],
      videos: [makeVideo({ id: 'v1', sort_order: 0 })],
    };
    const items = getMediaItems(listing);
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('image');
    expect(items[1].type).toBe('video');
    expect(items[0].index).toBe(0);
    expect(items[1].index).toBe(1);
  });

  it('filters out processing videos', () => {
    const listing = {
      images: ['https://dealer.com/img1.jpg'],
      videos: [
        makeVideo({ id: 'v1', status: 'ready', sort_order: 0 }),
        makeVideo({ id: 'v2', status: 'processing', sort_order: 1 }),
      ],
    };
    const items = getMediaItems(listing);
    expect(items).toHaveLength(2); // 1 image + 1 ready video
    expect(items.filter(m => m.type === 'video')).toHaveLength(1);
  });

  it('filters out failed videos', () => {
    const listing = {
      images: [],
      videos: [
        makeVideo({ id: 'v1', status: 'ready', sort_order: 0 }),
        makeVideo({ id: 'v2', status: 'failed', sort_order: 1 }),
      ],
    };
    const items = getMediaItems(listing);
    expect(items).toHaveLength(1);
    expect(items[0].videoId).toBe('v1');
  });

  it('sorts videos by sort_order', () => {
    const listing = {
      images: [],
      videos: [
        makeVideo({ id: 'v2', sort_order: 2, provider_id: 'g2', stream_url: 'https://cdn/g2/playlist.m3u8' }),
        makeVideo({ id: 'v1', sort_order: 0, provider_id: 'g1', stream_url: 'https://cdn/g1/playlist.m3u8' }),
        makeVideo({ id: 'v3', sort_order: 1, provider_id: 'g3', stream_url: 'https://cdn/g3/playlist.m3u8' }),
      ],
    };
    const items = getMediaItems(listing);
    expect(items.map(m => m.videoId)).toEqual(['v1', 'v3', 'v2']);
  });

  it('includes duration and thumbnailUrl from video data', () => {
    const listing = {
      images: [],
      videos: [makeVideo({
        duration_seconds: 45,
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      })],
    };
    const items = getMediaItems(listing);
    expect(items[0].duration).toBe(45);
    expect(items[0].thumbnailUrl).toBe('https://cdn.example.com/thumb.jpg');
  });
});

describe('getMediaItemsFromImages', () => {
  it('returns empty array when no images and no videos', () => {
    expect(getMediaItemsFromImages([])).toEqual([]);
    expect(getMediaItemsFromImages([], undefined)).toEqual([]);
    expect(getMediaItemsFromImages([], [])).toEqual([]);
  });

  it('returns images only when no videos', () => {
    const items = getMediaItemsFromImages(['https://img1.jpg', 'https://img2.jpg']);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ type: 'image', url: 'https://img1.jpg', index: 0 });
    expect(items[1]).toMatchObject({ type: 'image', url: 'https://img2.jpg', index: 1 });
  });

  it('combines pre-validated images with ready videos', () => {
    const videos = [makeVideo({ id: 'v1', sort_order: 0 })];
    const items = getMediaItemsFromImages(['https://img1.jpg'], videos);
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('image');
    expect(items[1].type).toBe('video');
    expect(items[0].index).toBe(0);
    expect(items[1].index).toBe(1);
  });

  it('filters out non-ready videos', () => {
    const videos = [
      makeVideo({ id: 'v1', status: 'ready', sort_order: 0 }),
      makeVideo({ id: 'v2', status: 'processing', sort_order: 1 }),
      makeVideo({ id: 'v3', status: 'failed', sort_order: 2 }),
    ];
    const items = getMediaItemsFromImages([], videos);
    expect(items).toHaveLength(1);
    expect(items[0].videoId).toBe('v1');
  });

  it('sorts videos by sort_order', () => {
    const videos = [
      makeVideo({ id: 'v2', sort_order: 2, provider_id: 'g2', stream_url: 'https://cdn/g2/playlist.m3u8' }),
      makeVideo({ id: 'v1', sort_order: 0, provider_id: 'g1', stream_url: 'https://cdn/g1/playlist.m3u8' }),
    ];
    const items = getMediaItemsFromImages([], videos);
    expect(items.map(m => m.videoId)).toEqual(['v1', 'v2']);
  });

  it('assigns correct indices across images and videos', () => {
    const videos = [
      makeVideo({ id: 'v1', sort_order: 0 }),
      makeVideo({ id: 'v2', sort_order: 1, provider_id: 'g2', stream_url: 'https://cdn/g2/playlist.m3u8' }),
    ];
    const items = getMediaItemsFromImages(['https://img1.jpg', 'https://img2.jpg'], videos);
    expect(items).toHaveLength(4);
    expect(items.map(m => m.index)).toEqual([0, 1, 2, 3]);
    expect(items.map(m => m.type)).toEqual(['image', 'image', 'video', 'video']);
  });
});

describe('hasReadyVideos', () => {
  it('returns false for listing without videos', () => {
    expect(hasReadyVideos({ images: ['img.jpg'] })).toBe(false);
    expect(hasReadyVideos(null)).toBe(false);
  });

  it('returns false when all videos are processing', () => {
    expect(hasReadyVideos({
      images: [],
      videos: [makeVideo({ status: 'processing' })],
    })).toBe(false);
  });

  it('returns true when at least one video is ready', () => {
    expect(hasReadyVideos({
      images: [],
      videos: [
        makeVideo({ status: 'processing' }),
        makeVideo({ status: 'ready', id: 'v2' }),
      ],
    })).toBe(true);
  });
});
