'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ListingCard } from '@/components/browse/ListingCard';
import { CollectorCard } from '@/components/browse/CollectorCard';
import { useCardStyle } from '@/hooks/useCardStyle';
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
  showFavoriteButton?: boolean;
}

export function SortableCard({ item, currency, exchangeRates, onClick, showFavoriteButton }: SortableCardProps) {
  const { cardStyle } = useCardStyle();
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

  const CardComponent = cardStyle === 'collector' ? CollectorCard : ListingCard;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardComponent
        listing={item}
        currency={currency}
        exchangeRates={exchangeRates}
        onClick={onClick}
        showFavoriteButton={showFavoriteButton}
      />
    </div>
  );
}
