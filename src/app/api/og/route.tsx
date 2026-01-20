import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Supabase config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cache the font fetch to avoid repeated requests
let fontCache: ArrayBuffer | null = null;

async function getFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;

  // Fetch Inter font as TTF from Google Fonts (Satori requires TTF/OTF, not woff2)
  // URL obtained from: https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap
  const fontResponse = await fetch(
    'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf'
  );

  if (!fontResponse.ok) {
    throw new Error(`Font fetch failed: ${fontResponse.status}`);
  }

  fontCache = await fontResponse.arrayBuffer();
  return fontCache;
}

// Certification tier colors
const CERT_COLORS: Record<string, string> = {
  tokuju: '#7c3aed',
  tokubetsu_juyo: '#7c3aed',
  'Tokubetsu Juyo': '#7c3aed',
  juyo: '#2563eb',
  Juyo: '#2563eb',
  tokuho: '#b45309',
  tokubetsu_hozon: '#b45309',
  'Tokubetsu Hozon': '#b45309',
  TokuHozon: '#b45309',
  hozon: '#ca8a04',
  Hozon: '#ca8a04',
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
  katana: 'KATANA',
  wakizashi: 'WAKIZASHI',
  tanto: 'TANTO',
  tachi: 'TACHI',
  naginata: 'NAGINATA',
  yari: 'YARI',
  ken: 'KEN',
  tsuba: 'TSUBA',
  menuki: 'MENUKI',
  kozuka: 'KOZUKA',
  kogai: 'KOGAI',
  fuchi: 'FUCHI',
  kashira: 'KASHIRA',
  fuchi_kashira: 'FUCHI-KASHIRA',
  'fuchi-kashira': 'FUCHI-KASHIRA',
  koshirae: 'KOSHIRAE',
  armor: 'ARMOR',
  helmet: 'HELMET',
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
          backgroundColor: '#0f0f0f',
          backgroundImage: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
          fontFamily: 'Inter',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700, color: '#c9a962' }}>
          Nihontowatch
        </div>
        <div style={{ fontSize: 28, color: '#6b7280', marginTop: 24 }}>
          Japanese Swords & Tosogu from Dealers Worldwide
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
            backgroundColor: '#0f0f0f',
            color: '#c9a962',
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

    // Generate the listing OG image
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 60,
            backgroundColor: '#0f0f0f',
            backgroundImage: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
            fontFamily: 'Inter',
          }}
        >
          {/* Top Row: Badges */}
          <div style={{ display: 'flex', gap: 12 }}>
            {certLabel && (
              <div
                style={{
                  display: 'flex',
                  backgroundColor: certColor || '#374151',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                {certLabel}
              </div>
            )}
            {itemTypeLabel && (
              <div
                style={{
                  display: 'flex',
                  backgroundColor: '#374151',
                  color: '#d1d5db',
                  padding: '10px 20px',
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                {itemTypeLabel}
              </div>
            )}
          </div>

          {/* Middle: Title + Artisan + Dealer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                fontSize: 44,
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.2,
              }}
            >
              {title}
            </div>
            {artisan && (
              <div style={{ display: 'flex', fontSize: 26, color: '#9ca3af' }}>
                by {artisan}
              </div>
            )}
            <div style={{ display: 'flex', fontSize: 20, color: '#6b7280', marginTop: 4 }}>
              Available at {dealerName}
            </div>
          </div>

          {/* Bottom: Price + Branding */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: '#c9a962',
              }}
            >
              {priceDisplay}
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#c9a962',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <span style={{ color: '#0f0f0f', fontSize: 22, fontWeight: 700 }}>N</span>
              </div>
              <span style={{ fontSize: 22, color: '#6b7280' }}>nihontowatch.com</span>
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
