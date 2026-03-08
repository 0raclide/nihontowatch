/**
 * Video Provider Abstraction
 *
 * Single file that handles all video hosting provider logic.
 * Default implementation: Bunny.net Stream
 *
 * Ported from oshi-v2/src/lib/videoProvider.ts
 */

import { createHash } from 'crypto';

export const BUNNY_LIBRARY_ID = (process.env.BUNNY_STREAM_LIBRARY_ID || '').trim();
export const BUNNY_API_KEY = (process.env.BUNNY_STREAM_API_KEY || '').trim();
const BUNNY_CDN_HOSTNAME = (process.env.BUNNY_STREAM_CDN_HOSTNAME || '').trim();

export interface VideoProvider {
  createUpload(filename: string): Promise<CreateUploadResult>;
  getStreamUrl(providerId: string): string;
  getThumbnailUrl(providerId: string): string;
  getEmbedUrl(providerId: string): string;
  deleteVideo(providerId: string): Promise<void>;
  getVideoStatus(providerId: string): Promise<VideoStatus>;
}

export interface CreateUploadResult {
  videoId: string;
  uploadUrl: string;
  expiresAt?: number;
  authSignature?: string;
  authExpire?: number;
  libraryId?: string;
}

export interface VideoStatus {
  status: 'processing' | 'ready' | 'failed';
  duration?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  encodeProgress?: number;
  availableResolutions?: string[];
}

function sha256(message: string): string {
  return createHash('sha256').update(message).digest('hex');
}

const bunnyProvider: VideoProvider = {
  async createUpload(filename: string): Promise<CreateUploadResult> {
    if (!BUNNY_LIBRARY_ID || !BUNNY_API_KEY) {
      throw new Error('Bunny.net Stream credentials not configured');
    }

    const response = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'AccessKey': BUNNY_API_KEY,
        },
        body: JSON.stringify({ title: filename }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create video: ${error}`);
    }

    const video = await response.json();

    const expirationTime = Math.floor(Date.now() / 1000) + 86400;
    const signatureString = BUNNY_LIBRARY_ID + BUNNY_API_KEY + expirationTime + video.guid;
    const signature = sha256(signatureString);

    return {
      videoId: video.guid,
      uploadUrl: 'https://video.bunnycdn.com/tusupload',
      expiresAt: expirationTime,
      authSignature: signature,
      authExpire: expirationTime,
      libraryId: BUNNY_LIBRARY_ID,
    };
  },

  getStreamUrl(providerId: string): string {
    if (BUNNY_CDN_HOSTNAME) {
      return `https://${BUNNY_CDN_HOSTNAME}/${providerId}/playlist.m3u8`;
    }
    return `https://vz-${BUNNY_LIBRARY_ID}.b-cdn.net/${providerId}/playlist.m3u8`;
  },

  getThumbnailUrl(providerId: string): string {
    if (BUNNY_CDN_HOSTNAME) {
      return `https://${BUNNY_CDN_HOSTNAME}/${providerId}/thumbnail.jpg`;
    }
    return `https://vz-${BUNNY_LIBRARY_ID}.b-cdn.net/${providerId}/thumbnail.jpg`;
  },

  getEmbedUrl(providerId: string): string {
    return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${providerId}`;
  },

  async deleteVideo(providerId: string): Promise<void> {
    if (!BUNNY_LIBRARY_ID || !BUNNY_API_KEY) {
      throw new Error('Bunny.net Stream credentials not configured');
    }

    const response = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${providerId}`,
      {
        method: 'DELETE',
        headers: { 'AccessKey': BUNNY_API_KEY },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete video: ${error}`);
    }
  },

  async getVideoStatus(providerId: string): Promise<VideoStatus> {
    if (!BUNNY_LIBRARY_ID || !BUNNY_API_KEY) {
      throw new Error('Bunny.net Stream credentials not configured');
    }

    const response = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${providerId}`,
      {
        method: 'GET',
        headers: { 'AccessKey': BUNNY_API_KEY },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get video status');
    }

    const video = await response.json();

    // Bunny status codes: 0=created, 1=uploaded, 2=processing, 3=transcoding, 4=finished, 5=error
    let status: VideoStatus['status'] = 'processing';
    if (video.status === 4) {
      status = 'ready';
    } else if (video.status === 5) {
      status = 'failed';
    }

    const availableResolutions = video.availableResolutions
      ? video.availableResolutions.split(',').filter(Boolean)
      : undefined;

    return {
      status,
      duration: video.length ? Math.round(video.length) : undefined,
      width: video.width || undefined,
      height: video.height || undefined,
      thumbnailUrl: this.getThumbnailUrl(providerId),
      encodeProgress: video.encodeProgress ?? undefined,
      availableResolutions,
    };
  },
};

export const videoProvider: VideoProvider = bunnyProvider;

export const VIDEO_PROVIDER_NAME = 'bunny';

export function isVideoProviderConfigured(): boolean {
  return Boolean(BUNNY_LIBRARY_ID && BUNNY_API_KEY);
}
