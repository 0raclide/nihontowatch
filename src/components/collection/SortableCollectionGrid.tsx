'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableCard } from './SortableCard';
import { ListingCard } from '@/components/browse/ListingCard';
import type { DisplayItem } from '@/types/displayItem';

type Currency = 'USD' | 'JPY' | 'EUR';
interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

interface SortableCollectionGridProps {
  items: DisplayItem[];
  currency: Currency;
  exchangeRates: ExchangeRates | null;
  onReorder: (activeId: string, overId: string) => void;
  appendSlot?: React.ReactNode;
  onCardClick?: (listing: DisplayItem) => void;
}

export function SortableCollectionGrid({
  items,
  currency,
  exchangeRates,
  onReorder,
  appendSlot,
  onCardClick,
}: SortableCollectionGridProps) {
  const [activeItem, setActiveItem] = useState<DisplayItem | null>(null);

  // PointerSensor only (no TouchSensor) — desktop drag only, Critical Rule #10 safe
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const draggedItem = items.find(i => i.id === event.active.id);
    setActiveItem(draggedItem || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  const handleDragCancel = () => {
    setActiveItem(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
        <div
          data-testid="sortable-collection-grid"
          className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
        >
          {items.map(item => (
            <SortableCard
              key={item.id}
              item={item}
              currency={currency}
              exchangeRates={exchangeRates}
              onClick={onCardClick}
            />
          ))}
          {appendSlot}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <div className="drag-overlay-card">
            <ListingCard
              listing={activeItem}
              currency={currency}
              exchangeRates={exchangeRates}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
