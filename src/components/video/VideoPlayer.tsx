'use client';

import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  streamUrl: string;
  posterUrl?: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
}

/**
 * HLS.js-based video player with Safari native fallback.
 * hls.js is dynamically imported to avoid 70KB in the main bundle.
 */
export function VideoPlayer({
  streamUrl,
  posterUrl,
  title,
  className = '',
  autoPlay = false,
  controls = true,
  loop = false,
  muted = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    setIsLoading(true);
    setError(null);

    let destroyed = false;

    (async () => {
      // Dynamic import to keep bundle small
      const Hls = (await import('hls.js')).default;

      if (destroyed) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          startLevel: -1,
          capLevelToPlayerSize: false,
          abrEwmaDefaultEstimate: 10000000,
          abrBandWidthFactor: 0.95,
          abrBandWidthUpFactor: 0.7,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (destroyed) return;
          setIsLoading(false);
          if (autoPlay) {
            video.play().catch(() => {});
          }
        });

        hls.on(Hls.Events.ERROR, (_, data: any) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setError('Video playback failed');
                hls.destroy();
                break;
            }
          }
        });

        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = streamUrl;

        const handleLoad = () => {
          if (destroyed) return;
          setIsLoading(false);
          if (autoPlay) {
            video.play().catch(() => {});
          }
        };
        const handleError = () => {
          if (destroyed) return;
          setError('Video playback failed');
        };

        video.addEventListener('loadedmetadata', handleLoad);
        video.addEventListener('error', handleError);

        return () => {
          video.removeEventListener('loadedmetadata', handleLoad);
          video.removeEventListener('error', handleError);
        };
      } else {
        setError('HLS playback not supported in this browser');
      }
    })();

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, autoPlay]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-[var(--bg-secondary)] rounded-lg p-4 ${className}`}>
        <p className="text-[var(--text-muted)] text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-secondary)] rounded-lg">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <video
        ref={videoRef}
        poster={posterUrl}
        title={title}
        controls={controls}
        loop={loop}
        muted={muted}
        playsInline
        className={`w-full rounded-lg bg-black ${isLoading ? 'invisible' : 'visible'}`}
      />
    </div>
  );
}
