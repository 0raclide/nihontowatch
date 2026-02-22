import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/i18n/LocaleContext', async () => {
  const en = await import('@/i18n/locales/en.json').then(m => m.default);
  const t = (key: string, params?: Record<string, string | number>) => {
    let value: string = (en as Record<string, string>)[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return value;
  };
  return {
    useLocale: () => ({ locale: 'en', setLocale: () => {}, t }),
    LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

import { RelatedArtisans } from '@/components/artisan/RelatedArtisans';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const makeArtisan = (overrides: Record<string, unknown> = {}) => ({
  code: 'TEST001',
  name_romaji: 'Testsmith',
  name_kanji: '試刀工',
  slug: 'testsmith-TEST001',
  school: 'Bizen',
  kokuho_count: 0,
  jubun_count: 0,
  jubi_count: 0,
  gyobutsu_count: 0,
  juyo_count: 5,
  tokuju_count: 2,
  elite_factor: 0.15,
  available_count: 0,
  ...overrides,
});

describe('RelatedArtisans', () => {
  it('renders nothing when artisans array is empty', () => {
    const { container } = render(
      <RelatedArtisans artisans={[]} schoolName="Bizen" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders artisan name and kanji', () => {
    render(
      <RelatedArtisans
        artisans={[makeArtisan()]}
        schoolName="Bizen"
      />
    );

    expect(screen.getByText('Testsmith')).toBeTruthy();
    expect(screen.getByText('試刀工')).toBeTruthy();
  });

  it('renders school name in description', () => {
    render(
      <RelatedArtisans
        artisans={[makeArtisan()]}
        schoolName="Bizen"
      />
    );

    expect(screen.getByText(/Other artisans of the Bizen school/)).toBeTruthy();
  });

  it('renders certification counts', () => {
    render(
      <RelatedArtisans
        artisans={[makeArtisan({ tokuju_count: 3, juyo_count: 12 })]}
        schoolName={null}
      />
    );

    expect(screen.getByText(/3 Tokubetsu/)).toBeTruthy();
    expect(screen.getByText(/12 Jūyō Tōken/)).toBeTruthy();
  });

  it('does not render zero certification counts', () => {
    render(
      <RelatedArtisans
        artisans={[makeArtisan({ kokuho_count: 0, jubun_count: 0, jubi_count: 0, gyobutsu_count: 0, tokuju_count: 0, juyo_count: 0 })]}
        schoolName={null}
      />
    );

    expect(screen.queryByText(/Kokuhō/)).toBeNull();
    expect(screen.queryByText(/Bunkazai/)).toBeNull();
    expect(screen.queryByText(/Jūyō Tōken/)).toBeNull();
    expect(screen.queryByText(/Tokubetsu Jūyō/)).toBeNull();
  });

  it('renders "for sale" when available_count > 0', () => {
    render(
      <RelatedArtisans
        artisans={[makeArtisan({ available_count: 3 })]}
        schoolName={null}
      />
    );

    expect(screen.getByText('3 for sale')).toBeTruthy();
  });

  it('does not render "for sale" when available_count is 0', () => {
    render(
      <RelatedArtisans
        artisans={[makeArtisan({ available_count: 0 })]}
        schoolName={null}
      />
    );

    expect(screen.queryByText(/for sale/)).toBeNull();
  });

  it('does not render "for sale" when available_count is undefined', () => {
    const artisan = makeArtisan();
    delete (artisan as Record<string, unknown>).available_count;

    render(
      <RelatedArtisans artisans={[artisan]} schoolName={null} />
    );

    expect(screen.queryByText(/for sale/)).toBeNull();
  });

  it('"for sale" text has emerald color class', () => {
    render(
      <RelatedArtisans
        artisans={[makeArtisan({ available_count: 5 })]}
        schoolName={null}
      />
    );

    const marketText = screen.getByText('5 for sale');
    expect(marketText.className).toContain('text-emerald');
  });

  it('renders multiple artisans with correct links', () => {
    const artisans = [
      makeArtisan({ code: 'A001', name_romaji: 'Alpha', slug: 'alpha-A001' }),
      makeArtisan({ code: 'B002', name_romaji: 'Beta', slug: 'beta-B002', available_count: 2 }),
      makeArtisan({ code: 'C003', name_romaji: 'Gamma', slug: 'gamma-C003' }),
    ];

    render(
      <RelatedArtisans artisans={artisans} schoolName="Bizen" />
    );

    // All three should render
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();

    // Only Beta should show market count
    expect(screen.getByText('2 for sale')).toBeTruthy();

    // Links should point to correct slugs
    const links = screen.getAllByRole('link');
    expect(links[0].getAttribute('href')).toBe('/artists/alpha-A001');
    expect(links[1].getAttribute('href')).toBe('/artists/beta-B002');
    expect(links[2].getAttribute('href')).toBe('/artists/gamma-C003');
  });

  it('renders kokuho and jubun with stronger font weight', () => {
    render(
      <RelatedArtisans
        artisans={[makeArtisan({ kokuho_count: 1, jubun_count: 2 })]}
        schoolName={null}
      />
    );

    const kokuhoEl = screen.getByText(/1 Kokuhō/);
    expect(kokuhoEl.className).toContain('font-semibold');

    const jubunEl = screen.getByText(/2 Jūyō Bunkazai/);
    expect(jubunEl.className).toContain('font-semibold');
  });
});
