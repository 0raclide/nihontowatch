import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArtisanTooltip } from '@/components/artisan/ArtisanTooltip';

// Mock createPortal to render inline (no actual DOM portal)
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ArtisanTooltip — Cert Pill Row', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: artisan detail fetch succeeds
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        artisan: {
          code: 'MAS590',
          name_kanji: '正宗',
          name_romaji: 'Masamune',
          school: 'Soshu',
          province: 'Sagami',
          era: 'Late Kamakura',
          elite_factor: 0.85,
          kokuho_count: 2,
          jubun_count: 1,
          jubi_count: 0,
          gyobutsu_count: 0,
          tokuju_count: 5,
          juyo_count: 12,
          total_items: 20,
          elite_count: 8,
        },
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function openTooltip() {
    const trigger = screen.getByRole('button', { expanded: false });
    fireEvent.click(trigger);
  }

  it('does NOT render cert section when certType prop is undefined', () => {
    render(
      <ArtisanTooltip listingId={1} artisanId="MAS590" confidence="HIGH">
        <span>trigger</span>
      </ArtisanTooltip>
    );

    openTooltip();

    // "Designation" label should not appear
    expect(screen.queryByText('Designation')).not.toBeInTheDocument();
  });

  it('renders cert pill row when certType prop is passed (even null)', () => {
    render(
      <ArtisanTooltip listingId={1} artisanId="MAS590" confidence="HIGH" certType={null}>
        <span>trigger</span>
      </ArtisanTooltip>
    );

    openTooltip();

    expect(screen.getByText('Designation')).toBeInTheDocument();
    // All 7 pills should be present
    expect(screen.getByText('Tokuju')).toBeInTheDocument();
    expect(screen.getByText('Jūyō')).toBeInTheDocument();
    expect(screen.getByText('Tokuho')).toBeInTheDocument();
    expect(screen.getByText('Hozon')).toBeInTheDocument();
    expect(screen.getByText('Jubi')).toBeInTheDocument();
    expect(screen.getByText('TokuKichō')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('highlights the active cert pill with ring-2', () => {
    render(
      <ArtisanTooltip listingId={1} artisanId="MAS590" confidence="HIGH" certType="Juyo">
        <span>trigger</span>
      </ArtisanTooltip>
    );

    openTooltip();

    const juyoPill = screen.getByText('Jūyō');
    expect(juyoPill.className).toContain('ring-2');

    // Other pills should NOT have ring-2
    const tokujuPill = screen.getByText('Tokuju');
    expect(tokujuPill.className).not.toContain('ring-2');
  });

  it('highlights "None" pill when certType is null', () => {
    render(
      <ArtisanTooltip listingId={1} artisanId="MAS590" confidence="HIGH" certType={null}>
        <span>trigger</span>
      </ArtisanTooltip>
    );

    openTooltip();

    const nonePill = screen.getByText('None');
    expect(nonePill.className).toContain('ring-2');
  });

  it('normalizes cert_type variants to canonical values', () => {
    // tokubetsu_juyo should highlight the Tokuju pill
    render(
      <ArtisanTooltip listingId={1} artisanId="MAS590" confidence="HIGH" certType="tokubetsu_juyo">
        <span>trigger</span>
      </ArtisanTooltip>
    );

    openTooltip();

    const tokujuPill = screen.getByText('Tokuju');
    expect(tokujuPill.className).toContain('ring-2');
  });

  it('calls fix-cert API on pill click', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/fix-cert')) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      // artisan detail fetch
      return {
        ok: true,
        json: async () => ({
          artisan: { code: 'MAS590', name_kanji: '正宗', name_romaji: 'Masamune' },
        }),
      };
    });

    const onCertChanged = vi.fn();

    render(
      <ArtisanTooltip
        listingId={42}
        artisanId="MAS590"
        confidence="HIGH"
        certType="Hozon"
        onCertChanged={onCertChanged}
      >
        <span>trigger</span>
      </ArtisanTooltip>
    );

    openTooltip();

    // Click Tokuju pill
    fireEvent.click(screen.getByText('Tokuju'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/listing/42/fix-cert',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ cert_type: 'Tokuju' }),
        }),
      );
    });

    await waitFor(() => {
      expect(onCertChanged).toHaveBeenCalledWith('Tokuju');
    });
  });

  it('shows success toast after successful save', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/fix-cert')) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      return {
        ok: true,
        json: async () => ({
          artisan: { code: 'MAS590', name_romaji: 'Masamune' },
        }),
      };
    });

    render(
      <ArtisanTooltip listingId={42} artisanId="MAS590" confidence="HIGH" certType="Hozon">
        <span>trigger</span>
      </ArtisanTooltip>
    );

    openTooltip();
    fireEvent.click(screen.getByText('Tokuju'));

    await waitFor(() => {
      expect(screen.getByText('Designation updated')).toBeInTheDocument();
    });
  });

  it('does not call API when clicking the already-active cert', async () => {
    render(
      <ArtisanTooltip listingId={42} artisanId="MAS590" confidence="HIGH" certType="Juyo">
        <span>trigger</span>
      </ArtisanTooltip>
    );

    openTooltip();

    // Click the already-active pill
    fireEvent.click(screen.getByText('Jūyō'));

    // Should NOT have called fix-cert
    await new Promise((r) => setTimeout(r, 50));
    const fixCertCalls = mockFetch.mock.calls.filter(
      (c: [string]) => typeof c[0] === 'string' && c[0].includes('/fix-cert')
    );
    expect(fixCertCalls).toHaveLength(0);
  });

  it('reverts optimistic update on API failure', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/fix-cert')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'DB error' }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          artisan: { code: 'MAS590', name_romaji: 'Masamune' },
        }),
      };
    });

    render(
      <ArtisanTooltip listingId={42} artisanId="MAS590" confidence="HIGH" certType="Hozon">
        <span>trigger</span>
      </ArtisanTooltip>
    );

    openTooltip();

    // Click Tokuju — should optimistically switch, then revert
    fireEvent.click(screen.getByText('Tokuju'));

    // After API failure, Hozon should be re-highlighted
    await waitFor(() => {
      const hozonPill = screen.getByText('Hozon');
      expect(hozonPill.className).toContain('ring-2');
    });
  });

  it('calls "None" to clear cert_type', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/fix-cert')) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      return {
        ok: true,
        json: async () => ({
          artisan: { code: 'MAS590', name_romaji: 'Masamune' },
        }),
      };
    });

    const onCertChanged = vi.fn();

    render(
      <ArtisanTooltip
        listingId={42}
        artisanId="MAS590"
        confidence="HIGH"
        certType="Juyo"
        onCertChanged={onCertChanged}
      >
        <span>trigger</span>
      </ArtisanTooltip>
    );

    openTooltip();
    fireEvent.click(screen.getByText('None'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/listing/42/fix-cert',
        expect.objectContaining({
          body: JSON.stringify({ cert_type: null }),
        }),
      );
    });

    await waitFor(() => {
      expect(onCertChanged).toHaveBeenCalledWith(null);
    });
  });

  it('dispatches listing-refreshed event on success', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/fix-cert')) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      return {
        ok: true,
        json: async () => ({
          artisan: { code: 'MAS590', name_romaji: 'Masamune' },
        }),
      };
    });

    const eventSpy = vi.fn();
    window.addEventListener('listing-refreshed', eventSpy);

    render(
      <ArtisanTooltip listingId={42} artisanId="MAS590" confidence="HIGH" certType="Hozon">
        <span>trigger</span>
      </ArtisanTooltip>
    );

    openTooltip();
    fireEvent.click(screen.getByText('Tokuju'));

    await waitFor(() => {
      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual(
        expect.objectContaining({ id: 42, cert_type: 'Tokuju' }),
      );
    });

    window.removeEventListener('listing-refreshed', eventSpy);
  });

  it('renders cert section even when no artisan is assigned', () => {
    render(
      <ArtisanTooltip listingId={1} startInSearchMode certType="Hozon">
        <span>trigger</span>
      </ArtisanTooltip>
    );

    openTooltip();

    // Cert section should still appear
    expect(screen.getByText('Designation')).toBeInTheDocument();
    expect(screen.getByText('Hozon')).toBeInTheDocument();
  });
});
