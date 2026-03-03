const CERT_EN_MAP: Record<string, string> = {
  'Tokubetsu Juyo': 'Tokubetsu Juyo',
  'Juyo': 'Juyo',
  'Tokubetsu Hozon': 'Tokubetsu Hozon',
  'Hozon': 'Hozon',
};

const CERT_JA_MAP: Record<string, string> = {
  'Tokubetsu Juyo': '特別重要刀剣',
  'Juyo': '重要刀剣',
  'Tokubetsu Hozon': '特別保存刀剣',
  'Hozon': '保存刀剣',
};

const TYPE_EN_MAP: Record<string, string> = {
  katana: 'Katana',
  wakizashi: 'Wakizashi',
  tanto: 'Tanto',
  tachi: 'Tachi',
  naginata: 'Naginata',
  yari: 'Yari',
  tsuba: 'Tsuba',
  fuchi_kashira: 'Fuchi-Kashira',
  menuki: 'Menuki',
  kozuka: 'Kozuka',
  kogai: 'Kogai',
};

const TYPE_JA_MAP: Record<string, string> = {
  katana: '刀',
  wakizashi: '脇差',
  tanto: '短刀',
  tachi: '太刀',
  naginata: '薙刀',
  yari: '槍',
  tsuba: '鍔',
  fuchi_kashira: '縁頭',
  menuki: '目貫',
  kozuka: '小柄',
  kogai: '笄',
};

/**
 * Generate listing title from structured fields.
 * Pattern: {cert} {type} — {artisan}
 */
export function generateListingTitle(
  cert: string | null,
  itemType: string | null,
  artisanName: string | null,
  artisanKanji: string | null
): { en: string; ja: string } {
  const typeKey = itemType?.toLowerCase() ?? '';

  const enParts: string[] = [];
  if (cert && CERT_EN_MAP[cert]) enParts.push(CERT_EN_MAP[cert]);
  if (TYPE_EN_MAP[typeKey]) enParts.push(TYPE_EN_MAP[typeKey]);
  else if (itemType) enParts.push(itemType);
  if (artisanName) enParts.push(`— ${artisanName}`);

  const jaParts: string[] = [];
  if (cert && CERT_JA_MAP[cert]) jaParts.push(CERT_JA_MAP[cert]);
  if (TYPE_JA_MAP[typeKey]) jaParts.push(TYPE_JA_MAP[typeKey]);
  else if (itemType) jaParts.push(itemType);
  if (artisanKanji) jaParts.push(`— ${artisanKanji}`);
  else if (artisanName) jaParts.push(`— ${artisanName}`);

  return {
    en: enParts.join(' ') || 'Untitled',
    ja: jaParts.join(' ') || '無題',
  };
}
