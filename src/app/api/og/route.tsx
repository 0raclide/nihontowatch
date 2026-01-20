import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

// Use Node.js runtime for better compatibility with image fetching
export const runtime = 'nodejs';

// Supabase config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Certification tier colors
const CERT_COLORS: Record<string, { bg: string; text: string }> = {
  tokuju: { bg: '#4c1d95', text: '#ffffff' },
  'tokubetsu_juyo': { bg: '#4c1d95', text: '#ffffff' },
  'Tokubetsu Juyo': { bg: '#4c1d95', text: '#ffffff' },
  juyo: { bg: '#1e40af', text: '#ffffff' },
  'Juyo': { bg: '#1e40af', text: '#ffffff' },
  tokuho: { bg: '#78350f', text: '#ffffff' },
  'tokubetsu_hozon': { bg: '#78350f', text: '#ffffff' },
  'Tokubetsu Hozon': { bg: '#78350f', text: '#ffffff' },
  'TokuHozon': { bg: '#78350f', text: '#ffffff' },
  hozon: { bg: '#854d0e', text: '#ffffff' },
  'Hozon': { bg: '#854d0e', text: '#ffffff' },
};

// Human-readable certification labels
const CERT_LABELS: Record<string, string> = {
  tokuju: 'Tokubetsu Juyo',
  'tokubetsu_juyo': 'Tokubetsu Juyo',
  'Tokubetsu Juyo': 'Tokubetsu Juyo',
  juyo: 'Juyo',
  'Juyo': 'Juyo',
  tokuho: 'Tokubetsu Hozon',
  'tokubetsu_hozon': 'Tokubetsu Hozon',
  'Tokubetsu Hozon': 'Tokubetsu Hozon',
  'TokuHozon': 'Tokubetsu Hozon',
  hozon: 'Hozon',
  'Hozon': 'Hozon',
};

// Item type labels
const ITEM_TYPE_LABELS: Record<string, string> = {
  katana: 'Katana',
  wakizashi: 'Wakizashi',
  tanto: 'Tanto',
  tachi: 'Tachi',
  naginata: 'Naginata',
  yari: 'Yari',
  tsuba: 'Tsuba',
  'fuchi-kashira': 'Fuchi-Kashira',
  fuchi_kashira: 'Fuchi-Kashira',
  kozuka: 'Kozuka',
  menuki: 'Menuki',
  koshirae: 'Koshirae',
};

function formatPrice(value: number | null, currency: string | null): string {
  if (!value) return 'Price on Request';

  const curr = currency || 'JPY';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  });

  return formatter.format(value);
}

// Fetch image and convert to base64 data URL
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Nihontowatch/1.0)',
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get('id');

  // Default OG image for non-listing pages
  if (!listingId) {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            backgroundImage: 'radial-gradient(circle at 25% 25%, #2a2a2a 0%, transparent 50%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 40,
            }}
          >
            <span
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: '#c9a962',
                letterSpacing: '-0.02em',
              }}
            >
              Nihontowatch
            </span>
          </div>
          <span
            style={{
              fontSize: 32,
              color: '#a0a0a0',
              textAlign: 'center',
              maxWidth: 800,
            }}
          >
            The premier aggregator for Japanese swords and sword fittings from dealers worldwide
          </span>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }

  // Fetch listing data using REST API (edge-compatible)
  try {
    const listingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=id,title,price_value,price_currency,item_type,cert_type,smith,tosogu_maker,stored_images,images,dealers(name)`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!listingResponse.ok) {
      throw new Error('Failed to fetch listing');
    }

    const listings = await listingResponse.json();
    const listing = listings[0];

    if (!listing) {
      throw new Error('Listing not found');
    }

    // Get the first available image and fetch it as base64
    const images = listing.stored_images || listing.images || [];
    const rawImageUrl = images[0] || null;
    const imageDataUrl = rawImageUrl ? await fetchImageAsDataUrl(rawImageUrl) : null;

    // Get certification info
    const certType = listing.cert_type;
    const certColors = certType ? CERT_COLORS[certType] : null;
    const certLabel = certType ? CERT_LABELS[certType] || certType : null;

    // Get item type label
    const itemType = listing.item_type;
    const itemTypeLabel = itemType ? ITEM_TYPE_LABELS[itemType.toLowerCase()] || itemType : null;

    // Get artisan name
    const artisan = listing.smith || listing.tosogu_maker;

    // Format price
    const priceDisplay = formatPrice(listing.price_value, listing.price_currency);

    // Dealer name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dealerName = (listing.dealers as any)?.name || 'Unknown Dealer';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            backgroundColor: '#faf8f5',
          }}
        >
          {/* Left side - Image */}
          <div
            style={{
              width: '50%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f0ede8',
              padding: 40,
            }}
          >
            {imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageDataUrl}
                alt={listing.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  color: '#a0a0a0',
                  fontSize: 24,
                }}
              >
                No Image Available
              </div>
            )}
          </div>

          {/* Right side - Details */}
          <div
            style={{
              width: '50%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: 48,
              justifyContent: 'space-between',
            }}
          >
            {/* Top section */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Badges row */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                {certLabel && certColors && (
                  <div
                    style={{
                      display: 'flex',
                      backgroundColor: certColors.bg,
                      color: certColors.text,
                      padding: '8px 16px',
                      borderRadius: 6,
                      fontSize: 16,
                      fontWeight: 600,
                      textTransform: 'uppercase',
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
                      backgroundColor: '#e5e5e5',
                      color: '#525252',
                      padding: '8px 16px',
                      borderRadius: 6,
                      fontSize: 16,
                      fontWeight: 500,
                    }}
                  >
                    {itemTypeLabel}
                  </div>
                )}
              </div>

              {/* Title */}
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: '#1a1a1a',
                  lineHeight: 1.2,
                  marginBottom: 16,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {listing.title}
              </div>

              {/* Artisan */}
              {artisan && (
                <div
                  style={{
                    fontSize: 22,
                    color: '#525252',
                    marginBottom: 8,
                  }}
                >
                  {artisan}
                </div>
              )}

              {/* Dealer */}
              <div
                style={{
                  fontSize: 18,
                  color: '#737373',
                }}
              >
                via {dealerName}
              </div>
            </div>

            {/* Bottom section */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Price */}
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 700,
                  color: '#c9a962',
                  marginBottom: 24,
                }}
              >
                {priceDisplay}
              </div>

              {/* Branding */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: '#1a1a1a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ color: '#c9a962', fontSize: 18, fontWeight: 700 }}>N</span>
                </div>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: '#1a1a1a',
                  }}
                >
                  nihontowatch.com
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch {
    // Fallback to default OG image on error
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#c9a962',
            }}
          >
            Nihontowatch
          </span>
          <span
            style={{
              fontSize: 32,
              color: '#a0a0a0',
              marginTop: 20,
            }}
          >
            Japanese Sword & Tosogu Marketplace
          </span>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }
}
