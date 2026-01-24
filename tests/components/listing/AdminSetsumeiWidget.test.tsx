import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminSetsumeiWidget } from '@/components/listing/AdminSetsumeiWidget';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock auth context
vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    user: { id: '123', email: 'admin@test.com' },
  }),
}));

const mockListing = {
  id: 5671,
  url: 'https://example.com/listing/5671',
  title: 'Test Katana',
  item_type: 'katana',
  price_value: 1500000,
  price_currency: 'JPY',
  cert_type: 'Tokuju',
  dealers: { id: 1, name: 'Test Dealer', domain: 'test.com' },
};

const mockListingWithEnrichment = {
  ...mockListing,
  yuhinkai_enrichment: {
    yuhinkai_collection: 'Tokuju',
    yuhinkai_volume: 25,
    yuhinkai_item_number: 5,
  },
};

describe('AdminSetsumeiWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders collapsed header for admin users', () => {
    render(<AdminSetsumeiWidget listing={mockListing} />);

    expect(screen.getByText('Admin: Yuhinkai Connection')).toBeInTheDocument();
  });

  it('shows "Connected" badge when listing has yuhinkai_enrichment', () => {
    render(<AdminSetsumeiWidget listing={mockListingWithEnrichment} />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('expands to show URL input when clicked', () => {
    render(<AdminSetsumeiWidget listing={mockListing} />);

    // Click to expand
    fireEvent.click(screen.getByText('Admin: Yuhinkai Connection'));

    // Should now show input field
    expect(screen.getByPlaceholderText(/item\/juyo\/68\/14936/)).toBeInTheDocument();
  });

  it('calls onConnectionChanged after successful connection', async () => {
    const onConnectionChanged = vi.fn();

    // Mock preview endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        catalogRecord: {
          yuhinkai_uuid: 'test-uuid',
          yuhinkai_collection: 'Tokuju',
          yuhinkai_volume: 25,
          yuhinkai_item_number: 5,
          collection_display: 'Tokubetsu Juyo',
          has_setsumei: true,
          setsumei_en: 'Test setsumei translation...',
          catalog_url: 'https://yuhinkai.com/item/tokuju/25/5',
        },
        willOverwrite: false,
        existingEnrichment: null,
      }),
    });

    // Mock connect endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    render(
      <AdminSetsumeiWidget
        listing={mockListing}
        onConnectionChanged={onConnectionChanged}
      />
    );

    // Expand widget
    fireEvent.click(screen.getByText('Admin: Yuhinkai Connection'));

    // Enter URL
    const input = screen.getByPlaceholderText(/item\/juyo\/68\/14936/);
    fireEvent.change(input, { target: { value: '/item/tokuju/25/5' } });

    // Click preview
    fireEvent.click(screen.getByText('Preview'));

    // Wait for preview to load and connect button to appear
    await waitFor(() => {
      expect(screen.getByText('Connect')).toBeInTheDocument();
    });

    // Click connect
    fireEvent.click(screen.getByText('Connect'));

    // Wait for connection to complete
    await waitFor(() => {
      expect(onConnectionChanged).toHaveBeenCalled();
    });
  });

  it('shows disconnect option when listing has enrichment', () => {
    render(<AdminSetsumeiWidget listing={mockListingWithEnrichment} />);

    // Expand widget
    fireEvent.click(screen.getByText('Admin: Yuhinkai Connection'));

    // Should show disconnect option
    expect(screen.getByText('Remove existing connection')).toBeInTheDocument();
  });
});
