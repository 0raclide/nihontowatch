import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArtistPageClient } from '@/app/artists/[slug]/ArtistPageClient';
import type { ArtisanPageResponse } from '@/app/api/artisan/[code]/route';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock sub-components that aren't relevant to the Students section test
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

// Mock displayName
vi.mock('@/lib/artisan/displayName', () => ({
  getArtisanDisplayParts: (name: string | null) => ({
    prefix: null,
    name: name || 'Unknown',
  }),
}));

// Suppress fetch calls for listings
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ listings: [] }),
  });
});

function makeTestData(overrides: Partial<ArtisanPageResponse> = {}): ArtisanPageResponse {
  return {
    entity: {
      code: 'MIT281',
      name_romaji: 'Mitsutada',
      name_kanji: '光忠',
      school: 'Bizen',
      province: 'Bizen',
      era: 'Kamakura',
      period: 'mid-Kamakura',
      generation: null,
      teacher: 'Mitsutada I',
      entity_type: 'smith',
      is_school_code: false,
      slug: 'mitsutada-MIT281',
      fujishiro: null,
      toko_taikan: null,
      specialties: null,
    },
    certifications: {
      kokuho_count: 3,
      jubun_count: 16,
      jubi_count: 13,
      gyobutsu_count: 2,
      tokuju_count: 10,
      juyo_count: 18,
      total_items: 62,
      elite_count: 44,
      elite_factor: 0.625,
    },
    rankings: {
      elite_percentile: 99,
      toko_taikan_percentile: null,
    },
    profile: null,
    stats: null,
    lineage: {
      teacher: null,
      students: [],
    },
    related: [],
    denrai: [],
    heroImage: null,
    ...overrides,
  };
}

function makeStudent(overrides: Record<string, unknown> = {}) {
  return {
    code: 'STU001',
    name_romaji: 'Test Student',
    name_kanji: '試弟子',
    slug: 'test-student-STU001',
    school: 'Bizen',
    kokuho_count: 0,
    jubun_count: 0,
    jubi_count: 0,
    gyobutsu_count: 0,
    tokuju_count: 2,
    juyo_count: 8,
    elite_factor: 0.12,
    available_count: 0,
    ...overrides,
  };
}

describe('ArtistPageClient — Students Section', () => {
  it('renders student names as individual rows', () => {
    const data = makeTestData({
      lineage: {
        teacher: null,
        students: [
          makeStudent({ code: 'A001', name_romaji: 'Kunimitsu', slug: 'kunimitsu-A001' }),
          makeStudent({ code: 'B002', name_romaji: 'Kagemitsu', slug: 'kagemitsu-B002' }),
        ],
      },
    });

    render(<ArtistPageClient data={data} />);

    expect(screen.getByText('Kunimitsu')).toBeTruthy();
    expect(screen.getByText('Kagemitsu')).toBeTruthy();
  });

  it('renders "Students (N)" label for multiple students', () => {
    const data = makeTestData({
      lineage: {
        teacher: null,
        students: [
          makeStudent({ code: 'A001', name_romaji: 'Student A' }),
          makeStudent({ code: 'B002', name_romaji: 'Student B' }),
          makeStudent({ code: 'C003', name_romaji: 'Student C' }),
        ],
      },
    });

    render(<ArtistPageClient data={data} />);
    expect(screen.getByText('Students (3)')).toBeTruthy();
  });

  it('renders "Student" label for single student', () => {
    const data = makeTestData({
      lineage: {
        teacher: null,
        students: [makeStudent()],
      },
    });

    render(<ArtistPageClient data={data} />);
    expect(screen.getByText('Student')).toBeTruthy();
  });

  it('renders student kanji names', () => {
    const data = makeTestData({
      lineage: {
        teacher: null,
        students: [
          makeStudent({ name_kanji: '景光' }),
        ],
      },
    });

    render(<ArtistPageClient data={data} />);
    expect(screen.getByText('景光')).toBeTruthy();
  });

  it('renders all 6 student certification types when non-zero', () => {
    const data = makeTestData({
      lineage: {
        teacher: null,
        students: [
          makeStudent({
            kokuho_count: 1,
            jubun_count: 3,
            jubi_count: 2,
            gyobutsu_count: 1,
            tokuju_count: 5,
            juyo_count: 15,
          }),
        ],
      },
    });

    render(<ArtistPageClient data={data} />);
    expect(screen.getByText(/1 kokuhō/)).toBeTruthy();
    expect(screen.getByText(/3 jubun/)).toBeTruthy();
    expect(screen.getByText(/2 jubi/)).toBeTruthy();
    expect(screen.getByText(/1 gyobutsu/)).toBeTruthy();
    expect(screen.getByText(/5 tokujū/)).toBeTruthy();
    expect(screen.getByText(/15 jūyō/)).toBeTruthy();
  });

  it('does not render zero certification counts for students', () => {
    const data = makeTestData({
      lineage: {
        teacher: null,
        students: [
          makeStudent({
            kokuho_count: 0,
            jubun_count: 0,
            jubi_count: 0,
            gyobutsu_count: 0,
            tokuju_count: 0,
            juyo_count: 0,
          }),
        ],
      },
    });

    render(<ArtistPageClient data={data} />);
    expect(screen.queryByText(/kokuhō/)).toBeNull();
    expect(screen.queryByText(/jubun/)).toBeNull();
    expect(screen.queryByText(/jubi/)).toBeNull();
    expect(screen.queryByText(/gyobutsu/)).toBeNull();
    expect(screen.queryByText(/tokujū/)).toBeNull();
    expect(screen.queryByText(/jūyō/)).toBeNull();
  });

  it('renders kokuho and jubun with semibold, jubi and gyobutsu with medium weight', () => {
    const data = makeTestData({
      lineage: {
        teacher: null,
        students: [
          makeStudent({ kokuho_count: 1, jubun_count: 2, jubi_count: 3, gyobutsu_count: 1 }),
        ],
      },
    });

    render(<ArtistPageClient data={data} />);

    const kokuhoEl = screen.getByText(/1 kokuhō/);
    expect(kokuhoEl.className).toContain('font-semibold');

    const jubunEl = screen.getByText(/2 jubun/);
    expect(jubunEl.className).toContain('font-semibold');

    const jubiEl = screen.getByText(/3 jubi/);
    expect(jubiEl.className).toContain('font-medium');

    const gyobutsuEl = screen.getByText(/1 gyobutsu/);
    expect(gyobutsuEl.className).toContain('font-medium');
  });

  it('renders "on the market" text for students with available listings', () => {
    const data = makeTestData({
      lineage: {
        teacher: null,
        students: [
          makeStudent({ code: 'A001', name_romaji: 'With Listings', available_count: 4 }),
          makeStudent({ code: 'B002', name_romaji: 'No Listings', available_count: 0 }),
        ],
      },
    });

    render(<ArtistPageClient data={data} />);

    expect(screen.getByText('4 on the market')).toBeTruthy();
    // Should only appear once (not for the student with 0)
    const marketTexts = screen.queryAllByText(/on the market/);
    expect(marketTexts).toHaveLength(1);
  });

  it('"on the market" text has emerald color class', () => {
    const data = makeTestData({
      lineage: {
        teacher: null,
        students: [
          makeStudent({ available_count: 2 }),
        ],
      },
    });

    render(<ArtistPageClient data={data} />);

    const marketText = screen.getByText('2 on the market');
    expect(marketText.className).toContain('text-emerald');
  });

  it('renders student links pointing to correct artist profile URLs', () => {
    const data = makeTestData({
      lineage: {
        teacher: null,
        students: [
          makeStudent({ code: 'KAG001', name_romaji: 'Kagemitsu', slug: 'kagemitsu-KAG001' }),
        ],
      },
    });

    render(<ArtistPageClient data={data} />);

    const link = screen.getByText('Kagemitsu').closest('a');
    expect(link?.getAttribute('href')).toBe('/artists/kagemitsu-KAG001');
  });

  it('does not render lineage section when no teacher and no students', () => {
    const data = makeTestData({
      lineage: { teacher: null, students: [] },
    });

    render(<ArtistPageClient data={data} />);
    expect(screen.queryByText('Lineage')).toBeNull();
  });
});
