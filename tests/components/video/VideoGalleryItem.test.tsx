/**
 * Tests for VideoGalleryItem — thumbnail→player toggle
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoGalleryItem } from '@/components/video/VideoGalleryItem';

// Mock VideoPlayer to avoid HLS.js import in tests
vi.mock('@/components/video/VideoPlayer', () => ({
  VideoPlayer: ({ streamUrl }: { streamUrl: string }) => (
    <div data-testid="video-player" data-stream-url={streamUrl} />
  ),
}));

describe('VideoGalleryItem', () => {
  it('renders thumbnail with play button for ready video', () => {
    render(
      <VideoGalleryItem
        streamUrl="https://cdn/vid/playlist.m3u8"
        thumbnailUrl="https://cdn/vid/thumbnail.jpg"
        duration={120}
        status="ready"
      />
    );
    // Should show a button (thumbnail mode)
    const btn = screen.getByRole('button');
    expect(btn).toBeDefined();
    // Should show duration
    expect(screen.getByText('2:00')).toBeDefined();
  });

  it('switches to player on click', () => {
    render(
      <VideoGalleryItem
        streamUrl="https://cdn/vid/playlist.m3u8"
        thumbnailUrl="https://cdn/vid/thumbnail.jpg"
        status="ready"
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('video-player')).toBeDefined();
    expect(screen.getByTestId('video-player').getAttribute('data-stream-url')).toBe('https://cdn/vid/playlist.m3u8');
  });

  it('renders processing state with spinner', () => {
    render(
      <VideoGalleryItem
        streamUrl=""
        status="processing"
      />
    );
    expect(screen.getByText('Processing...')).toBeDefined();
  });

  it('renders failed state with error message', () => {
    render(
      <VideoGalleryItem
        streamUrl=""
        status="failed"
      />
    );
    expect(screen.getByText('Processing failed')).toBeDefined();
  });

  it('shows duration badge formatted as M:SS', () => {
    render(
      <VideoGalleryItem
        streamUrl="https://cdn/vid/playlist.m3u8"
        thumbnailUrl="https://cdn/vid/thumbnail.jpg"
        duration={65}
        status="ready"
      />
    );
    expect(screen.getByText('1:05')).toBeDefined();
  });
});
