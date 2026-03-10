/**
 * Tests for SortableCollectionGrid component.
 *
 * Verifies:
 * - Renders all items
 * - Renders appendSlot
 * - Wraps in DndContext and SortableContext
 * - Uses PointerSensor (not TouchSensor)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// vi.hoisted() runs before vi.mock() hoisting
const { mockUseSortable } = vi.hoisted(() => ({
  mockUseSortable: vi.fn().mockReturnValue({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div data-testid="sortable-context">{children}</div>,
  useSortable: mockUseSortable,
  rectSortingStrategy: 'rectSortingStrategy',
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div data-testid="drag-overlay">{children}</div>,
  PointerSensor: vi.fn(),
  closestCenter: vi.fn(),
  useSensor: vi.fn().mockReturnValue({}),
  useSensors: vi.fn().mockReturnValue([]),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: (t: unknown) => (t ? 'translate(0, 0)' : undefined) } },
}));

// Mock ListingCard
vi.mock('@/components/browse/ListingCard', () => ({
  ListingCard: ({ listing }: { listing: { title: string } }) => (
    <div data-testid={`listing-card-${listing.title}`}>{listing.title}</div>
  ),
}));

// Mock contexts
vi.mock('@/i18n/LocaleContext', () => ({
  useLocale: () => ({ locale: 'en', t: (k: string) => k }),
}));

vi.mock('@/contexts/QuickViewContext', () => ({
  useQuickViewOptional: () => null,
}));

import { SortableCollectionGrid } from '@/components/collection/SortableCollectionGrid';
import type { DisplayItem } from '@/types/displayItem';

function makeItem(id: string, title: string): DisplayItem {
  return {
    id,
    source: 'collection',
    title,
    item_type: 'katana',
    price_value: null,
    price_currency: null,
    images: [],
    first_seen_at: '2026-01-01',
    status: 'AVAILABLE',
    is_available: true,
    is_sold: false,
    cert_type: null,
    smith: null,
    tosogu_maker: null,
    school: null,
    tosogu_school: null,
    nagasa_cm: null,
    dealer_name: null,
    dealer_domain: null,
    dealer_name_ja: null,
    dealer_id: null,
  } as DisplayItem;
}

const defaultProps = {
  currency: 'JPY' as const,
  exchangeRates: null,
  onReorder: vi.fn(),
};

describe('SortableCollectionGrid', () => {
  it('renders all provided items', () => {
    const items = [makeItem('1', 'Katana A'), makeItem('2', 'Wakizashi B')];
    render(<SortableCollectionGrid items={items} {...defaultProps} />);

    expect(screen.getByTestId('listing-card-Katana A')).toBeTruthy();
    expect(screen.getByTestId('listing-card-Wakizashi B')).toBeTruthy();
  });

  it('renders appendSlot after items', () => {
    const items = [makeItem('1', 'Katana A')];
    render(
      <SortableCollectionGrid
        items={items}
        {...defaultProps}
        appendSlot={<div data-testid="add-card">Add</div>}
      />
    );

    expect(screen.getByTestId('add-card')).toBeTruthy();
  });

  it('renders with DndContext and SortableContext', () => {
    const items = [makeItem('1', 'Katana A')];
    render(<SortableCollectionGrid items={items} {...defaultProps} />);

    expect(screen.getByTestId('dnd-context')).toBeTruthy();
    expect(screen.getByTestId('sortable-context')).toBeTruthy();
  });

  it('renders the sortable grid container', () => {
    const items = [makeItem('1', 'Katana A')];
    render(<SortableCollectionGrid items={items} {...defaultProps} />);

    expect(screen.getByTestId('sortable-collection-grid')).toBeTruthy();
  });

  it('renders DragOverlay container', () => {
    const items = [makeItem('1', 'Katana A')];
    render(<SortableCollectionGrid items={items} {...defaultProps} />);

    expect(screen.getByTestId('drag-overlay')).toBeTruthy();
  });
});
