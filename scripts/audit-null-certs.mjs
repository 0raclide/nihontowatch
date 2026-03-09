#!/usr/bin/env node
/**
 * Audit: Listings with cert_type=NULL that likely have papers.
 *
 * Signals checked:
 *   1. Image URL patterns (cert/paper/hozon/juyo/鑑定書 in filename)
 *   2. raw_page_text loose patterns (broader than conservative extractor)
 *   3. Price anomaly (high price + no cert = suspicious)
 *   4. Elite artisan match (high elite_factor + no cert)
 *
 * Outputs per-dealer breakdown and ranked suspect list.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// --- env ---
const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// --- image URL cert patterns ---
const IMAGE_CERT_PATTERNS = [
  /鑑定書/i,
  /kanteisho/i,
  /certificate/i,
  /cert[_\-\/\.]/i,
  /papers?[_\-\/\.]/i,
  /nbthk/i,
  /\bhozon\b/i,
  /\bjuyo\b/i,
  /\btokuju\b/i,
  /tokubetsu/i,
  /shinsa/i,
  /origami/i,
  /nthk/i,
  /designation/i,
];

// --- raw_page_text loose cert patterns ---
// Broader than classify_cert_conservative — catches mentions conservative rejects
const TEXT_CERT_PATTERNS = [
  { name: 'JP: 鑑定書付/附', re: /鑑定書[付附き]/ },
  { name: 'JP: 保存刀剣', re: /保存刀剣/ },
  { name: 'JP: 特別保存刀剣', re: /特別保存刀剣/ },
  { name: 'JP: 重要刀剣', re: /重要刀剣/ },
  { name: 'JP: 特別重要刀剣', re: /特別重要刀剣/ },
  { name: 'JP: 保存刀装具', re: /保存刀装具/ },
  { name: 'JP: 特別保存刀装具', re: /特別保存刀装具/ },
  { name: 'JP: 重要刀装具', re: /重要刀装具/ },
  { name: 'JP: 重要美術品', re: /重要美術品/ },
  { name: 'JP: 特別貴重刀剣', re: /特別貴重刀剣/ },
  { name: 'JP: 貴重刀剣', re: /貴重刀剣/ },
  { name: 'EN: Juyo Token', re: /juyo\s+to[ou]?ken/i },
  { name: 'EN: Tokubetsu Juyo', re: /tokubetsu\s+juyo/i },
  { name: 'EN: Tokubetsu Hozon', re: /tokubetsu\s+hozon/i },
  { name: 'EN: Hozon Token', re: /hozon\s+to[ou]?ken/i },
  { name: 'EN: Hozon certificate', re: /hozon\s+(certificate|paper)/i },
  { name: 'EN: NBTHK', re: /\bNBTHK\b/ },
  { name: 'EN: N.B.T.H.K', re: /N\.?B\.?T\.?H\.?K/i },
  { name: 'EN: Juyo Bijutsuhin', re: /juyo\s+bijutsuhin/i },
  { name: 'EN: certified/certification', re: /\bcertifi(ed|cation)\b/i },
  { name: 'EN: papered', re: /\bpapered\b/i },
  { name: 'EN: with papers', re: /with\s+papers?\b/i },
  { name: 'EN: Kanteisho', re: /kanteisho/i },
];

// --- price thresholds (in JPY) ---
const PRICE_THRESHOLDS = [
  { label: '≥5M JPY', min: 5_000_000 },
  { label: '≥2M JPY', min: 2_000_000 },
  { label: '≥1M JPY', min: 1_000_000 },
  { label: '≥500K JPY', min: 500_000 },
];

// --- helpers ---
async function fetchAllNullCert() {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, url, title, images, raw_page_text, price_value, price_currency, price_jpy, dealer_id, artisan_id, is_sold, is_available, item_type, cert_admin_locked')
      .is('cert_type', null)
      .eq('page_exists', true)
      .range(from, from + PAGE - 1);
    if (error) { console.error('Fetch error:', error); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function fetchDealerMap() {
  const { data } = await supabase.from('dealers').select('id, name, domain');
  const map = {};
  (data || []).forEach(d => { map[d.id] = d; });
  return map;
}

async function fetchEliteFactors(artisanIds) {
  // Fetch from yuhinkai artisan_makers
  const yuhinkai = createClient(env.YUHINKAI_SUPABASE_URL, env.YUHINKAI_SUPABASE_KEY);
  const unique = [...new Set(artisanIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const map = {};
  // Batch in chunks of 200
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const { data } = await yuhinkai.from('artisan_makers').select('maker_id, elite_factor').in('maker_id', chunk);
    (data || []).forEach(d => { map[d.maker_id] = d.elite_factor; });
  }
  return map;
}

// Rough currency conversion to JPY
const RATES = { JPY: 1, USD: 150, EUR: 160, GBP: 190, AUD: 100, CAD: 110, CHF: 170 };
function toJPY(value, currency) {
  if (!value || !currency) return null;
  const rate = RATES[currency.toUpperCase()] || null;
  return rate ? value * rate : null;
}

// --- main ---
async function main() {
  console.log('Fetching all NULL cert listings...');
  const listings = await fetchAllNullCert();
  console.log(`Total NULL cert listings (page_exists=true): ${listings.length}\n`);

  const dealers = await fetchDealerMap();

  // --- Signal 1: Image URL patterns ---
  console.log('='.repeat(80));
  console.log('SIGNAL 1: IMAGE URL PATTERNS');
  console.log('='.repeat(80));

  const imgHits = [];
  for (const l of listings) {
    if (!l.images || !Array.isArray(l.images)) continue;
    const matchedPatterns = new Set();
    const matchedUrls = [];
    for (const img of l.images) {
      const filename = typeof img === 'string' ? img : (img.url || img.src || '');
      for (const pat of IMAGE_CERT_PATTERNS) {
        if (pat.test(filename)) {
          matchedPatterns.add(pat.source);
          matchedUrls.push(filename.split('/').pop());
          break;
        }
      }
    }
    if (matchedPatterns.size > 0) {
      imgHits.push({ ...l, matchedPatterns: [...matchedPatterns], matchedUrls });
    }
  }

  console.log(`\nListings with cert-related image URLs: ${imgHits.length}`);

  // By dealer
  const imgByDealer = {};
  imgHits.forEach(h => {
    const d = dealers[h.dealer_id]?.name || `dealer_${h.dealer_id}`;
    imgByDealer[d] = (imgByDealer[d] || 0) + 1;
  });
  console.log('\nBy dealer:');
  Object.entries(imgByDealer).sort((a, b) => b[1] - a[1]).forEach(([d, c]) => {
    console.log(`  ${d}: ${c}`);
  });

  // By pattern
  const imgByPattern = {};
  imgHits.forEach(h => {
    h.matchedPatterns.forEach(p => {
      imgByPattern[p] = (imgByPattern[p] || 0) + 1;
    });
  });
  console.log('\nBy pattern:');
  Object.entries(imgByPattern).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
    console.log(`  ${p}: ${c}`);
  });

  // --- Signal 2: raw_page_text loose patterns ---
  console.log('\n' + '='.repeat(80));
  console.log('SIGNAL 2: RAW PAGE TEXT (loose patterns)');
  console.log('='.repeat(80));

  const textHits = [];
  for (const l of listings) {
    if (!l.raw_page_text) continue;
    const text = l.raw_page_text;
    const matchedNames = [];
    for (const { name, re } of TEXT_CERT_PATTERNS) {
      if (re.test(text)) {
        matchedNames.push(name);
      }
    }
    if (matchedNames.length > 0) {
      textHits.push({ ...l, matchedNames });
    }
  }

  console.log(`\nListings with cert text in raw_page_text: ${textHits.length}`);

  // By dealer
  const textByDealer = {};
  textHits.forEach(h => {
    const d = dealers[h.dealer_id]?.name || `dealer_${h.dealer_id}`;
    textByDealer[d] = (textByDealer[d] || 0) + 1;
  });
  console.log('\nBy dealer:');
  Object.entries(textByDealer).sort((a, b) => b[1] - a[1]).forEach(([d, c]) => {
    console.log(`  ${d}: ${c}`);
  });

  // By pattern name
  const textByPattern = {};
  textHits.forEach(h => {
    h.matchedNames.forEach(n => {
      textByPattern[n] = (textByPattern[n] || 0) + 1;
    });
  });
  console.log('\nBy pattern:');
  Object.entries(textByPattern).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
    console.log(`  ${p}: ${c}`);
  });

  // --- Signal 3: Price anomaly ---
  console.log('\n' + '='.repeat(80));
  console.log('SIGNAL 3: PRICE ANOMALY (high price + no cert)');
  console.log('='.repeat(80));

  const priceHits = [];
  for (const l of listings) {
    const jpy = l.price_jpy || toJPY(l.price_value, l.price_currency);
    if (jpy && jpy >= 500_000) {
      priceHits.push({ ...l, priceJpy: jpy });
    }
  }

  for (const threshold of PRICE_THRESHOLDS) {
    const count = priceHits.filter(h => h.priceJpy >= threshold.min).length;
    console.log(`  ${threshold.label}: ${count} listings`);
  }

  // Top 20 by price
  const sortedByPrice = priceHits.sort((a, b) => b.priceJpy - a.priceJpy);
  console.log(`\nTop 20 highest-priced NULL cert items:`);
  sortedByPrice.slice(0, 20).forEach(h => {
    const d = dealers[h.dealer_id]?.name || '?';
    const priceStr = `¥${h.priceJpy.toLocaleString()}`;
    const soldStr = h.is_sold ? ' [SOLD]' : '';
    console.log(`  ${priceStr} | ${d} | ${(h.title || '').substring(0, 60)}${soldStr}`);
    console.log(`    ${h.url}`);
  });

  // --- Signal 4: Elite artisan + no cert ---
  console.log('\n' + '='.repeat(80));
  console.log('SIGNAL 4: ELITE ARTISAN MATCH (high elite_factor + no cert)');
  console.log('='.repeat(80));

  const withArtisan = listings.filter(l => l.artisan_id && l.artisan_id !== 'UNKNOWN');
  console.log(`\nNULL cert listings with artisan_id: ${withArtisan.length}`);

  let eliteMap = {};
  try {
    eliteMap = await fetchEliteFactors(withArtisan.map(l => l.artisan_id));
    console.log(`Fetched elite_factor for ${Object.keys(eliteMap).length} artisans`);
  } catch (e) {
    console.log(`Could not fetch Yuhinkai data: ${e.message}`);
    console.log('Skipping elite artisan signal.');
  }

  const eliteHits = [];
  for (const l of withArtisan) {
    const ef = eliteMap[l.artisan_id];
    if (ef && ef > 0.05) {
      eliteHits.push({ ...l, eliteFactor: ef });
    }
  }

  if (eliteHits.length > 0) {
    console.log(`Listings with elite artisan (ef>0.05) + NULL cert: ${eliteHits.length}`);
    const sortedByElite = eliteHits.sort((a, b) => b.eliteFactor - a.eliteFactor);
    console.log('\nTop 20 by elite factor:');
    sortedByElite.slice(0, 20).forEach(h => {
      const d = dealers[h.dealer_id]?.name || '?';
      console.log(`  ef=${h.eliteFactor.toFixed(2)} | ${h.artisan_id} | ${d} | ${(h.title || '').substring(0, 55)}`);
    });
  }

  // --- COMBINED: Multi-signal suspects ---
  console.log('\n' + '='.repeat(80));
  console.log('COMBINED: MULTI-SIGNAL SUSPECTS');
  console.log('='.repeat(80));

  const imgIds = new Set(imgHits.map(h => h.id));
  const textIds = new Set(textHits.map(h => h.id));
  const priceIds = new Set(priceHits.map(h => h.id));
  const eliteIds = new Set(eliteHits.map(h => h.id));

  // Score each listing
  const scores = new Map();
  for (const l of listings) {
    let score = 0;
    const signals = [];
    if (imgIds.has(l.id)) { score += 3; signals.push('IMG'); }
    if (textIds.has(l.id)) { score += 3; signals.push('TEXT'); }
    if (priceIds.has(l.id)) { score += 2; signals.push('PRICE'); }
    if (eliteIds.has(l.id)) { score += 1; signals.push('ELITE'); }
    if (score > 0) {
      scores.set(l.id, { listing: l, score, signals });
    }
  }

  // Multi-signal (≥2 signals)
  const multiSignal = [...scores.values()].filter(s => s.signals.length >= 2);
  multiSignal.sort((a, b) => b.score - a.score);

  console.log(`\nTotal listings with any signal: ${scores.size}`);
  console.log(`Listings with ≥2 signals: ${multiSignal.length}`);

  // By dealer (multi-signal)
  const multiByDealer = {};
  multiSignal.forEach(s => {
    const d = dealers[s.listing.dealer_id]?.name || `dealer_${s.listing.dealer_id}`;
    multiByDealer[d] = (multiByDealer[d] || 0) + 1;
  });
  console.log('\nMulti-signal by dealer:');
  Object.entries(multiByDealer).sort((a, b) => b[1] - a[1]).forEach(([d, c]) => {
    console.log(`  ${d}: ${c}`);
  });

  // Top 50 suspects
  console.log(`\nTop 50 suspects (sorted by signal count + score):`);
  multiSignal.slice(0, 50).forEach(s => {
    const d = dealers[s.listing.dealer_id]?.name || '?';
    const soldStr = s.listing.is_sold ? ' [SOLD]' : '';
    console.log(`  [${s.signals.join('+')}] score=${s.score} | ${d} | ${(s.listing.title || '').substring(0, 50)}${soldStr}`);
    console.log(`    ${s.listing.url}`);
  });

  // --- OVERALL DEALER BREAKDOWN ---
  console.log('\n' + '='.repeat(80));
  console.log('OVERALL: NULL CERT BY DEALER (total vs flagged)');
  console.log('='.repeat(80));

  const dealerTotals = {};
  const dealerFlagged = {};
  listings.forEach(l => {
    const d = dealers[l.dealer_id]?.name || `dealer_${l.dealer_id}`;
    dealerTotals[d] = (dealerTotals[d] || 0) + 1;
  });
  [...scores.values()].forEach(s => {
    const d = dealers[s.listing.dealer_id]?.name || `dealer_${s.listing.dealer_id}`;
    dealerFlagged[d] = (dealerFlagged[d] || 0) + 1;
  });

  console.log('\n  Dealer                        | Total NULL | Flagged | Flag%');
  console.log('  ' + '-'.repeat(70));
  Object.entries(dealerTotals)
    .sort((a, b) => (dealerFlagged[b[0]] || 0) - (dealerFlagged[a[0]] || 0))
    .forEach(([d, total]) => {
      const flagged = dealerFlagged[d] || 0;
      const pct = total > 0 ? ((flagged / total) * 100).toFixed(1) : '0.0';
      console.log(`  ${d.padEnd(30)} | ${String(total).padStart(10)} | ${String(flagged).padStart(7)} | ${pct}%`);
    });
}

main().catch(console.error);
