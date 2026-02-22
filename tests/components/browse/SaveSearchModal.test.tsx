/**
 * Tests for SaveSearchModal default frequency (Change 1)
 *
 * Tests cover:
 * - Modal defaults to "instant" frequency (not "daily")
 * - Instant radio is pre-selected on open
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SaveSearchModal } from '@/components/browse/SaveSearchModal';
import type { SavedSearchCriteria } from '@/types';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/hooks/useSavedSearches', () => ({
  useSavedSearches: () => ({
    createSavedSearch: vi.fn(),
    isCreating: false,
    error: null,
    savedSearches: [],
    isLoading: false,
    fetchSavedSearches: vi.fn(),
    toggleSavedSearch: vi.fn(),
    updateSavedSearch: vi.fn(),
    updateNotificationFrequency: vi.fn(),
    deleteSavedSearch: vi.fn(),
    isUpdating: false,
    isDeleting: false,
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
}));

vi.mock('@/lib/savedSearches/urlToCriteria', () => ({
  criteriaToHumanReadable: () => 'Juyo Katana',
  generateSearchName: () => 'Juyo Katana',
}));

vi.mock('@/i18n/LocaleContext', async () => {
  const en = await import('@/i18n/locales/en.json').then((m) => m.default);
  const t = (key: string, params?: Record<string, string | number>) => {
    let value: string = (en as Record<string, string>)[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return value;
  };
  return { useLocale: () => ({ locale: 'en', setLocale: () => {}, t }) };
});

vi.mock('@/lib/tracking/ActivityTracker', () => ({
  useActivityTrackerOptional: () => null,
}));

// =============================================================================
// TESTS
// =============================================================================

const criteria: SavedSearchCriteria = {
  tab: 'available',
  category: 'all',
  itemTypes: ['katana'],
  certifications: ['Juyo'],
  dealers: [],
  schools: [],
  sort: 'featured',
};

describe('SaveSearchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to instant frequency when opened', () => {
    render(
      <SaveSearchModal
        isOpen={true}
        onClose={() => {}}
        criteria={criteria}
      />
    );

    // Find the radio buttons
    const instantRadio = screen.getByDisplayValue('instant') as HTMLInputElement;
    const dailyRadio = screen.getByDisplayValue('daily') as HTMLInputElement;

    expect(instantRadio.checked).toBe(true);
    expect(dailyRadio.checked).toBe(false);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <SaveSearchModal
        isOpen={false}
        onClose={() => {}}
        criteria={criteria}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
