import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterContent, getActiveFilterCount } from '@/components/browse/FilterContent';

describe('FilterContent Component', () => {
  const mockFacets = {
    itemTypes: [
      { value: 'katana', count: 100 },
      { value: 'wakizashi', count: 50 },
      { value: 'tsuba', count: 75 },
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
  };

  const defaultFilters = {
    category: 'all' as const,
    itemTypes: [],
    certifications: [],
    schools: [],
    dealers: [],
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

    expect(screen.getByText('Refine')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Dealer')).toBeInTheDocument();
    expect(screen.getByText('Certification')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('renders category toggle buttons', () => {
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
  });

  it('calls onFilterChange when category is changed', () => {
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

  it('shows reset button when filters are active', () => {
    const activeFilters = {
      ...defaultFilters,
      certifications: ['Juyo'],
    };

    render(
      <FilterContent
        facets={mockFacets}
        filters={activeFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  it('does not show reset button when no filters are active', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument();
  });

  it('clears all filters when reset is clicked', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));

    expect(mockOnFilterChange).toHaveBeenCalledWith('category', 'all');
    expect(mockOnFilterChange).toHaveBeenCalledWith('itemTypes', []);
    expect(mockOnFilterChange).toHaveBeenCalledWith('certifications', []);
    expect(mockOnFilterChange).toHaveBeenCalledWith('dealers', []);
  });

  it('renders dealer dropdown', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.getByText('All dealers')).toBeInTheDocument();
  });

  it('opens dealer dropdown on click', () => {
    render(
      <FilterContent
        facets={mockFacets}
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    fireEvent.click(screen.getByText('All dealers'));

    // Should show dealers
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

  describe('Mobile Apply Button', () => {
    it('shows Apply button when onClose is provided', () => {
      render(
        <FilterContent
          facets={mockFacets}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /apply filters/i })).toBeInTheDocument();
    });

    it('does not show Apply button when onClose is not provided', () => {
      render(
        <FilterContent
          facets={mockFacets}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
        />
      );

      expect(screen.queryByRole('button', { name: /apply filters/i })).not.toBeInTheDocument();
    });

    it('calls onClose when Apply button is clicked', () => {
      render(
        <FilterContent
          facets={mockFacets}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('shows active filter count in Apply button', () => {
      const activeFilters = {
        ...defaultFilters,
        certifications: ['Juyo', 'Hozon'],
        itemTypes: ['katana'],
      };

      render(
        <FilterContent
          facets={mockFacets}
          filters={activeFilters}
          onFilterChange={mockOnFilterChange}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /apply filters \(3\)/i })).toBeInTheDocument();
    });
  });

  describe('Touch-friendly sizing', () => {
    it('has responsive checkbox sizing', () => {
      render(
        <FilterContent
          facets={mockFacets}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
        />
      );

      // Find checkbox containers with responsive classes
      const checkboxes = document.querySelectorAll('.w-4.h-4.lg\\:w-3\\.5.lg\\:h-3\\.5');
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

      // Find labels with min-height classes
      const labels = document.querySelectorAll('.min-h-\\[44px\\]');
      expect(labels.length).toBeGreaterThan(0);
    });

    it('has responsive category button padding', () => {
      render(
        <FilterContent
          facets={mockFacets}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
        />
      );

      // Find category buttons with responsive padding
      const categoryButtons = document.querySelectorAll('.py-2\\.5.lg\\:py-1\\.5');
      expect(categoryButtons.length).toBeGreaterThan(0);
    });
  });
});

describe('getActiveFilterCount', () => {
  it('returns 0 for default filters', () => {
    const filters = {
      category: 'all' as const,
      itemTypes: [],
      certifications: [],
      schools: [],
      dealers: [],
      askOnly: false,
    };

    expect(getActiveFilterCount(filters)).toBe(0);
  });

  it('counts category change as 1', () => {
    const filters = {
      category: 'nihonto' as const,
      itemTypes: [],
      certifications: [],
      schools: [],
      dealers: [],
      askOnly: false,
    };

    expect(getActiveFilterCount(filters)).toBe(1);
  });

  it('counts each item type', () => {
    const filters = {
      category: 'all' as const,
      itemTypes: ['katana', 'wakizashi'],
      certifications: [],
      schools: [],
      dealers: [],
      askOnly: false,
    };

    expect(getActiveFilterCount(filters)).toBe(2);
  });

  it('counts each certification', () => {
    const filters = {
      category: 'all' as const,
      itemTypes: [],
      certifications: ['Juyo', 'Hozon', 'TokuHozon'],
      schools: [],
      dealers: [],
      askOnly: false,
    };

    expect(getActiveFilterCount(filters)).toBe(3);
  });

  it('counts each dealer', () => {
    const filters = {
      category: 'all' as const,
      itemTypes: [],
      certifications: [],
      schools: [],
      dealers: [1, 2, 3],
      askOnly: false,
    };

    expect(getActiveFilterCount(filters)).toBe(3);
  });

  it('counts askOnly as 1', () => {
    const filters = {
      category: 'all' as const,
      itemTypes: [],
      certifications: [],
      schools: [],
      dealers: [],
      askOnly: true,
    };

    expect(getActiveFilterCount(filters)).toBe(1);
  });

  it('counts all filters combined', () => {
    const filters = {
      category: 'nihonto' as const, // 1
      itemTypes: ['katana', 'wakizashi'], // 2
      certifications: ['Juyo'], // 1
      schools: [],
      dealers: [1], // 1
      askOnly: true, // 1
    };

    expect(getActiveFilterCount(filters)).toBe(6);
  });
});
