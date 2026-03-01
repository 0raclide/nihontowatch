/**
 * ArtisanDetailsPanel Component Tests
 *
 * Tests the admin artisan details display panel including:
 * - Loading state while fetching
 * - Fetch on mount with correct API call
 * - Rendering name, elite standing, cert counts, candidates, profile link
 * - Re-fetch when artisanId prop changes
 * - Skip fetch for UNKNOWN artisan
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ArtisanDetailsPanel } from '@/components/admin/ArtisanDetailsPanel';

// Mock locale context
vi.mock('@/i18n/LocaleContext', async () => {
  return {
    useLocale: () => ({ locale: 'en', setLocale: () => {}, t: (key: string) => key }),
    LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockArtisan = {
  code: 'MAS590',
  name_kanji: '正宗',
  name_romaji: 'Masamune',
  school: 'Soshu',
  province: 'Sagami',
  era: 'Late Kamakura (1288-1333)',
  period: 'Kamakura',
  elite_factor: 0.42,
  kokuho_count: 2,
  jubun_count: 1,
  jubi_count: 0,
  gyobutsu_count: 0,
  tokuju_count: 5,
  juyo_count: 12,
  total_items: 20,
  elite_count: 8,
  is_school_code: false,
};

function mockFetchSuccess(artisan = mockArtisan) {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ artisan }),
  });
}

describe('ArtisanDetailsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state while fetching', () => {
    // Never resolve the fetch
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" />
    );

    expect(screen.getByTestId('artisan-details-loading')).toBeInTheDocument();
  });

  it('fetches /api/artisan/{code} on mount', async () => {
    mockFetchSuccess();

    render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/artisan/MAS590');
    });
  });

  it('renders name kanji and romaji after fetch', async () => {
    mockFetchSuccess();

    render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" />
    );

    await waitFor(() => {
      expect(screen.getByText('正宗')).toBeInTheDocument();
      expect(screen.getByText('Masamune')).toBeInTheDocument();
    });
  });

  it('renders elite standing bar with correct score', async () => {
    mockFetchSuccess();

    render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" />
    );

    await waitFor(() => {
      expect(screen.getByTestId('elite-percentage')).toHaveTextContent('0.42');
    });
  });

  it('renders cert counts grid (6 cells)', async () => {
    mockFetchSuccess();

    render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" />
    );

    await waitFor(() => {
      expect(screen.getByTestId('cert-counts')).toBeInTheDocument();
    });

    // Check specific cert labels
    expect(screen.getByText('Kokuho')).toBeInTheDocument();
    expect(screen.getByText('Jubun')).toBeInTheDocument();
    expect(screen.getByText('Tokuju')).toBeInTheDocument();
    expect(screen.getByText('Juyo')).toBeInTheDocument();
  });

  it('renders alternative candidates (up to 3)', async () => {
    mockFetchSuccess();

    const candidates = [
      { artisan_id: 'MAS001', name_romaji: 'Masamune I', school: 'Soshu', retrieval_method: 'kanji_exact' },
      { artisan_id: 'MAS002', name_romaji: 'Masamune II', school: 'Soshu' },
      { artisan_id: 'MAS003', name_romaji: 'Masamune III' },
      { artisan_id: 'MAS004', name_romaji: 'Masamune IV' }, // should be excluded (only first 3 shown)
    ];

    render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" candidates={candidates} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('artisan-candidates')).toBeInTheDocument();
    });

    expect(screen.getByText('MAS001')).toBeInTheDocument();
    expect(screen.getByText('MAS002')).toBeInTheDocument();
    expect(screen.getByText('MAS003')).toBeInTheDocument();
    expect(screen.queryByText('MAS004')).not.toBeInTheDocument();
  });

  it('renders "View Profile" link with correct href', async () => {
    mockFetchSuccess();

    render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" />
    );

    await waitFor(() => {
      const link = screen.getByTestId('view-profile-link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/artists/MAS590');
    });
  });

  it('re-fetches when artisanId prop changes', async () => {
    mockFetchSuccess();

    const { rerender } = render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/artisan/MAS590');
    });

    // Change artisanId
    const newArtisan = { ...mockArtisan, code: 'KUN232', name_kanji: '国広', name_romaji: 'Kunihiro' };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ artisan: newArtisan }),
    });

    rerender(
      <ArtisanDetailsPanel artisanId="KUN232" confidence="HIGH" />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/artisan/KUN232');
    });
  });

  it('skips fetch for UNKNOWN artisan', () => {
    render(
      <ArtisanDetailsPanel artisanId="UNKNOWN" confidence="LOW" />
    );

    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
    expect(screen.getByText('Flagged for later identification')).toBeInTheDocument();
  });

  it('renders "School" badge for school codes', async () => {
    const schoolArtisan = { ...mockArtisan, is_school_code: true };
    mockFetchSuccess(schoolArtisan);

    render(
      <ArtisanDetailsPanel artisanId="NS-SOSHU" confidence="HIGH" />
    );

    await waitFor(() => {
      // The school badge has specific styling distinct from the grid label
      const schoolElements = screen.getAllByText('School');
      // At least one should be the badge (uppercase tracking-wider bg-surface)
      const badge = schoolElements.find(el =>
        el.className.includes('uppercase') && el.className.includes('bg-surface')
      );
      expect(badge).toBeDefined();
    });
  });

  // --- Edge Cases ---

  it('shows error state when fetch returns 500', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

    render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load artisan details')).toBeInTheDocument();
    });
  });

  it('shows fallback with code when fetch returns 404', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });

    render(
      <ArtisanDetailsPanel artisanId="BOGUS999" confidence="HIGH" />
    );

    await waitFor(() => {
      expect(screen.getByText('BOGUS999')).toBeInTheDocument();
      expect(screen.getByText('No artisan data found')).toBeInTheDocument();
    });
  });

  it('shows error state when fetch throws network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load artisan details')).toBeInTheDocument();
    });
  });

  it('still shows elite bar when elite_factor is 0', async () => {
    const zeroEliteArtisan = { ...mockArtisan, elite_factor: 0, elite_count: 0 };
    mockFetchSuccess(zeroEliteArtisan);

    render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" />
    );

    await waitFor(() => {
      expect(screen.getByTestId('elite-percentage')).toHaveTextContent('0.00');
      expect(screen.getByTestId('elite-bar')).toBeInTheDocument();
    });
  });

  it('hides cert grid when all cert counts are 0', async () => {
    const noCertsArtisan = {
      ...mockArtisan,
      kokuho_count: 0,
      jubun_count: 0,
      jubi_count: 0,
      gyobutsu_count: 0,
      tokuju_count: 0,
      juyo_count: 0,
    };
    mockFetchSuccess(noCertsArtisan);

    render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" />
    );

    await waitFor(() => {
      expect(screen.getByTestId('artisan-details-panel')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('cert-counts')).not.toBeInTheDocument();
  });

  it('hides candidates section when candidates is null', async () => {
    mockFetchSuccess();

    render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" candidates={null} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('artisan-details-panel')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('artisan-candidates')).not.toBeInTheDocument();
  });

  it('hides candidates section when candidates is empty array', async () => {
    mockFetchSuccess();

    render(
      <ArtisanDetailsPanel artisanId="MAS590" confidence="HIGH" candidates={[]} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('artisan-details-panel')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('artisan-candidates')).not.toBeInTheDocument();
  });
});
