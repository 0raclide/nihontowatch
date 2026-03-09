/**
 * Takamaru Discovery Run 2 — Physical variations + Totoro crossover
 *
 * Usage:
 *   npx tsx scripts/takamaru-discovery-2.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

// --- Load API key ---
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) { console.error('Missing OPENROUTER_API_KEY'); process.exit(1); }

// --- Output dir ---
const outputDir = path.join(__dirname, '..', 'assets', 'takamaru', 'discovery-2');
fs.mkdirSync(outputDir, { recursive: true });

// --- Core character (consistent across all) ---
const CORE = `An Inari shrine fox seated upright in the traditional guardian pose, looking forward. Studio Ghibli style, hand-painted watercolor warmth with confident ink lines. Warm amber-gold fur (#c9a040 to #d49040) with cream-white chest and belly (#F5F0E8). Black-tipped triangular ears. Single fluffy tail. Small vermillion bib at neck (#C73B3A). Holds onion-shaped kaen-hoju jewel in mouth, gold (#D4AF37) with warm orange flame (#E8740C). Clean warm off-white background (#FAF7F2).`;

const variations: { id: number; label: string; prompt: string }[] = [
  // --- Fur texture ---
  { id: 1,  label: 'Thick plush fur, very fluffy',
    prompt: `${CORE} The fox has extremely thick, plush, luxurious fur — like a winter coat. Every surface is soft and fluffy. The chest ruff is voluminous. The tail is enormous and cloud-like. Painterly brush strokes emphasize the fur texture.` },
  { id: 2,  label: 'Sleek, smooth coat',
    prompt: `${CORE} The fox has a sleek, smooth, well-groomed coat — short and close to the body. Clean lines, elegant silhouette. The tail is still fluffy but the body is streamlined. Refined and polished appearance.` },
  { id: 3,  label: 'Rough, wild fur with texture',
    prompt: `${CORE} The fox has slightly rough, textured fur with visible brush-stroke texture — not scruffy but natural, like a real wild fox. Wind-tousled. Individual fur tufts visible at cheeks and chest. Character and personality in the texture.` },

  // --- Tail emphasis ---
  { id: 4,  label: 'Enormous dramatic tail, curling over head',
    prompt: `${CORE} The single tail is enormous — a dramatic, sweeping plume that curls up and over the fox's back, nearly reaching above its head. The tail is the most prominent visual feature, luxuriously fluffy with a cream tip. It frames the entire character.` },
  { id: 5,  label: 'Tail wrapped around front paws',
    prompt: `${CORE} The single fluffy tail wraps forward around the fox's front paws, curling neatly like a warm scarf. The cream tail tip is visible at the front. This creates a cozy, self-contained silhouette — compact and endearing.` },
  { id: 6,  label: 'Tail straight up like a flag',
    prompt: `${CORE} The single tail stands straight up behind the fox like a proud flag or banner, perfectly vertical. The fur fans out at the top. Bold, confident, immediately recognizable silhouette. Signals alertness and pride.` },

  // --- Ear variations ---
  { id: 7,  label: 'Extra large expressive ears',
    prompt: `${CORE} The fox has unusually large, tall, expressive ears — they dominate the head silhouette. Like a fennec fox crossed with an Inari fox. The large ears give maximum expressiveness and make the character instantly recognizable even at small sizes.` },
  { id: 8,  label: 'Rounded, softer ear tips',
    prompt: `${CORE} The ears are slightly more rounded at the tips rather than sharply pointed — softer, friendlier, more approachable. Still triangular and upright but with gentle curves. The black tips are still present but softer. Warmer, gentler character.` },

  // --- Eye & face ---
  { id: 9,  label: 'Larger, rounder eyes — more emotive',
    prompt: `${CORE} The fox has larger, rounder eyes than a real fox — bright amber orbs that are very expressive and emotive, catching the light with clear highlights. The eyes are the emotional center of the character. Warm, soulful gaze. Not anime-large, but noticeably expressive.` },
  { id: 10, label: 'Narrower, wiser eyes — more knowing',
    prompt: `${CORE} The fox has slightly narrower, more almond-shaped eyes — wise, knowing, perceptive. Not squinting, but conveying depth and intelligence. An old soul. The gaze feels like the fox sees more than it says.` },
  { id: 11, label: 'Broader face, rounder cheeks',
    prompt: `${CORE} The fox has a slightly broader face with rounder, fuller cheeks — giving it more visual presence and warmth. Not chibi-round, but the face has more substance than a narrow fox face. Approachable and friendly silhouette.` },

  // --- Hoju variations ---
  { id: 12, label: 'Large hoju, bright blazing flame',
    prompt: `${CORE} The kaen-hoju is large and prominent — a clearly visible onion-shaped gold jewel with a bright, vivid flame that illuminates the fox's face with warm golden light. The jewel is the visual anchor of the entire image. The flame has visible tendrils.` },
  { id: 13, label: 'Hoju held in paw instead of mouth',
    prompt: `${CORE} Instead of holding the hoju in its mouth, the fox cradles the small glowing gold kaen-hoju jewel between both front paws, held against its chest. The jewel's warm glow illuminates the fox's face from below. The mouth is visible — slight gentle smile.` },

  // --- Bib variations ---
  { id: 14, label: 'Tiny minimal bib, just a triangle',
    prompt: `${CORE} The vermillion bib is very small and minimal — just a tiny triangular cloth at the throat, barely more than a collar. Clean, understated. The Inari signifier is present but doesn't dominate. The fox's fur and the hoju are the primary visual elements.` },
  { id: 15, label: 'Bib with small gold bell',
    prompt: `${CORE} The vermillion bib has a small gold bell (suzu) hanging from its center — a common detail on real shrine fox statues. The bell catches the same warm light as the hoju. Adds a delicate detail and connects to Japanese shrine tradition.` },

  // --- Body build ---
  { id: 16, label: 'Lean and tall, elegant',
    prompt: `${CORE} The fox is lean and tall — longer legs, longer neck, an elegant elongated silhouette. Think of a sight hound crossed with a fox. Graceful and refined. The proportions convey poise and dignity.` },
  { id: 17, label: 'Compact and solid, grounded',
    prompt: `${CORE} The fox is compact and solidly built — low center of gravity, thick chest, sturdy legs planted firmly. Not fat, just substantial. Conveys reliability and groundedness. A fox that won't be knocked over.` },

  // --- Age / maturity ---
  { id: 18, label: 'Young kit — gangly, big paws, big ears',
    prompt: `${CORE} The fox is a young kit — slightly gangly proportions, paws a bit too big for its body, ears oversized, short fluffy coat. The expression is earnest and eager, not yet fully confident. Charming awkwardness. A junior scout still learning.` },
  { id: 19, label: 'Mature, distinguished elder fox',
    prompt: `${CORE} The fox is a mature, distinguished elder — thicker fur especially around the neck ruff, slightly heavier build, calm steady gaze. The expression carries the weight of experience. This fox has seen many swords come and go. Wise and steady.` },

  // --- TOTORO CROSSOVER ---
  { id: 20, label: 'TOTORO VERSION — round, magical, forest spirit',
    prompt: `A magical forest spirit fox inspired by Totoro from My Neighbor Totoro, in the style of Studio Ghibli. The fox is round and substantial like Totoro — large soft belly, short sturdy legs, wide gentle smile. Warm amber-gold fur (#c9a040 to #d49040) with a large cream-white belly (#F5F0E8). Huge round expressive eyes. Enormous tall triangular ears with black tips, standing upright like Totoro's pointy ears. A single massive fluffy tail. Small vermillion bib at the neck (#C73B3A). Holds a small glowing onion-shaped kaen-hoju jewel at its belly, gold (#D4AF37) with warm flame (#E8740C), like a magical lantern. The character radiates the same wonder, gentleness, and quiet magic as Totoro — a benevolent nature spirit who watches over swords instead of a forest. Seated upright, facing forward. Hand-painted watercolor style. Clean warm off-white background (#FAF7F2). Magical, whimsical, awe-inspiring.` },
];

// --- Generate one image ---
async function generateOne(v: typeof variations[0]): Promise<{ id: number; label: string; file: string; error?: string }> {
  const filename = `${String(v.id).padStart(2, '0')}.png`;
  const filepath = path.join(outputDir, filename);

  if (fs.existsSync(filepath) && fs.statSync(filepath).size > 1000) {
    return { id: v.id, label: v.label, file: filename };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nihontowatch.com',
        'X-Title': 'NihontoWatch Takamaru Discovery 2',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [{ role: 'user', content: v.prompt }],
        modalities: ['image', 'text'],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API ${response.status}: ${err.slice(0, 200)}`);
    }

    const result = await response.json();
    const message = result.choices?.[0]?.message;
    let imageBase64: string | null = null;

    if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
      const img = message.images[0];
      if (img?.image_url?.url) {
        imageBase64 = img.image_url.url.replace(/^data:image\/\w+;base64,/, '');
      } else if (typeof img === 'string') {
        imageBase64 = img.replace(/^data:image\/\w+;base64,/, '');
      }
    }

    if (!imageBase64 && Array.isArray(message?.content)) {
      for (const part of message.content) {
        if (part.type === 'image_url' && part.image_url?.url) {
          imageBase64 = part.image_url.url.replace(/^data:image\/\w+;base64,/, '');
          break;
        }
      }
    }

    if (!imageBase64) throw new Error('No image in response');

    fs.writeFileSync(filepath, Buffer.from(imageBase64, 'base64'));
    return { id: v.id, label: v.label, file: filename };
  } catch (err: any) {
    return { id: v.id, label: v.label, file: '', error: err.message };
  }
}

// --- Generate with concurrency ---
async function generateAll(concurrency: number = 4) {
  const results: Awaited<ReturnType<typeof generateOne>>[] = [];
  const queue = [...variations];
  const inFlight: Promise<void>[] = [];

  console.log(`Generating ${variations.length} physical variations (${concurrency} concurrent)...\n`);

  while (queue.length > 0 || inFlight.length > 0) {
    while (inFlight.length < concurrency && queue.length > 0) {
      const v = queue.shift()!;
      const p = generateOne(v).then((r) => {
        results.push(r);
        const icon = r.error ? 'x' : 'ok';
        console.log(`  [${icon}] #${String(r.id).padStart(2, '0')} ${r.label}${r.error ? ' — ' + r.error : ''}`);
        inFlight.splice(inFlight.indexOf(p), 1);
      });
      inFlight.push(p);
    }
    if (inFlight.length > 0) await Promise.race(inFlight);
  }

  return results.sort((a, b) => a.id - b.id);
}

// --- Build HTML ---
function buildHTML(results: Awaited<ReturnType<typeof generateOne>>[]) {
  const cards = results.map((r) => {
    if (r.error) {
      return `<div class="card error"><div class="num">#${r.id}</div><div class="label">${r.label}</div><div class="err">${r.error}</div></div>`;
    }
    const special = r.id === 20 ? ' totoro' : '';
    return `<div class="card${special}"><div class="num">#${r.id}</div><img src="${r.file}" alt="${r.label}" loading="lazy"/><div class="label">${r.label}</div></div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Takamaru Discovery 2 — Physical Variations</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #1a1a1a; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; }
  h1 { text-align: center; margin-bottom: 8px; font-size: 24px; color: #d49040; }
  .subtitle { text-align: center; margin-bottom: 32px; font-size: 14px; color: #888; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; max-width: 1600px; margin: 0 auto; }
  .card { background: #252525; border-radius: 12px; overflow: hidden; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; position: relative; }
  .card:hover { transform: scale(1.02); box-shadow: 0 8px 24px rgba(212,144,64,0.3); }
  .card.totoro { border: 2px solid #5b8c3e; }
  .card.totoro .num { background: rgba(91,140,62,0.8); }
  .card img { width: 100%; aspect-ratio: 1/1; object-fit: contain; display: block; background: #FAF7F2; }
  .card .num { position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: #d49040; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 18px; z-index: 1; }
  .card .label { padding: 12px 14px; font-size: 13px; color: #ccc; line-height: 1.4; }
  .card.error { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 200px; }
  .card .err { color: #c73b3a; font-size: 12px; padding: 8px 14px; }
  .legend { max-width: 1600px; margin: 32px auto 0; padding: 20px; background: #252525; border-radius: 12px; }
  .legend h2 { color: #d49040; font-size: 16px; margin-bottom: 12px; }
  .legend table { width: 100%; font-size: 13px; border-collapse: collapse; }
  .legend td, .legend th { padding: 6px 10px; text-align: left; border-bottom: 1px solid #333; }
  .legend th { color: #888; font-weight: 600; }
  .lightbox { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.9); z-index: 100; justify-content: center; align-items: center; cursor: zoom-out; flex-direction: column; }
  .lightbox.active { display: flex; }
  .lightbox img { max-width: 85vw; max-height: 80vh; border-radius: 8px; }
  .lightbox .info { margin-top: 16px; color: #d49040; font-size: 18px; font-weight: 600; }
</style>
</head>
<body>
<h1>Takamaru Discovery 2 — Physical Variations</h1>
<p class="subtitle">20 variations exploring fur, tail, ears, eyes, build, age + Totoro crossover (#20) — click to enlarge</p>
<div class="grid">
${cards}
</div>
<div class="legend">
<h2>Variation Map</h2>
<table>
<tr><th>Range</th><th>Axis</th><th>What's varying</th></tr>
<tr><td>#1–3</td><td>Fur texture</td><td>Thick plush, sleek smooth, rough natural</td></tr>
<tr><td>#4–6</td><td>Tail style</td><td>Enormous curling, wrapped forward, straight-up flag</td></tr>
<tr><td>#7–8</td><td>Ears</td><td>Extra large fennec-style, soft rounded tips</td></tr>
<tr><td>#9–11</td><td>Eyes & face</td><td>Large round emotive, narrow wise, broad rounder cheeks</td></tr>
<tr><td>#12–13</td><td>Hoju</td><td>Large blazing flame, held in paws (not mouth)</td></tr>
<tr><td>#14–15</td><td>Bib</td><td>Tiny minimal triangle, bib with gold bell (suzu)</td></tr>
<tr><td>#16–17</td><td>Body build</td><td>Lean tall elegant, compact solid grounded</td></tr>
<tr><td>#18–19</td><td>Age</td><td>Young gangly kit, mature distinguished elder</td></tr>
<tr><td style="color:#5b8c3e">#20</td><td style="color:#5b8c3e">Totoro crossover</td><td style="color:#5b8c3e">Round magical forest spirit fox, Totoro-inspired</td></tr>
</table>
</div>
<div class="lightbox" id="lb" onclick="this.classList.remove('active')">
  <img id="lb-img" src="" alt=""/>
  <div class="info" id="lb-info"></div>
</div>
<script>
document.querySelectorAll('.card:not(.error)').forEach(card => {
  card.addEventListener('click', () => {
    const img = card.querySelector('img');
    const num = card.querySelector('.num').textContent;
    const label = card.querySelector('.label').textContent;
    document.getElementById('lb-img').src = img.src;
    document.getElementById('lb-info').textContent = num + ' — ' + label;
    document.getElementById('lb').classList.add('active');
  });
});
</script>
</body>
</html>`;
}

// --- Serve ---
function serve(port: number) {
  const server = http.createServer((req, res) => {
    const url = req.url === '/' ? '/index.html' : req.url!;
    const filePath = path.join(outputDir, url.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    const mime: Record<string, string> = { '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  server.listen(port, () => {
    console.log(`\n  Discovery 2 viewer: http://localhost:${port}\n`);
    console.log('  Press Ctrl+C to stop.\n');
  });
}

// --- Main ---
async function main() {
  const results = await generateAll(4);
  const ok = results.filter(r => !r.error).length;
  const fail = results.filter(r => r.error).length;
  console.log(`\nDone: ${ok} generated, ${fail} failed.\n`);

  fs.writeFileSync(path.join(outputDir, 'index.html'), buildHTML(results));
  serve(4567);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
