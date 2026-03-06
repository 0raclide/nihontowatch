'use client';

import { useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';

const PRESETS = [
  { hex: '#c4a35a', label: 'Gold' },
  { hex: '#4f46e5', label: 'Indigo' },
  { hex: '#dc2626', label: 'Crimson' },
  { hex: '#16a34a', label: 'Forest' },
  { hex: '#475569', label: 'Slate' },
  { hex: '#1c1917', label: 'Charcoal' },
];

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

interface AccentColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

export function AccentColorPicker({ value, onChange }: AccentColorPickerProps) {
  const { t } = useLocale();
  const [customInput, setCustomInput] = useState(
    PRESETS.some((p) => p.hex === value) ? '' : value
  );

  const handleCustomBlur = () => {
    const trimmed = customInput.trim();
    if (trimmed && HEX_REGEX.test(trimmed)) {
      onChange(trimmed);
    }
  };

  return (
    <div>
      <label className="text-[12px] font-medium text-text-secondary mb-1.5 block">
        {t('dealer.accentColor')}
      </label>

      {/* Preset circles */}
      <div className="flex items-center gap-2 mb-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.hex}
            onClick={() => {
              onChange(preset.hex);
              setCustomInput('');
            }}
            className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
            style={{
              backgroundColor: preset.hex,
              borderColor: value === preset.hex ? 'var(--color-gold)' : 'transparent',
            }}
            title={preset.label}
          >
            {value === preset.hex && (
              <svg className="w-3.5 h-3.5 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* Custom hex input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onBlur={handleCustomBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCustomBlur(); }}
          placeholder="#hex"
          className="w-24 px-2 py-1 text-[12px] bg-hover border border-border/50 rounded focus:border-gold/50 focus:outline-none"
        />
        {value && (
          <div
            className="w-5 h-5 rounded-full border border-border/30"
            style={{ backgroundColor: value }}
          />
        )}
      </div>

      {/* Live preview */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[10px] text-muted">{t('dealer.accentColorHelp')}</span>
      </div>
    </div>
  );
}
