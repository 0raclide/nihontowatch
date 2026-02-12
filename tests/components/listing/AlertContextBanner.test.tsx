import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertContextBanner } from '@/components/listing/AlertContextBanner';

// Control QuickView context per test
let mockQuickViewState = {
  isOpen: true,
  currentIndex: 0,
  listings: [{ id: 1 }, { id: 2 }, { id: 3 }],
};

vi.mock('@/contexts/QuickViewContext', () => ({
  useQuickView: () => mockQuickViewState,
}));

// Mock sessionStorage
let mockSessionData: Record<string, string> = {};

Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: vi.fn((key: string) => mockSessionData[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockSessionData[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockSessionData[key];
    }),
  },
  writable: true,
});

// Mock window.location for URL param checks
function setWindowUrl(url: string) {
  Object.defineProperty(window, 'location', {
    value: new URL(url),
    writable: true,
  });
}

describe('AlertContextBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionData = {};
    mockQuickViewState = {
      isOpen: true,
      currentIndex: 0,
      listings: [{ id: 1 }, { id: 2 }, { id: 3 }],
    };
    setWindowUrl('http://localhost:3000/?listings=1,2,3&alert_search=Juyo');
  });

  it('shows banner when alert context exists in sessionStorage and URL has listings param', () => {
    mockSessionData['quickview_alert_context'] = JSON.stringify({
      searchName: 'Juyo Katana',
      totalMatches: 3,
    });

    render(<AlertContextBanner />);

    expect(screen.getByText(/Match 1 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/Juyo Katana/)).toBeInTheDocument();
  });

  it('updates counter as currentIndex changes', () => {
    mockSessionData['quickview_alert_context'] = JSON.stringify({
      searchName: 'Test',
      totalMatches: 3,
    });
    mockQuickViewState.currentIndex = 2;

    render(<AlertContextBanner />);

    expect(screen.getByText(/Match 3 of 3/)).toBeInTheDocument();
  });

  it('returns null when no alert context in sessionStorage', () => {
    const { container } = render(<AlertContextBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when currentIndex is -1', () => {
    mockSessionData['quickview_alert_context'] = JSON.stringify({
      searchName: 'Test',
      totalMatches: 1,
    });
    mockQuickViewState.currentIndex = -1;

    const { container } = render(<AlertContextBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when listings is empty', () => {
    mockSessionData['quickview_alert_context'] = JSON.stringify({
      searchName: 'Test',
      totalMatches: 1,
    });
    mockQuickViewState.listings = [];

    const { container } = render(<AlertContextBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('clears stale sessionStorage when URL has no listings param', () => {
    mockSessionData['quickview_alert_context'] = JSON.stringify({
      searchName: 'Stale Search',
      totalMatches: 5,
    });
    // Normal browsing URL — no listings param
    setWindowUrl('http://localhost:3000/');

    const { container } = render(<AlertContextBanner />);

    // Should not show the banner
    expect(container.innerHTML).toBe('');
    // Should clear the stale data
    expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('quickview_alert_context');
  });

  it('works when URL has alert_search but no listings param', () => {
    mockSessionData['quickview_alert_context'] = JSON.stringify({
      searchName: 'Test',
      totalMatches: 1,
    });
    // URL with only alert_search (edge case)
    setWindowUrl('http://localhost:3000/?alert_search=Test');

    render(<AlertContextBanner />);

    expect(screen.getByText(/Match 1 of 3/)).toBeInTheDocument();
  });

  it('handles searchName being empty string', () => {
    mockSessionData['quickview_alert_context'] = JSON.stringify({
      searchName: '',
      totalMatches: 2,
    });

    render(<AlertContextBanner />);

    // Should show counter but no search name
    expect(screen.getByText(/Match 1 of 3/)).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });
});
