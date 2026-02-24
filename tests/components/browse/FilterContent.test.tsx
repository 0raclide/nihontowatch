import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterContent, getActiveFilterCount } from '@/components/browse/FilterContent';

// Mock useLocale — return English so all existing string assertions pass
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
  };
});

describe('FilterContent Component', () => {
  const mockFacets = {
    itemTypes: [
      { value: 'katana', count: 100 },
      { value: 'wakizashi', count: 50 },
      { value: 'tsuba', count: 75 },
      { value: 'kabuto', count: 15 },
      { value: 'menpo', count: 8 },
      { value: 'armor', count: 5 },
    ],
    certifications: [
      { value: 'Juyo', count: 20 },
      { value: 'Hozon', count: 50 },
      { value: 'TokuHozon', count: 30 },
    ],
    dealers: [
      { id: 1, name: 'Aoi Art', count: 100 },
      { id: 2, name: 'Eirakudo', count: 80 },
    ],
    historicalPeriods: [],
    signatureStatuses: [],
  };

  const defaultFilters = {
    category: 'nihonto' as 'nihonto' | 'tosogu' | 'armor',
    itemTypes: [] as string[],
    certifications: [] as string[],
    schools: [] as string[],
    dealers: [] as number[],
    historicalPeriods: [] as string[],
    signatureStatuses: [] as string[],
    askOnly: false,
  };

  const mockOnFilterChange = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnFilterChange.mockClear();
    mockOnClose.mockClear();
  });

  it('renders filter sections', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Designation')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Dealer')).toBeInTheDocument();
  });

  it('renders category toggle buttons (Nihonto and Tosogu)', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    // Category toggle is a 2-segment control: Nihonto | Tosogu
    expect(screen.getByRole('button', { name: /^nihonto$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^tosogu$/i })).toBeInTheDocument();
  });

  it('calls onFilterChange when category is changed to nihonto', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /nihonto/i }));

    expect(mockOnFilterChange).toHaveBeenCalledWith('category', 'nihonto');
    expect(mockOnFilterChange).toHaveBeenCalledWith('itemTypes', []);
  });

  it('calls onFilterChange when category is changed to tosogu', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /tosogu/i }));

    expect(mockOnFilterChange).toHaveBeenCalledWith('category', 'tosogu');
    expect(mockOnFilterChange).toHaveBeenCalledWith('itemTypes', []);
  });

  it('renders certification checkboxes', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    // Certifications should be displayed with formatted labels
    expect(screen.getByText('Jūyō')).toBeInTheDocument();
    expect(screen.getByText('Hozon')).toBeInTheDocument();
    expect(screen.getByText('Tokuho')).toBeInTheDocument();
  });

  it('calls onFilterChange when certification is toggled', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    // Find and click the Juyo checkbox
    const juyoLabel = screen.getByText('Jūyō');
    fireEvent.click(juyoLabel);

    expect(mockOnFilterChange).toHaveBeenCalledWith('certifications', ['Juyo']);
  });

  it('shows clear all button when filters are active', () => {
    const activeFilters = {
      ...defaultFilters,
      certifications: ['Juyo'] as string[],
    };

    render(
      <FilterContent
        facets={mockFacets}
        filters={activeFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    // There are two clear buttons (mobile and desktop), check at least one exists
    const clearButtons = screen.getAllByRole('button', { name: /clear all/i });
    expect(clearButtons.length).toBeGreaterThan(0);
  });

  it('does not show clear all button when no filters are active', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
  });

  it('clears all filters when clear all is clicked', () => {
    const activeFilters = {
      ...defaultFilters,
      category: 'nihonto' as const,
      certifications: ['Juyo'],
    };

    render(
      <FilterContent
        facets={mockFacets}
        filters={activeFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    // Click the first clear all button (could be mobile or desktop)
    const clearButtons = screen.getAllByRole('button', { name: /clear all/i });
    fireEvent.click(clearButtons[0]);

    // Category is a mode — not reset by "clear all"
    expect(mockOnFilterChange).not.toHaveBeenCalledWith('category', expect.anything());
    expect(mockOnFilterChange).toHaveBeenCalledWith('itemTypes', []);
    expect(mockOnFilterChange).toHaveBeenCalledWith('certifications', []);
    expect(mockOnFilterChange).toHaveBeenCalledWith('dealers', []);
  });

  it('renders dealer section', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    // Dealer section title should be present
    expect(screen.getByText('Dealer')).toBeInTheDocument();
  });

  it('shows dealer checkboxes when section is expanded', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    // Click the Dealer section header to expand (defaultOpen is false)
    fireEvent.click(screen.getByText('Dealer'));

    // Should show dealers as checkboxes
    expect(screen.getByText('Aoi Art')).toBeInTheDocument();
    expect(screen.getByText('Eirakudo')).toBeInTheDocument();
  });

  it('shows "Price on request only" toggle', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.getByText('Price on request only')).toBeInTheDocument();
  });

  it('calls onFilterChange when askOnly is toggled', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    const toggle = screen.getByText('Price on request only');
    fireEvent.click(toggle);

    expect(mockOnFilterChange).toHaveBeenCalledWith('askOnly', true);
  });

  describe('Mobile UI behavior', () => {
    it('shows updating indicator when isUpdating is true', () => {
      render(
        <FilterContent
          facets={mockFacets}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onClose={mockOnClose}
          isUpdating={true}
        />
      );

      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });

    it('does not show updating indicator when not updating', () => {
      render(
        <FilterContent
          facets={mockFacets}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onClose={mockOnClose}
          isUpdating={false}
        />
      );

      expect(screen.queryByText('Updating...')).not.toBeInTheDocument();
    });
  });

  describe('Touch-friendly sizing', () => {
    it('has large checkbox sizing for accessibility', () => {
      render(
        <FilterContent
          facets={mockFacets}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
        />
      );

      // Find checkbox containers with accessible sizes
      const checkboxes = document.querySelectorAll('.w-5.h-5');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('has minimum touch height for checkbox labels', () => {
      render(
        <FilterContent
          facets={mockFacets}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
        />
      );

      // Find labels with min-height classes (48px for better touch targets)
      const labels = document.querySelectorAll('.min-h-\\[48px\\]');
      expect(labels.length).toBeGreaterThan(0);
    });

    it('has large category buttons for easy tapping', () => {
      render(
        <FilterContent
          facets={mockFacets}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
        />
      );

      // Find category buttons with large padding
      const categoryButtons = document.querySelectorAll('.py-3');
      expect(categoryButtons.length).toBeGreaterThan(0);
    });
  });
});

describe('Mobile Availability Select', () => {
  const mockFacets = {
    itemTypes: [],
    certifications: [],
    dealers: [],
    historicalPeriods: [],
    signatureStatuses: [],
  };

  const defaultFilters = {
    category: 'nihonto' as 'nihonto' | 'tosogu' | 'armor',
    itemTypes: [] as string[],
    certifications: [] as string[],
    schools: [] as string[],
    dealers: [] as number[],
    historicalPeriods: [] as string[],
    signatureStatuses: [] as string[],
    askOnly: false,
  };

  const mockOnFilterChange = vi.fn();
  const mockOnAvailabilityChange = vi.fn();

  beforeEach(() => {
    mockOnFilterChange.mockClear();
    mockOnAvailabilityChange.mockClear();
  });

  it('renders availability buttons when onAvailabilityChange is provided', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availability="available"
        onAvailabilityChange={mockOnAvailabilityChange}
      />
    );

    expect(screen.getByText(/show/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /for sale/i })).toBeInTheDocument();
  });

  it('does not render availability buttons when onAvailabilityChange is not provided', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.queryByRole('button', { name: /for sale/i })).not.toBeInTheDocument();
  });

  it('shows all three availability buttons', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availability="available"
        onAvailabilityChange={mockOnAvailabilityChange}
      />
    );

    expect(screen.getByRole('button', { name: /for sale/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sold$/i })).toBeInTheDocument();
    // "All" button exists in both availability and signature sections
    expect(screen.getAllByRole('button', { name: /^all$/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('highlights active button based on availability prop', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availability="sold"
        onAvailabilityChange={mockOnAvailabilityChange}
      />
    );

    const soldBtn = screen.getByRole('button', { name: /^sold$/i });
    expect(soldBtn.className).toContain('text-gold');
  });

  it('calls onAvailabilityChange when button is clicked', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availability="available"
        onAvailabilityChange={mockOnAvailabilityChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^sold$/i }));

    expect(mockOnAvailabilityChange).toHaveBeenCalledTimes(1);
    expect(mockOnAvailabilityChange).toHaveBeenCalledWith('sold');
  });

  it('calls onAvailabilityChange with "all" when All is clicked', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availability="available"
        onAvailabilityChange={mockOnAvailabilityChange}
      />
    );

    // First "All" button is in the availability section
    const allButtons = screen.getAllByRole('button', { name: /^all$/i });
    fireEvent.click(allButtons[0]);

    expect(mockOnAvailabilityChange).toHaveBeenCalledWith('all');
  });
});

describe('getActiveFilterCount', () => {
  it('returns 0 for default filters', () => {
    const filters = {
      category: 'nihonto' as const,
      itemTypes: [] as string[],
      certifications: [] as string[],
      schools: [] as string[],
      dealers: [] as number[],
      historicalPeriods: [] as string[],
      signatureStatuses: [] as string[],
      askOnly: false,
    };

    expect(getActiveFilterCount(filters)).toBe(0);
  });

  it('does not count category as a filter (it is a mode)', () => {
    const filters = {
      category: 'tosogu' as const,
      itemTypes: [] as string[],
      certifications: [] as string[],
      schools: [] as string[],
      dealers: [] as number[],
      historicalPeriods: [] as string[],
      signatureStatuses: [] as string[],
      askOnly: false,
    };

    expect(getActiveFilterCount(filters)).toBe(0);
  });

  it('does not count armor category as a filter', () => {
    const filters = {
      category: 'armor' as const,
      itemTypes: [] as string[],
      certifications: [] as string[],
      schools: [] as string[],
      dealers: [] as number[],
      historicalPeriods: [] as string[],
      signatureStatuses: [] as string[],
      askOnly: false,
    };

    expect(getActiveFilterCount(filters)).toBe(0);
  });

  it('counts each item type', () => {
    const filters = {
      category: 'nihonto' as const,
      itemTypes: ['katana', 'wakizashi'],
      certifications: [] as string[],
      schools: [] as string[],
      dealers: [] as number[],
      historicalPeriods: [] as string[],
      signatureStatuses: [] as string[],
      askOnly: false,
    };

    expect(getActiveFilterCount(filters)).toBe(2);
  });

  it('counts each certification', () => {
    const filters = {
      category: 'nihonto' as const,
      itemTypes: [] as string[],
      certifications: ['Juyo', 'Hozon', 'TokuHozon'],
      schools: [] as string[],
      dealers: [] as number[],
      historicalPeriods: [] as string[],
      signatureStatuses: [] as string[],
      askOnly: false,
    };

    expect(getActiveFilterCount(filters)).toBe(3);
  });

  it('counts each dealer', () => {
    const filters = {
      category: 'nihonto' as const,
      itemTypes: [] as string[],
      certifications: [] as string[],
      schools: [] as string[],
      dealers: [1, 2, 3],
      historicalPeriods: [] as string[],
      signatureStatuses: [] as string[],
      askOnly: false,
    };

    expect(getActiveFilterCount(filters)).toBe(3);
  });

  it('counts askOnly as 1', () => {
    const filters = {
      category: 'nihonto' as const,
      itemTypes: [] as string[],
      certifications: [] as string[],
      schools: [] as string[],
      dealers: [] as number[],
      historicalPeriods: [] as string[],
      signatureStatuses: [] as string[],
      askOnly: true,
    };

    expect(getActiveFilterCount(filters)).toBe(1);
  });

  it('counts price range as 1', () => {
    const filters = {
      category: 'nihonto' as const,
      itemTypes: [] as string[],
      certifications: [] as string[],
      schools: [] as string[],
      dealers: [] as number[],
      historicalPeriods: [] as string[],
      signatureStatuses: [] as string[],
      priceMin: 1000000,
      priceMax: 3000000,
      askOnly: false,
    };

    expect(getActiveFilterCount(filters)).toBe(1);
  });

  it('counts all filters combined (category excluded)', () => {
    const filters = {
      category: 'nihonto' as const, // mode, not counted
      itemTypes: ['katana', 'wakizashi'], // 2
      certifications: ['Juyo'], // 1
      schools: [] as string[],
      dealers: [1], // 1
      historicalPeriods: [] as string[],
      signatureStatuses: [] as string[],
      askOnly: true, // 1
    };

    expect(getActiveFilterCount(filters)).toBe(5);
  });
});
