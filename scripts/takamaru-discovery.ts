/**
 * Takamaru Discovery Run — Generate 20 prompt variations via Gemini 3 Pro Image
 * and serve them on localhost for visual comparison.
 *
 * Usage:
 *   npx tsx scripts/takamaru-discovery.ts
 *
 * Then open http://localhost:3333
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
const outputDir = path.join(__dirname, '..', 'assets', 'takamaru', 'discovery');
fs.mkdirSync(outputDir, { recursive: true });

// --- The 20 prompt variations ---
const BASE = `A young Inari shrine fox seated upright in the traditional guardian pose, looking directly forward with warm alert amber-gold eyes. Warm amber-gold fur (#c9a040 to #d49040) with cream-white chest, belly, and tail tip (#F5F0E8). Black-tipped triangular ears standing tall. Single fluffy tail. Small vermillion red cloth bib (yodarekake) tied at the neck (#C73B3A). In its mouth holds a small onion-shaped kaen-hoju wish-fulfilling jewel, gold (#D4AF37) with warm orange flame (#E8740C). Clean warm off-white background.`;

const variations: { id: number; label: string; prompt: string }[] = [
  // --- Style axis ---
  { id: 1,  label: 'Ghibli watercolor, warm',
    prompt: `${BASE} Studio Ghibli style, hand-painted watercolor warmth with confident ink lines. Young adult fox proportions with expressive features. Warm, intelligent, quietly proud expression. Like a trusted companion from a Miyazaki film.` },
  { id: 2,  label: 'Ghibli + ink-brush hybrid',
    prompt: `${BASE} Studio Ghibli meets Japanese ink-brush sumi-e. Watercolor warmth with bold fude-brush outlines, thicker on contours, thinner on details. Young adult fox, expressive but not chibi.` },
  { id: 3,  label: 'Pure sumi-e ink wash',
    prompt: `${BASE} Japanese sumi-e ink wash painting style with watercolor tints. Confident brush strokes, wabi-sabi aesthetic. Elegant and minimal. Adult fox proportions, dignified posture.` },
  { id: 4,  label: 'Soft watercolor, children\'s book',
    prompt: `${BASE} Soft watercolor illustration style, like a high-quality Japanese children's book. Warm gentle colors, slightly soft edges. Friendly and approachable young fox. Delicate brush work.` },
  { id: 5,  label: 'Ghibli + ukiyo-e woodblock',
    prompt: `${BASE} Blend of Studio Ghibli warmth and ukiyo-e woodblock print aesthetics. Clean confident outlines, flat color areas with subtle texture. Fox has presence and dignity. Traditional yet modern.` },

  // --- Proportion axis ---
  { id: 6,  label: 'Slightly stylized (larger eyes)',
    prompt: `${BASE} Studio Ghibli style watercolor. The fox has slightly larger, more expressive eyes and a slightly rounder face than a real fox, but adult body proportions — slender and elegant, not chibi. Warm and endearing.` },
  { id: 7,  label: 'More realistic adult fox',
    prompt: `${BASE} Studio Ghibli style. Realistic adult red fox proportions — long slender body, proportional head, pointed muzzle. The warmth and personality comes from the eyes and posture, not from stylized proportions.` },
  { id: 8,  label: 'Young fox (adolescent)',
    prompt: `${BASE} Studio Ghibli style watercolor. A young adolescent fox — not a kit, not fully grown. Slightly lanky proportions, big ears relative to head, curious bright eyes. Energetic but composed.` },
  { id: 9,  label: 'Compact & sturdy',
    prompt: `${BASE} Studio Ghibli style. A compact, sturdy young fox — slightly stockier than a real fox, with a thick fluffy coat. Not chibi but has visual weight and presence. Confident seated posture.` },

  // --- Expression axis ---
  { id: 10, label: 'Alert & dignified',
    prompt: `${BASE} Studio Ghibli watercolor style. Expression is alert, dignified, and watchful — like a guardian on duty. Eyes focused directly at viewer. Ears perfectly upright. Proud posture. The face of a sentinel.` },
  { id: 11, label: 'Warm & inviting',
    prompt: `${BASE} Studio Ghibli watercolor style. Expression is warm, gentle, and inviting — eyes slightly soft, mouth hint of a smile around the hoju. The fox is welcoming you. Friendly without being silly.` },
  { id: 12, label: 'Quietly proud',
    prompt: `${BASE} Studio Ghibli watercolor style. Expression is quietly proud — chin slightly lifted, eyes bright with satisfaction. The fox found something good and is pleased about it. Subtle confidence.` },
  { id: 13, label: 'Wise & serene',
    prompt: `${BASE} Studio Ghibli watercolor style. Expression is wise and serene — calm steady gaze, relaxed ears, composed posture. An old soul in a young fox. Peaceful guardian energy.` },

  // --- Bib & hoju emphasis ---
  { id: 14, label: 'Tiny bib, prominent hoju flame',
    prompt: `${BASE} Studio Ghibli watercolor style. The vermillion bib is very small, just a tiny cloth triangle at the throat. The kaen-hoju jewel is prominent — glowing brightly with visible teardrop flame, illuminating the fox's chin with warm golden light. The hoju is the visual anchor.` },
  { id: 15, label: 'Bib with knot detail, subtle hoju',
    prompt: `${BASE} Studio Ghibli watercolor style. The vermillion bib is a neat small square cloth tied with a visible knot at the back of the neck, like on real Inari fox statues. The hoju glows softly, more subtle. Focus on the bib as the Inari signifier.` },

  // --- Color temperature ---
  { id: 16, label: 'Warmer amber (more orange)',
    prompt: `${BASE} Studio Ghibli watercolor style. The fox's fur leans warmer — more orange-amber like autumn leaves, hex #d49040 dominant. Rich, warm, autumnal. The vermillion bib contrasts beautifully with the warmer fur.` },
  { id: 17, label: 'Cooler gold (more honey)',
    prompt: `${BASE} Studio Ghibli watercolor style. The fox's fur leans cooler — more honey-gold, hex #c9a040 dominant. Elegant, refined, like aged gold or pale amber. Distinguished and calm.` },

  // --- Tail & pose micro-variations ---
  { id: 18, label: 'Tail raised high, fluffy',
    prompt: `${BASE} Studio Ghibli watercolor style. The single fluffy tail is raised high and proudly behind the fox, tip curling slightly forward. The tail is a major visual element — full, luxurious, cream-tipped. Young adult fox proportions.` },
  { id: 19, label: 'Slight 3/4 turn, dynamic',
    prompt: `${BASE} Studio Ghibli watercolor style. The fox is seated but at a slight three-quarter angle, head turned to face the viewer directly. This creates depth and dimension. Tail visible wrapping to one side. Alert, engaging composition.` },
  { id: 20, label: 'Front-facing, symmetrical, iconic',
    prompt: `${BASE} Studio Ghibli watercolor style. Perfectly front-facing, nearly symmetrical composition like a heraldic emblem or shrine statue. Both ears visible and upright, both front paws together, tail centered behind. Iconic, balanced, formal.` },
];

// --- Generate one image ---
async function generateOne(v: typeof variations[0]): Promise<{ id: number; label: string; file: string; error?: string }> {
  const filename = `${String(v.id).padStart(2, '0')}.png`;
  const filepath = path.join(outputDir, filename);

  // Skip if already generated
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
        'X-Title': 'NihontoWatch Takamaru Discovery',
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

    // Extract from images array
    if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
      const img = message.images[0];
      if (img?.image_url?.url) {
        imageBase64 = img.image_url.url.replace(/^data:image\/\w+;base64,/, '');
      } else if (typeof img === 'string') {
        imageBase64 = img.replace(/^data:image\/\w+;base64,/, '');
      }
    }

    // Extract from content array
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

// --- Generate with concurrency limit ---
async function generateAll(concurrency: number = 4) {
  const results: Awaited<ReturnType<typeof generateOne>>[] = [];
  const queue = [...variations];
  const inFlight: Promise<void>[] = [];

  console.log(`Generating ${variations.length} variations (${concurrency} concurrent)...\n`);

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

// --- Build HTML viewer ---
function buildHTML(results: Awaited<ReturnType<typeof generateOne>>[]) {
  const cards = results.map((r) => {
    if (r.error) {
      return `<div class="card error"><div class="num">#${r.id}</div><div class="label">${r.label}</div><div class="err">${r.error}</div></div>`;
    }
    return `<div class="card"><div class="num">#${r.id}</div><img src="${r.file}" alt="${r.label}" loading="lazy"/><div class="label">${r.label}</div></div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Takamaru Discovery — 20 Variations</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #1a1a1a; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; }
  h1 { text-align: center; margin-bottom: 8px; font-size: 24px; color: #d49040; }
  .subtitle { text-align: center; margin-bottom: 32px; font-size: 14px; color: #888; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; max-width: 1600px; margin: 0 auto; }
  .card { background: #252525; border-radius: 12px; overflow: hidden; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; position: relative; }
  .card:hover { transform: scale(1.02); box-shadow: 0 8px 24px rgba(212,144,64,0.3); }
  .card img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; background: #FAF7F2; }
  .card .num { position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: #d49040; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 18px; z-index: 1; }
  .card .label { padding: 12px 14px; font-size: 13px; color: #ccc; line-height: 1.4; }
  .card.error { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 200px; }
  .card .err { color: #c73b3a; font-size: 12px; padding: 8px 14px; }
  .legend { max-width: 1600px; margin: 32px auto 0; padding: 20px; background: #252525; border-radius: 12px; }
  .legend h2 { color: #d49040; font-size: 16px; margin-bottom: 12px; }
  .legend table { width: 100%; font-size: 13px; border-collapse: collapse; }
  .legend td, .legend th { padding: 6px 10px; text-align: left; border-bottom: 1px solid #333; }
  .legend th { color: #888; font-weight: 600; }
  .lightbox { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.9); z-index: 100; justify-content: center; align-items: center; cursor: zoom-out; }
  .lightbox.active { display: flex; }
  .lightbox img { max-width: 90vw; max-height: 90vh; border-radius: 8px; }
  .lightbox .info { position: absolute; bottom: 24px; color: #d49040; font-size: 18px; font-weight: 600; }
</style>
</head>
<body>
<h1>Takamaru Discovery Run</h1>
<p class="subtitle">20 prompt variations via Gemini 3 Pro Image — click to enlarge, pick your favorites by number</p>
<div class="grid">
${cards}
</div>
<div class="legend">
<h2>Variation Map</h2>
<table>
<tr><th>Range</th><th>Axis</th><th>What's varying</th></tr>
<tr><td>#1–5</td><td>Art style</td><td>Ghibli watercolor, ink-brush hybrid, sumi-e, children's book, ukiyo-e blend</td></tr>
<tr><td>#6–9</td><td>Proportions</td><td>Stylized eyes, realistic adult, adolescent, compact & sturdy</td></tr>
<tr><td>#10–13</td><td>Expression</td><td>Alert guardian, warm inviting, quietly proud, wise serene</td></tr>
<tr><td>#14–15</td><td>Bib & hoju</td><td>Tiny bib + bright hoju, detailed bib + subtle hoju</td></tr>
<tr><td>#16–17</td><td>Color temp</td><td>Warmer orange-amber, cooler honey-gold</td></tr>
<tr><td>#18–20</td><td>Pose/composition</td><td>Tail raised high, 3/4 turn dynamic, front-facing iconic</td></tr>
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

// --- Serve on localhost ---
function serve(port: number = 3333) {
  const server = http.createServer((req, res) => {
    const url = req.url === '/' ? '/index.html' : req.url!;
    const filePath = path.join(outputDir, url.replace(/^\//, ''));

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(port, () => {
    console.log(`\n  Discovery viewer: http://localhost:${port}\n`);
    console.log('  Press Ctrl+C to stop.\n');
  });
}

// --- Main ---
async function main() {
  const results = await generateAll(4);

  const succeeded = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;
  console.log(`\nDone: ${succeeded} generated, ${failed} failed.\n`);

  // Write HTML
  const html = buildHTML(results);
  fs.writeFileSync(path.join(outputDir, 'index.html'), html);

  // Serve
  serve(3333);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
