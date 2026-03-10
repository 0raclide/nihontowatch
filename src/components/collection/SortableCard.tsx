'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ListingCard } from '@/components/browse/ListingCard';
import type { DisplayItem } from '@/types/displayItem';

type Currency = 'USD' | 'JPY' | 'EUR';
interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

interface SortableCardProps {
  item: DisplayItem;
  currency: Currency;
  exchangeRates: ExchangeRates | null;
  onClick?: (listing: DisplayItem) => void;
}

export function SortableCard({ item, currency, exchangeRates, onClick }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ListingCard
        listing={item}
        currency={currency}
        exchangeRates={exchangeRates}
        onClick={onClick}
      />
    </div>
  );
}
