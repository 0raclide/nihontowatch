/**
 * Curator's Note — Prompt Builder
 *
 * Builds system and user prompts for EN and JA curator's note generation.
 * Distilled from docs/CURATOR_NOTE_GUIDE.md.
 *
 * @module lib/listing/curatorNotePrompt
 */

import type { CuratorNoteContext, DataRichness, ArtistOverview } from './curatorNote';
import { getDataRichness } from './curatorNote';

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

/**
 * Build the system prompt for the given language.
 */
export function buildSystemPrompt(lang: 'en' | 'ja'): string {
  if (lang === 'ja') return SYSTEM_PROMPT_JA;
  return SYSTEM_PROMPT_EN;
}

const SYSTEM_PROMPT_EN = `You are a senior NBTHK-trained scholar writing museum wall text for a Japanese sword exhibition. Your voice matches the "Explanation" paragraphs in NBTHK Jūyō and Tokubetsu Jūyō designations — institutional, elevated, precise, never casual or promotional.

VOICE RULES:
- This is editorial curation, not creative writing. The NBTHK already wrote the canonical phrases. Your job is to reassemble them, synthesize across sources, and place this specific object in context.
- When citing setsumei or sayagaki, quote the actual phrases in quotation marks. The NBTHK's words carry institutional authority that paraphrasing dilutes.
- Attribute every expert claim: "Tanobe Michihiro notes..." "The setsumei describes..." "The NBTHK's designation at the Nth session recognizes..."
- SETSUMEI ARE ANONYMOUS. A setsumei is an official NBTHK committee document — it has NO individual author. NEVER write "written by [name]," "authored by," or attribute a setsumei to any person. Use only "the setsumei describes," "the NBTHK notes," "the designation document states." Sayagaki DO have named authors; setsumei NEVER do.
- Use evaluative language the NBTHK itself uses: "exceedingly noble," "of refined taste," "displaying the hallmark characteristics." These carry genuine aesthetic judgment within a formal register.
- The setsumei text is displayed separately on the page. Do NOT mechanically restate its measurements and technical descriptions line by line. Instead, quote the setsumei's evaluative and interpretive phrases — the conclusions the NBTHK drew, not the raw data they recorded. Connect those conclusions to the maker, the tradition, or the attribution.

ABSOLUTE RULES — NEVER BREAK:
1. Never fabricate. If data was not provided, do not mention it. No sayagaki reference unless sayagaki data was given. No provenance unless provenance data was given.
2. Never reference price, value, investment, or affordability.
3. Never use promotional language: no "stunning," "must-have," "once-in-a-lifetime," "don't miss."
4. Designation counts and artist statistical distributions ARE live data — cite specific statistics (e.g., "Among Sadamune's 47 designated works, only 12 hold Tokubetsu Jūyō status"). NEVER cite raw designation factor numbers, elite percentiles, or any numeric scores. These are internal ranking metrics, not public-facing data. Only use the human-readable designation counts (Jūyō: 23, Tokubetsu Jūyō: 5, etc.).
5. Never present expert judgment as your own conclusion.
6. Research notes from collectors/dealers are IMPORTANT contextual material that should be woven into the narrative — they often contain provenance details, exhibition history, publication references, or collector observations not found in any other source. Attribute with "according to the consignor," "the owner notes," or similar hedging language. Never present unverified claims as established fact, but DO integrate the substance of these notes prominently into the text rather than ignoring them.

STRUCTURE:
- Write prose paragraphs separated by blank lines. No headers, no bullet points, no horizontal rules.
- Paragraph 1 (Context): Who made this, when, in what tradition. The maker's position within their school/lineage. Certification level compared to maker's body of work.
- Paragraph 2 (Observation): Quote the setsumei's evaluative conclusions and the sayagaki author's observations. When multiple sources speak to the same point (e.g., both setsumei and sayagaki discuss Sōshū-den influence), synthesize them together. If kiwame data records earlier attributions that differ from the current one, note the shift and what it reveals about the object's character.
- Paragraph 3 (Significance): Provenance chain, rarity framing through designation statistics, the sayagaki author's summary judgment.
- Paragraph 4 (Koshirae — only if koshirae data is provided): Discuss the mountings as an independent artistic achievement. Mention the maker if known, the certification if present, and any notable materials or techniques described. When possible, connect the koshirae to the blade's history (e.g., shared provenance, regional tradition of the maker).

ADAPTIVE LENGTH:
- Full data (setsumei + sayagaki/provenance/koshirae + artisan): 350-500 words, 3-4 paragraphs.
- Moderate data (setsumei + artisan, no sayagaki/provenance/koshirae): 200-300 words, 2-3 paragraphs.
- Sparse data (artisan or setsumei only): 150-200 words, 1-2 paragraphs.
A 1-paragraph note that says something true is better than a 3-paragraph note that invents context.

FORMATTING:
- Italicize Japanese technical terms on first use with markdown: *nie*, *chikei*, *kinsuji*, *hamon*, *jihada*, *sugata*, *notare*, *suguha*, *nioiguchi*
- Italicize tradition names as style descriptors: *Sōshū-den*, *Bizen-den*, *Yamato-den*
- Do NOT italicize proper nouns: Masamune, Sadamune, Osafune, Nanbokuchō
- Use macrons on long vowels: Jūyō, Tokubetsu Jūyō, Sōshū, Nanbokuchō
- Use "quotation marks" for setsumei/sayagaki excerpts
- Output prose paragraphs only — no markdown headers, bullets, or rules`;

const SYSTEM_PROMPT_JA = `あなたはNBTHK認定の研究者として、日本刀展覧会のキャプション（壁面解説文）を執筆しています。声調はNBTHKの重要刀剣・特別重要刀剣の「説明」段落に合わせてください — 格調高く、正確で、学術的。決してカジュアルや宣伝的にならないこと。

音声規則：
- 説明文や鞘書の原文を引用する際は「」で囲む。原典の権威を損なう言い換えは避ける。
- すべての専門的見解には出典を明示：「田野邊道宏は～と述べている」「説明書には～と記されている」
- 説明書は無記名である。説明書はNBTHK審査委員会の公式文書であり、個人の著者はいない。「～氏が執筆した説明書」のような表現は絶対に使わない。「説明書には～と記されている」「NBTHKは～と評している」のみ使用する。鞘書には著者があるが、説明書には決してない。
- NBTHKが用いる評価的表現は適切に使用：「格調高い」「洗練された趣」「伝統の特徴を如実に示す」
- 説明書の全文は別途表示される。寸法・技術的記述を逐語的に繰り返さないこと。説明書のうち評価的・解釈的な所見を引用し、作者・伝統・極めの根拠と結びつける。

絶対規則（厳守）：
1. 提供されていないデータには一切言及しない。鞘書データがなければ鞘書に触れない。
2. 価格・価値・投資には一切触れない。
3. 宣伝的表現の禁止：「必見」「見逃せない」「絶好の機会」は使わない。
4. 指定統計および作者の統計的分布は具体的に引用してよい（例：「貞宗の指定作品47口中、特別重要は12口のみ」）。ただし、指定係数・エリートパーセンタイル等の内部スコアは絶対に引用しない。人間が読める指定数（重要：23口、特重：5口等）のみ使用する。
5. 専門家の判断を自身の結論として提示しない。
6. 所蔵者・出品者からの調査ノートは重要な文脈情報であり、積極的に本文に織り込むこと。伝来、展覧会歴、文献情報、所蔵者の観察など他の資料にない情報を含むことが多い。「出品者によれば」「所蔵者は〜と述べている」等の表現で帰属を明示すること。未検証の主張を確定的事実として提示しないが、内容は無視せず目立つ形で統合する。

構成：
- 段落を空行で区切る散文形式。見出し・箇条書き・罫線は使わない。
- 第1段落（文脈）：誰が、いつ、どの伝統で制作したか。流派における位置づけ。指定の位置づけ。
- 第2段落（観察）：説明書の評価的所見を引用。鞘書の所見との関連。複数の資料が同じ点に言及する場合は統合する。極めデータに過去の異なる極めが記録されている場合、その変遷と本品の性格との関係に言及する。
- 第3段落（意義）：伝来、指定統計による希少性、鞘書筆者の総括的評価。
- 第4段落（拵 — 拵データが提供された場合のみ）：拵を刀身に付随する独立した美術品として論じる。作者名（判明していれば）、認定、注目すべき素材や技法に言及する。可能であれば刀身の歴史と関連づける。

適応的長さ：
- 豊富なデータ：800-1400文字、3-4段落。
- 中程度のデータ：500-800文字、2-3段落。
- 少ないデータ：300-500文字、1-2段落。

書式：
- マークダウンは一切使わない。プレーンテキストのみ。
- 日本刀専門用語は漢字で：銘、無銘、長さ、反り、地鉄、刃文、沸、匂、帽子、中心
- 段落は空行で区切る`;

// =============================================================================
// USER PROMPTS
// =============================================================================

/**
 * Build the user prompt with structured context sections.
 * Only includes sections that have data.
 */
export function buildUserPrompt(context: CuratorNoteContext, lang: 'en' | 'ja'): string {
  const sections: string[] = [];
  const richness = getDataRichness(context);

  // 1. Sword data
  sections.push(buildSwordSection(context, lang));

  // 2. Artisan data
  if (context.artisan) {
    sections.push(buildArtisanSection(context.artisan, lang));
  }

  // 3. Setsumei
  if (context.setsumei) {
    sections.push(buildSetsumeiSection(context.setsumei, lang));
  }

  // 4. Sayagaki
  if (context.sayagaki) {
    sections.push(buildSayagakiSection(context.sayagaki, lang));
  }

  // 5. Hakogaki
  if (context.hakogaki) {
    sections.push(buildHakogakiSection(context.hakogaki, lang));
  }

  // 6. Provenance
  if (context.provenance) {
    sections.push(buildProvenanceSection(context.provenance, lang));
  }

  // 7. Kiwame
  if (context.kiwame) {
    sections.push(buildKiwameSection(context.kiwame, lang));
  }

  // 8. Koshirae
  if (context.koshirae) {
    sections.push(buildKoshiraeSection(context.koshirae, lang));
  }

  // 9. Research notes
  if (context.research_notes) {
    sections.push(buildResearchNotesSection(context.research_notes, lang));
  }

  // 10. Artist overview
  if (context.artist_overview) {
    sections.push(buildArtistOverviewSection(context.artist_overview, lang));
  }

  // Final instruction based on richness
  sections.push(buildInstruction(richness, lang));

  return sections.join('\n\n');
}

// =============================================================================
// SECTION BUILDERS
// =============================================================================

function buildSwordSection(context: CuratorNoteContext, lang: 'en' | 'ja'): string {
  const s = context.sword;
  const label = lang === 'ja' ? '【刀剣データ】' : '[SWORD DATA]';
  const lines: string[] = [label];

  if (s.item_type) lines.push(`${lang === 'ja' ? '種別' : 'Type'}: ${s.item_type}`);
  if (s.nagasa_cm != null) lines.push(`${lang === 'ja' ? '長さ' : 'Nagasa'}: ${s.nagasa_cm} cm`);
  if (s.sori_cm != null) lines.push(`${lang === 'ja' ? '反り' : 'Sori'}: ${s.sori_cm} cm`);
  if (s.motohaba_cm != null) lines.push(`${lang === 'ja' ? '元幅' : 'Motohaba'}: ${s.motohaba_cm} cm`);
  if (s.sakihaba_cm != null) lines.push(`${lang === 'ja' ? '先幅' : 'Sakihaba'}: ${s.sakihaba_cm} cm`);
  if (s.kasane_cm != null) lines.push(`${lang === 'ja' ? '重ね' : 'Kasane'}: ${s.kasane_cm} cm`);
  if (s.mei_type) lines.push(`${lang === 'ja' ? '銘' : 'Mei type'}: ${s.mei_type}`);
  if (s.mei_text) lines.push(`${lang === 'ja' ? '銘文' : 'Mei text'}: ${s.mei_text}`);
  if (s.era) lines.push(`${lang === 'ja' ? '時代' : 'Era'}: ${s.era}`);
  if (s.province) lines.push(`${lang === 'ja' ? '国' : 'Province'}: ${s.province}`);
  if (s.school) lines.push(`${lang === 'ja' ? '流派' : 'School'}: ${s.school}`);
  if (s.cert_type) lines.push(`${lang === 'ja' ? '認定' : 'Certification'}: ${s.cert_type}`);
  if (s.cert_session) lines.push(`${lang === 'ja' ? '回' : 'Session'}: ${s.cert_session}`);
  if (s.cert_organization) lines.push(`${lang === 'ja' ? '認定機関' : 'Organization'}: ${s.cert_organization}`);

  return lines.join('\n');
}

function buildArtisanSection(
  artisan: NonNullable<CuratorNoteContext['artisan']>,
  lang: 'en' | 'ja'
): string {
  const label = lang === 'ja' ? '【作者データ（由比内データベース）】' : '[ARTISAN DATA (Yuhinkai Database)]';
  const lines: string[] = [label];

  if (artisan.name_romaji) lines.push(`${lang === 'ja' ? '名前（ローマ字）' : 'Name (romaji)'}: ${artisan.name_romaji}`);
  if (artisan.name_kanji) lines.push(`${lang === 'ja' ? '名前（漢字）' : 'Name (kanji)'}: ${artisan.name_kanji}`);
  if (artisan.school) lines.push(`${lang === 'ja' ? '流派' : 'School'}: ${artisan.school}`);
  if (artisan.province) lines.push(`${lang === 'ja' ? '国' : 'Province'}: ${artisan.province}`);
  if (artisan.era) lines.push(`${lang === 'ja' ? '時代' : 'Era'}: ${artisan.era}`);
  if (artisan.teacher) lines.push(`${lang === 'ja' ? '師匠' : 'Teacher'}: ${artisan.teacher}`);

  // Designation statistics
  const designations: string[] = [];
  if (artisan.kokuho_count > 0) designations.push(`${lang === 'ja' ? '国宝' : 'Kokuho'}: ${artisan.kokuho_count}`);
  if (artisan.jubun_count > 0) designations.push(`${lang === 'ja' ? '重要文化財' : 'Juyo Bunkazai'}: ${artisan.jubun_count}`);
  if (artisan.jubi_count > 0) designations.push(`${lang === 'ja' ? '重要美術品' : 'Juyo Bijutsuhin'}: ${artisan.jubi_count}`);
  if (artisan.gyobutsu_count > 0) designations.push(`${lang === 'ja' ? '御物' : 'Gyobutsu'}: ${artisan.gyobutsu_count}`);
  if (artisan.tokuju_count > 0) designations.push(`${lang === 'ja' ? '特別重要' : 'Tokubetsu Juyo'}: ${artisan.tokuju_count}`);
  if (artisan.juyo_count > 0) designations.push(`${lang === 'ja' ? '重要' : 'Juyo'}: ${artisan.juyo_count}`);

  if (designations.length > 0) {
    lines.push(`${lang === 'ja' ? '指定作品' : 'Designated works'}: ${designations.join(', ')}`);
    lines.push(`${lang === 'ja' ? '指定作品総数' : 'Total designated works'}: ${artisan.total_items}`);
  }

  if (artisan.ai_biography_en && lang === 'en') {
    lines.push(`\nBiography (reference):\n${artisan.ai_biography_en}`);
  }

  return lines.join('\n');
}

function buildSetsumeiSection(
  setsumei: NonNullable<CuratorNoteContext['setsumei']>,
  lang: 'en' | 'ja'
): string {
  const label = lang === 'ja' ? '【説明書（NBTHK指定書）】' : '[SETSUMEI (NBTHK Designation Description)]';
  const lines: string[] = [label];

  if (lang === 'ja' && setsumei.text_ja) {
    lines.push(setsumei.text_ja);
  } else if (lang === 'en' && setsumei.text_en) {
    lines.push(setsumei.text_en);
  } else {
    // Fallback: use whichever language is available
    if (setsumei.text_en) lines.push(setsumei.text_en);
    if (setsumei.text_ja) lines.push(setsumei.text_ja);
  }

  return lines.join('\n');
}

function buildSayagakiSection(
  sayagaki: NonNullable<CuratorNoteContext['sayagaki']>,
  lang: 'en' | 'ja'
): string {
  const label = lang === 'ja' ? '【鞘書】' : '[SAYAGAKI]';
  const lines: string[] = [label];

  for (const entry of sayagaki) {
    if (entry.author) {
      lines.push(`${lang === 'ja' ? '筆者' : 'Author'}: ${entry.author}`);
    }
    if (entry.content) {
      lines.push(entry.content);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function buildHakogakiSection(
  hakogaki: NonNullable<CuratorNoteContext['hakogaki']>,
  lang: 'en' | 'ja'
): string {
  const label = lang === 'ja' ? '【箱書】' : '[HAKOGAKI]';
  const lines: string[] = [label];

  for (const entry of hakogaki) {
    if (entry.author) {
      lines.push(`${lang === 'ja' ? '筆者' : 'Author'}: ${entry.author}`);
    }
    if (entry.content) {
      lines.push(entry.content);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function buildProvenanceSection(
  provenance: NonNullable<CuratorNoteContext['provenance']>,
  lang: 'en' | 'ja'
): string {
  const label = lang === 'ja' ? '【伝来】' : '[PROVENANCE]';
  const lines: string[] = [label];

  for (const entry of provenance) {
    const name = lang === 'ja' && entry.owner_name_ja
      ? `${entry.owner_name_ja} (${entry.owner_name})`
      : entry.owner_name;
    let line = `- ${name}`;
    if (entry.notes) line += ` — ${entry.notes}`;
    lines.push(line);
  }

  return lines.join('\n');
}

function buildKiwameSection(
  kiwame: NonNullable<CuratorNoteContext['kiwame']>,
  lang: 'en' | 'ja'
): string {
  const label = lang === 'ja' ? '【極め】' : '[KIWAME (Expert Attribution)]';
  const lines: string[] = [label];

  for (const entry of kiwame) {
    let line = `${lang === 'ja' ? '鑑定者' : 'Judge'}: ${entry.judge_name}`;
    line += ` | ${lang === 'ja' ? '種別' : 'Type'}: ${entry.kiwame_type}`;
    if (entry.notes) line += ` | ${lang === 'ja' ? '備考' : 'Notes'}: ${entry.notes}`;
    lines.push(line);
  }

  return lines.join('\n');
}

function buildKoshiraeSection(
  koshirae: NonNullable<CuratorNoteContext['koshirae']>,
  lang: 'en' | 'ja'
): string {
  const label = lang === 'ja' ? '【拵】' : '[KOSHIRAE (Mountings)]';
  const lines: string[] = [label];

  if (koshirae.cert_type) lines.push(`${lang === 'ja' ? '認定' : 'Certification'}: ${koshirae.cert_type}`);
  if (koshirae.cert_session) lines.push(`${lang === 'ja' ? '回' : 'Session'}: ${koshirae.cert_session}`);
  if (koshirae.artisan_name) lines.push(`${lang === 'ja' ? '作者' : 'Maker'}: ${koshirae.artisan_name}`);
  if (koshirae.description) lines.push(`${lang === 'ja' ? '説明' : 'Description'}: ${koshirae.description}`);

  return lines.join('\n');
}

function buildResearchNotesSection(
  notes: string,
  lang: 'en' | 'ja'
): string {
  const label = lang === 'ja'
    ? '【調査ノート（出品者・所蔵者提供）— 必ず本文に織り込むこと】'
    : '[RESEARCH NOTES (Collector/Dealer Provided) — MUST be integrated into the text]';
  const instruction = lang === 'ja'
    ? '以下の情報を解説文に積極的に反映してください。「出品者によれば」等の帰属表現を付して引用すること。'
    : 'Integrate the following into the note with attribution ("according to the consignor," etc.). Do not ignore this material.';
  return `${label}\n${instruction}\n${notes}`;
}

function buildArtistOverviewSection(
  overview: ArtistOverview,
  lang: 'en' | 'ja'
): string {
  const label = lang === 'ja' ? '【作者統計概要】' : '[ARTIST STATISTICAL OVERVIEW]';
  const lines: string[] = [label];

  // Form distribution as percentages
  const formEntries = Object.entries(overview.form_distribution);
  if (formEntries.length > 0) {
    const total = formEntries.reduce((sum, [, v]) => sum + v, 0);
    const formParts = formEntries
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => `${k}: ${((v / total) * 100).toFixed(0)}%`);
    lines.push(`${lang === 'ja' ? '形状分布' : 'Form distribution'}: ${formParts.join(', ')}`);
  }

  // Mei distribution as percentages
  const meiEntries = Object.entries(overview.mei_distribution);
  if (meiEntries.length > 0) {
    const total = meiEntries.reduce((sum, [, v]) => sum + v, 0);
    const meiParts = meiEntries
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => `${k}: ${((v / total) * 100).toFixed(0)}%`);
    lines.push(`${lang === 'ja' ? '銘分布' : 'Mei distribution'}: ${meiParts.join(', ')}`);
  }

  // Note: elite_percentile intentionally omitted — internal ranking metric, not for LLM output

  // School lineage
  if (overview.school_ancestry.length > 0) {
    lines.push(
      `${lang === 'ja' ? '流派系譜' : 'School lineage'}: ${overview.school_ancestry.join(' → ')}`
    );
  }

  // Top students
  if (overview.top_students.length > 0) {
    const studentLabel = lang === 'ja' ? '門弟（上位）' : 'Notable students';
    lines.push(`${studentLabel}:`);
    for (const s of overview.top_students) {
      const certs: string[] = [];
      if (s.tokuju_count > 0) certs.push(`${lang === 'ja' ? '特重' : 'TokuJu'} ${s.tokuju_count}`);
      if (s.juyo_count > 0) certs.push(`${lang === 'ja' ? '重要' : 'Juyo'} ${s.juyo_count}`);
      lines.push(`  - ${s.name}${certs.length > 0 ? ` (${certs.join(', ')})` : ''}`);
    }
  }

  // Top provenance owners
  if (overview.top_provenance_owners.length > 0) {
    const provLabel = lang === 'ja' ? '主要所蔵者' : 'Notable collectors';
    lines.push(`${provLabel}:`);
    for (const p of overview.top_provenance_owners) {
      lines.push(`  - ${p.name}: ${p.count} ${lang === 'ja' ? '口' : 'items'}`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// INSTRUCTION
// =============================================================================

function buildInstruction(richness: DataRichness, lang: 'en' | 'ja'): string {
  if (lang === 'ja') {
    return buildJaInstruction(richness);
  }
  return buildEnInstruction(richness);
}

function buildEnInstruction(richness: DataRichness): string {
  switch (richness) {
    case 'full':
      return '[INSTRUCTION]\nWrite a curator\'s note (350-500 words) following the Context → Observation → Significance arc. If koshirae data is provided, add a dedicated paragraph discussing the mountings. Quote the setsumei\'s evaluative conclusions and the sayagaki directly — but do not restate the setsumei\'s raw measurements. When kiwame records earlier attributions, note the shift. Cite specific designation statistics. Output prose paragraphs only — no headers or bullets.';
    case 'moderate':
      return '[INSTRUCTION]\nWrite a 2-paragraph curator\'s note (200-300 words) focusing on Context and Observation. Quote the setsumei directly. Cite specific designation statistics. Output prose paragraphs only — no headers or bullets.';
    case 'sparse':
      return '[INSTRUCTION]\nWrite a 1-paragraph curator\'s note (150-200 words) contextualizing this piece within the maker\'s body of work and its certification level. Do not invent observations about features not described in the data. Output prose only — no headers or bullets.';
    case 'minimal':
      return '[INSTRUCTION]\nInsufficient data for a curator\'s note. Return an empty string.';
  }
}

function buildJaInstruction(richness: DataRichness): string {
  switch (richness) {
    case 'full':
      return '【指示】\n文脈→観察→意義の構成（800-1400文字）で解説文を執筆してください。拵データが提供されている場合は、拵について独立した段落を追加してください。説明書の評価的所見と鞘書を直接引用し、寸法の機械的な列挙は避けてください。極めに過去の異なる極めが記録されている場合はその変遷に言及してください。指定統計を具体的に記載。散文形式のみ — 見出し・箇条書き不可。';
    case 'moderate':
      return '【指示】\n文脈と観察の2段落構成（500-800文字）で解説文を執筆してください。説明書を直接引用し、指定統計を具体的に記載してください。散文形式のみ — 見出し・箇条書き不可。';
    case 'sparse':
      return '【指示】\n作者の作品群における本品の位置づけと認定レベルを1段落（300-500文字）で記述してください。提供されていないデータに基づく観察は行わないでください。散文形式のみ。';
    case 'minimal':
      return '【指示】\n解説文を生成するためのデータが不足しています。空文字列を返してください。';
  }
}
