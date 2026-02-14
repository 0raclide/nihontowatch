/**
 * SEO category page definitions.
 * Each entry drives a static landing page with unique metadata and content.
 */

export interface CategoryDef {
  slug: string;
  /** The filter value(s) sent to the browse API */
  filterValues: string[];
  /** Filter param name for browse URL */
  filterParam: string;
  title: string;
  h1: string;
  metaDescription: string;
  intro: string;
}

// ─── SWORDS ──────────────────────────────────────────────────────────────────

export const SWORD_CATEGORIES: Record<string, CategoryDef> = {
  katana: {
    slug: 'katana',
    filterValues: ['katana'],
    filterParam: 'type',
    title: 'Katana for Sale — Japanese Long Swords from Trusted Dealers | NihontoWatch',
    h1: 'Katana for Sale',
    metaDescription:
      'Browse authentic Japanese katana for sale from 44 trusted dealers in Japan and worldwide. NBTHK certified, with detailed specifications and provenance.',
    intro:
      'The katana is the iconic long sword of the Japanese samurai, typically measuring over 60 cm in blade length (nagasa). Renowned for its curved, single-edged blade and exceptional craftsmanship, the katana has been the primary weapon and status symbol of the warrior class since the Muromachi period. Browse authenticated katana from leading Japanese and international dealers.',
  },
  wakizashi: {
    slug: 'wakizashi',
    filterValues: ['wakizashi'],
    filterParam: 'type',
    title: 'Wakizashi for Sale — Japanese Short Swords | NihontoWatch',
    h1: 'Wakizashi for Sale',
    metaDescription:
      'Browse authentic Japanese wakizashi for sale. The companion short sword worn alongside the katana, from 30-60 cm blade length. NBTHK certified pieces available.',
    intro:
      'The wakizashi is a traditional Japanese short sword with a blade length between 30 and 60 cm. Worn as the companion blade alongside the katana in the daisho pair, the wakizashi served both as a backup weapon and for close-quarters combat. Many feature exceptional artistry, often by the same smiths who forged katana.',
  },
  tanto: {
    slug: 'tanto',
    filterValues: ['tanto'],
    filterParam: 'type',
    title: 'Tanto for Sale — Japanese Daggers & Short Blades | NihontoWatch',
    h1: 'Tanto for Sale',
    metaDescription:
      'Browse authentic Japanese tanto for sale. Traditional daggers under 30 cm, prized for their craftsmanship and as collectible art objects. NBTHK certified.',
    intro:
      'The tanto is a Japanese dagger with a blade under 30 cm, carried by samurai as a personal sidearm and self-defense weapon. Tanto were often lavishly decorated and are among the most sought-after collectible blades, with many receiving the highest NBTHK designations. Their compact size also makes them ideal entry points for new collectors.',
  },
  tachi: {
    slug: 'tachi',
    filterValues: ['tachi'],
    filterParam: 'type',
    title: 'Tachi for Sale — Ancient Japanese Swords | NihontoWatch',
    h1: 'Tachi for Sale',
    metaDescription:
      'Browse authentic Japanese tachi for sale. The predecessor to the katana, worn edge-down by mounted warriors. Rare historical blades from trusted dealers.',
    intro:
      'The tachi is the predecessor to the katana, a long sword worn suspended edge-down from the belt — unlike the katana which is thrust through the obi edge-up. Tachi were the dominant sword form from the Heian through early Muromachi periods and were often the work of the most celebrated ancient smiths. They are among the rarest and most valuable nihonto.',
  },
  naginata: {
    slug: 'naginata',
    filterValues: ['naginata', 'naginata naoshi', 'naginata-naoshi'],
    filterParam: 'type',
    title: 'Naginata for Sale — Japanese Polearm Blades | NihontoWatch',
    h1: 'Naginata for Sale',
    metaDescription:
      'Browse authentic Japanese naginata blades for sale. Traditional polearm blades and naginata-naoshi conversions from trusted dealers worldwide.',
    intro:
      'The naginata is a Japanese polearm featuring a curved blade mounted on a long shaft. Originally a battlefield weapon, many historical naginata blades were later shortened and remounted as swords (naginata-naoshi). These converted blades retain their distinctive wide curvature and are highly prized by collectors.',
  },
  yari: {
    slug: 'yari',
    filterValues: ['yari'],
    filterParam: 'type',
    title: 'Yari for Sale — Japanese Spear Blades | NihontoWatch',
    h1: 'Yari for Sale',
    metaDescription:
      'Browse authentic Japanese yari spear blades for sale. Traditional straight-bladed spears from the samurai era, available from trusted dealers.',
    intro:
      'The yari is a Japanese spear with a straight blade, used extensively on the battlefield from the Kamakura through Edo periods. Yari come in many forms — from simple su-yari to cross-bladed jumonji-yari — and represent some of the finest examples of Japanese metalworking. They are less common on the market than swords, making them particularly collectible.',
  },
};

// ─── FITTINGS ────────────────────────────────────────────────────────────────

export const FITTING_CATEGORIES: Record<string, CategoryDef> = {
  tsuba: {
    slug: 'tsuba',
    filterValues: ['tsuba'],
    filterParam: 'type',
    title: 'Tsuba for Sale — Japanese Sword Guards | NihontoWatch',
    h1: 'Tsuba for Sale',
    metaDescription:
      'Browse authentic Japanese tsuba (sword guards) for sale from 44 dealers. Iron, shakudo, and gold tsuba by renowned makers. NBTHK certified pieces available.',
    intro:
      'The tsuba is the hand guard of a Japanese sword, positioned between the blade and the grip. Far more than functional protection, tsuba evolved into miniature works of art featuring intricate designs in iron, copper, shakudo, and precious metals. They are the most widely collected category of Japanese sword fittings (tosogu), with pieces by famous schools like Goto, Nara, and Yokoya commanding premium prices.',
  },
  'fuchi-kashira': {
    slug: 'fuchi-kashira',
    filterValues: ['fuchi-kashira', 'fuchi_kashira'],
    filterParam: 'type',
    title: 'Fuchi-Kashira for Sale — Japanese Sword Handle Fittings | NihontoWatch',
    h1: 'Fuchi-Kashira for Sale',
    metaDescription:
      'Browse authentic Japanese fuchi-kashira sets for sale. Matching collar and pommel cap sets for sword handles from trusted dealers.',
    intro:
      'Fuchi-kashira are the matching pair of fittings at either end of the Japanese sword handle: the fuchi (collar at the guard end) and the kashira (pommel cap). Sold as matched sets, they showcase the maker\'s skill in miniature metalwork with themes from nature, mythology, and warrior culture.',
  },
  kozuka: {
    slug: 'kozuka',
    filterValues: ['kozuka', 'kogatana'],
    filterParam: 'type',
    title: 'Kozuka for Sale — Japanese Utility Knife Handles | NihontoWatch',
    h1: 'Kozuka for Sale',
    metaDescription:
      'Browse authentic Japanese kozuka for sale. Decorative utility knife handles fitted into sword scabbards, from trusted dealers worldwide.',
    intro:
      'The kozuka is the decorative handle of a small utility knife (kogatana) that fits into a slot in the sword scabbard. These palm-sized masterpieces feature some of the most refined metalwork in the tosogu tradition, with intricate inlay work in gold, silver, and shakudo by celebrated makers.',
  },
  menuki: {
    slug: 'menuki',
    filterValues: ['menuki'],
    filterParam: 'type',
    title: 'Menuki for Sale — Japanese Sword Grip Ornaments | NihontoWatch',
    h1: 'Menuki for Sale',
    metaDescription:
      'Browse authentic Japanese menuki for sale. Small sculptural grip ornaments for sword handles from trusted nihonto dealers.',
    intro:
      'Menuki are small sculptural ornaments placed beneath the wrapping of a Japanese sword handle. Sold in mirror-image pairs, these tiny works of art depict dragons, tigers, deities, and scenes from Japanese legend. Despite their diminutive size, menuki by top makers are highly valued and represent an accessible entry point into tosogu collecting.',
  },
};

// ─── CERTIFICATIONS ──────────────────────────────────────────────────────────

export const CERT_CATEGORIES: Record<string, CategoryDef> = {
  juyo: {
    slug: 'juyo',
    filterValues: ['juyo', 'Juyo'],
    filterParam: 'cert',
    title: 'Juyo Token Swords for Sale — NBTHK Important Swords | NihontoWatch',
    h1: 'Juyo Token — Important Swords for Sale',
    metaDescription:
      'Browse NBTHK Juyo Token (Important Sword) certified Japanese swords for sale. The highest regularly awarded designation, representing the finest nihonto available.',
    intro:
      'Juyo Token ("Important Sword") is the highest designation regularly awarded by the NBTHK (Society for Preservation of Japanese Art Swords). Only swords of exceptional quality, historical significance, and excellent preservation receive this honor. Juyo blades represent the top tier of what collectors can realistically acquire, and they are universally recognized as benchmarks of quality in the nihonto world.',
  },
  'tokubetsu-juyo': {
    slug: 'tokubetsu-juyo',
    filterValues: ['tokuju', 'Tokuju', 'tokubetsu_juyo'],
    filterParam: 'cert',
    title: 'Tokubetsu Juyo Swords for Sale — NBTHK Supreme Designation | NihontoWatch',
    h1: 'Tokubetsu Juyo — Supreme Swords for Sale',
    metaDescription:
      'Browse NBTHK Tokubetsu Juyo (Especially Important) certified Japanese swords. The rarest and most prestigious NBTHK designation, reserved for national-treasure-caliber blades.',
    intro:
      'Tokubetsu Juyo Token ("Especially Important Sword") is the most prestigious NBTHK designation, awarded to blades considered equal in quality to National Treasures and Important Cultural Properties. Fewer than 900 items have ever received this honor since 1971. Acquiring a Tokubetsu Juyo blade is a defining moment for any serious collector.',
  },
  hozon: {
    slug: 'hozon',
    filterValues: ['hozon', 'Hozon'],
    filterParam: 'cert',
    title: 'Hozon Certified Swords for Sale — NBTHK Worthy of Preservation | NihontoWatch',
    h1: 'Hozon — Certified Swords for Sale',
    metaDescription:
      'Browse NBTHK Hozon (Worthy of Preservation) certified Japanese swords and fittings. Authenticated pieces with official NBTHK certification from trusted dealers.',
    intro:
      'Hozon ("Worthy of Preservation") is the foundational NBTHK certification confirming a sword\'s authenticity, quality, and historical merit. Hozon papers verify that a blade is a genuine Japanese sword of recognized craftsmanship — making it an essential baseline for collectors. Many Hozon-certified pieces offer exceptional value and are actively sought by collectors building their first collections.',
  },
  'tokubetsu-hozon': {
    slug: 'tokubetsu-hozon',
    filterValues: ['tokubetsu_hozon', 'TokuHozon'],
    filterParam: 'cert',
    title: 'Tokubetsu Hozon Swords for Sale — NBTHK Especially Worthy | NihontoWatch',
    h1: 'Tokubetsu Hozon — Especially Worthy Swords for Sale',
    metaDescription:
      'Browse NBTHK Tokubetsu Hozon (Especially Worthy of Preservation) certified Japanese swords. A step above Hozon, indicating superior quality and condition.',
    intro:
      'Tokubetsu Hozon ("Especially Worthy of Preservation") is the NBTHK designation above Hozon, awarded to swords of notably superior quality, condition, or historical interest. These blades are strong candidates for future Juyo submission and represent a sweet spot for collectors seeking quality with room for appreciation.',
  },
};

// ─── LOOKUP HELPERS ──────────────────────────────────────────────────────────

export function getSwordCategory(slug: string): CategoryDef | undefined {
  return SWORD_CATEGORIES[slug];
}

export function getFittingCategory(slug: string): CategoryDef | undefined {
  return FITTING_CATEGORIES[slug];
}

export function getCertCategory(slug: string): CategoryDef | undefined {
  return CERT_CATEGORIES[slug];
}

/** All valid slugs for generateStaticParams */
export function getAllSwordSlugs(): string[] {
  return Object.keys(SWORD_CATEGORIES);
}

export function getAllFittingSlugs(): string[] {
  return Object.keys(FITTING_CATEGORIES);
}

export function getAllCertSlugs(): string[] {
  return Object.keys(CERT_CATEGORIES);
}
