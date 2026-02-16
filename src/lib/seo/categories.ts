/**
 * SEO category page definitions — dimension-based generation.
 *
 * All category pages (type, certification, combination) are generated
 * from dimensions + hand-written content. Related links are computed
 * from the category graph. Entity URL helpers for internal linking
 * are derived from reverse lookups against the registry.
 */

import { createDealerSlug } from '@/lib/dealers/utils';

// ── Public Interface ────────────────────────────────────────────────────────

export interface CategoryDef {
  slug: string;
  /** Full route path, e.g. '/swords/katana' */
  route: string;
  /** Route section: 'swords' | 'fittings' | 'certified' */
  routePrefix: string;
  /** URL filter params → DB values. Used by fetchCategoryPreview and browseUrl. */
  filters: Record<string, string[]>;
  /** Parent type slug for breadcrumbs on combination pages */
  parentSlug?: string;
  /** Related category page links (auto-computed) */
  relatedLinks: Array<{ label: string; url: string }>;
  title: string;
  h1: string;
  metaDescription: string;
  intro: string;
}

/** Maps URL filter param names to Supabase column names. */
export const PARAM_TO_COLUMN: Record<string, string> = {
  type: 'item_type',
  cert: 'cert_type',
  era: 'era',
  school: 'school',
};

// ── Dimensions ──────────────────────────────────────────────────────────────

interface TypeDim {
  label: string;
  dbValues: string[];
  routePrefix: 'swords' | 'fittings';
  subtitle: string;
}

interface SecondaryDim {
  label: string;
  dbValues: string[];
  param: 'cert' | 'era' | 'school';
  titleSuffix: string;
}

const TYPE_DIMS: Record<string, TypeDim> = {
  katana: {
    label: 'Katana', dbValues: ['katana'],
    routePrefix: 'swords', subtitle: 'Japanese Long Swords from Trusted Dealers',
  },
  wakizashi: {
    label: 'Wakizashi', dbValues: ['wakizashi'],
    routePrefix: 'swords', subtitle: 'Japanese Short Swords',
  },
  tanto: {
    label: 'Tanto', dbValues: ['tanto'],
    routePrefix: 'swords', subtitle: 'Japanese Daggers & Short Blades',
  },
  tachi: {
    label: 'Tachi', dbValues: ['tachi'],
    routePrefix: 'swords', subtitle: 'Ancient Japanese Swords',
  },
  naginata: {
    label: 'Naginata', dbValues: ['naginata', 'naginata naoshi', 'naginata-naoshi'],
    routePrefix: 'swords', subtitle: 'Japanese Polearm Blades',
  },
  yari: {
    label: 'Yari', dbValues: ['yari'],
    routePrefix: 'swords', subtitle: 'Japanese Spear Blades',
  },
  tsuba: {
    label: 'Tsuba', dbValues: ['tsuba'],
    routePrefix: 'fittings', subtitle: 'Japanese Sword Guards',
  },
  'fuchi-kashira': {
    label: 'Fuchi-Kashira', dbValues: ['fuchi-kashira', 'fuchi_kashira'],
    routePrefix: 'fittings', subtitle: 'Japanese Sword Handle Fittings',
  },
  kozuka: {
    label: 'Kozuka', dbValues: ['kozuka', 'kogatana'],
    routePrefix: 'fittings', subtitle: 'Japanese Utility Knife Handles',
  },
  menuki: {
    label: 'Menuki', dbValues: ['menuki'],
    routePrefix: 'fittings', subtitle: 'Japanese Sword Grip Ornaments',
  },
};

const SECONDARY_DIMS: Record<string, SecondaryDim> = {
  // Certifications
  juyo: {
    label: 'Juyo', dbValues: ['juyo', 'Juyo'],
    param: 'cert', titleSuffix: 'NBTHK Certified Japanese Swords',
  },
  'tokubetsu-juyo': {
    label: 'Tokubetsu Juyo', dbValues: ['tokuju', 'Tokuju', 'tokubetsu_juyo'],
    param: 'cert', titleSuffix: 'NBTHK Supreme Designation',
  },
  hozon: {
    label: 'Hozon', dbValues: ['hozon', 'Hozon'],
    param: 'cert', titleSuffix: 'NBTHK Certified Authentic Swords',
  },
  'tokubetsu-hozon': {
    label: 'Tokubetsu Hozon', dbValues: ['tokubetsu_hozon', 'TokuHozon'],
    param: 'cert', titleSuffix: 'NBTHK Especially Worthy',
  },
  // Eras
  koto: {
    label: 'Koto', dbValues: ['koto', 'Koto'],
    param: 'era', titleSuffix: 'Ancient Japanese Swords Pre-1596',
  },
  shinto: {
    label: 'Shinto', dbValues: ['shinto', 'Shinto'],
    param: 'era', titleSuffix: 'Edo Period Japanese Swords',
  },
  shinshinto: {
    label: 'Shinshinto', dbValues: ['shinshinto', 'Shinshinto'],
    param: 'era', titleSuffix: 'Late Edo Revival Swords',
  },
  // Schools
  bizen: {
    label: 'Bizen', dbValues: ['bizen', 'Bizen'],
    param: 'school', titleSuffix: 'Japanese Swords from Bizen Province',
  },
  soshu: {
    label: 'Soshu', dbValues: ['soshu', 'Soshu', 'sagami', 'Sagami'],
    param: 'school', titleSuffix: 'Masamune Tradition Swords',
  },
  yamashiro: {
    label: 'Yamashiro', dbValues: ['yamashiro', 'Yamashiro'],
    param: 'school', titleSuffix: 'Kyoto Tradition Swords',
  },
  mino: {
    label: 'Mino', dbValues: ['mino', 'Mino'],
    param: 'school', titleSuffix: 'Seki Tradition Japanese Swords',
  },
  yamato: {
    label: 'Yamato', dbValues: ['yamato', 'Yamato'],
    param: 'school', titleSuffix: 'Nara Temple Tradition Swords',
  },
};

// ── Hand-written Content ────────────────────────────────────────────────────

// Type page content
const TYPE_CONTENT: Record<string, { metaDescription: string; intro: string }> = {
  katana: {
    metaDescription:
      'Browse authentic Japanese katana for sale from 44 trusted dealers in Japan and worldwide. NBTHK certified, with detailed specifications and provenance.',
    intro:
      'The katana is the iconic long sword of the Japanese samurai, typically measuring over 60 cm in blade length (nagasa). Renowned for its curved, single-edged blade and exceptional craftsmanship, the katana has been the primary weapon and status symbol of the warrior class since the Muromachi period. Browse authenticated katana from leading Japanese and international dealers.',
  },
  wakizashi: {
    metaDescription:
      'Browse authentic Japanese wakizashi for sale. The companion short sword worn alongside the katana, from 30-60 cm blade length. NBTHK certified pieces available.',
    intro:
      'The wakizashi is a traditional Japanese short sword with a blade length between 30 and 60 cm. Worn as the companion blade alongside the katana in the daisho pair, the wakizashi served both as a backup weapon and for close-quarters combat. Many feature exceptional artistry, often by the same smiths who forged katana.',
  },
  tanto: {
    metaDescription:
      'Browse authentic Japanese tanto for sale. Traditional daggers under 30 cm, prized for their craftsmanship and as collectible art objects. NBTHK certified.',
    intro:
      'The tanto is a Japanese dagger with a blade under 30 cm, carried by samurai as a personal sidearm and self-defense weapon. Tanto were often lavishly decorated and are among the most sought-after collectible blades, with many receiving the highest NBTHK designations. Their compact size also makes them ideal entry points for new collectors.',
  },
  tachi: {
    metaDescription:
      'Browse authentic Japanese tachi for sale. The predecessor to the katana, worn edge-down by mounted warriors. Rare historical blades from trusted dealers.',
    intro:
      'The tachi is the predecessor to the katana, a long sword worn suspended edge-down from the belt — unlike the katana which is thrust through the obi edge-up. Tachi were the dominant sword form from the Heian through early Muromachi periods and were often the work of the most celebrated ancient smiths. They are among the rarest and most valuable nihonto.',
  },
  naginata: {
    metaDescription:
      'Browse authentic Japanese naginata blades for sale. Traditional polearm blades and naginata-naoshi conversions from trusted dealers worldwide.',
    intro:
      'The naginata is a Japanese polearm featuring a curved blade mounted on a long shaft. Originally a battlefield weapon, many historical naginata blades were later shortened and remounted as swords (naginata-naoshi). These converted blades retain their distinctive wide curvature and are highly prized by collectors.',
  },
  yari: {
    metaDescription:
      'Browse authentic Japanese yari spear blades for sale. Traditional straight-bladed spears from the samurai era, available from trusted dealers.',
    intro:
      'The yari is a Japanese spear with a straight blade, used extensively on the battlefield from the Kamakura through Edo periods. Yari come in many forms — from simple su-yari to cross-bladed jumonji-yari — and represent some of the finest examples of Japanese metalworking. They are less common on the market than swords, making them particularly collectible.',
  },
  tsuba: {
    metaDescription:
      'Browse authentic Japanese tsuba (sword guards) for sale from 44 dealers. Iron, shakudo, and gold tsuba by renowned makers. NBTHK certified pieces available.',
    intro:
      'The tsuba is the hand guard of a Japanese sword, positioned between the blade and the grip. Far more than functional protection, tsuba evolved into miniature works of art featuring intricate designs in iron, copper, shakudo, and precious metals. They are the most widely collected category of Japanese sword fittings (tosogu), with pieces by famous schools like Goto, Nara, and Yokoya commanding premium prices.',
  },
  'fuchi-kashira': {
    metaDescription:
      'Browse authentic Japanese fuchi-kashira sets for sale. Matching collar and pommel cap sets for sword handles from trusted dealers.',
    intro:
      'Fuchi-kashira are the matching pair of fittings at either end of the Japanese sword handle: the fuchi (collar at the guard end) and the kashira (pommel cap). Sold as matched sets, they showcase the maker\'s skill in miniature metalwork with themes from nature, mythology, and warrior culture.',
  },
  kozuka: {
    metaDescription:
      'Browse authentic Japanese kozuka for sale. Decorative utility knife handles fitted into sword scabbards, from trusted dealers worldwide.',
    intro:
      'The kozuka is the decorative handle of a small utility knife (kogatana) that fits into a slot in the sword scabbard. These palm-sized masterpieces feature some of the most refined metalwork in the tosogu tradition, with intricate inlay work in gold, silver, and shakudo by celebrated makers.',
  },
  menuki: {
    metaDescription:
      'Browse authentic Japanese menuki for sale. Small sculptural grip ornaments for sword handles from trusted nihonto dealers.',
    intro:
      'Menuki are small sculptural ornaments placed beneath the wrapping of a Japanese sword handle. Sold in mirror-image pairs, these tiny works of art depict dragons, tigers, deities, and scenes from Japanese legend. Despite their diminutive size, menuki by top makers are highly valued and represent an accessible entry point into tosogu collecting.',
  },
};

// Certification page content (custom h1/title that don't follow the template)
const CERT_CONTENT: Record<string, { h1: string; title: string; metaDescription: string; intro: string }> = {
  juyo: {
    h1: 'Juyo Token — Important Swords for Sale',
    title: 'Juyo Token Swords for Sale — NBTHK Important Swords | NihontoWatch',
    metaDescription:
      'Browse NBTHK Juyo Token (Important Sword) certified Japanese swords for sale. The highest regularly awarded designation, representing the finest nihonto available.',
    intro:
      'Juyo Token ("Important Sword") is the highest designation regularly awarded by the NBTHK (Society for Preservation of Japanese Art Swords). Only swords of exceptional quality, historical significance, and excellent preservation receive this honor. Juyo blades represent the top tier of what collectors can realistically acquire, and they are universally recognized as benchmarks of quality in the nihonto world.',
  },
  'tokubetsu-juyo': {
    h1: 'Tokubetsu Juyo — Supreme Swords for Sale',
    title: 'Tokubetsu Juyo Swords for Sale — NBTHK Supreme Designation | NihontoWatch',
    metaDescription:
      'Browse NBTHK Tokubetsu Juyo (Especially Important) certified Japanese swords. The rarest and most prestigious NBTHK designation, reserved for national-treasure-caliber blades.',
    intro:
      'Tokubetsu Juyo Token ("Especially Important Sword") is the most prestigious NBTHK designation, awarded to blades considered equal in quality to National Treasures and Important Cultural Properties. Fewer than 900 items have ever received this honor since 1971. Acquiring a Tokubetsu Juyo blade is a defining moment for any serious collector.',
  },
  hozon: {
    h1: 'Hozon — Certified Swords for Sale',
    title: 'Hozon Certified Swords for Sale — NBTHK Worthy of Preservation | NihontoWatch',
    metaDescription:
      'Browse NBTHK Hozon (Worthy of Preservation) certified Japanese swords and fittings. Authenticated pieces with official NBTHK certification from trusted dealers.',
    intro:
      'Hozon ("Worthy of Preservation") is the foundational NBTHK certification confirming a sword\'s authenticity, quality, and historical merit. Hozon papers verify that a blade is a genuine Japanese sword of recognized craftsmanship — making it an essential baseline for collectors. Many Hozon-certified pieces offer exceptional value and are actively sought by collectors building their first collections.',
  },
  'tokubetsu-hozon': {
    h1: 'Tokubetsu Hozon — Especially Worthy Swords for Sale',
    title: 'Tokubetsu Hozon Swords for Sale — NBTHK Especially Worthy | NihontoWatch',
    metaDescription:
      'Browse NBTHK Tokubetsu Hozon (Especially Worthy of Preservation) certified Japanese swords. A step above Hozon, indicating superior quality and condition.',
    intro:
      'Tokubetsu Hozon ("Especially Worthy of Preservation") is the NBTHK designation above Hozon, awarded to swords of notably superior quality, condition, or historical interest. These blades are strong candidates for future Juyo submission and represent a sweet spot for collectors seeking quality with room for appreciation.',
  },
};

// Combination page content
const COMBO_CONTENT: Record<string, { metaDescription: string; intro: string }> = {
  // cert × type
  'juyo-katana': {
    metaDescription:
      'Browse NBTHK Juyo certified katana from trusted dealers worldwide. Important Sword designation — the pinnacle of collectible Japanese long swords available to serious collectors.',
    intro:
      'A Juyo katana represents the intersection of the most iconic Japanese sword form with the highest regularly awarded NBTHK designation. Only katana of exceptional quality, preservation, and historical significance receive the Juyo Token ("Important Sword") certificate. These blades are universally recognized as the gold standard for collectors seeking museum-quality long swords. Each Juyo katana has passed rigorous examination by Japan\'s foremost sword scholars, confirming its authenticity, attribution, and outstanding artistic merit.',
  },
  'juyo-wakizashi': {
    metaDescription:
      'Browse NBTHK Juyo certified wakizashi from trusted dealers. Important Sword designated companion blades showcasing exceptional craftsmanship in the short sword form.',
    intro:
      'Juyo-designated wakizashi represent the finest examples of the traditional Japanese companion sword. While often overshadowed by the katana, the wakizashi demanded equal skill from the smith and frequently features more adventurous hamon patterns and innovative forging techniques. NBTHK Juyo certification confirms these blades as works of exceptional artistic merit, making them prized acquisitions for discerning collectors who appreciate the subtlety and craftsmanship of the shorter blade form.',
  },
  'juyo-tanto': {
    metaDescription:
      'Browse NBTHK Juyo certified tanto from trusted dealers. Important Sword designated Japanese daggers — compact masterpieces of the swordsmith\'s art.',
    intro:
      'Juyo tanto are among the most coveted items in nihonto collecting. The tanto form, with its blade under 30 cm, showcases the swordsmith\'s artistry in concentrated form — every detail of the hamon, jigane, and sugata is immediately visible. Many of Japan\'s greatest smiths, from Masamune to Sadamune, are best known for their tanto. NBTHK Juyo certification confirms these blades as works of the highest caliber, often by attributed masters whose larger works rarely appear on the market.',
  },
  'juyo-tsuba': {
    metaDescription:
      'Browse NBTHK Juyo certified tsuba from trusted dealers. Important Art Object designated Japanese sword guards — the finest collectible tosogu available.',
    intro:
      'Juyo-designated tsuba represent the pinnacle of Japanese sword guard artistry. The NBTHK Juyo certification confirms these tsuba as works of exceptional artistic merit by master metalworkers of the Goto, Nara, Yokoya, and other celebrated schools. Juyo tsuba feature extraordinary craftsmanship in materials including iron, shakudo, shibuichi, and gold — with techniques ranging from dramatic sukashi (openwork) to intricate inlay. These are the most collectible sword guards on the market, prized by institutions and private collectors worldwide.',
  },
  'hozon-katana': {
    metaDescription:
      'Browse NBTHK Hozon certified katana from trusted dealers. Authenticated Japanese long swords with official certification — ideal for building a quality collection.',
    intro:
      'Hozon ("Worthy of Preservation") certified katana offer an accessible entry into authenticated nihonto collecting. The NBTHK Hozon designation confirms a blade\'s authenticity, craftsmanship, and historical merit — essential baseline assurance for any serious purchase. Hozon katana span every era and school of Japanese swordmaking, from storied Koto masterworks to refined Shinto-era blades. Many represent outstanding value, as the Hozon tier includes pieces that may be candidates for future higher certification.',
  },
  'hozon-tsuba': {
    metaDescription:
      'Browse NBTHK Hozon certified tsuba from trusted dealers. Authenticated Japanese sword guards with official certification — the foundation of quality tosogu collecting.',
    intro:
      'Hozon-certified tsuba provide the essential foundation for building a quality tosogu collection. The NBTHK Hozon designation authenticates these sword guards as genuine works of recognized craftsmanship and historical merit. The category spans an enormous range — from austere iron tsuba by provincial smiths to refined soft-metal guards by Kyoto masters. Hozon tsuba offer collectors authenticated pieces at accessible price points, making them ideal for both new collectors and experienced buyers seeking specific schools or themes.',
  },
  'tokubetsu-hozon-katana': {
    metaDescription:
      'Browse NBTHK Tokubetsu Hozon certified katana. Especially Worthy of Preservation — superior quality swords one step below Juyo, ideal for serious collectors.',
    intro:
      'Tokubetsu Hozon ("Especially Worthy of Preservation") katana occupy a compelling position in the nihonto hierarchy — a step above standard Hozon, indicating superior quality, condition, or historical significance. These blades are strong candidates for Juyo submission and represent what many experienced collectors consider the sweet spot: authenticated excellence with meaningful room for appreciation. For collectors building a focused collection of quality blades, Tokubetsu Hozon katana deliver outstanding artistic merit at accessible price points.',
  },
  'tokubetsu-juyo-katana': {
    metaDescription:
      'Browse NBTHK Tokubetsu Juyo katana — the rarest designation. Fewer than 900 items have ever received this honor. National-treasure-caliber Japanese long swords.',
    intro:
      'A Tokubetsu Juyo katana represents the absolute pinnacle of the nihonto collecting world. This NBTHK designation — "Especially Important Sword" — is reserved for blades considered equal in quality to National Treasures and Important Cultural Properties. Fewer than 900 items in total have ever received this honor since the program began in 1971. Acquiring a Tokubetsu Juyo katana is a once-in-a-generation event for most collectors, representing the culmination of decades of connoisseurship.',
  },
  // era × type
  'koto-katana': {
    metaDescription:
      'Browse Koto-era katana from trusted dealers. Pre-1596 Japanese long swords from the golden age of swordmaking — Bizen, Soshu, Yamashiro, and other legendary traditions.',
    intro:
      'Koto ("old sword") katana date from the earliest period of Japanese swordmaking through 1596, encompassing the golden age of the craft. This era produced the legendary Five Traditions (Gokaden) — Bizen, Soshu, Yamashiro, Yamato, and Mino — and the most celebrated smiths in history: Masamune, Sadamune, Go Yoshihiro, and Osafune Nagamitsu. Koto katana are distinguished by their use of locally smelted tamahagane steel, resulting in characteristic jigane patterns that cannot be replicated. They represent the most historically significant and collectible category of Japanese long swords.',
  },
  'koto-wakizashi': {
    metaDescription:
      'Browse Koto-era wakizashi from trusted dealers. Pre-1596 Japanese short swords from the golden age of swordmaking, featuring legendary school traditions.',
    intro:
      'Koto wakizashi are short swords from the earliest period of Japanese swordmaking through 1596. Many Koto-era short blades were originally full-length tachi or katana that were shortened (suriage) in later periods — meaning they may preserve the work of master smiths from centuries ago. Others were purpose-forged companion blades by the same schools and smiths that produced legendary long swords. Koto wakizashi showcase the distinctive steel and forging characteristics of ancient Japan\'s great swordmaking traditions.',
  },
  'koto-tanto': {
    metaDescription:
      'Browse Koto-era tanto from trusted dealers. Pre-1596 Japanese daggers — highly prized collectible blades from the golden age, many by celebrated master smiths.',
    intro:
      'Koto tanto are among the most treasured items in nihonto collecting. The Kamakura and Nanbokucho periods produced an extraordinary concentration of tanto masterworks by the greatest smiths in history — Masamune, Sadamune, Shintogo Kunimitsu, and Awataguchi Yoshimitsu. The compact blade form demanded the highest skill and allowed smiths to express the full range of their artistry. Many Koto tanto carry NBTHK Juyo or Tokubetsu Juyo designations, reflecting their exceptional quality and historical importance.',
  },
  'shinto-katana': {
    metaDescription:
      'Browse Shinto-era katana from trusted dealers. Edo period Japanese long swords (1596-1781) — refined craftsmanship from Japan\'s era of peace and artistic flourishing.',
    intro:
      'Shinto ("new sword") katana date from 1596 to approximately 1781, spanning the peaceful Edo period when swordsmiths concentrated on artistic excellence rather than battlefield utility. This era saw the development of spectacular hamon patterns, innovative forging techniques, and flamboyant styles that reflected the aesthetic sensibilities of the time. Great Shinto smiths like Kotetsu, Shinkai, and Tadayoshi created blades renowned for their beauty and cutting ability. Shinto katana are generally better preserved than Koto blades and offer collectors the chance to own Edo-era masterworks.',
  },
  'shinshinto-katana': {
    metaDescription:
      'Browse Shinshinto-era katana from trusted dealers. Late Edo revival swords (1781-1876) — a renaissance in Japanese swordmaking led by master smiths like Suishinshi Masahide.',
    intro:
      'Shinshinto ("new-new sword") katana represent the final flowering of traditional Japanese swordmaking, from approximately 1781 to the Meiji abolition in 1876. This era was a conscious revival led by Suishinshi Masahide, who sought to recreate the qualities of Koto-era blades. Shinshinto smiths like Koyama Munetsugu, Sa Yukihide, and Taikei Naotane produced katana of exceptional quality that rivaled ancient masterworks. These blades typically feature excellent preservation and bold characteristics that make them highly appealing to collectors.',
  },
  // school × type
  'bizen-katana': {
    metaDescription:
      'Browse Bizen school katana from trusted dealers. Japan\'s most prolific swordmaking tradition — Osafune, Ichimonji, and other legendary Bizen lineages.',
    intro:
      'Bizen province (modern Okayama) was Japan\'s most prolific and celebrated swordmaking center, producing more blades than all other provinces combined. The Bizen tradition is known for its characteristic choji midare hamon, warm and active jigane, and excellent balance between beauty and cutting performance. Legendary Bizen schools include Ichimonji, Osafune (Nagamitsu, Kagemitsu, Mitsutada), and Ko-Bizen. From the Heian period through the late Muromachi, Bizen smiths set the standard for Japanese swordmaking that endures to this day.',
  },
  'bizen-wakizashi': {
    metaDescription:
      'Browse Bizen school wakizashi from trusted dealers. Short swords from Japan\'s most celebrated swordmaking tradition — Osafune and Ichimonji lineages.',
    intro:
      'Bizen wakizashi showcase the distinctive qualities of Japan\'s most prolific swordmaking tradition in the companion blade format. Many are suriage (shortened) from full-length tachi by master smiths of the Osafune school, preserving centuries-old craftsmanship in a more compact form. Purpose-forged Bizen wakizashi display the same warm jigane and spectacular choji hamon that define the tradition. These blades offer collectors access to the Bizen legacy at approachable sizes and price points.',
  },
  'bizen-tanto': {
    metaDescription:
      'Browse Bizen school tanto from trusted dealers. Japanese daggers from the Bizen tradition — compact masterworks by Osafune and Ichimonji smiths.',
    intro:
      'Bizen tanto represent some of the most sought-after compact blades in nihonto collecting. The Bizen tradition\'s characteristic warmth — rich jigane, lively choji hamon, and excellent utsuri — is expressed with particular intensity in the short blade format. Notable Bizen tanto by smiths like Kanemitsu, Nagamitsu, and the Ichimonji school frequently receive Juyo and Tokubetsu Juyo designations. For collectors, a Bizen tanto offers a direct connection to the greatest swordmaking province in Japanese history.',
  },
  'soshu-katana': {
    metaDescription:
      'Browse Soshu (Sagami) school katana from trusted dealers. The tradition of Masamune — Japan\'s most revered swordmaking school, famous for nie-based tempering.',
    intro:
      'The Soshu (Sagami) tradition represents the most revered school in Japanese swordmaking, centered in Kamakura and defined by the legendary Masamune and his students. Soshu blades are characterized by brilliant nie crystals, dramatic notare and hitatsura hamon, and kinsuji/sunagashi activity that creates a dazzling visual effect. The Soshu style revolutionized Japanese swordmaking in the Kamakura period and influenced every subsequent tradition. Genuine Soshu school katana are among the rarest and most valuable nihonto, with top examples ranked as National Treasures.',
  },
  'yamashiro-katana': {
    metaDescription:
      'Browse Yamashiro school katana from trusted dealers. The elegant Kyoto tradition — Awataguchi, Rai, and other refined lineages prized for suguha and ko-nie.',
    intro:
      'The Yamashiro tradition, centered in Kyoto, produced some of the most elegant and refined blades in Japanese sword history. Known for their dignified suguha (straight) hamon, fine ko-nie, and noble sugata, Yamashiro blades reflect the aristocratic culture of the imperial capital. The Awataguchi school (Yoshimitsu, Kuniyoshi) and Rai school (Kunitoshi, Kunimitsu) are among the most celebrated lineages in all of nihonto. Yamashiro katana are prized by connoisseurs for their understated beauty and exceptional workmanship.',
  },
  'mino-katana': {
    metaDescription:
      'Browse Mino school katana from trusted dealers. The Seki tradition — practical, battle-ready swords from Japan\'s most versatile swordmaking province.',
    intro:
      'The Mino tradition, centered in Seki (modern Gifu), produced Japan\'s most practical and widely used battle swords. Mino smiths like Kanesada, Kanemoto (famous for the "three-cedar" sanbon-sugi hamon), and Muramura created blades renowned for their cutting ability and durability. The Mino style — characterized by togari-ba (pointed) hamon elements and robust construction — became the dominant school in the Sengoku (Warring States) period when demand for effective weapons was at its peak.',
  },
  'yamato-katana': {
    metaDescription:
      'Browse Yamato school katana from trusted dealers. The temple tradition of Nara — austere, functional blades from Japan\'s oldest swordmaking schools.',
    intro:
      'The Yamato tradition, rooted in Nara\'s great Buddhist temples, represents Japan\'s oldest organized swordmaking schools. The five Yamato schools — Senjuin, Taima, Tegai, Shikkake, and Hosho — produced blades characterized by masame-hada (straight grain), subdued hamon, and an austere, functional beauty that reflects their monastic origins. Yamato katana are relatively rare on the market compared to Bizen or Mino blades, making them prized finds for collectors interested in the deepest roots of Japanese swordmaking.',
  },
};

// ── Combination Specs ───────────────────────────────────────────────────────

const COMBO_SPECS: Array<{ dim: string; types: string[] }> = [
  // cert × type
  { dim: 'juyo', types: ['katana', 'wakizashi', 'tanto', 'tsuba'] },
  { dim: 'hozon', types: ['katana', 'tsuba'] },
  { dim: 'tokubetsu-hozon', types: ['katana'] },
  { dim: 'tokubetsu-juyo', types: ['katana'] },
  // era × type
  { dim: 'koto', types: ['katana', 'wakizashi', 'tanto'] },
  { dim: 'shinto', types: ['katana'] },
  { dim: 'shinshinto', types: ['katana'] },
  // school × type
  { dim: 'bizen', types: ['katana', 'wakizashi', 'tanto'] },
  { dim: 'soshu', types: ['katana'] },
  { dim: 'yamashiro', types: ['katana'] },
  { dim: 'mino', types: ['katana'] },
  { dim: 'yamato', types: ['katana'] },
];

// ── Generators ──────────────────────────────────────────────────────────────

function generateBaseTypes(): CategoryDef[] {
  return Object.entries(TYPE_DIMS).map(([key, dim]) => {
    const content = TYPE_CONTENT[key];
    return {
      slug: key,
      route: `/${dim.routePrefix}/${key}`,
      routePrefix: dim.routePrefix,
      filters: { type: dim.dbValues },
      title: `${dim.label} for Sale — ${dim.subtitle} | NihontoWatch`,
      h1: `${dim.label} for Sale`,
      metaDescription: content.metaDescription,
      intro: content.intro,
      relatedLinks: [], // computed below
    };
  });
}

function generateCertPages(): CategoryDef[] {
  return Object.entries(CERT_CONTENT).map(([key, content]) => {
    const dim = SECONDARY_DIMS[key];
    return {
      slug: key,
      route: `/certified/${key}`,
      routePrefix: 'certified',
      filters: { cert: dim.dbValues },
      title: content.title,
      h1: content.h1,
      metaDescription: content.metaDescription,
      intro: content.intro,
      relatedLinks: [], // computed below
    };
  });
}

function generateCombos(): CategoryDef[] {
  const results: CategoryDef[] = [];
  for (const { dim: dimKey, types } of COMBO_SPECS) {
    const secDim = SECONDARY_DIMS[dimKey];
    for (const typeKey of types) {
      const typeDim = TYPE_DIMS[typeKey];
      const slug = `${dimKey}-${typeKey}`;
      const content = COMBO_CONTENT[slug];
      if (!content) {
        throw new Error(`Missing content for combination category: ${slug}`);
      }
      results.push({
        slug,
        route: `/${typeDim.routePrefix}/${slug}`,
        routePrefix: typeDim.routePrefix,
        filters: { type: typeDim.dbValues, [secDim.param]: secDim.dbValues },
        parentSlug: typeKey,
        title: `${secDim.label} ${typeDim.label} for Sale — ${secDim.titleSuffix} | NihontoWatch`,
        h1: `${secDim.label} ${typeDim.label} for Sale`,
        metaDescription: content.metaDescription,
        intro: content.intro,
        relatedLinks: [], // computed below
      });
    }
  }
  return results;
}

// ── Related Links Computation ───────────────────────────────────────────────

function computeRelatedLinks(allCategories: CategoryDef[]): void {
  for (const cat of allCategories) {
    const links: Array<{ label: string; url: string }> = [];

    if (cat.parentSlug) {
      // Combination page
      const typeSlug = cat.parentSlug;
      const dimSlug = cat.slug.slice(0, -(typeSlug.length + 1));

      // 1. Parent type page
      const parentType = allCategories.find(c => c.slug === typeSlug && !c.parentSlug);
      if (parentType) {
        links.push({ label: `All ${parentType.h1.replace(' for Sale', '')}`, url: parentType.route });
      }

      // 2. Parent dim page (certified pages only — eras/schools don't have standalone pages)
      const parentDim = allCategories.find(c => c.slug === dimSlug && c.routePrefix === 'certified');
      if (parentDim) {
        links.push({ label: `All ${parentDim.h1.split(' — ')[0]}`, url: parentDim.route });
      }

      // 3. Same dim, different type (e.g., juyo-wakizashi for juyo-katana)
      const sameDim = allCategories.filter(c =>
        c.parentSlug && c !== cat && c.slug.startsWith(dimSlug + '-')
      );
      for (const s of sameDim.slice(0, 2)) {
        links.push({ label: s.h1.replace(' for Sale', ''), url: s.route });
      }

      // 4. Same type, different dim (e.g., hozon-katana for juyo-katana)
      const sameType = allCategories.filter(c =>
        c.parentSlug === typeSlug && c !== cat
      );
      for (const s of sameType.slice(0, 2)) {
        links.push({ label: s.h1.replace(' for Sale', ''), url: s.route });
      }
    } else if (cat.routePrefix === 'certified') {
      // Cert page: combo children + sibling certs
      const children = allCategories.filter(c => {
        if (!c.parentSlug) return false;
        const dimSlug = c.slug.slice(0, -(c.parentSlug.length + 1));
        return dimSlug === cat.slug;
      });
      for (const child of children.slice(0, 4)) {
        links.push({ label: child.h1.replace(' for Sale', ''), url: child.route });
      }
      const siblings = allCategories.filter(c => c.routePrefix === 'certified' && c !== cat);
      for (const s of siblings.slice(0, 2)) {
        links.push({ label: s.h1.split(' — ')[0], url: s.route });
      }
    } else {
      // Base type page: combo children + sibling types
      const children = allCategories.filter(c => c.parentSlug === cat.slug);
      for (const child of children.slice(0, 4)) {
        links.push({ label: child.h1.replace(' for Sale', ''), url: child.route });
      }
      const siblings = allCategories.filter(c =>
        c.routePrefix === cat.routePrefix && !c.parentSlug && c !== cat
      );
      for (const s of siblings.slice(0, 2)) {
        links.push({ label: s.h1.replace(' for Sale', ''), url: s.route });
      }
    }

    cat.relatedLinks = links.slice(0, 6);
  }
}

// ── Registry ────────────────────────────────────────────────────────────────

const ALL_CATEGORIES: CategoryDef[] = [
  ...generateBaseTypes(),
  ...generateCertPages(),
  ...generateCombos(),
];

computeRelatedLinks(ALL_CATEGORIES);

// Index by routePrefix + slug for fast lookup
const ROUTE_INDEX: Record<string, Record<string, CategoryDef>> = {};
for (const cat of ALL_CATEGORIES) {
  if (!ROUTE_INDEX[cat.routePrefix]) ROUTE_INDEX[cat.routePrefix] = {};
  ROUTE_INDEX[cat.routePrefix][cat.slug] = cat;
}

// ── Lookup Functions ────────────────────────────────────────────────────────

/** Look up a category by its route prefix and slug. */
export function getCategoryByRoute(routePrefix: string, slug: string): CategoryDef | undefined {
  return ROUTE_INDEX[routePrefix]?.[slug];
}

/** Get all slugs for a given route prefix (for generateStaticParams). */
export function getAllSlugsByRoute(routePrefix: string): string[] {
  return Object.keys(ROUTE_INDEX[routePrefix] || {});
}

// Backward-compatible wrappers (used by some consumers)

export function getSwordCategory(slug: string): CategoryDef | undefined {
  const cat = ROUTE_INDEX['swords']?.[slug];
  return cat && !cat.parentSlug ? cat : undefined;
}

export function getFittingCategory(slug: string): CategoryDef | undefined {
  const cat = ROUTE_INDEX['fittings']?.[slug];
  return cat && !cat.parentSlug ? cat : undefined;
}

export function getCertCategory(slug: string): CategoryDef | undefined {
  return ROUTE_INDEX['certified']?.[slug];
}

export function getCombinationSwordCategory(slug: string): CategoryDef | undefined {
  const cat = ROUTE_INDEX['swords']?.[slug];
  return cat?.parentSlug ? cat : undefined;
}

export function getCombinationFittingCategory(slug: string): CategoryDef | undefined {
  const cat = ROUTE_INDEX['fittings']?.[slug];
  return cat?.parentSlug ? cat : undefined;
}

export function getAllSwordSlugs(): string[] {
  return Object.entries(ROUTE_INDEX['swords'] || {})
    .filter(([, cat]) => !cat.parentSlug)
    .map(([slug]) => slug);
}

export function getAllFittingSlugs(): string[] {
  return Object.entries(ROUTE_INDEX['fittings'] || {})
    .filter(([, cat]) => !cat.parentSlug)
    .map(([slug]) => slug);
}

export function getAllCertSlugs(): string[] {
  return Object.keys(ROUTE_INDEX['certified'] || {});
}

export function getAllCombinationSwordSlugs(): string[] {
  return Object.entries(ROUTE_INDEX['swords'] || {})
    .filter(([, cat]) => !!cat.parentSlug)
    .map(([slug]) => slug);
}

export function getAllCombinationFittingSlugs(): string[] {
  return Object.entries(ROUTE_INDEX['fittings'] || {})
    .filter(([, cat]) => !!cat.parentSlug)
    .map(([slug]) => slug);
}

// ── Entity URL Helpers (replaces entityLinks.ts) ────────────────────────────

// Build reverse lookup: item_type value → category page route
const _itemTypeToUrl: Record<string, string> = {};
for (const cat of ALL_CATEGORIES) {
  if (!cat.parentSlug && cat.filters.type && (cat.routePrefix === 'swords' || cat.routePrefix === 'fittings')) {
    for (const val of cat.filters.type) {
      _itemTypeToUrl[val.toLowerCase()] = cat.route;
    }
  }
}

// Build reverse lookup: cert_type value → certification page route
const _certToUrl: Record<string, string> = {};
for (const cat of ALL_CATEGORIES) {
  if (cat.routePrefix === 'certified' && cat.filters.cert) {
    for (const val of cat.filters.cert) {
      _certToUrl[val.toLowerCase()] = cat.route;
    }
  }
}

/** Map item_type to its category page URL, or null if no page exists. */
export function getItemTypeUrl(itemType: string): string | null {
  return _itemTypeToUrl[itemType.toLowerCase()] ?? null;
}

/** Map cert_type to its certification page URL, or null if no page exists. */
export function getCertUrl(certType: string): string | null {
  return _certToUrl[certType.toLowerCase()] ?? null;
}

/** Map dealer name to its dealer directory page URL. */
export function getDealerUrl(dealerName: string): string {
  return `/dealers/${createDealerSlug(dealerName)}`;
}
