'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth/AuthContext';

// ============================================================================
// Types
// ============================================================================

export type UploadStatus = 'preparing' | 'uploading' | 'processing' | 'complete' | 'error';

export interface UploadEntry {
  id: string;
  videoId: string;
  listingId: number;
  fileName: string;
  fileSize: number;
  status: UploadStatus;
  progress: number;
  isPaused: boolean;
  error?: string;
  startedAt: number;
}

interface TusUploadHandle {
  entry: UploadEntry;
  tusUpload: any; // tus.Upload instance
}

interface VideoUploadContextValue {
  /** React state for UI — flushed from refs every 500ms */
  uploads: UploadEntry[];
  /** Whether any uploads are active (uploading or preparing) */
  hasActiveUploads: boolean;
  /** Start a new upload for a listing */
  startUpload: (listingId: number, file: File) => Promise<void>;
  /** Pause an active upload */
  pauseUpload: (id: string) => void;
  /** Resume a paused upload */
  resumeUpload: (id: string) => void;
  /** Cancel an active upload */
  cancelUpload: (id: string) => void;
  /** Dismiss a completed/errored entry from UI */
  dismissUpload: (id: string) => void;
  /** Get uploads filtered to a specific listing */
  getUploadsForListing: (listingId: number) => UploadEntry[];
  /** Subscribe to completion events for a listing. Returns unsubscribe fn. */
  subscribeToListing: (listingId: number, cb: () => void) => () => void;
}

// ============================================================================
// Context
// ============================================================================

const VideoUploadContext = createContext<VideoUploadContextValue | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

const EMPTY_UPLOADS: UploadEntry[] = [];

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
const VALID_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export function VideoUploadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Authoritative state — kept in ref to avoid re-renders on every progress tick
  const uploadsRef = useRef<Map<string, TusUploadHandle>>(new Map());

  // React state for UI consumers — flushed every 500ms
  const [uploads, setUploads] = useState<UploadEntry[]>(EMPTY_UPLOADS);

  // Per-listing completion subscribers
  const subscribersRef = useRef<Map<number, Set<() => void>>>(new Map());

  // Auto-dismiss timers
  const dismissTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Counter for unique IDs
  const idCounterRef = useRef(0);

  // Flush ref state to React state on an interval
  useEffect(() => {
    const interval = setInterval(() => {
      const entries = Array.from(uploadsRef.current.values()).map(h => ({ ...h.entry }));
      setUploads(prev => {
        // Only update if something actually changed (avoids unnecessary re-renders)
        if (prev.length === 0 && entries.length === 0) return prev;
        // Simple deep comparison via JSON — entries are small objects
        const prevJson = JSON.stringify(prev);
        const nextJson = JSON.stringify(entries);
        if (prevJson === nextJson) return prev;
        return entries;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dismissTimersRef.current.forEach(timer => clearTimeout(timer));
      dismissTimersRef.current.clear();
    };
  }, []);

  const notifyListingSubscribers = useCallback((listingId: number) => {
    const subs = subscribersRef.current.get(listingId);
    if (subs) {
      subs.forEach(cb => {
        try { cb(); } catch {}
      });
    }
  }, []);

  const scheduleAutoDismiss = useCallback((id: string) => {
    const timer = setTimeout(() => {
      uploadsRef.current.delete(id);
      dismissTimersRef.current.delete(id);
      // Immediate flush for removal
      setUploads(Array.from(uploadsRef.current.values()).map(h => ({ ...h.entry })));
    }, 8000);
    dismissTimersRef.current.set(id, timer);
  }, []);

  const startUpload = useCallback(async (listingId: number, file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File too large. Maximum size is 5 GB.');
    }

    if (!VALID_VIDEO_TYPES.some(type => file.type === type || file.type.match(type.replace('*', '.*')))) {
      throw new Error('Invalid file type. Please upload a video file.');
    }

    const uploadId = `upload_${Date.now()}_${++idCounterRef.current}`;

    const entry: UploadEntry = {
      id: uploadId,
      videoId: '',
      listingId,
      fileName: file.name,
      fileSize: file.size,
      status: 'preparing',
      progress: 0,
      isPaused: false,
      startedAt: Date.now(),
    };

    // Store immediately so UI can show "preparing"
    uploadsRef.current.set(uploadId, { entry, tusUpload: null });
    // Immediate flush
    setUploads(Array.from(uploadsRef.current.values()).map(h => ({ ...h.entry })));

    try {
      // Call API to create video slot
      const res = await fetch('/api/dealer/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, filename: file.name }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create upload');
      }

      const uploadInfo = await res.json();

      // Update entry with video ID
      const handle = uploadsRef.current.get(uploadId);
      if (!handle) return; // cancelled during API call
      handle.entry.videoId = uploadInfo.videoId;

      // Dynamic import tus-js-client
      const tus = await import('tus-js-client');

      const tusHeaders: Record<string, string> = {};
      if (uploadInfo.authSignature && uploadInfo.authExpire) {
        tusHeaders['AuthorizationSignature'] = uploadInfo.authSignature;
        tusHeaders['AuthorizationExpire'] = String(uploadInfo.authExpire);
        tusHeaders['VideoId'] = uploadInfo.providerId || uploadInfo.videoId;
        tusHeaders['LibraryId'] = uploadInfo.libraryId || '';
      }

      const tusUpload = new tus.Upload(file, {
        endpoint: uploadInfo.uploadUrl,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        chunkSize: 10 * 1024 * 1024,
        metadata: {
          filename: file.name,
          filetype: file.type,
        },
        headers: tusHeaders,
        onError: (err: Error) => {
          console.error('[VideoUploadContext] TUS error:', err);
          const h = uploadsRef.current.get(uploadId);
          if (h) {
            h.entry.status = 'error';
            h.entry.error = err.message || 'Upload failed';
          }
        },
        onProgress: (bytesUploaded: number, bytesTotal: number) => {
          const h = uploadsRef.current.get(uploadId);
          if (h) {
            h.entry.progress = Math.round((bytesUploaded / bytesTotal) * 100);
          }
        },
        onSuccess: () => {
          const h = uploadsRef.current.get(uploadId);
          if (h) {
            h.entry.status = 'processing';
            h.entry.progress = 100;
            // Notify listing subscribers (video is uploaded, now processing on Bunny)
            notifyListingSubscribers(h.entry.listingId);
            // Auto-dismiss after delay
            scheduleAutoDismiss(uploadId);
          }
        },
      });

      // Store TUS instance in handle
      handle.tusUpload = tusUpload;
      handle.entry.status = 'uploading';

      // Check for previous uploads (TUS resume)
      const previousUploads = await tusUpload.findPreviousUploads();
      if (previousUploads.length > 0) {
        tusUpload.resumeFromPreviousUpload(previousUploads[0]);
      }

      tusUpload.start();
    } catch (err) {
      console.error('[VideoUploadContext] Failed to start upload:', err);
      const handle = uploadsRef.current.get(uploadId);
      if (handle) {
        handle.entry.status = 'error';
        handle.entry.error = err instanceof Error ? err.message : 'Failed to start upload';
      }
      // Immediate flush for error state
      setUploads(Array.from(uploadsRef.current.values()).map(h => ({ ...h.entry })));
    }
  }, [notifyListingSubscribers, scheduleAutoDismiss]);

  const pauseUpload = useCallback((id: string) => {
    const handle = uploadsRef.current.get(id);
    if (handle?.tusUpload && handle.entry.status === 'uploading') {
      handle.tusUpload.abort();
      handle.entry.isPaused = true;
    }
  }, []);

  const resumeUpload = useCallback((id: string) => {
    const handle = uploadsRef.current.get(id);
    if (handle?.tusUpload && handle.entry.isPaused) {
      handle.tusUpload.start();
      handle.entry.isPaused = false;
    }
  }, []);

  const cancelUpload = useCallback((id: string) => {
    const handle = uploadsRef.current.get(id);
    if (handle?.tusUpload) {
      handle.tusUpload.abort();
    }
    uploadsRef.current.delete(id);
    const timer = dismissTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimersRef.current.delete(id);
    }
    // Immediate flush
    setUploads(Array.from(uploadsRef.current.values()).map(h => ({ ...h.entry })));
  }, []);

  const dismissUpload = useCallback((id: string) => {
    uploadsRef.current.delete(id);
    const timer = dismissTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimersRef.current.delete(id);
    }
    // Immediate flush
    setUploads(Array.from(uploadsRef.current.values()).map(h => ({ ...h.entry })));
  }, []);

  const getUploadsForListing = useCallback((listingId: number): UploadEntry[] => {
    return uploads.filter(u => u.listingId === listingId);
  }, [uploads]);

  const subscribeToListing = useCallback((listingId: number, cb: () => void) => {
    if (!subscribersRef.current.has(listingId)) {
      subscribersRef.current.set(listingId, new Set());
    }
    subscribersRef.current.get(listingId)!.add(cb);

    return () => {
      const subs = subscribersRef.current.get(listingId);
      if (subs) {
        subs.delete(cb);
        if (subs.size === 0) subscribersRef.current.delete(listingId);
      }
    };
  }, []);

  const hasActiveUploads = useMemo(() => {
    return uploads.some(u => u.status === 'preparing' || u.status === 'uploading');
  }, [uploads]);

  const value = useMemo<VideoUploadContextValue>(
    () => ({
      uploads,
      hasActiveUploads,
      startUpload,
      pauseUpload,
      resumeUpload,
      cancelUpload,
      dismissUpload,
      getUploadsForListing,
      subscribeToListing,
    }),
    [
      uploads,
      hasActiveUploads,
      startUpload,
      pauseUpload,
      resumeUpload,
      cancelUpload,
      dismissUpload,
      getUploadsForListing,
      subscribeToListing,
    ]
  );

  return (
    <VideoUploadContext.Provider value={value}>
      {children}
    </VideoUploadContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useVideoUpload(): VideoUploadContextValue {
  const context = useContext(VideoUploadContext);
  if (context === undefined) {
    throw new Error('useVideoUpload must be used within a VideoUploadProvider');
  }
  return context;
}
