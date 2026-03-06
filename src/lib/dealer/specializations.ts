export const SPECIALIZATIONS = [
  { value: 'nihonto', labelKey: 'dealer.specNihonto' },
  { value: 'tosogu', labelKey: 'dealer.specTosogu' },
  { value: 'japanese_art', labelKey: 'dealer.specJapaneseArt' },
] as const;

export const SPECIALIZATION_VALUES: Set<string> = new Set(
  SPECIALIZATIONS.map((s) => s.value)
);
