'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { useVideoUpload } from '@/contexts/VideoUploadContext';
import { VideoUploadProgress } from '@/components/video/VideoUploadProgress';
import { VideoThumbnail } from '@/components/video/VideoThumbnail';
import type { ListingVideo } from '@/types/media';

interface VideoUploadSectionProps {
  listingId?: number;
  videos: ListingVideo[];
  onVideosChange: (videos: ListingVideo[]) => void;
}

/**
 * VideoUploadSection — manages video uploads + displays existing videos for a listing.
 *
 * - Add mode (no listingId): disabled with "save first" message
 * - Edit mode (has listingId): full upload + video management
 * - Polls for processing status every 5s while any video is processing
 * - Subscribes to global upload context for completion events
 */
export function VideoUploadSection({
  listingId,
  videos,
  onVideosChange,
}: VideoUploadSectionProps) {
  const { t } = useLocale();
  const { subscribeToListing } = useVideoUpload();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const hasProcessing = videos.some(v => v.status === 'processing');

  // Poll for processing status
  useEffect(() => {
    if (!hasProcessing || !listingId) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/dealer/videos?listingId=${listingId}`);
        if (res.ok) {
          const data = await res.json();
          onVideosChange(data.videos);
        }
      } catch {}
    };

    pollRef.current = setInterval(poll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasProcessing, listingId, onVideosChange]);

  // Subscribe to global upload completion events for this listing
  useEffect(() => {
    if (!listingId) return;

    return subscribeToListing(listingId, async () => {
      // Upload finished (now processing on Bunny) — refresh video list
      try {
        const res = await fetch(`/api/dealer/videos?listingId=${listingId}`);
        if (res.ok) {
          const data = await res.json();
          onVideosChange(data.videos);
        }
      } catch {}
    });
  }, [listingId, subscribeToListing, onVideosChange]);

  const handleDelete = useCallback(async (videoId: string) => {
    setIsDeleting(videoId);
    try {
      const res = await fetch(`/api/dealer/videos/${videoId}`, { method: 'DELETE' });
      if (res.ok) {
        onVideosChange(videos.filter(v => v.id !== videoId));
      }
    } catch {}
    setIsDeleting(null);
  }, [videos, onVideosChange]);

  if (!listingId) {
    return (
      <div className="border border-dashed border-[var(--border)] rounded-lg p-6 text-center opacity-50">
        <svg className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-[var(--text-muted)]">{t('dealer.video.saveFirst')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Existing videos */}
      {videos.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {videos.map(video => (
            <div key={video.id} className="relative">
              <VideoThumbnail
                thumbnailUrl={video.thumbnail_url || undefined}
                duration={video.duration_seconds}
                status={video.status}
                className="w-full"
              />
              {video.status !== 'processing' && (
                <button
                  onClick={() => handleDelete(video.id)}
                  disabled={isDeleting === video.id}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
                  title={t('dealer.video.delete')}
                >
                  {isDeleting === video.id ? (
                    <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      <VideoUploadProgress
        listingId={listingId}
        onUploadError={(err) => console.error('Video upload error:', err)}
      />
    </div>
  );
}
