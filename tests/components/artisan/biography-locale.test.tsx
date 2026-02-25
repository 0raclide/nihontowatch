/**
 * Tests for artist biography locale switching.
 *
 * Verifies that the Overview section on artist pages switches between
 * English (profile_md) and Japanese (profile_md_ja) based on locale.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// ---- Locale mock ----

let mockLocale = 'en';

vi.mock('@/i18n/LocaleContext', async () => {
  const en = await import('@/i18n/locales/en.json').then(m => m.default);
  const ja = await import('@/i18n/locales/ja.json').then(m => m.default);
  return {
    useLocale: () => {
      const strings = mockLocale === 'ja' ? ja : en;
      const fallback = mockLocale !== 'en' ? en : null;
      const t = (key: string, params?: Record<string, string | number>) => {
        let value: string = (strings as Record<string, string>)[key]
          ?? (fallback as Record<string, string> | null)?.[key]
          ?? key;
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          }
        }
        return value;
      };
      return { locale: mockLocale, setLocale: () => {}, t };
    },
  };
});

// ---- Minimal mocks for ArtistPageClient dependencies ----

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => React.createElement('img', props),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', props, children),
}));

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({ user: null, isAdmin: false }),
}));

vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    tier: 'free',
    canAccessFeature: () => false,
    requireFeature: () => false,
    isPro: false,
    isCollector: false,
    isInnerCircle: false,
    isDealer: false,
  }),
}));

vi.mock('@/components/glossary/HighlightedMarkdown', () => ({
  HighlightedMarkdown: ({ content }: { content: string }) =>
    React.createElement('div', { 'data-testid': 'biography-content' }, content),
}));

vi.mock('@/components/artisan/PrestigePyramid', () => ({
  PrestigePyramid: () => null,
}));

vi.mock('@/components/artisan/EliteFactorDisplay', () => ({
  EliteFactorDisplay: () => null,
}));

vi.mock('@/components/artisan/ProvenancePyramid', () => ({
  ProvenancePyramid: () => null,
  ProvenanceFactorDisplay: () => null,
}));

vi.mock('@/lib/artisan/provenanceMock', () => ({
  computeProvenanceAnalysis: () => ({ factor: 0, percentile: null, confidence: 'low', n: 0 }),
}));

vi.mock('@/components/artisan/FormDistributionBar', () => ({
  FormDistributionBar: () => null,
}));

vi.mock('@/components/artisan/MeiDistributionBar', () => ({
  MeiDistributionBar: () => null,
}));

vi.mock('@/components/artisan/SectionJumpNav', () => ({
  SectionJumpNav: () => null,
}));

vi.mock('@/components/artisan/ArtisanListings', () => ({
  ArtisanListings: () => null,
}));

vi.mock('@/components/artisan/RelatedArtisans', () => ({
  RelatedArtisans: () => null,
}));

vi.mock('@/components/artisan/CatalogueShowcase', () => ({
  CatalogueShowcase: () => null,
}));

vi.mock('@/components/ui/Breadcrumbs', () => ({
  Breadcrumbs: () => null,
}));

vi.mock('@/components/browse/SaveSearchModal', () => ({
  SaveSearchModal: () => null,
}));

vi.mock('@/components/auth/LoginModal', () => ({
  LoginModal: () => null,
}));

// ---- Test data ----

const EN_BIOGRAPHY = 'Masamune is widely regarded as the greatest swordsmith in Japanese history.';
const JA_BIOGRAPHY = '正宗は相模国鎌倉に住し、新藤五国光の門下に学んだ。';

function makeTestData(overrides?: { profile_md?: string; profile_md_ja?: string | null }) {
  return {
    entity: {
      code: 'MAS590',
      name_romaji: 'Masamune',
      name_kanji: '正宗',
      school: 'Sōshū',
      school_code: 'NS-Soshu',
      school_kanji: '相州',
      school_tradition: null,
      province: 'Sagami',
      era: 'Kamakura',
      period: 'Late Kamakura',
      generation: null,
      teacher: 'Kunimitsu',
      entity_type: 'smith' as const,
      is_school_code: false,
      slug: 'masamune-MAS590',
      fujishiro: 'Saijō-saku',
      toko_taikan: null,
      specialties: null,
    },
    certifications: {
      kokuho_count: 2,
      jubun_count: 0,
      jubi_count: 3,
      gyobutsu_count: 1,
      tokuju_count: 5,
      juyo_count: 10,
      total_items: 50,
      elite_count: 21,
      elite_factor: 0.42,
    },
    rankings: {
      elite_percentile: 99,
      toko_taikan_percentile: null,
      provenance_percentile: null,
    },
    provenance: {
      factor: null,
      count: 0,
      apex: 0,
    },
    profile: {
      profile_md: overrides?.profile_md ?? EN_BIOGRAPHY,
      profile_md_ja: overrides?.profile_md_ja !== undefined ? overrides.profile_md_ja : JA_BIOGRAPHY,
      hook: null,
      setsumei_count: 0,
      generated_at: '',
    },
    stats: null,
    lineage: { teacher: null, students: [] },
    related: [],
    denrai: [],
    denraiGrouped: [],
    heroImage: null,
  };
}

// ---- Tests ----

describe('Artist Biography locale switching', () => {
  beforeEach(() => {
    mockLocale = 'en';
    cleanup();
  });

  it('renders English biography when locale is EN', async () => {
    const { ArtistPageClient } = await import('@/app/artists/[slug]/ArtistPageClient');
    const { container } = render(React.createElement(ArtistPageClient, { data: makeTestData() }));

    const bio = screen.getByTestId('biography-content');
    expect(bio.textContent).toBe(EN_BIOGRAPHY);
  });

  it('renders Japanese biography when locale is JA and profile_md_ja exists', async () => {
    mockLocale = 'ja';
    const { ArtistPageClient } = await import('@/app/artists/[slug]/ArtistPageClient');
    const { container } = render(React.createElement(ArtistPageClient, { data: makeTestData() }));

    const bio = screen.getByTestId('biography-content');
    expect(bio.textContent).toBe(JA_BIOGRAPHY);
  });

  it('falls back to English when locale is JA but profile_md_ja is null', async () => {
    mockLocale = 'ja';
    const { ArtistPageClient } = await import('@/app/artists/[slug]/ArtistPageClient');
    const { container } = render(
      React.createElement(ArtistPageClient, { data: makeTestData({ profile_md_ja: null }) })
    );

    const bio = screen.getByTestId('biography-content');
    expect(bio.textContent).toBe(EN_BIOGRAPHY);
  });

  it('does not render biography section when profile_md is empty and profile_md_ja is null', async () => {
    const data = makeTestData({ profile_md: '', profile_md_ja: null });
    // When both are empty/null, profile should be null from the builder.
    // But here we test the guard: profile_md is empty string → falsy → section hidden
    data.profile = { profile_md: '', profile_md_ja: null, hook: null, setsumei_count: 0, generated_at: '' };

    const { ArtistPageClient } = await import('@/app/artists/[slug]/ArtistPageClient');
    render(React.createElement(ArtistPageClient, { data }));

    expect(screen.queryByTestId('biography-content')).toBeNull();
  });
});
