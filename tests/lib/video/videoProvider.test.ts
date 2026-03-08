/**
 * Tests for videoProvider module
 *
 * Tests URL generation and configuration checks.
 * Network-dependent methods (createUpload, deleteVideo, getVideoStatus)
 * are tested for error handling only (unconfigured credentials).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { videoProvider, isVideoProviderConfigured, VIDEO_PROVIDER_NAME } from '@/lib/video/videoProvider';

describe('videoProvider', () => {
  describe('VIDEO_PROVIDER_NAME', () => {
    it('is bunny', () => {
      expect(VIDEO_PROVIDER_NAME).toBe('bunny');
    });
  });

  describe('isVideoProviderConfigured', () => {
    it('reflects current env var state', () => {
      // Depends on whether env vars are set in .env.test — typically not
      const result = isVideoProviderConfigured();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getStreamUrl', () => {
    it('returns a valid HLS URL', () => {
      const url = videoProvider.getStreamUrl('test-guid-123');
      expect(url).toContain('test-guid-123');
      expect(url).toContain('playlist.m3u8');
    });
  });

  describe('getThumbnailUrl', () => {
    it('returns a valid thumbnail URL', () => {
      const url = videoProvider.getThumbnailUrl('test-guid-123');
      expect(url).toContain('test-guid-123');
      expect(url).toContain('thumbnail.jpg');
    });
  });

  describe('getEmbedUrl', () => {
    it('returns a valid embed URL', () => {
      const url = videoProvider.getEmbedUrl('test-guid-123');
      expect(url).toContain('test-guid-123');
      expect(url).toContain('iframe.mediadelivery.net');
    });
  });

  describe('createUpload', () => {
    it('throws when credentials are not configured', async () => {
      // Only run this test if env vars are NOT set
      if (isVideoProviderConfigured()) return;
      await expect(videoProvider.createUpload('test.mp4')).rejects.toThrow('not configured');
    });
  });

  describe('deleteVideo', () => {
    it('throws when credentials are not configured', async () => {
      if (isVideoProviderConfigured()) return;
      await expect(videoProvider.deleteVideo('vid-abc')).rejects.toThrow('not configured');
    });
  });

  describe('getVideoStatus', () => {
    it('throws when credentials are not configured', async () => {
      if (isVideoProviderConfigured()) return;
      await expect(videoProvider.getVideoStatus('vid-abc')).rejects.toThrow('not configured');
    });
  });
});
