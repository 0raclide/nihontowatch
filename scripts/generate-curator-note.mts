/**
 * One-shot script: generate curator's note for a listing.
 * Usage: npx tsx scripts/generate-curator-note.mts 90396
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// --- Inline imports (can't use @/ aliases in standalone scripts) ---
// We'll call the Supabase + OpenRouter APIs directly.

const LISTING_ID = parseInt(process.argv[2] || '90396');
if (isNaN(LISTING_ID)) { console.error('Usage: npx tsx scripts/generate-curator-note.mts <listing_id>'); process.exit(1); }

const nwUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const nwKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ykUrl = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL!;
const ykKey = process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY!;
const openrouterKey = process.env.OPENROUTER_API_KEY!;

const nw = createClient(nwUrl, nwKey);
const yk = createClient(ykUrl, ykKey);

// Step 1: Fetch listing
console.log(`\n📦 Fetching listing ${LISTING_ID}...`);
const { data: listing, error: listingErr } = await nw
  .from('listings')
  .select('id, title, item_type, item_category, nagasa_cm, sori_cm, motohaba_cm, sakihaba_cm, kasane_cm, mei_type, mei_text, era, tosogu_era, province, school, tosogu_school, cert_type, cert_session, cert_organization, artisan_id, setsumei_text_en, setsumei_text_ja, sayagaki, hakogaki, provenance, kiwame, koshirae')
  .eq('id', LISTING_ID)
  .single();

if (listingErr || !listing) { console.error('Listing not found:', listingErr); process.exit(1); }
console.log(`   Title: ${listing.title}`);
console.log(`   Artisan: ${listing.artisan_id || 'none'}`);
console.log(`   Cert: ${listing.cert_type || 'none'}`);
console.log(`   Setsumei EN: ${listing.setsumei_text_en ? listing.setsumei_text_en.slice(0, 80) + '...' : 'none'}`);

// Step 2: Fetch artisan from Yuhinkai
let artisan: any = null;
let aiDesc: { en: string | null; ja: string | null } = { en: null, ja: null };

if (listing.artisan_id) {
  console.log(`\n🎨 Fetching artisan ${listing.artisan_id} from Yuhinkai...`);
  const isSchool = listing.artisan_id.startsWith('NS-');
  const table = isSchool ? 'artisan_schools' : 'artisan_makers';
  const idCol = isSchool ? 'school_id' : 'maker_id';

  const { data: art } = await yk
    .from(table)
    .select('*, artisan_schools(name_romaji, name_kanji, tradition)')
    .eq(idCol, listing.artisan_id)
    .single();

  if (art) {
    const joinedSchool = !isSchool ? (art.artisan_schools as any) : null;
    artisan = {
      code: listing.artisan_id,
      name_romaji: art.name_romaji,
      name_kanji: art.name_kanji,
      school: joinedSchool?.name_romaji ?? art.legacy_school_text ?? (isSchool ? art.name_romaji : null),
      province: art.province,
      era: isSchool ? art.era_start : art.era,
      teacher: art.teacher_text ?? null,
      teacher_id: art.teacher_id ?? null,
      designation_factor: art.elite_factor || 0,
      kokuho_count: art.kokuho_count || 0,
      jubun_count: art.jubun_count || 0,
      jubi_count: art.jubi_count || 0,
      gyobutsu_count: art.gyobutsu_count || 0,
      tokuju_count: art.tokuju_count || 0,
      juyo_count: art.juyo_count || 0,
      total_items: art.total_items || 0,
      ai_biography_en: null as string | null,
    };
    console.log(`   Name: ${artisan.name_romaji} (${artisan.name_kanji})`);
    console.log(`   Designation factor: ${artisan.designation_factor}`);
    console.log(`   Works: Kokuho=${artisan.kokuho_count}, Tokuju=${artisan.tokuju_count}, Juyo=${artisan.juyo_count}, Total=${artisan.total_items}`);

    // AI biography
    const { data: descData } = await yk
      .from(table)
      .select('ai_description, ai_description_jp')
      .eq(idCol, listing.artisan_id)
      .single();
    if (descData) {
      aiDesc.en = (descData as any).ai_description ?? null;
      aiDesc.ja = (descData as any).ai_description_jp ?? null;
      artisan.ai_biography_en = aiDesc.en;
      if (aiDesc.en) console.log(`   AI bio: ${aiDesc.en.slice(0, 80)}...`);
    }
  } else {
    console.log('   ⚠️ Artisan not found in Yuhinkai');
  }
}

// Step 3: Assemble context (inline version of assembleCuratorContext)
const sword = {
  item_type: listing.item_type,
  nagasa_cm: listing.nagasa_cm, sori_cm: listing.sori_cm,
  motohaba_cm: listing.motohaba_cm, sakihaba_cm: listing.sakihaba_cm,
  kasane_cm: listing.kasane_cm,
  mei_type: listing.mei_type, mei_text: listing.mei_text,
  era: listing.era ?? listing.tosogu_era,
  province: listing.province,
  school: listing.school ?? listing.tosogu_school,
  cert_type: listing.cert_type, cert_session: listing.cert_session,
  cert_organization: listing.cert_organization,
};

const hasSetsumei = !!(listing.setsumei_text_en || listing.setsumei_text_ja);
const setsumei = hasSetsumei ? { text_en: listing.setsumei_text_en, text_ja: listing.setsumei_text_ja } : null;

const sayagakiEntries = (listing.sayagaki || []).filter((s: any) => s.content);
const sayagaki = sayagakiEntries.length > 0
  ? sayagakiEntries.map((s: any) => ({ author: s.author_custom ?? s.author ?? null, content: s.content }))
  : null;

const hakogakiEntries = (listing.hakogaki || []).filter((h: any) => h.content);
const hakogaki = hakogakiEntries.length > 0
  ? hakogakiEntries.map((h: any) => ({ author: h.author ?? null, content: h.content }))
  : null;

const provenanceEntries = (listing.provenance || []).filter((p: any) => p.owner_name);
const provenance = provenanceEntries.length > 0
  ? provenanceEntries.map((p: any) => ({ owner_name: p.owner_name, owner_name_ja: p.owner_name_ja, notes: p.notes }))
  : null;

const kiwameEntries = (listing.kiwame || []).filter((k: any) => k.judge_name);
const kiwame = kiwameEntries.length > 0
  ? kiwameEntries.map((k: any) => ({ judge_name: k.judge_name, kiwame_type: k.kiwame_type, notes: k.notes }))
  : null;

const k = listing.koshirae as any;
const hasKoshirae = !!(k && (k.cert_type || k.artisan_id || k.artisan_name || k.description));
const koshirae = hasKoshirae && k
  ? { cert_type: k.cert_type, cert_session: k.cert_session, artisan_name: k.artisan_name, description: k.description }
  : null;

const context = { sword, artisan, setsumei, sayagaki, hakogaki, provenance, kiwame, koshirae };

// Richness
const hasArt = !!artisan;
const hasSet = !!setsumei;
const hasSay = !!sayagaki;
const hasProv = !!provenance;
const hasHak = !!hakogaki;
const hasKiw = !!kiwame;
let richness: string;
if (!hasSet && !hasArt) richness = 'minimal';
else if (hasSet && hasArt && (hasSay || hasProv || hasHak || hasKiw)) richness = 'full';
else if (hasSet && hasArt) richness = 'moderate';
else richness = 'sparse';

console.log(`\n📊 Data richness: ${richness}`);
console.log(`   Setsumei: ${hasSet}, Artisan: ${hasArt}, Sayagaki: ${hasSay}, Provenance: ${hasProv}, Hakogaki: ${hasHak}, Kiwame: ${hasKiw}`);

if (!hasSet && !hasArt) {
  console.log('\n⚠️ Minimal data — skipping generation.');
  process.exit(0);
}

// Step 4: Build prompts (inline from curatorNotePrompt.ts)
// Import the actual prompt builders
const { buildSystemPrompt, buildUserPrompt } = await import('../src/lib/listing/curatorNotePrompt.js');

const systemEN = buildSystemPrompt('en');
const userEN = buildUserPrompt(context as any, 'en');

console.log('\n📝 User prompt (EN):\n' + '─'.repeat(60));
console.log(userEN);
console.log('─'.repeat(60));

// Step 5: Generate EN
console.log('\n🤖 Generating EN curator note via Opus 4.6...');
const startEn = Date.now();
const enRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openrouterKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://nihontowatch.com',
    'X-Title': 'Nihontowatch',
  },
  body: JSON.stringify({
    model: 'anthropic/claude-opus-4-6',
    messages: [
      { role: 'system', content: systemEN },
      { role: 'user', content: userEN },
    ],
    max_tokens: 1500,
    temperature: 0.4,
  }),
});

const enData = await enRes.json();
const noteEN = enData.choices?.[0]?.message?.content?.trim();
console.log(`   Done in ${((Date.now() - startEn) / 1000).toFixed(1)}s`);

if (!noteEN) {
  console.error('❌ EN generation failed:', JSON.stringify(enData.error || enData, null, 2));
  process.exit(1);
}

console.log('\n═══ ENGLISH CURATOR\'S NOTE ═══');
console.log(noteEN);
console.log('═'.repeat(40));

// Step 6: Generate JA
console.log('\n🤖 Generating JA curator note...');
const systemJA = buildSystemPrompt('ja');
const userJA = buildUserPrompt(context as any, 'ja');
const startJa = Date.now();
const jaRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openrouterKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://nihontowatch.com',
    'X-Title': 'Nihontowatch',
  },
  body: JSON.stringify({
    model: 'anthropic/claude-opus-4-6',
    messages: [
      { role: 'system', content: systemJA },
      { role: 'user', content: userJA },
    ],
    max_tokens: 2000,
    temperature: 0.4,
  }),
});

const jaData = await jaRes.json();
const noteJA = jaData.choices?.[0]?.message?.content?.trim();
console.log(`   Done in ${((Date.now() - startJa) / 1000).toFixed(1)}s`);

if (noteJA) {
  console.log('\n═══ JAPANESE CURATOR\'S NOTE ═══');
  console.log(noteJA);
  console.log('═'.repeat(40));
}

// Step 7: Store in DB
console.log('\n💾 Storing in database...');
const { createHash } = await import('crypto');
const inputHash = createHash('sha256').update(JSON.stringify(context)).digest('hex');

const { error: updateErr } = await nw
  .from('listings')
  .update({
    ai_curator_note_en: noteEN,
    ai_curator_note_ja: noteJA || null,
    ai_curator_note_generated_at: new Date().toISOString(),
    ai_curator_note_input_hash: inputHash,
  } as any)
  .eq('id', LISTING_ID);

if (updateErr) {
  console.error('❌ DB update failed:', updateErr);
} else {
  console.log(`   ✅ Stored for listing ${LISTING_ID} (hash: ${inputHash.slice(0, 12)}...)`);
}

console.log(`\n📊 Summary:`);
console.log(`   EN: ${noteEN.length} chars, ~${noteEN.split(/\s+/).length} words`);
console.log(`   JA: ${noteJA ? noteJA.length + ' chars' : 'failed'}`);
console.log(`   Richness: ${richness}`);
console.log(`   Input hash: ${inputHash.slice(0, 16)}...`);
