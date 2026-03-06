export const SPECIALIZATIONS = [
  { value: 'koto', labelKey: 'dealer.specKoto' },
  { value: 'shinto', labelKey: 'dealer.specShinto' },
  { value: 'shinshinto', labelKey: 'dealer.specShinshinto' },
  { value: 'gendaito', labelKey: 'dealer.specGendaito' },
  { value: 'bizen', labelKey: 'dealer.specBizen' },
  { value: 'yamato', labelKey: 'dealer.specYamato' },
  { value: 'soshu', labelKey: 'dealer.specSoshu' },
  { value: 'mino', labelKey: 'dealer.specMino' },
  { value: 'yamashiro', labelKey: 'dealer.specYamashiro' },
  { value: 'tsuba', labelKey: 'dealer.specTsuba' },
  { value: 'armor', labelKey: 'dealer.specArmor' },
  { value: 'koshirae', labelKey: 'dealer.specKoshirae' },
] as const;

export const SPECIALIZATION_VALUES: Set<string> = new Set(
  SPECIALIZATIONS.map((s) => s.value)
);
