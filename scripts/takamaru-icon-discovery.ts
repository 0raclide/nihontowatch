/**
 * Takamaru App Icon Discovery — 12 variations of the fox mark
 *
 * Usage:
 *   npx tsx scripts/takamaru-icon-discovery.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

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

const outputDir = path.join(__dirname, '..', 'assets', 'takamaru', 'discovery-icons');
fs.mkdirSync(outputDir, { recursive: true });

const ROUND = `Designed as a round app icon for iOS/Android. The composition fills a circle perfectly. Warm off-white background (#FAF7F2) inside the circle.`;

const variations: { id: number; label: string; prompt: string }[] = [
  // --- Style register ---
  { id: 1,  label: 'Ghibli watercolor face',
    prompt: `Round app icon: front-facing head of a young Inari shrine fox, Studio Ghibli style. Warm amber-gold fur (#c9a040), cream muzzle (#F5F0E8), tall pointed ears with black tips, bright amber eyes, small black nose, tiny vermillion bib hint (#C73B3A). Hand-painted watercolor warmth. Ear tips touch top of circle, chin at bottom. ${ROUND}` },
  { id: 2,  label: 'Japanese mon (family crest)',
    prompt: `Round app icon: a fox face designed as a Japanese mon (family crest). Minimalist, geometric, bold. Fox face reduced to essential shapes — triangular ears, eyes, pointed muzzle — flat graphic symbol in warm amber-gold (#d49040). Like a traditional kamon depicting a fox. Single color on off-white. ${ROUND}` },
  { id: 3,  label: 'Hanko ink stamp',
    prompt: `Round app icon: a fox face rendered as a Japanese hanko seal impression. Vermillion-red ink (#C73B3A) with slightly imperfect carved edges. Just ears, eyes, nose, muzzle in bold strokes. Organic hand-carved quality. ${ROUND}` },
  { id: 4,  label: 'Sumi-e brush stroke',
    prompt: `Round app icon: a fox face painted in confident sumi-e brush strokes. Ears are two upward strokes, face is a flowing curve, eyes are two precise dots. Warm amber-gold ink (#c9a040) instead of black. Minimal, calligraphic, expressive. ${ROUND}` },
  { id: 5,  label: 'Geometric flat modern',
    prompt: `Round app icon: a fox face as clean geometric shapes. Triangular ears, oval face, dot eyes, triangle nose. Warm amber-gold (#d49040), cream accent (#F5F0E8), black ear tips. Pure flat design, no gradients, perfectly symmetrical. Modern tech app aesthetic. ${ROUND}` },
  { id: 6,  label: 'Woodblock print (mokuhanga)',
    prompt: `Round app icon: a fox face in Edo-period woodblock print style. Bold outlines, flat color with subtle wood grain texture. Amber-gold face (#c9a040), cream muzzle, black ear tips, vermillion accent. Traditional yet graphic. ${ROUND}` },

  // --- Expression ---
  { id: 7,  label: 'Alert guardian, direct gaze',
    prompt: `Round app icon: Ghibli-style fox face with alert, watchful amber eyes looking directly at you. Ears perfectly upright — a guardian on duty. Warm amber-gold fur (#c9a040), cream muzzle, black ear tips, vermillion bib hint. Expression says "I'm watching." ${ROUND}` },
  { id: 8,  label: 'Gentle wisdom, slight smile',
    prompt: `Round app icon: Ghibli-style fox face with gentle, wise expression. Soft amber eyes with warmth, faintest suggestion of a smile. Calm and trustworthy. Warm amber-gold fur (#c9a040), cream muzzle, black ear tips. The face of a friend who knows things. ${ROUND}` },
  { id: 9,  label: 'Playful, one ear tilted',
    prompt: `Round app icon: Ghibli-style fox face with a playful expression. One ear straight up, one slightly tilted sideways. Bright curious amber eyes. A hint of personality and mischief without being silly. Warm amber-gold fur (#c9a040), cream muzzle, black ear tips, vermillion bib. ${ROUND}` },
  { id: 10, label: 'Serene, eyes slightly closed',
    prompt: `Round app icon: Ghibli-style fox face with a serene, peaceful expression. Eyes slightly narrowed in contentment, like a cat in sunlight. Deep calm. Warm amber-gold fur (#c9a040), cream muzzle, black ear tips. Meditative quality. ${ROUND}` },

  // --- With hoju ---
  { id: 11, label: 'Hoju glow illuminating chin',
    prompt: `Round app icon: Ghibli-style fox face with a small glowing kaen-hoju jewel below the chin. The onion-shaped gold jewel (#D4AF37) emits warm orange glow (#E8740C) illuminating the fox's face from below. Amber fur, cream muzzle, black ear tips, vermillion bib. The glow adds warmth and magic. ${ROUND}` },
  { id: 12, label: 'Hoju as negative space cutout',
    prompt: `Round app icon: fox face silhouette in amber-gold (#d49040) with a kaen-hoju jewel shape cut out as glowing negative space at the chin. Warm orange glow (#E8740C) through the cutout. Graphic, clever positive/negative space design. ${ROUND}` },

  // --- Color variations ---
  { id: 13, label: 'Warmer orange-amber fur',
    prompt: `Round app icon: Ghibli-style fox face in warmer orange-amber fur (#d49040 dominant, leaning orange). Rich autumn color. Cream muzzle, black ear tips, amber eyes, vermillion bib. Warm and inviting. ${ROUND}` },
  { id: 14, label: 'Cooler honey-gold fur',
    prompt: `Round app icon: Ghibli-style fox face in cooler honey-gold fur (#c9a040 dominant, leaning gold). Elegant, refined. Cream muzzle, black ear tips, amber eyes, vermillion bib. Distinguished and calm. ${ROUND}` },
  { id: 15, label: 'Dark background variant',
    prompt: `Round app icon: Ghibli-style fox face, warm amber-gold fur (#c9a040), cream muzzle, black ear tips, vermillion bib hint. Set against a dark scholarly background (#0e0d0c) inside the circle instead of light. The warm fox glows against the dark. Ears touch top of circle.` },

  // --- Ear & proportion variations ---
  { id: 16, label: 'Extra large fennec ears',
    prompt: `Round app icon: Ghibli-style fox face with dramatically large fennec-fox-style ears dominating the silhouette. The oversized ears are the defining feature — they fill the upper half of the circle. Warm amber-gold fur (#c9a040), cream muzzle, black ear tips. Instantly recognizable even tiny. ${ROUND}` },
  { id: 17, label: 'Rounder, softer face',
    prompt: `Round app icon: Ghibli-style fox face with slightly rounder, softer features. Fuller cheeks, more approachable. Still clearly a fox but with the warmth dialed up. Amber-gold fur (#c9a040), cream muzzle, black ear tips, vermillion bib. Friendly and trustworthy. ${ROUND}` },

  // --- Full body in circle ---
  { id: 18, label: 'Full fox curled in circle',
    prompt: `Round app icon: a full-body Ghibli-style fox curled into a circle shape, tail wrapping around to meet the nose, forming a circular composition naturally. Amber-gold fur (#c9a040), cream belly, vermillion bib, fluffy cream-tipped tail. The fox's body IS the circle. Cozy, self-contained, iconic. ${ROUND}` },
  { id: 19, label: 'Full fox seated, filling circle',
    prompt: `Round app icon: a small full-body Ghibli-style fox seated upright inside a circle. Ears touch top, tail fills one side. Warm amber-gold fur (#c9a040), cream chest, vermillion bib. Simple enough to read at 32px. The entire character as a compact icon. ${ROUND}` },

  // --- Premium / sophisticated ---
  { id: 20, label: 'Gold foil on dark, premium',
    prompt: `Round app icon: a fox face rendered in warm gold (#d49040) with a metallic gold foil quality, on a deep dark background (#0e0d0c). The fox has the feel of gold leaf on lacquerware (makie). Refined, premium, sophisticated. Ears, eyes, muzzle picked out in gold. Vermillion accent at bib. Luxurious and collector-grade. Not cute — elegant.` },
];

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
        'X-Title': 'NihontoWatch Icon Discovery',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [{ role: 'user', content: v.prompt }],
        modalities: ['image', 'text'],
        max_tokens: 4096,
      }),
    });
    if (!response.ok) throw new Error(`API ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const result = await response.json();
    const message = result.choices?.[0]?.message;
    let b64: string | null = null;
    if (message?.images?.[0]?.image_url?.url) {
      b64 = message.images[0].image_url.url.replace(/^data:image\/\w+;base64,/, '');
    } else if (Array.isArray(message?.content)) {
      for (const p of message.content) {
        if (p.type === 'image_url' && p.image_url?.url) { b64 = p.image_url.url.replace(/^data:image\/\w+;base64,/, ''); break; }
      }
    }
    if (!b64) throw new Error('No image');
    fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
    return { id: v.id, label: v.label, file: filename };
  } catch (err: any) {
    return { id: v.id, label: v.label, file: '', error: err.message };
  }
}

async function generateAll(concurrency = 4) {
  const results: Awaited<ReturnType<typeof generateOne>>[] = [];
  const queue = [...variations];
  const inFlight: Promise<void>[] = [];
  console.log(`Generating ${variations.length} icon variations (${concurrency} concurrent)...\n`);
  while (queue.length > 0 || inFlight.length > 0) {
    while (inFlight.length < concurrency && queue.length > 0) {
      const v = queue.shift()!;
      const p = generateOne(v).then((r) => {
        results.push(r);
        console.log(`  [${r.error ? 'x' : 'ok'}] #${String(r.id).padStart(2, '0')} ${r.label}${r.error ? ' — ' + r.error : ''}`);
        inFlight.splice(inFlight.indexOf(p), 1);
      });
      inFlight.push(p);
    }
    if (inFlight.length > 0) await Promise.race(inFlight);
  }
  return results.sort((a, b) => a.id - b.id);
}

function buildHTML(results: Awaited<ReturnType<typeof generateOne>>[]) {
  const cards = results.map((r) => {
    if (r.error) return `<div class="card error"><div class="num">#${r.id}</div><div class="label">${r.label}</div><div class="err">${r.error}</div></div>`;
    return `<div class="card"><div class="num">#${r.id}</div><div class="img-wrap"><img src="${r.file}" alt="${r.label}" loading="lazy"/></div><div class="previews"><div class="preview light"><img src="${r.file}"/><span>Light</span></div><div class="preview dark"><img src="${r.file}"/><span>Dark</span></div><div class="preview tiny"><img src="${r.file}"/><span>32px</span></div></div><div class="label">${r.label}</div></div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Takamaru Icon Discovery</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #1a1a1a; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; }
  h1 { text-align: center; margin-bottom: 8px; font-size: 24px; color: #d49040; }
  .subtitle { text-align: center; margin-bottom: 32px; font-size: 14px; color: #888; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; max-width: 1600px; margin: 0 auto; }
  .card { background: #252525; border-radius: 12px; overflow: hidden; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; position: relative; }
  .card:hover { transform: scale(1.02); box-shadow: 0 8px 24px rgba(212,144,64,0.3); }
  .card .num { position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: #d49040; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 18px; z-index: 1; }
  .card .img-wrap { background: #FAF7F2; padding: 20px; display: flex; justify-content: center; }
  .card .img-wrap img { width: 200px; height: 200px; object-fit: contain; }
  .previews { display: flex; gap: 8px; padding: 12px; justify-content: center; }
  .preview { display: flex; flex-direction: column; align-items: center; gap: 4px; border-radius: 8px; padding: 8px; }
  .preview span { font-size: 10px; color: #888; }
  .preview.light { background: #FAF7F2; }
  .preview.light img { width: 48px; height: 48px; object-fit: contain; }
  .preview.dark { background: #0e0d0c; }
  .preview.dark img { width: 48px; height: 48px; object-fit: contain; }
  .preview.tiny { background: #333; }
  .preview.tiny img { width: 32px; height: 32px; object-fit: contain; image-rendering: auto; }
  .card .label { padding: 8px 14px 14px; font-size: 13px; color: #ccc; line-height: 1.4; text-align: center; }
  .card.error { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 200px; }
  .card .err { color: #c73b3a; font-size: 12px; padding: 8px 14px; }
  .legend { max-width: 1600px; margin: 32px auto 0; padding: 20px; background: #252525; border-radius: 12px; }
  .legend h2 { color: #d49040; font-size: 16px; margin-bottom: 12px; }
  .legend table { width: 100%; font-size: 13px; border-collapse: collapse; }
  .legend td, .legend th { padding: 6px 10px; text-align: left; border-bottom: 1px solid #333; }
  .legend th { color: #888; font-weight: 600; }
  .lightbox { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.92); z-index: 100; justify-content: center; align-items: center; cursor: zoom-out; flex-direction: column; }
  .lightbox.active { display: flex; }
  .lightbox img { max-width: 70vw; max-height: 70vh; border-radius: 8px; background: #FAF7F2; padding: 20px; }
  .lightbox .info { margin-top: 16px; color: #d49040; font-size: 18px; font-weight: 600; }
</style>
</head>
<body>
<h1>Takamaru Icon Discovery</h1>
<p class="subtitle">12 app icon variations — each shown at full size + light/dark/32px previews. Click to enlarge.</p>
<div class="grid">
${cards}
</div>
<div class="legend">
<h2>Variation Map</h2>
<table>
<tr><th>Range</th><th>Axis</th><th>Exploring</th></tr>
<tr><td>#1</td><td>Ghibli painterly</td><td>Warm watercolor face</td></tr>
<tr><td>#2</td><td>Japanese mon</td><td>Family crest style, geometric</td></tr>
<tr><td>#3</td><td>Hanko stamp</td><td>Carved seal impression in vermillion</td></tr>
<tr><td>#4</td><td>Sumi-e calligraphy</td><td>Brush stroke fox</td></tr>
<tr><td>#5</td><td>Geometric flat</td><td>Modern app icon, pure shapes</td></tr>
<tr><td>#6</td><td>Woodblock print</td><td>Edo mokuhanga style</td></tr>
<tr><td>#7–8</td><td>Expression</td><td>Alert guardian vs gentle wisdom</td></tr>
<tr><td>#9–10</td><td>With hoju</td><td>Hoju glow below chin, hoju as negative space</td></tr>
<tr><td>#11</td><td>Circle crop</td><td>Designed for rounded-square icon format</td></tr>
<tr><td>#12</td><td>Full body tiny</td><td>Entire fox as icon silhouette</td></tr>
</table>
</div>
<div class="lightbox" id="lb" onclick="this.classList.remove('active')">
  <img id="lb-img" src="" alt=""/>
  <div class="info" id="lb-info"></div>
</div>
<script>
document.querySelectorAll('.card:not(.error)').forEach(card => {
  card.addEventListener('click', () => {
    const img = card.querySelector('.img-wrap img');
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

function serve(port: number) {
  const server = http.createServer((req, res) => {
    const url = req.url === '/' ? '/index.html' : req.url!;
    const fp = path.join(outputDir, url.replace(/^\//, ''));
    if (!fs.existsSync(fp)) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(fp);
    const mime: Record<string, string> = { '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  });
  server.listen(port, () => {
    console.log(`\n  Icon discovery viewer: http://localhost:${port}\n`);
    console.log('  Press Ctrl+C to stop.\n');
  });
}

async function main() {
  const results = await generateAll(4);
  const ok = results.filter(r => !r.error).length;
  console.log(`\nDone: ${ok} generated, ${results.length - ok} failed.\n`);
  fs.writeFileSync(path.join(outputDir, 'index.html'), buildHTML(results));
  serve(4568);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
