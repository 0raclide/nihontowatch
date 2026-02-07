require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const JUYO_IDS = [
  90,895,1157,1179,1180,1282,1292,1297,1306,1325,4282,4283,4317,4585,4649,
  4673,4821,5159,5432,5666,5678,5680,5686,6226,6265,6300,6553,6752,6761,6764,
  6904,6947,6954,6991,7687,31356,31398,31415,31628,31629,31662,31708,31934,
  31946,31969,31982,32087,36177,39095,40182,42480,42481,42482,42923,42925,
  42929,42933,42935,42948,42949,42951,42953,42955,42963,42968,42970,42972,
  42978,43038,44741,44763
];

async function analyze() {
  const { data, error } = await supabase.from('listings')
    .select('id, title, smith, school, province, era, item_type, dealers(name)')
    .in('id', JUYO_IDS)
    .order('id');

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Categorize the unmatched items
  const patterns = {
    noSmithWithSchool: [],      // Mumei with school attribution
    noSmithNoSchool: [],        // No smith, no school
    japaneseSmithOnly: [],      // Smith has Japanese only (no romaji)
    mixedSmithField: [],        // Smith has both Japanese and romaji
    fullMeiString: [],          // Long mei inscription
    denAttribution: [],         // "Den X" or "伝X" attribution
    other: []
  };

  for (const item of data) {
    const smith = item.smith || '';
    const school = item.school || '';
    const title = item.title || '';

    // Check patterns
    const hasSmith = smith && smith.trim() !== '';
    const hasSchool = school && school.trim() !== '';
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(smith);
    const hasRomaji = /[a-zA-Z]/.test(smith);
    const isDen = /伝|Den /i.test(smith) || /伝|Den /i.test(title);
    const isLongMei = smith.length > 20;
    const isMumei = /無銘|mumei/i.test(smith) || /無銘|mumei/i.test(title);

    const record = {
      id: item.id,
      smith: smith.substring(0, 50) || 'NULL',
      school: school || 'NULL',
      title: title.substring(0, 60),
      dealer: item.dealers?.name || 'Unknown'
    };

    if (!hasSmith || isMumei) {
      if (hasSchool) {
        patterns.noSmithWithSchool.push(record);
      } else {
        patterns.noSmithNoSchool.push(record);
      }
    } else if (isDen) {
      patterns.denAttribution.push(record);
    } else if (isLongMei) {
      patterns.fullMeiString.push(record);
    } else if (hasJapanese && hasRomaji) {
      patterns.mixedSmithField.push(record);
    } else if (hasJapanese && !hasRomaji) {
      patterns.japaneseSmithOnly.push(record);
    } else {
      patterns.other.push(record);
    }
  }

  // Print analysis
  console.log('=' .repeat(80));
  console.log('UNMATCHED JUYO SWORDS - PATTERN ANALYSIS');
  console.log('=' .repeat(80));
  console.log(`Total: ${data.length} items\n`);

  // 1. Mumei with school
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`1. MUMEI WITH SCHOOL ONLY (${patterns.noSmithWithSchool.length} items)`);
  console.log('   → Need school-only lookup for these schools');
  console.log('─'.repeat(80));
  const schoolCounts = {};
  patterns.noSmithWithSchool.forEach(r => {
    schoolCounts[r.school] = (schoolCounts[r.school] || 0) + 1;
  });
  Object.entries(schoolCounts).sort((a,b) => b[1] - a[1]).forEach(([school, count]) => {
    console.log(`   ${school}: ${count}`);
  });
  console.log('\n   Sample items:');
  patterns.noSmithWithSchool.slice(0, 5).forEach(r => {
    console.log(`   ID ${r.id}: school="${r.school}" | ${r.title.substring(0,50)}`);
  });

  // 2. Japanese-only smith names
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`2. JAPANESE-ONLY SMITH NAMES (${patterns.japaneseSmithOnly.length} items)`);
  console.log('   → Need better kanji normalization or extraction');
  console.log('─'.repeat(80));
  patterns.japaneseSmithOnly.forEach(r => {
    console.log(`   ID ${r.id}: smith="${r.smith}" | school="${r.school}"`);
  });

  // 3. Mixed Japanese + Romaji
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`3. MIXED JAPANESE + ROMAJI (${patterns.mixedSmithField.length} items)`);
  console.log('   → Need to extract romaji portion for lookup');
  console.log('─'.repeat(80));
  patterns.mixedSmithField.forEach(r => {
    console.log(`   ID ${r.id}: smith="${r.smith}"`);
  });

  // 4. Den attributions
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`4. DEN (伝) ATTRIBUTIONS (${patterns.denAttribution.length} items)`);
  console.log('   → Need to extract smith name after "Den" or "伝"');
  console.log('─'.repeat(80));
  patterns.denAttribution.forEach(r => {
    console.log(`   ID ${r.id}: smith="${r.smith}" | title="${r.title.substring(0,40)}"`);
  });

  // 5. Full mei strings
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`5. FULL MEI INSCRIPTIONS (${patterns.fullMeiString.length} items)`);
  console.log('   → Need to extract core smith name from long inscription');
  console.log('─'.repeat(80));
  patterns.fullMeiString.forEach(r => {
    console.log(`   ID ${r.id}: smith="${r.smith}"`);
  });

  // 6. No smith, no school
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`6. NO SMITH, NO SCHOOL (${patterns.noSmithNoSchool.length} items)`);
  console.log('   → May need title parsing or manual review');
  console.log('─'.repeat(80));
  patterns.noSmithNoSchool.forEach(r => {
    console.log(`   ID ${r.id}: title="${r.title}"`);
  });

  // 7. Other
  if (patterns.other.length > 0) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`7. OTHER (${patterns.other.length} items)`);
    console.log('─'.repeat(80));
    patterns.other.forEach(r => {
      console.log(`   ID ${r.id}: smith="${r.smith}" | school="${r.school}"`);
    });
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('IMPROVEMENT OPPORTUNITIES');
  console.log('='.repeat(80));
  console.log(`1. Add school codes for: ${Object.keys(schoolCounts).join(', ')}`);
  console.log(`2. Extract romaji from mixed fields: ${patterns.mixedSmithField.length} items`);
  console.log(`3. Parse "Den X" patterns: ${patterns.denAttribution.length} items`);
  console.log(`4. Extract core name from full mei: ${patterns.fullMeiString.length} items`);
  console.log(`5. Better kanji lookup: ${patterns.japaneseSmithOnly.length} items`);
}

analyze();
