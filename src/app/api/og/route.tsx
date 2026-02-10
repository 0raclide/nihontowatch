import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// =============================================================================
// OPUS THEME COLORS
// Deep sapphire with warm amber accents - elevated, contemplative
// =============================================================================
const OPUS = {
  // Backgrounds
  bg: '#0c1220',           // Deep sapphire
  bgWarm: '#101828',       // Slightly warmer
  surface: '#141c2c',      // Card surface
  surfaceElevated: '#1c2538',

  // Accent - warm amber
  accent: '#daa55a',
  accentLight: '#e8c080',

  // Text
  textPrimary: '#e8e4dc',   // Warm parchment
  textSecondary: '#c0b8a8',
  textMuted: '#8a847c',

  // Certification colors - Opus variants
  certKokuho: '#e07070',
  certTokuju: '#c090e0',
  certJuyo: '#70b0e8',
  certTokuHozon: '#e0a858',
  certHozon: '#e0d048',
};

// Supabase config — main database (listings)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

// Yuhinkai database credentials are read at call time in fetchArtistData()
// (Edge runtime may not resolve non-NEXT_PUBLIC_ env vars at module scope)

// Cache the font fetch to avoid repeated requests
let fontCache: ArrayBuffer | null = null;

async function getFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;

  // Fetch Inter font as TTF from Google Fonts (Satori requires TTF/OTF, not woff2)
  const fontResponse = await fetch(
    'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf'
  );

  if (!fontResponse.ok) {
    throw new Error(`Font fetch failed: ${fontResponse.status}`);
  }

  fontCache = await fontResponse.arrayBuffer();
  return fontCache;
}

// Certification colors - Opus theme
const CERT_COLORS: Record<string, string> = {
  tokuju: OPUS.certTokuju,
  tokubetsu_juyo: OPUS.certTokuju,
  'Tokubetsu Juyo': OPUS.certTokuju,
  juyo: OPUS.certJuyo,
  Juyo: OPUS.certJuyo,
  tokuho: OPUS.certTokuHozon,
  tokubetsu_hozon: OPUS.certTokuHozon,
  'Tokubetsu Hozon': OPUS.certTokuHozon,
  TokuHozon: OPUS.certTokuHozon,
  hozon: OPUS.certHozon,
  Hozon: OPUS.certHozon,
};

// Human-readable certification labels
const CERT_LABELS: Record<string, string> = {
  tokuju: 'TOKUBETSU JUYO',
  tokubetsu_juyo: 'TOKUBETSU JUYO',
  'Tokubetsu Juyo': 'TOKUBETSU JUYO',
  juyo: 'JUYO',
  Juyo: 'JUYO',
  tokuho: 'TOKUBETSU HOZON',
  tokubetsu_hozon: 'TOKUBETSU HOZON',
  'Tokubetsu Hozon': 'TOKUBETSU HOZON',
  TokuHozon: 'TOKUBETSU HOZON',
  hozon: 'HOZON',
  Hozon: 'HOZON',
};

// Item type display names
const ITEM_TYPE_LABELS: Record<string, string> = {
  katana: 'Katana',
  wakizashi: 'Wakizashi',
  tanto: 'Tantō',
  tachi: 'Tachi',
  naginata: 'Naginata',
  yari: 'Yari',
  ken: 'Ken',
  tsuba: 'Tsuba',
  menuki: 'Menuki',
  kozuka: 'Kōzuka',
  kogai: 'Kōgai',
  fuchi: 'Fuchi',
  kashira: 'Kashira',
  fuchi_kashira: 'Fuchi-Kashira',
  'fuchi-kashira': 'Fuchi-Kashira',
  koshirae: 'Koshirae',
  armor: 'Armor',
  helmet: 'Helmet',
};

function formatPrice(value: number | null, currency: string | null): string {
  if (!value) return 'Price on Request';
  const curr = currency || 'JPY';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Sanitize text for safe rendering in Satori.
 * Removes or replaces characters that might cause rendering issues.
 * Keeps ASCII, common punctuation, and romanized Japanese (romaji).
 */
function sanitizeText(text: string | null | undefined, maxLength = 100): string {
  if (!text) return '';

  // Convert to string and trim
  let safe = String(text).trim();

  // Replace Japanese characters with empty string for now
  // (Future: could add Japanese font support)
  // Keep: ASCII letters, numbers, spaces, common punctuation
  safe = safe.replace(/[^\x20-\x7E]/g, '');

  // Clean up multiple spaces
  safe = safe.replace(/\s+/g, ' ').trim();

  // Truncate if needed
  if (safe.length > maxLength) {
    safe = safe.substring(0, maxLength - 3) + '...';
  }

  return safe;
}

// =============================================================================
// Shared footer component for OG images
// =============================================================================
function BrandFooter() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 56px',
        backgroundColor: OPUS.surface,
        borderTop: `1px solid ${OPUS.surfaceElevated}`,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>
          <span style={{ color: OPUS.textPrimary }}>Nihonto</span>
          <span style={{ color: OPUS.accent }}>Watch</span>
        </div>
        <span style={{ fontSize: 12, color: OPUS.textSecondary, marginTop: 4 }}>
          Compare. Decide. Acquire.
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Default OG Image
// =============================================================================

/**
 * Generate the default/fallback OG image (used when no listing ID or on error)
 * Uses Opus theme - deep sapphire with warm amber accents
 */
async function generateDefaultOG(font: ArrayBuffer): Promise<ImageResponse> {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: OPUS.bg,
          fontFamily: 'Inter',
          position: 'relative',
        }}
      >
        {/* Subtle radial gradient overlay for depth */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            background: 'radial-gradient(ellipse at 50% 40%, rgba(218,165,90,0.06) 0%, transparent 70%)',
          }}
        />

        {/* Tokugawa Mon - Large with elegant glow */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: `${OPUS.accent}12`,
            marginBottom: 32,
          }}
        >
          <img
            src={`${BASE_URL}/logo-mon.png`}
            width={120}
            height={120}
          />
        </div>

        {/* Brand Name - Nihonto in parchment, Watch in gold */}
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, letterSpacing: '-0.02em' }}>
          <span style={{ color: OPUS.textPrimary }}>Nihonto</span>
          <span style={{ color: OPUS.accent }}>Watch</span>
        </div>

        {/* Tagline - HIGH CONTRAST */}
        <div style={{ fontSize: 28, color: OPUS.textPrimary, marginTop: 20, letterSpacing: '0.03em', fontWeight: 500 }}>
          Compare. Decide. Acquire.
        </div>

        {/* Stats line */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            marginTop: 28,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: OPUS.accent }}>44</div>
            <div style={{ fontSize: 16, color: OPUS.textSecondary }}>Dealers</div>
          </div>
          <div style={{ fontSize: 16, color: OPUS.textMuted }}>·</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: OPUS.accent }}>13,500+</div>
            <div style={{ fontSize: 16, color: OPUS.textSecondary }}>Artisans</div>
          </div>
          <div style={{ fontSize: 16, color: OPUS.textMuted }}>·</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 16, color: OPUS.textSecondary }}>Global Coverage</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Inter', data: font, style: 'normal', weight: 400 }],
    }
  );
}

// =============================================================================
// Artist OG Image
// =============================================================================

interface ArtistData {
  name_romaji: string | null;
  school: string | null;
  province: string | null;
  era: string | null;
  entity_type: 'smith' | 'tosogu';
  kokuho_count: number;
  tokuju_count: number;
  juyo_count: number;
  elite_factor: number;
  total_items: number;
}

async function fetchArtistData(code: string): Promise<ArtistData | null> {
  // Read env at call time (Edge runtime may not resolve at module scope)
  const yuUrl = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '';
  const yuKey = process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY || '';
  if (!yuUrl || !yuKey) return null;

  // Try smith_entities first
  const smithResponse = await fetch(
    `${yuUrl}/rest/v1/smith_entities?smith_id=eq.${encodeURIComponent(code)}&select=smith_id,name_romaji,school,province,era,juyo_count,tokuju_count,kokuho_count,elite_factor,total_items`,
    {
      headers: {
        apikey: yuKey,
        Authorization: `Bearer ${yuKey}`,
      },
    }
  );

  if (smithResponse.ok) {
    const smithRows = await smithResponse.json();
    if (smithRows.length > 0) {
      const s = smithRows[0];
      return {
        name_romaji: s.name_romaji,
        school: s.school,
        province: s.province,
        era: s.era,
        entity_type: 'smith',
        kokuho_count: s.kokuho_count || 0,
        tokuju_count: s.tokuju_count || 0,
        juyo_count: s.juyo_count || 0,
        elite_factor: s.elite_factor || 0,
        total_items: s.total_items || 0,
      };
    }
  }

  // Fall back to tosogu_makers
  const tosoguResponse = await fetch(
    `${yuUrl}/rest/v1/tosogu_makers?maker_id=eq.${encodeURIComponent(code)}&select=maker_id,name_romaji,school,province,era,juyo_count,tokuju_count,kokuho_count,elite_factor,total_items`,
    {
      headers: {
        apikey: yuKey,
        Authorization: `Bearer ${yuKey}`,
      },
    }
  );

  if (tosoguResponse.ok) {
    const tosoguRows = await tosoguResponse.json();
    if (tosoguRows.length > 0) {
      const t = tosoguRows[0];
      return {
        name_romaji: t.name_romaji,
        school: t.school,
        province: t.province,
        era: t.era,
        entity_type: 'tosogu',
        kokuho_count: t.kokuho_count || 0,
        tokuju_count: t.tokuju_count || 0,
        juyo_count: t.juyo_count || 0,
        elite_factor: t.elite_factor || 0,
        total_items: t.total_items || 0,
      };
    }
  }

  return null;
}

/**
 * Compute percentile rank text from elite_factor (0-1 scale).
 * Approximate thresholds based on the distribution of elite_factor values.
 */
function getElitePercentileText(eliteFactor: number, entityType: 'smith' | 'tosogu'): string | null {
  if (eliteFactor <= 0) return null;
  const label = entityType === 'smith' ? 'smiths' : 'tosogu makers';
  if (eliteFactor >= 0.40) return `Top 1% of all ${label}`;
  if (eliteFactor >= 0.20) return `Top 5% of all ${label}`;
  if (eliteFactor >= 0.10) return `Top 10% of all ${label}`;
  if (eliteFactor >= 0.05) return `Top 20% of all ${label}`;
  return null;
}

async function generateArtistOG(font: ArrayBuffer, code: string): Promise<ImageResponse> {
  const artist = await fetchArtistData(code);

  if (!artist) {
    return generateDefaultOG(font);
  }

  const name = sanitizeText(artist.name_romaji, 60) || code;
  const entityLabel = artist.entity_type === 'smith' ? 'SWORDSMITH' : 'TOSOGU MAKER';

  // Build subtitle parts
  const subtitleParts: string[] = [];
  const school = sanitizeText(artist.school, 30);
  const province = sanitizeText(artist.province, 20);
  const era = sanitizeText(artist.era, 30);
  if (school) subtitleParts.push(school);
  if (province) subtitleParts.push(province);
  if (era) subtitleParts.push(era);
  const subtitle = subtitleParts.join('  ·  ');

  // Build certification badges (only non-zero counts)
  const certBadges: Array<{ label: string; count: number; color: string }> = [];
  if (artist.kokuho_count > 0) {
    certBadges.push({ label: 'Kokuho', count: artist.kokuho_count, color: OPUS.certKokuho });
  }
  if (artist.tokuju_count > 0) {
    certBadges.push({ label: 'Tokubetsu Juyo', count: artist.tokuju_count, color: OPUS.certTokuju });
  }
  if (artist.juyo_count > 0) {
    certBadges.push({ label: 'Juyo', count: artist.juyo_count, color: OPUS.certJuyo });
  }

  const eliteText = getElitePercentileText(artist.elite_factor, artist.entity_type);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: OPUS.bg,
          fontFamily: 'Inter',
          padding: 0,
          position: 'relative',
        }}
      >
        {/* Subtle accent glow at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 200,
            display: 'flex',
            background: 'linear-gradient(180deg, rgba(218,165,90,0.06) 0%, transparent 100%)',
          }}
        />

        {/* Main Content Area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '48px 56px',
          }}
        >
          {/* Entity type label */}
          <div
            style={{
              display: 'flex',
              fontSize: 14,
              fontWeight: 500,
              color: OPUS.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              marginBottom: 16,
            }}
          >
            {entityLabel}
          </div>

          {/* Artist name - Large, warm */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: OPUS.textPrimary,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              marginBottom: 12,
            }}
          >
            {name}
          </div>

          {/* School · Province · Era subtitle */}
          {subtitle && (
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                color: OPUS.textSecondary,
                marginBottom: 28,
                letterSpacing: '0.01em',
              }}
            >
              {subtitle}
            </div>
          )}

          {/* Certification badges row */}
          {certBadges.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 24,
              }}
            >
              {certBadges.map((badge) => (
                <div
                  key={badge.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: `${badge.color}18`,
                    border: `2px solid ${badge.color}50`,
                    color: badge.color,
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{badge.count}</span>
                  <span>{badge.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Elite factor indicator */}
          {eliteText && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: OPUS.accent,
                }}
              />
              <div
                style={{
                  fontSize: 16,
                  color: OPUS.accent,
                  fontWeight: 500,
                }}
              >
                {eliteText}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Brand */}
        <BrandFooter />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Inter', data: font, style: 'normal', weight: 400 }],
    }
  );
}

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(request: NextRequest) {
  // Load font first
  let font: ArrayBuffer;
  try {
    font = await getFont();
  } catch {
    // If font fails to load, return a simple fallback without custom font
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: OPUS.bg,
            color: OPUS.accent,
            fontSize: 64,
          }}
        >
          Nihontowatch
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const { searchParams } = new URL(request.url);

  // Check for artist OG image first
  const artistCode = searchParams.get('artist');
  if (artistCode) {
    try {
      return await generateArtistOG(font, artistCode);
    } catch {
      return generateDefaultOG(font);
    }
  }

  const listingId = searchParams.get('id');

  // Default OG image for non-listing pages
  if (!listingId) {
    return generateDefaultOG(font);
  }

  // Validate listing ID is a positive integer
  const parsedId = parseInt(listingId, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    return generateDefaultOG(font);
  }

  try {
    const listingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${parsedId}&select=id,title,title_en,price_value,price_currency,item_type,cert_type,smith,tosogu_maker,dealers(name)`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!listingResponse.ok) {
      return generateDefaultOG(font);
    }

    const listings = await listingResponse.json();
    const listing = listings[0];

    if (!listing) {
      return generateDefaultOG(font);
    }

    // Extract and sanitize all text fields
    const certType = listing.cert_type as string | null;
    const certColor = certType ? CERT_COLORS[certType] || '#374151' : null;
    const certLabel = certType ? CERT_LABELS[certType] || sanitizeText(certType, 30).toUpperCase() : null;

    // Prefer English title, fall back to sanitized original title
    const rawTitle = listing.title_en || listing.title || 'Japanese Sword';
    const title = sanitizeText(rawTitle, 80) || 'Japanese Sword';

    // Sanitize artisan name (remove Japanese characters for now)
    const rawArtisan = listing.smith || listing.tosogu_maker || '';
    const artisan = sanitizeText(rawArtisan, 40);

    const priceDisplay = formatPrice(listing.price_value, listing.price_currency);
    const dealerName = sanitizeText(listing.dealers?.name, 30) || 'Dealer';

    // Get item type label
    const itemType = listing.item_type as string | null;
    const itemTypeLabel = itemType ? ITEM_TYPE_LABELS[itemType.toLowerCase()] || null : null;

    // Generate the listing OG image - Opus theme, elegant design
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: OPUS.bg,
            fontFamily: 'Inter',
            padding: 0,
          }}
        >
          {/* Main Content Area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '48px 56px',
            }}
          >
            {/* Item Type - subtle, elegant */}
            {itemTypeLabel && (
              <div
                style={{
                  display: 'flex',
                  fontSize: 14,
                  fontWeight: 500,
                  color: OPUS.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  marginBottom: 16,
                }}
              >
                {itemTypeLabel}
              </div>
            )}

            {/* Title - Large, commanding */}
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: OPUS.textPrimary,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                marginBottom: 12,
              }}
            >
              {title}
            </div>

            {/* Artisan - Secondary emphasis */}
            {artisan && (
              <div
                style={{
                  display: 'flex',
                  fontSize: 24,
                  color: OPUS.textSecondary,
                  marginBottom: 24,
                }}
              >
                {artisan}
              </div>
            )}

            {/* Certification Badge - Prominent if present */}
            {certLabel && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 32,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    backgroundColor: `${certColor}20`,
                    border: `2px solid ${certColor}`,
                    color: certColor || OPUS.accent,
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                  }}
                >
                  {certLabel}
                </div>
              </div>
            )}

            {/* Price - Elegant, prominent */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 700,
                  color: OPUS.accent,
                  letterSpacing: '-0.02em',
                }}
              >
                {priceDisplay}
              </div>
            </div>

            {/* Dealer */}
            <div
              style={{
                display: 'flex',
                fontSize: 16,
                color: OPUS.textMuted,
                marginTop: 12,
              }}
            >
              via {dealerName}
            </div>
          </div>

          {/* Footer - Brand */}
          <BrandFooter />
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [{ name: 'Inter', data: font, style: 'normal', weight: 400 }],
      }
    );
  } catch {
    // On any error, return the default OG image
    return generateDefaultOG(font);
  }
}
