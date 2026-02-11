import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterContent, getActiveFilterCount } from '@/components/browse/FilterContent';

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
    category: 'all' as 'all' | 'nihonto' | 'tosogu' | 'armor',
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

  it('renders category toggle buttons including Armor', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    // Find buttons within the category toggle section
    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^nihonto$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^tosogu$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^armor$/i })).toBeInTheDocument();
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

  it('calls onFilterChange when category is changed to armor', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /armor/i }));

    expect(mockOnFilterChange).toHaveBeenCalledWith('category', 'armor');
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
    expect(screen.getByText('Tokubetsu Hozon')).toBeInTheDocument();
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

    expect(mockOnFilterChange).toHaveBeenCalledWith('category', 'all');
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
    category: 'all' as 'all' | 'nihonto' | 'tosogu' | 'armor',
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

  it('renders availability select when onAvailabilityChange is provided', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availability="available"
        onAvailabilityChange={mockOnAvailabilityChange}
      />
    );

    expect(screen.getByLabelText(/show/i)).toBeInTheDocument();
  });

  it('does not render availability select when onAvailabilityChange is not provided', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.queryByLabelText(/show/i)).not.toBeInTheDocument();
  });

  it('shows all three availability options', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availability="available"
        onAvailabilityChange={mockOnAvailabilityChange}
      />
    );

    const select = screen.getByLabelText(/show/i);
    expect(select).toBeInTheDocument();

    // Check all options exist
    expect(screen.getByRole('option', { name: /for sale/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /sold/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^all$/i })).toBeInTheDocument();
  });

  it('displays correct value based on availability prop', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availability="sold"
        onAvailabilityChange={mockOnAvailabilityChange}
      />
    );

    const select = screen.getByLabelText(/show/i) as HTMLSelectElement;
    expect(select.value).toBe('sold');
  });

  it('calls onAvailabilityChange when selection changes', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availability="available"
        onAvailabilityChange={mockOnAvailabilityChange}
      />
    );

    const select = screen.getByLabelText(/show/i);
    fireEvent.change(select, { target: { value: 'sold' } });

    expect(mockOnAvailabilityChange).toHaveBeenCalledTimes(1);
    expect(mockOnAvailabilityChange).toHaveBeenCalledWith('sold');
  });

  it('calls onAvailabilityChange with "all" when All is selected', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availability="available"
        onAvailabilityChange={mockOnAvailabilityChange}
      />
    );

    const select = screen.getByLabelText(/show/i);
    fireEvent.change(select, { target: { value: 'all' } });

    expect(mockOnAvailabilityChange).toHaveBeenCalledWith('all');
  });
});

describe('getActiveFilterCount', () => {
  it('returns 0 for default filters', () => {
    const filters = {
      category: 'all' as const,
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

  it('counts category change to nihonto as 1', () => {
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

    expect(getActiveFilterCount(filters)).toBe(1);
  });

  it('counts category change to armor as 1', () => {
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

    expect(getActiveFilterCount(filters)).toBe(1);
  });

  it('counts each item type', () => {
    const filters = {
      category: 'all' as const,
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
      category: 'all' as const,
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
      category: 'all' as const,
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
      category: 'all' as const,
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

  it('counts all filters combined', () => {
    const filters = {
      category: 'nihonto' as const, // 1
      itemTypes: ['katana', 'wakizashi'], // 2
      certifications: ['Juyo'], // 1
      schools: [] as string[],
      dealers: [1], // 1
      historicalPeriods: [] as string[],
      signatureStatuses: [] as string[],
      askOnly: true, // 1
    };

    expect(getActiveFilterCount(filters)).toBe(6);
  });
});
