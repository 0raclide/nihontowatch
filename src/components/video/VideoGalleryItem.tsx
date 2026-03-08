'use client';

import { useState } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { VideoThumbnail } from './VideoThumbnail';

interface VideoGalleryItemProps {
  streamUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  status?: 'processing' | 'ready' | 'failed';
  className?: string;
}

/**
 * VideoGalleryItem — two states:
 *   Thumbnail mode (default): clickable VideoThumbnail with play overlay
 *   Player mode (after click): inline VideoPlayer with HLS streaming
 */
export function VideoGalleryItem({
  streamUrl,
  thumbnailUrl,
  duration,
  status = 'ready',
  className = '',
}: VideoGalleryItemProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (status !== 'ready') {
    return (
      <VideoThumbnail
        thumbnailUrl={thumbnailUrl}
        duration={duration}
        status={status}
        className={className}
      />
    );
  }

  if (isPlaying) {
    return (
      <VideoPlayer
        streamUrl={streamUrl}
        posterUrl={thumbnailUrl}
        autoPlay
        controls
        className={className}
      />
    );
  }

  return (
    <VideoThumbnail
      thumbnailUrl={thumbnailUrl}
      duration={duration}
      status="ready"
      onClick={() => setIsPlaying(true)}
      className={className}
    />
  );
}
