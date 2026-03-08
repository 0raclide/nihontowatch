/**
 * CatalogMatchPanel Tests
 *
 * Tests the catalog match panel that auto-queries Yuhinkai for oshigata
 * images when cert + artisan are set. Verifies:
 * - Auto-fetches on mount with correct params
 * - Renders oshigata card grid
 * - Volume pills filter client-side (no re-fetch)
 * - Selecting a card calls onPrefill with mapped fields
 * - Selected state shows confirmation strip
 * - Change button re-opens grid
 * - Empty state message
 * - Loading state
 * - AbortController cancels stale requests
 * - Image fallback on error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CatalogMatchPanel } from '@/components/dealer/CatalogMatchPanel';

vi.mock('@/i18n/LocaleContext', () => ({
  useLocale: () => ({
    locale: 'en',
    setLocale: () => {},
    t: (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        'dealer.catalogMatch': 'NBTHK Catalog Match',
        'dealer.catalogMatchEmpty': `No catalog records found for ${params?.artisan ?? ''} in ${params?.collection ?? ''}`,
        'dealer.catalogMatchLoading': 'Searching NBTHK catalog...',
        'dealer.catalogMatchSelected': 'Catalog record selected — fields auto-filled',
        'dealer.catalogMatchChange': 'Change',
        'dealer.catalogSession': `Session ${params?.volume ?? ''}`,
        'dealer.catalogSessionAll': 'All sessions',
      };
      return map[key] ?? key;
    },
  }),
}));

const mockItems = [
  {
    object_uuid: 'uuid-1',
    collection: 'Juyo',
    volume: 45,
    item_number: 12,
    image_urls: ['https://example.com/Juyo/45_12_oshigata.jpg', 'https://example.com/Juyo/45_12_setsumei.jpg'],
    form_type: 'Katana',
    nagasa_cm: 71.5,
    sori_cm: 1.8,
    motohaba_cm: 3.1,
    sakihaba_cm: 2.2,
    mei_status: 'signed',
    mei_kanji: '備前国長船住景光',
    period: 'Kamakura',
    artisan_kanji: '正宗',
    item_type: 'token',
    school: 'Soshu',
    province: 'Sagami',
    nakago_condition: 'Ubu',
  },
  {
    object_uuid: 'uuid-2',
    collection: 'Juyo',
    volume: 50,
    item_number: 5,
    image_urls: ['https://example.com/Juyo/50_5_oshigata.jpg'],
    form_type: 'Tanto',
    nagasa_cm: 28.3,
    sori_cm: 0.1,
    motohaba_cm: null,
    sakihaba_cm: null,
    mei_status: 'unsigned',
    mei_kanji: '正宗',
    period: 'Kamakura',
    artisan_kanji: '正宗',
    item_type: 'token',
    school: null,
    province: null,
    nakago_condition: 'O-Suriage',
  },
];

const mockVolumes = [
  { volume: 45, count: 3 },
  { volume: 50, count: 2 },
];

function mockFetchSuccess(items = mockItems, volumes = mockVolumes, total = 5) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items, volumes, total }),
  });
}

function mockFetchEmpty() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items: [], volumes: [], total: 0 }),
  });
}

describe('CatalogMatchPanel', () => {
  const defaultProps = {
    certType: 'Juyo',
    artisanId: 'MAS590',
    artisanName: 'Masamune',
    onPrefill: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('auto-fetches on mount with correct params', async () => {
    const fetchSpy = mockFetchSuccess();
    global.fetch = fetchSpy;

    render(<CatalogMatchPanel {...defaultProps} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('artisan_code=MAS590');
      expect(url).toContain('collection=Juyo');
    });
  });

  it('passes AbortController signal to fetch', async () => {
    const fetchSpy = mockFetchSuccess();
    global.fetch = fetchSpy;

    render(<CatalogMatchPanel {...defaultProps} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const options = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });
  });

  it('aborts previous fetch when artisanId changes', async () => {
    let resolveFirst: (v: unknown) => void;
    const firstFetch = new Promise(r => { resolveFirst = r; });
    const secondFetch = mockFetchSuccess();

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return firstFetch;
      return secondFetch();
    });

    const { rerender } = render(<CatalogMatchPanel {...defaultProps} />);

    // Change artisanId — should abort first request
    rerender(<CatalogMatchPanel {...defaultProps} artisanId="KUN232" />);

    // Verify signal was aborted (first call's signal)
    await waitFor(() => {
      const firstSignal = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.signal as AbortSignal;
      expect(firstSignal.aborted).toBe(true);
    });

    // Resolve first fetch after abort — should not update state
    resolveFirst!({
      ok: true,
      json: async () => ({ items: [{ ...mockItems[0], object_uuid: 'stale-uuid' }], volumes: [], total: 1 }),
    });

    // Wait for second fetch to complete
    await waitFor(() => {
      expect(screen.getByText('Vol. 45 #12')).toBeTruthy();
    });

    // Stale data should not appear
    expect(screen.queryByText('stale-uuid')).toBeNull();
  });

  it('maps Tokubetsu Juyo → Tokuju collection', async () => {
    const fetchSpy = mockFetchSuccess();
    global.fetch = fetchSpy;

    render(<CatalogMatchPanel {...defaultProps} certType="Tokubetsu Juyo" />);

    await waitFor(() => {
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('collection=Tokuju');
    });
  });

  it('renders oshigata cards after fetch', async () => {
    global.fetch = mockFetchSuccess();

    render(<CatalogMatchPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 45 #12')).toBeTruthy();
      expect(screen.getByText('Vol. 50 #5')).toBeTruthy();
    });
  });

  it('shows count badge', async () => {
    global.fetch = mockFetchSuccess();

    render(<CatalogMatchPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeTruthy();
    });
  });

  it('renders volume pills when >1 volume', async () => {
    global.fetch = mockFetchSuccess();

    render(<CatalogMatchPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('All sessions')).toBeTruthy();
      expect(screen.getByText(/Session 45/)).toBeTruthy();
      expect(screen.getByText(/Session 50/)).toBeTruthy();
    });
  });

  it('does not render volume pills when only 1 volume', async () => {
    global.fetch = mockFetchSuccess(mockItems, [{ volume: 45, count: 5 }]);

    render(<CatalogMatchPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 45 #12')).toBeTruthy();
    });
    expect(screen.queryByText('All sessions')).toBeNull();
  });

  it('filters items client-side when volume pill clicked (no re-fetch)', async () => {
    const fetchSpy = mockFetchSuccess();
    global.fetch = fetchSpy;

    render(<CatalogMatchPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 45 #12')).toBeTruthy();
      expect(screen.getByText('Vol. 50 #5')).toBeTruthy();
    });

    // Click volume 45 pill
    fireEvent.click(screen.getByText(/Session 45/));

    // Vol 50 item should be filtered out
    expect(screen.queryByText('Vol. 50 #5')).toBeNull();
    // Vol 45 item should remain
    expect(screen.getByText('Vol. 45 #12')).toBeTruthy();

    // Should NOT have re-fetched — still just 1 call from mount
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('"All sessions" pill shows all items after filtering', async () => {
    global.fetch = mockFetchSuccess();

    render(<CatalogMatchPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 45 #12')).toBeTruthy();
    });

    // Filter to volume 45
    fireEvent.click(screen.getByText(/Session 45/));
    expect(screen.queryByText('Vol. 50 #5')).toBeNull();

    // Click "All sessions"
    fireEvent.click(screen.getByText('All sessions'));
    expect(screen.getByText('Vol. 50 #5')).toBeTruthy();
    expect(screen.getByText('Vol. 45 #12')).toBeTruthy();
  });

  it('calls onPrefill with mapped fields when card is clicked', async () => {
    global.fetch = mockFetchSuccess();
    const onPrefill = vi.fn();

    render(<CatalogMatchPanel {...defaultProps} onPrefill={onPrefill} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 45 #12')).toBeTruthy();
    });

    const card = screen.getByText('Vol. 45 #12').closest('button')!;
    fireEvent.click(card);

    expect(onPrefill).toHaveBeenCalledTimes(1);
    const fields = onPrefill.mock.calls[0][0];
    expect(fields.itemType).toBe('katana');
    expect(fields.nagasaCm).toBe('71.5');
    expect(fields.soriCm).toBe('1.8');
    expect(fields.motohabaCm).toBe('3.1');
    expect(fields.sakihabaCm).toBe('2.2');
    expect(fields.meiType).toBe('zaimei'); // signed → zaimei
    expect(fields.era).toBe('Kamakura');
    expect(fields.certSession).toBe(45);
    expect(fields.catalogObjectUuid).toBe('uuid-1');
    expect(fields.school).toBe('Soshu');
    expect(fields.province).toBe('Sagami');
    expect(fields.nakagoType).toEqual(['ubu']);
  });

  it('maps unsigned mei_status to mumei', async () => {
    global.fetch = mockFetchSuccess();
    const onPrefill = vi.fn();

    render(<CatalogMatchPanel {...defaultProps} onPrefill={onPrefill} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 50 #5')).toBeTruthy();
    });

    const card = screen.getByText('Vol. 50 #5').closest('button')!;
    fireEvent.click(card);

    expect(onPrefill.mock.calls[0][0].meiType).toBe('mumei');
  });

  it('maps O-Suriage nakago condition to suriage', async () => {
    global.fetch = mockFetchSuccess();
    const onPrefill = vi.fn();

    render(<CatalogMatchPanel {...defaultProps} onPrefill={onPrefill} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 50 #5')).toBeTruthy();
    });

    const card = screen.getByText('Vol. 50 #5').closest('button')!;
    fireEvent.click(card);

    expect(onPrefill.mock.calls[0][0].nakagoType).toEqual(['suriage']);
  });

  it('skips null school/province in prefill', async () => {
    global.fetch = mockFetchSuccess();
    const onPrefill = vi.fn();

    render(<CatalogMatchPanel {...defaultProps} onPrefill={onPrefill} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 50 #5')).toBeTruthy();
    });

    // Second item has null school and province
    const card = screen.getByText('Vol. 50 #5').closest('button')!;
    fireEvent.click(card);

    const fields = onPrefill.mock.calls[0][0];
    expect(fields.school).toBeUndefined();
    expect(fields.province).toBeUndefined();
  });

  it('shows selected state after card click', async () => {
    global.fetch = mockFetchSuccess();

    render(<CatalogMatchPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 45 #12')).toBeTruthy();
    });

    const card = screen.getByText('Vol. 45 #12').closest('button')!;
    fireEvent.click(card);

    expect(screen.getByText('Catalog record selected — fields auto-filled')).toBeTruthy();
    expect(screen.getByText('Change')).toBeTruthy();
    expect(screen.queryByText('Vol. 50 #5')).toBeNull();
  });

  it('Change button re-opens card grid', async () => {
    global.fetch = mockFetchSuccess();

    render(<CatalogMatchPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 45 #12')).toBeTruthy();
    });

    const card = screen.getByText('Vol. 45 #12').closest('button')!;
    fireEvent.click(card);
    fireEvent.click(screen.getByText('Change'));

    await waitFor(() => {
      expect(screen.getByText('Vol. 45 #12')).toBeTruthy();
      expect(screen.getByText('Vol. 50 #5')).toBeTruthy();
    });
  });

  it('shows empty state when no results', async () => {
    global.fetch = mockFetchEmpty();

    render(<CatalogMatchPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/No catalog records found for Masamune in Juyo/)).toBeTruthy();
    });
  });

  it('shows loading state', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    render(<CatalogMatchPanel {...defaultProps} />);

    expect(screen.getByText('Searching NBTHK catalog...')).toBeTruthy();
  });

  it('returns null for non-catalog cert types', () => {
    global.fetch = vi.fn();

    const { container } = render(
      <CatalogMatchPanel {...defaultProps} certType="Hozon" />
    );

    expect(container.innerHTML).toBe('');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('includes catalogImages in prefill fields', async () => {
    global.fetch = mockFetchSuccess();
    const onPrefill = vi.fn();

    render(<CatalogMatchPanel {...defaultProps} onPrefill={onPrefill} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 45 #12')).toBeTruthy();
    });

    const card = screen.getByText('Vol. 45 #12').closest('button')!;
    fireEvent.click(card);

    const fields = onPrefill.mock.calls[0][0];
    expect(fields.catalogImages).toEqual([
      'https://example.com/Juyo/45_12_oshigata.jpg',
      'https://example.com/Juyo/45_12_setsumei.jpg',
    ]);
  });

  it('skips null measurements in prefill', async () => {
    global.fetch = mockFetchSuccess();
    const onPrefill = vi.fn();

    render(<CatalogMatchPanel {...defaultProps} onPrefill={onPrefill} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 50 #5')).toBeTruthy();
    });

    const card = screen.getByText('Vol. 50 #5').closest('button')!;
    fireEvent.click(card);

    const fields = onPrefill.mock.calls[0][0];
    expect(fields.motohabaCm).toBeUndefined();
    expect(fields.sakihabaCm).toBeUndefined();
  });

  it('signed card click: onPrefill includes meiText from mei_kanji', async () => {
    global.fetch = mockFetchSuccess();
    const onPrefill = vi.fn();

    render(<CatalogMatchPanel {...defaultProps} onPrefill={onPrefill} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 45 #12')).toBeTruthy();
    });

    const card = screen.getByText('Vol. 45 #12').closest('button')!;
    fireEvent.click(card);

    const fields = onPrefill.mock.calls[0][0];
    expect(fields.meiText).toBe('備前国長船住景光');
  });

  it('unsigned card click: onPrefill does NOT include meiText', async () => {
    global.fetch = mockFetchSuccess();
    const onPrefill = vi.fn();

    render(<CatalogMatchPanel {...defaultProps} onPrefill={onPrefill} />);

    await waitFor(() => {
      expect(screen.getByText('Vol. 50 #5')).toBeTruthy();
    });

    const card = screen.getByText('Vol. 50 #5').closest('button')!;
    fireEvent.click(card);

    const fields = onPrefill.mock.calls[0][0];
    expect(fields.meiText).toBeUndefined();
  });

  describe('OshigataImage fallback', () => {
    it('tries next URL on image error', async () => {
      global.fetch = mockFetchSuccess();

      render(<CatalogMatchPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Vol. 45 #12')).toBeTruthy();
      });

      // First item has 2 image_urls — find its img
      const imgs = screen.getAllByRole('img');
      const firstImg = imgs[0];
      expect(firstImg.getAttribute('src')).toBe('https://example.com/Juyo/45_12_oshigata.jpg');

      // Simulate oshigata load failure
      fireEvent.error(firstImg);

      // Should now show setsumei fallback
      expect(firstImg.getAttribute('src')).toBe('https://example.com/Juyo/45_12_setsumei.jpg');
    });

    it('hides image when all URLs fail', async () => {
      global.fetch = mockFetchSuccess();

      render(<CatalogMatchPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Vol. 50 #5')).toBeTruthy();
      });

      // Second item has only 1 image_url
      const imgs = screen.getAllByRole('img');
      const secondImg = imgs[1];

      // Simulate failure of the only URL
      fireEvent.error(secondImg);

      // img should be gone — replaced by empty div placeholder
      const updatedImgs = screen.queryAllByRole('img');
      // First item still has its img, but second should be gone
      expect(updatedImgs.length).toBe(imgs.length - 1);
    });
  });
});
