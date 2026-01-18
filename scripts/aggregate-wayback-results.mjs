#!/usr/bin/env node
/**
 * Aggregate Wayback validation results
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';

const RESULTS_DIR = 'wayback-validation-results';
const files = readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));

const results = [];
let totalSampled = 0;
let totalFetched = 0;
let totalDifferent = 0;
let totalSame = 0;
let totalUncertain = 0;

for (const file of files) {
  try {
    const data = JSON.parse(readFileSync(`${RESULTS_DIR}/${file}`, 'utf8'));
    const v = data.summary?.verdicts || {};
    const sampled = data.summary?.sampled || 0;
    const fetchFailed = v.FETCH_FAILED || 0;
    const fetched = sampled - fetchFailed;
    const different = (v.DIFFERENT || 0) + (v.LIKELY_DIFFERENT || 0);
    const same = (v.SAME || 0);
    const uncertain = v.UNCERTAIN || 0;

    totalSampled += sampled;
    totalFetched += fetched;
    totalDifferent += different;
    totalSame += same;
    totalUncertain += uncertain;

    results.push({
      dealer: data.dealer,
      total: data.summary?.total || 0,
      sampled,
      fetched,
      different,
      same,
      uncertain,
      reuseRate: fetched > 0 ? Math.round((different / fetched) * 100) : null,
      avgTitleSim: data.summary?.avgTitleSim || 0,
      avgImageSim: data.summary?.avgImageSim || 0,
    });
  } catch (e) {
    console.error('Error:', file, e.message);
  }
}

// Sort by reuse rate
results.sort((a, b) => (b.reuseRate ?? -1) - (a.reuseRate ?? -1));

console.log('');
console.log('COMPREHENSIVE WAYBACK CONTENT VALIDATION RESULTS');
console.log('='.repeat(90));
console.log('');
console.log('SUMMARY');
console.log('-'.repeat(40));
console.log('Total dealers tested:', results.length);
console.log('Total listings sampled:', totalSampled);
console.log('Successful Wayback fetches:', totalFetched, `(${Math.round(totalFetched / totalSampled * 100)}%)`);
console.log('Confirmed URL reuse (DIFFERENT):', totalDifferent);
console.log('Confirmed same listing (SAME):', totalSame);
console.log('Uncertain:', totalUncertain);
console.log('Overall URL reuse rate:', Math.round(totalDifferent / totalFetched * 100) + '%', `(${totalDifferent}/${totalFetched})`);
console.log('');
console.log('DEALER BREAKDOWN');
console.log('-'.repeat(90));
console.log('Dealer'.padEnd(28) + '| Total | Tested | Fetched | Reuse% | Same | Diff | Title% | Img%');
console.log('-'.repeat(90));

results.forEach(r => {
  const reuseStr = r.reuseRate !== null ? String(r.reuseRate) + '%' : 'N/A';
  const risk = r.reuseRate >= 70 ? '🔴' : r.reuseRate >= 40 ? '🟡' : r.reuseRate !== null ? '🟢' : '⚪';
  console.log(
    risk + ' ' + r.dealer.padEnd(26) +
    '| ' + String(r.total).padStart(5) +
    ' | ' + String(r.sampled).padStart(6) +
    ' | ' + String(r.fetched).padStart(7) +
    ' | ' + reuseStr.padStart(6) +
    ' | ' + String(r.same).padStart(4) +
    ' | ' + String(r.different).padStart(4) +
    ' | ' + String(r.avgTitleSim).padStart(6) + '%' +
    ' | ' + String(r.avgImageSim).padStart(4) + '%'
  );
});

console.log('');
console.log('LEGEND:');
console.log('🔴 HIGH RISK (≥70% reuse) - Wayback dates unreliable');
console.log('🟡 MEDIUM RISK (40-69% reuse) - Use with caution');
console.log('🟢 LOW RISK (<40% reuse) - Wayback dates more reliable');
console.log('⚪ UNKNOWN - Could not fetch enough Wayback data');

// Export as JSON for further analysis
const exportData = {
  timestamp: new Date().toISOString(),
  summary: {
    dealersTested: results.length,
    totalSampled,
    totalFetched,
    fetchRate: Math.round(totalFetched / totalSampled * 100),
    totalDifferent,
    totalSame,
    totalUncertain,
    overallReuseRate: Math.round(totalDifferent / totalFetched * 100),
  },
  dealers: results,
};

writeFileSync('wayback-validation-summary.json', JSON.stringify(exportData, null, 2));
console.log('\nExported to: wayback-validation-summary.json');
