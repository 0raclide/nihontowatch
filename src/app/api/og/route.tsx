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
  certTokuju: '#c090e0',
  certJuyo: '#70b0e8',
  certTokuHozon: '#e0a858',
  certHozon: '#e0d048',
};

// Supabase config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

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
        }}
      >
        {/* Tokugawa Mon - Large with elegant glow */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: `${OPUS.accent}12`,
            marginBottom: 40,
          }}
        >
          <img
            src={`${BASE_URL}/logo-mon.png`}
            width={140}
            height={140}
          />
        </div>

        {/* Brand Name */}
        <div style={{ fontSize: 72, fontWeight: 700, color: OPUS.accent, letterSpacing: '-0.02em' }}>
          Nihontowatch
        </div>

        {/* Tagline */}
        <div style={{ fontSize: 26, color: OPUS.textSecondary, marginTop: 20, letterSpacing: '0.02em' }}>
          Compare. Decide. Acquire.
        </div>

        {/* Subtext */}
        <div style={{ fontSize: 18, color: OPUS.textMuted, marginTop: 12 }}>
          All the dealers, one search.
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

export async function GET(request: NextRequest) {
  // Load font first - this is critical for Edge runtime
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

          {/* Footer - Elegant Branding */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 56px',
              backgroundColor: OPUS.surface,
              borderTop: `1px solid ${OPUS.surfaceElevated}`,
              gap: 20,
            }}
          >
            {/* Mon - Larger, with subtle glow effect via background */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: `${OPUS.accent}15`,
              }}
            >
              <img
                src={`${BASE_URL}/logo-mon.png`}
                width={44}
                height={44}
              />
            </div>

            {/* Brand text */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 22, fontWeight: 600, color: OPUS.accent, letterSpacing: '-0.01em' }}>
                nihontowatch.com
              </span>
              <span style={{ fontSize: 13, color: OPUS.textMuted, marginTop: 2 }}>
                Compare. Decide. Acquire.
              </span>
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
  } catch {
    // On any error, return the default OG image
    return generateDefaultOG(font);
  }
}
