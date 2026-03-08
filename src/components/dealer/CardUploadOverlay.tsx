'use client';

import { useVideoUpload } from '@/contexts/VideoUploadContext';

/**
 * Thin progress overlay rendered on listing card thumbnails when the dealer
 * has an active video upload for that listing.
 *
 * - Uploading: accent-colored progress bar + percentage
 * - Processing (Bunny transcoding): pulsing yellow bar at 100%
 * - No active uploads: renders nothing
 */
export function CardUploadOverlay({ listingId }: { listingId: number }) {
  const { getUploadsForListing } = useVideoUpload();
  const uploads = getUploadsForListing(listingId);

  // Only show for active/processing uploads
  const active = uploads.filter(
    u => u.status === 'preparing' || u.status === 'uploading' || u.status === 'processing'
  );
  if (active.length === 0) return null;

  // Use the highest-progress active upload for display
  const primary = active.reduce((a, b) => (a.progress >= b.progress ? a : b));
  const isProcessing = primary.status === 'processing';

  return (
    <div className="absolute inset-x-0 bottom-0 z-10">
      {/* Label row */}
      <div className="flex items-center justify-between px-1.5 pb-0.5">
        <div className="flex items-center gap-1">
          <svg
            className={`w-3 h-3 text-white ${isProcessing ? '' : 'animate-pulse'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          <span className="text-[10px] font-medium text-white drop-shadow-sm">
            {isProcessing ? 'Processing' : `${primary.progress}%`}
          </span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-black/40">
        <div
          className={`h-full transition-all duration-300 ${
            isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-[var(--accent)]'
          }`}
          style={{ width: `${primary.progress}%` }}
        />
      </div>
    </div>
  );
}
