import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArtistPageClient } from '@/app/artists/[slug]/ArtistPageClient';
import type { ArtisanPageResponse } from '@/app/api/artisan/[code]/route';

// ─── Mocks for dependencies not under test ──────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/components/artisan/PrestigePyramid', () => ({
  PrestigePyramid: () => <div data-testid="prestige-pyramid" />,
}));
vi.mock('@/components/artisan/EliteFactorDisplay', () => ({
  EliteFactorDisplay: () => <div data-testid="elite-factor" />,
}));
vi.mock('@/components/artisan/FormDistributionBar', () => ({
  FormDistributionBar: () => <div data-testid="form-distribution" />,
}));
vi.mock('@/components/artisan/MeiDistributionBar', () => ({
  MeiDistributionBar: () => <div data-testid="mei-distribution" />,
}));
vi.mock('@/components/artisan/SectionJumpNav', () => ({
  SectionJumpNav: () => <div data-testid="section-jump-nav" />,
}));
vi.mock('@/components/artisan/ArtisanListings', () => ({
  ArtisanListings: () => <div data-testid="artisan-listings" />,
}));
vi.mock('@/components/artisan/RelatedArtisans', () => ({
  RelatedArtisans: () => <div data-testid="related-artisans" />,
}));
vi.mock('@/lib/artisan/displayName', () => ({
  getArtisanDisplayParts: (name: string | null) => ({ prefix: null, name: name || 'Unknown' }),
  getArtisanAlias: () => null,
}));

// ─── Mocks under test — auth, subscription, modals ──────────────────────────

const mockUseAuth = vi.fn();
vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockRequireFeature = vi.fn();
vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => ({ requireFeature: mockRequireFeature }),
}));

let capturedSaveModalProps: Record<string, unknown> = {};
vi.mock('@/components/browse/SaveSearchModal', () => ({
  SaveSearchModal: (props: Record<string, unknown>) => {
    capturedSaveModalProps = props;
    return props.isOpen ? <div data-testid="save-search-modal" /> : null;
  },
}));

let capturedLoginModalProps: Record<string, unknown> = {};
vi.mock('@/components/auth/LoginModal', () => ({
  LoginModal: (props: Record<string, unknown>) => {
    capturedLoginModalProps = props;
    return props.isOpen ? <div data-testid="login-modal" /> : null;
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTestData(overrides: Partial<ArtisanPageResponse> = {}): ArtisanPageResponse {
  return {
    entity: {
      code: 'MAS590',
      name_romaji: 'Masamune',
      name_kanji: '正宗',
      school: 'Soshu',
      province: 'Sagami',
      era: 'Kamakura',
      period: 'late Kamakura',
      generation: null,
      teacher: null,
      entity_type: 'smith',
      is_school_code: false,
      slug: 'masamune-MAS590',
      fujishiro: null,
      toko_taikan: null,
      specialties: null,
    },
    certifications: {
      kokuho_count: 0,
      jubun_count: 0,
      jubi_count: 0,
      gyobutsu_count: 0,
      tokuju_count: 0,
      juyo_count: 0,
      total_items: 0,
      elite_count: 0,
      elite_factor: 0,
    },
    rankings: { elite_percentile: null, toko_taikan_percentile: null },
    profile: null,
    stats: null,
    lineage: { teacher: null, students: [] },
    related: [],
    denrai: [],
    heroImage: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Artist Page — Alert Button', () => {
  beforeEach(() => {
    capturedSaveModalProps = {};
    capturedLoginModalProps = {};
    mockUseAuth.mockReturnValue({ user: null, isAdmin: false, isLoading: false });
    mockRequireFeature.mockReturnValue(true);
    // Resolve listings fetch so button becomes visible
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ listings: [] }),
    });
  });

  it('renders alert button after listings load (even when 0 listings)', async () => {
    render(<ArtistPageClient data={makeTestData()} />);

    await waitFor(() => {
      expect(screen.getByText('Set alert for new listings')).toBeTruthy();
    });
  });

  it('renders alert button alongside "Browse all" when listings exist', async () => {
    // Return some listings from the fetch
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ listings: [{ id: 1 }] }),
    });

    render(<ArtistPageClient data={makeTestData()} />);

    await waitFor(() => {
      expect(screen.getByText('Browse all listings')).toBeTruthy();
      expect(screen.getByText('Set alert for new listings')).toBeTruthy();
    });
  });

  it('does not render alert button while listings are still loading', () => {
    // Never-resolving fetch — listings stay null
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    render(<ArtistPageClient data={makeTestData()} />);

    expect(screen.queryByText('Set alert for new listings')).toBeNull();
  });

  it('opens login modal when user is not authenticated', async () => {
    mockUseAuth.mockReturnValue({ user: null, isAdmin: false, isLoading: false });

    render(<ArtistPageClient data={makeTestData()} />);

    await waitFor(() => {
      expect(screen.getByText('Set alert for new listings')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Set alert for new listings'));

    expect(screen.getByTestId('login-modal')).toBeTruthy();
    // Save modal should NOT open
    expect(screen.queryByTestId('save-search-modal')).toBeNull();
  });

  it('checks subscription access when user is authenticated', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, isAdmin: false, isLoading: false });
    mockRequireFeature.mockReturnValue(false); // paywall blocks

    render(<ArtistPageClient data={makeTestData()} />);

    await waitFor(() => {
      expect(screen.getByText('Set alert for new listings')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Set alert for new listings'));

    expect(mockRequireFeature).toHaveBeenCalledWith('saved_searches');
    // Neither modal should open — requireFeature shows paywall internally
    expect(screen.queryByTestId('save-search-modal')).toBeNull();
    expect(screen.queryByTestId('login-modal')).toBeNull();
  });

  it('opens save search modal when authenticated and authorized', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, isAdmin: false, isLoading: false });
    mockRequireFeature.mockReturnValue(true);

    render(<ArtistPageClient data={makeTestData()} />);

    await waitFor(() => {
      expect(screen.getByText('Set alert for new listings')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Set alert for new listings'));

    expect(screen.getByTestId('save-search-modal')).toBeTruthy();
  });

  it('passes correct criteria to SaveSearchModal (artisan code + available tab)', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, isAdmin: false, isLoading: false });
    mockRequireFeature.mockReturnValue(true);

    render(<ArtistPageClient data={makeTestData()} />);

    await waitFor(() => {
      expect(screen.getByText('Set alert for new listings')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Set alert for new listings'));

    expect(capturedSaveModalProps.criteria).toEqual({
      query: 'MAS590',
      tab: 'available',
    });
  });

  it('uses the entity code from props, not a hardcoded value', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, isAdmin: false, isLoading: false });
    mockRequireFeature.mockReturnValue(true);

    const data = makeTestData({
      entity: {
        ...makeTestData().entity,
        code: 'YOS463',
        name_romaji: 'Yoshimitsu',
      },
    });

    render(<ArtistPageClient data={data} />);

    await waitFor(() => {
      expect(screen.getByText('Set alert for new listings')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Set alert for new listings'));

    expect(capturedSaveModalProps.criteria).toEqual({
      query: 'YOS463',
      tab: 'available',
    });
  });
});
