/**
 * Generate Takamaru pose 01 via OpenRouter → Gemini 3 Pro Image (Nano Banana Pro)
 *
 * Usage:
 *   npx tsx scripts/generate-takamaru.ts
 *
 * Requires OPENROUTER_API_KEY in .env.local
 */

import * as fs from 'fs';
import * as path from 'path';

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  // Try reading from .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/OPENROUTER_API_KEY=(.+)/);
    if (match) {
      process.env.OPENROUTER_API_KEY = match[1].trim();
    }
  }
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('Missing OPENROUTER_API_KEY in environment or .env.local');
  process.exit(1);
}

const PROMPT = `Generate an illustration of a young Inari shrine fox seated upright in the traditional guardian pose, looking directly forward with warm alert amber-gold eyes. Studio Ghibli style — hand-painted watercolor warmth with confident ink lines, like a trusted companion from a Hayao Miyazaki film.

Warm amber-gold fur (#c9a040 to #d49040) with cream-white chest, belly, and tail tip (#F5F0E8). Black-tipped triangular ears (#1C1C1C) standing tall. Single fluffy tail raised elegantly behind. Small vermillion red cloth bib (yodarekake) tied at the neck (#C73B3A). In its mouth it holds a small onion-shaped kaen-hoju wish-fulfilling jewel — gold (#D4AF37) with a gentle warm orange flame nimbus (#E8740C). The hoju has an inverted teardrop shape with a pointed top, like a Japanese bridge giboshi ornament, wreathed in soft flame.

Expression is warm, intelligent, quietly proud. Young adult fox proportions with expressive features — not chibi or super-deformed, but not photorealistic either. The warmth and personality of a Ghibli animal character.

Clean warm off-white background (#FAF7F2). Centered, full body visible including tail. Fox faces the viewer. The hoju's glow is the brightest point in the image.`;

async function generate() {
  console.log('Generating Takamaru pose 01 via Gemini 3 Pro Image...');
  console.log('Model: google/gemini-3-pro-image-preview');
  console.log('');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://nihontowatch.com',
      'X-Title': 'NihontoWatch Takamaru Generator',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-image-preview',
      messages: [
        {
          role: 'user',
          content: PROMPT,
        },
      ],
      modalities: ['image', 'text'],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`API error ${response.status}: ${error}`);
    process.exit(1);
  }

  const result = await response.json();

  // Extract image from response — handle multiple response formats
  const message = result.choices?.[0]?.message;
  if (!message) {
    console.error('No message in response:', JSON.stringify(result, null, 2));
    process.exit(1);
  }

  // Debug: dump the response structure
  console.log('Response structure keys:', Object.keys(message));

  let imageBase64: string | null = null;
  let textParts: string[] = [];

  // Format A: content is an array of parts (OpenAI multimodal format)
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      // Image as inline base64 part
      if (part.type === 'image_url') {
        const url = part.image_url?.url ?? part.url ?? '';
        if (typeof url === 'string' && url.includes('base64')) {
          imageBase64 = url.replace(/^data:image\/\w+;base64,/, '');
        }
      }
      // Image as inline_data (Gemini native format)
      if (part.type === 'inline_data' || part.inline_data) {
        const data = part.inline_data ?? part;
        if (data.data) {
          imageBase64 = data.data;
        }
      }
      // Text parts
      if (part.type === 'text' && part.text) {
        textParts.push(part.text);
      }
    }
  } else if (typeof message.content === 'string') {
    textParts.push(message.content);
  }

  // Format B: top-level images array (some OpenRouter providers)
  if (!imageBase64 && message.images) {
    console.log('images field type:', typeof message.images);
    console.log('images is array:', Array.isArray(message.images));
    if (Array.isArray(message.images) && message.images.length > 0) {
      const img = message.images[0];
      console.log('First image type:', typeof img);
      console.log('First image preview:', typeof img === 'string' ? img.slice(0, 100) : JSON.stringify(img).slice(0, 200));
      if (typeof img === 'string') {
        imageBase64 = img.replace(/^data:image\/\w+;base64,/, '');
      } else if (img?.image_url?.url) {
        // OpenRouter wraps as {type: "image_url", image_url: {url: "data:image/png;base64,..."}}
        imageBase64 = img.image_url.url.replace(/^data:image\/\w+;base64,/, '');
      } else if (img?.url) {
        imageBase64 = (typeof img.url === 'string' ? img.url : '').replace(/^data:image\/\w+;base64,/, '');
      } else if (img?.b64_json) {
        imageBase64 = img.b64_json;
      }
    } else if (typeof message.images === 'string') {
      // Could be a single base64 string
      imageBase64 = message.images.replace(/^data:image\/\w+;base64,/, '');
    }
  }

  if (!imageBase64) {
    console.log('\nFull response (no image extracted):');
    console.log(JSON.stringify(result, null, 2).slice(0, 3000));
    console.error('\nNo image data found. The model may have returned text only.');
    process.exit(1);
  }

  // Save the image
  const outputDir = path.join(__dirname, '..', 'assets', 'takamaru', 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `01-primary-seated-gemini3pro-${timestamp}.png`;
  const outputPath = path.join(outputDir, filename);

  fs.writeFileSync(outputPath, Buffer.from(imageBase64, 'base64'));
  console.log(`\nSaved: ${outputPath}`);

  // Print any text response
  if (textParts.length > 0) {
    console.log('\nModel notes:', textParts.join('\n'));
  }

  // Print usage
  if (result.usage) {
    console.log('');
    console.log(`Tokens: ${result.usage.prompt_tokens} in / ${result.usage.completion_tokens} out`);
    const cost = (result.usage.prompt_tokens * 2 + result.usage.completion_tokens * 12) / 1_000_000;
    console.log(`Estimated cost: $${cost.toFixed(4)}`);
  }
}

generate().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
