'use client';

import { useState, useEffect } from 'react';

export type CardStyle = 'classic' | 'clean' | 'editorial' | 'gallery';

const CARD_STYLE_KEY = 'nihontowatch-card-style';

const STYLES: { value: CardStyle; label: string; description: string }[] = [
  { value: 'classic', label: 'Classic', description: 'Current design' },
  { value: 'clean', label: 'Clean', description: 'Uncluttered badges' },
  { value: 'editorial', label: 'Editorial', description: 'Image-forward' },
  { value: 'gallery', label: 'Gallery', description: 'Accent line' },
];

export function useCardStyle(): [CardStyle, (style: CardStyle) => void] {
  const [style, setStyle] = useState<CardStyle>('classic');

  useEffect(() => {
    const saved = localStorage.getItem(CARD_STYLE_KEY) as CardStyle | null;
    if (saved && STYLES.some(s => s.value === saved)) {
      setStyle(saved);
    }
  }, []);

  const updateStyle = (newStyle: CardStyle) => {
    setStyle(newStyle);
    localStorage.setItem(CARD_STYLE_KEY, newStyle);
  };

  return [style, updateStyle];
}

export function CardStyleSelector({
  value,
  onChange,
}: {
  value: CardStyle;
  onChange: (style: CardStyle) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {STYLES.map((s) => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          title={s.description}
          className={`text-[10px] lg:text-[11px] px-2 py-1 transition-all duration-200 ${
            value === s.value
              ? 'bg-gold/20 text-gold border border-gold/40 font-medium'
              : 'text-muted hover:text-ink border border-transparent hover:border-border'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
