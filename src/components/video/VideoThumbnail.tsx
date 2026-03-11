'use client';

interface VideoThumbnailProps {
  thumbnailUrl?: string;
  duration?: number;
  status: 'processing' | 'ready' | 'failed';
  onClick?: () => void;
  className?: string;
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VideoThumbnail({
  thumbnailUrl,
  duration,
  status,
  onClick,
  className = '',
}: VideoThumbnailProps) {
  if (status === 'processing') {
    return (
      <div className={`relative flex items-center justify-center bg-[var(--bg-secondary)] rounded overflow-hidden aspect-video ${className}`}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[var(--text-muted)]">Processing...</span>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className={`relative flex items-center justify-center bg-red-500/10 rounded overflow-hidden aspect-video ${className}`}>
        <span className="text-xs text-red-500">Processing failed</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`relative group rounded overflow-hidden aspect-video ${className}`}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt="Video thumbnail"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-[var(--bg-secondary)]" />
      )}

      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-white/90 group-hover:bg-white transition-colors">
          <svg className="w-6 h-6 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      {/* Duration badge */}
      {duration != null && (
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-medium">
          {formatDuration(duration)}
        </div>
      )}
    </button>
  );
}
