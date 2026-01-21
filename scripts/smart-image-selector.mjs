#!/usr/bin/env node
/**
 * Smart Image Selector - Dealer-specific certificate image selection
 *
 * Each dealer has different patterns for where certificates appear.
 * This module implements per-dealer selection strategies.
 */

// Dealer-specific selection strategies
const DEALER_STRATEGIES = {
  'aoijapan': {
    name: 'Aoi Art',
    // Aoi Art uses explicit "paper-" naming convention
    strategy: 'url_pattern',
    patterns: [/paper-?\d*\.jpg/i],
    fallback: 'first',
    expected_success: '100%'
  },

  'eirakudo': {
    name: 'Eirakudo',
    // Eirakudo uses _z suffix for composite images containing certificates
    strategy: 'url_pattern',
    patterns: [/_z\.(jpg|jpeg)/i],
    fallback: 'first',
    composite: true, // Needs slicing
    expected_success: '66% (when composite exists)'
  },

  'token-net': {
    name: 'Token-net',
    // Token-net certificates are LATE in gallery (80-90% through)
    // Look for kan*.gif patterns or use late-gallery position
    strategy: 'url_pattern_or_position',
    patterns: [/kan\d*\.gif/i, /juyo.*paper/i, /paper.*juyo/i],
    position: 'late', // Use last 20% of images
    expected_success: '100% (Juyo specialist)'
  },

  'iida-koendo': {
    name: 'Iida Koendo',
    // Iida uses kan*.gif for certificates
    strategy: 'url_pattern',
    patterns: [/kan\d*\.gif/i],
    fallback: 'first',
    expected_success: '87%'
  },

  'katanahanbai': {
    name: 'Katanahanbai',
    // Certificates are NOT first - look for specific patterns
    strategy: 'url_pattern',
    patterns: [/jyuyou/i, /juyo/i, /cert/i, /paper/i, /setsumei/i],
    fallback: 'scan_all', // OCR all images if no pattern match
    expected_success: 'Unknown - testing'
  },

  'kusanaginosya': {
    name: 'Kusanaginosya',
    // Single-image galleries - just use first image
    strategy: 'first',
    expected_success: '66%'
  },

  'nipponto': {
    name: 'Nipponto',
    // Images may be blocked - need special headers
    strategy: 'url_pattern',
    patterns: [/paper/i, /kan/i, /cert/i],
    fallback: 'first',
    headers: {
      'Referer': 'https://www.nipponto.co.jp/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    },
    expected_success: 'Unknown - access issues'
  },

  'samurai-nippon': {
    name: 'Samurai Nippon',
    strategy: 'url_pattern',
    patterns: [/paper/i, /cert/i, /kan/i],
    fallback: 'first',
    expected_success: '50%'
  },

  // Default strategy for unknown dealers
  'default': {
    name: 'Default',
    strategy: 'url_pattern',
    patterns: [
      /paper/i, /cert/i, /setsumei/i, /kan\d*\.gif/i,
      /juyo/i, /nbthk/i, /origami/i, /shinsa/i
    ],
    fallback: 'first'
  }
};

/**
 * Get dealer key from URL
 */
function getDealerKey(url) {
  const dealerPatterns = [
    { key: 'aoijapan', pattern: /aoijapan/i },
    { key: 'eirakudo', pattern: /eirakudo/i },
    { key: 'token-net', pattern: /token-net/i },
    { key: 'iida-koendo', pattern: /iida-koendo/i },
    { key: 'katanahanbai', pattern: /katanahanbai/i },
    { key: 'kusanaginosya', pattern: /kusanagi/i },
    { key: 'nipponto', pattern: /nipponto/i },
    { key: 'samurai-nippon', pattern: /samurai-nippon/i },
  ];

  for (const { key, pattern } of dealerPatterns) {
    if (pattern.test(url)) return key;
  }
  return 'default';
}

/**
 * Select best certificate image(s) based on dealer strategy
 * Returns array of candidates in priority order
 */
export function selectCertificateImages(images, listingUrl) {
  if (!images || images.length === 0) return [];

  const dealerKey = getDealerKey(listingUrl);
  const strategy = DEALER_STRATEGIES[dealerKey] || DEALER_STRATEGIES['default'];

  const candidates = [];

  // Strategy 1: URL pattern matching
  if (strategy.patterns) {
    for (const pattern of strategy.patterns) {
      for (const img of images) {
        if (pattern.test(img)) {
          candidates.push({
            url: img,
            reason: `pattern_match: ${pattern}`,
            dealer: strategy.name,
            isComposite: strategy.composite || false
          });
        }
      }
    }
  }

  // Strategy 2: Late-gallery position (Token-net style)
  if (strategy.position === 'late' && candidates.length === 0) {
    const lateStart = Math.floor(images.length * 0.7);
    for (let i = images.length - 1; i >= lateStart; i--) {
      candidates.push({
        url: images[i],
        reason: `late_position: index ${i}/${images.length}`,
        dealer: strategy.name,
        isComposite: false
      });
    }
  }

  // Fallback strategies
  if (candidates.length === 0) {
    if (strategy.fallback === 'scan_all') {
      // Return all images for scanning
      for (const img of images) {
        candidates.push({
          url: img,
          reason: 'scan_all_fallback',
          dealer: strategy.name,
          isComposite: false
        });
      }
    } else {
      // Default: use first image
      candidates.push({
        url: images[0],
        reason: 'first_image_fallback',
        dealer: strategy.name,
        isComposite: strategy.composite || false
      });
    }
  }

  // Add headers if needed
  if (strategy.headers) {
    for (const c of candidates) {
      c.headers = strategy.headers;
    }
  }

  return candidates;
}

/**
 * Get strategy info for a dealer
 */
export function getStrategyInfo(listingUrl) {
  const dealerKey = getDealerKey(listingUrl);
  return DEALER_STRATEGIES[dealerKey] || DEALER_STRATEGIES['default'];
}

// Test the selector
async function test() {
  const testCases = [
    {
      url: 'https://aoijapan.com/item/12345',
      images: ['12345sword-1.jpg', '12345paper-1.jpg', '12345sword-2.jpg']
    },
    {
      url: 'https://eirakudo.shop/token/123',
      images: ['sword_b.jpg', 'sword_z.jpg']
    },
    {
      url: 'https://token-net.com/item/456',
      images: ['1-toushi0.jpg', '2-blade.jpg', '3-detail.jpg', '4-kan.gif', '5-paper.jpg']
    },
    {
      url: 'https://katanahanbai.com/item/789',
      images: ['sword-main.jpg', 'detail-1.jpg', 'jyuyou-cert.jpg', 'detail-2.jpg']
    }
  ];

  console.log('Smart Image Selector Test\n');

  for (const tc of testCases) {
    const candidates = selectCertificateImages(tc.images, tc.url);
    const strategy = getStrategyInfo(tc.url);

    console.log(`Dealer: ${strategy.name}`);
    console.log(`URL: ${tc.url}`);
    console.log(`Images: ${tc.images.length}`);
    console.log(`Selected: ${candidates.length} candidates`);
    candidates.forEach((c, i) => {
      console.log(`  [${i + 1}] ${c.url} (${c.reason})`);
    });
    console.log();
  }
}

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  test();
}
