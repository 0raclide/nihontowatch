/**
 * VisitorDetailModal Component Tests
 *
 * Tests the visitor detail modal UI including:
 * - Loading and error states
 * - Summary stats display
 * - Tab navigation
 * - Timeline, sessions, searches, and filters views
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VisitorDetailModal } from '@/components/admin/VisitorDetailModal';

// =============================================================================
// MOCK DATA
// =============================================================================

const mockVisitorDetail = {
  visitorId: 'vis_test_123456789',
  ipAddresses: ['1.2.3.4', '5.6.7.8'],
  firstSeen: '2026-01-15T10:00:00Z',
  lastSeen: '2026-01-20T15:30:00Z',
  totalEvents: 150,
  totalSessions: 5,
  totalDurationMs: 3600000, // 1 hour

  searchCount: 25,
  filterChangeCount: 10,
  pageViewCount: 80,
  dealerClickCount: 15,
  favoriteCount: 8,

  topSearches: [
    { query: 'katana', count: 10 },
    { query: 'wakizashi', count: 8 },
    { query: 'tanto', count: 5 },
  ],

  filterPatterns: [
    { category: 'Category: swords | Types: katana', filters: { category: 'swords', itemTypes: ['katana'] }, count: 5 },
    { category: 'Certs: NBTHK', filters: { certifications: ['NBTHK'] }, count: 3 },
  ],

  sessions: [
    {
      sessionId: 'sess_1',
      startedAt: '2026-01-20T14:00:00Z',
      endedAt: '2026-01-20T15:30:00Z',
      durationMs: 5400000,
      pageViews: 25,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      screenWidth: 1920,
      screenHeight: 1080,
    },
    {
      sessionId: 'sess_2',
      startedAt: '2026-01-18T10:00:00Z',
      endedAt: '2026-01-18T11:00:00Z',
      durationMs: 3600000,
      pageViews: 15,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
      screenWidth: 390,
      screenHeight: 844,
    },
  ],

  recentActivity: [
    { id: 1, eventType: 'search', eventData: { query: 'katana' }, createdAt: '2026-01-20T15:30:00Z', sessionId: 'sess_1' },
    { id: 2, eventType: 'page_view', eventData: { path: '/browse' }, createdAt: '2026-01-20T15:25:00Z', sessionId: 'sess_1' },
    { id: 3, eventType: 'external_link_click', eventData: { dealerName: 'Aoi Art' }, createdAt: '2026-01-20T15:20:00Z', sessionId: 'sess_1' },
  ],

  dealersClicked: [
    { name: 'Aoi Art', count: 8 },
    { name: 'Nipponto', count: 5 },
  ],

  pagesViewed: [
    { path: '/browse', count: 40 },
    { path: '/listing/123', count: 10 },
  ],
};

// =============================================================================
// MOCK SETUP
// =============================================================================

function setupFetch(response: { ok: boolean; data: unknown }) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: response.ok,
      json: () => Promise.resolve(response.data),
    } as Response)
  );
}

beforeEach(() => {
  setupFetch({ ok: true, data: mockVisitorDetail });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// TEST SUITES
// =============================================================================

describe('VisitorDetailModal', () => {
  // ===========================================================================
  // LOADING STATE
  // ===========================================================================

  describe('loading state', () => {
    it('shows loading spinner initially', () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // ERROR STATE
  // ===========================================================================

  describe('error state', () => {
    it('shows error message when fetch fails', async () => {
      setupFetch({ ok: false, data: { error: 'Visitor not found' } });

      render(<VisitorDetailModal visitorId="vis_nonexistent" onClose={() => {}} />);

      await waitFor(() => {
        // Error message from API is displayed
        expect(screen.getByText('Visitor not found')).toBeInTheDocument();
      });
    });

    it('shows error message on network error', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // MODAL BEHAVIOR
  // ===========================================================================

  describe('modal behavior', () => {
    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Visitor Details')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText(/close/i);
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', async () => {
      const onClose = vi.fn();
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Visitor Details')).toBeInTheDocument();
      });

      // Click the backdrop (the outer div)
      const backdrop = screen.getByTestId('modal-backdrop');
      fireEvent.click(backdrop);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('displays truncated visitor ID in header', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123456789" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText(/vis_test_123456789/)).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // SUMMARY STATS
  // ===========================================================================

  describe('summary stats', () => {
    it('displays total time on site', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        // 3600000ms = 1 hour
        expect(screen.getByText('1h 0m')).toBeInTheDocument();
      });
    });

    it('displays session count', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('displays total events', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
      });
    });

    it('displays search count', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('25')).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // TAB NAVIGATION
  // ===========================================================================

  describe('tab navigation', () => {
    it('shows Timeline tab by default', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        // Timeline shows search events with quotes around query
        expect(screen.getByText(/"katana"/)).toBeInTheDocument();
      });
    });

    it('switches to Sessions tab when clicked', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Sessions/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Sessions/ }));

      await waitFor(() => {
        // Should show session durations
        expect(screen.getByText(/1h 30m/)).toBeInTheDocument();
      });
    });

    it('switches to Searches tab when clicked', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Searches/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Searches/ }));

      await waitFor(() => {
        // Should show search counts (component shows "Nx" format)
        expect(screen.getByText('10x')).toBeInTheDocument();
      });
    });

    it('switches to Filters tab when clicked', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Filters/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Filters/ }));

      await waitFor(() => {
        // Should show dealer clicks
        expect(screen.getByText('Aoi Art')).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // TIMELINE TAB
  // ===========================================================================

  describe('timeline tab', () => {
    it('displays activity events with icons', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        // Search event (with quotes around query)
        expect(screen.getByText(/"katana"/)).toBeInTheDocument();
        // Page view
        expect(screen.getByText('/browse')).toBeInTheDocument();
        // Dealer click
        expect(screen.getByText('Aoi Art')).toBeInTheDocument();
      });
    });

    it('shows timestamps for events', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        // Events should have time displayed (format depends on locale)
        // Look for any PM time indicator
        expect(screen.getAllByText(/PM/).length).toBeGreaterThan(0);
      });
    });
  });

  // ===========================================================================
  // SESSIONS TAB
  // ===========================================================================

  describe('sessions tab', () => {
    it('displays session duration', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Sessions/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Sessions/ }));

      await waitFor(() => {
        // Check that duration format appears (Xh Ym format)
        // Multiple durations may appear: summary stat + individual sessions
        const durationMatches = screen.getAllByText(/\d+h \d+m/);
        expect(durationMatches.length).toBeGreaterThan(0);
      });
    });

    it('displays page view counts', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Sessions/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Sessions/ }));

      await waitFor(() => {
        // Component shows "N page views" format
        expect(screen.getByText(/25 page views/)).toBeInTheDocument();
        expect(screen.getByText(/15 page views/)).toBeInTheDocument();
      });
    });

    it('displays screen dimensions', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Sessions/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Sessions/ }));

      await waitFor(() => {
        // Component uses "x" not "×" for dimensions
        expect(screen.getByText(/1920x1080/)).toBeInTheDocument();
        expect(screen.getByText(/390x844/)).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // SEARCHES TAB
  // ===========================================================================

  describe('searches tab', () => {
    it('displays top search queries with counts', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Searches/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Searches/ }));

      await waitFor(() => {
        // Component shows "Nx" format
        expect(screen.getByText('10x')).toBeInTheDocument();
        expect(screen.getByText('8x')).toBeInTheDocument();
        expect(screen.getByText('5x')).toBeInTheDocument();
      });
    });

    it('displays search query terms', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Searches/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Searches/ }));

      await waitFor(() => {
        const searchTab = screen.getByRole('tabpanel');
        // Queries are displayed with quotes in SearchesTab
        expect(searchTab).toHaveTextContent('katana');
        expect(searchTab).toHaveTextContent('wakizashi');
        expect(searchTab).toHaveTextContent('tanto');
      });
    });
  });

  // ===========================================================================
  // FILTERS TAB
  // ===========================================================================

  describe('filters tab', () => {
    it('displays dealers clicked with counts', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Filters'));

      await waitFor(() => {
        expect(screen.getByText('Aoi Art')).toBeInTheDocument();
        expect(screen.getByText('Nipponto')).toBeInTheDocument();
      });
    });

    it('displays pages viewed with counts', async () => {
      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Filters'));

      await waitFor(() => {
        expect(screen.getByText('/browse')).toBeInTheDocument();
        expect(screen.getByText('/listing/123')).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('handles visitor with no searches', async () => {
      setupFetch({
        ok: true,
        data: {
          ...mockVisitorDetail,
          searchCount: 0,
          topSearches: [],
        },
      });

      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      // Wait for the modal to load
      await waitFor(() => {
        expect(screen.getByText('Visitor Details')).toBeInTheDocument();
      });

      // Find and click the Searches tab button (shows "Searches (0)")
      const searchesButton = screen.getByRole('button', { name: /Searches \(0\)/ });
      fireEvent.click(searchesButton);

      await waitFor(() => {
        expect(screen.getByText(/no searches/i)).toBeInTheDocument();
      });
    });

    it('handles visitor with no sessions', async () => {
      setupFetch({
        ok: true,
        data: {
          ...mockVisitorDetail,
          totalSessions: 0,
          sessions: [],
        },
      });

      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      // Wait for the modal to load
      await waitFor(() => {
        expect(screen.getByText('Visitor Details')).toBeInTheDocument();
      });

      // Find and click the Sessions tab button (shows "Sessions (0)")
      const sessionsButton = screen.getByRole('button', { name: /Sessions \(0\)/ });
      fireEvent.click(sessionsButton);

      await waitFor(() => {
        expect(screen.getByText(/no sessions/i)).toBeInTheDocument();
      });
    });

    it('handles zero total duration', async () => {
      setupFetch({
        ok: true,
        data: {
          ...mockVisitorDetail,
          totalDurationMs: 0,
        },
      });

      render(<VisitorDetailModal visitorId="vis_test_123" onClose={() => {}} />);

      await waitFor(() => {
        // Component shows "—" for zero/null duration
        expect(screen.getByText('—')).toBeInTheDocument();
      });
    });
  });
});
