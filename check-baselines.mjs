// Test the updated badge logic with isDealerEstablished check
const windowHours = 24;
const thresholdDays = 7;

function isDealerEstablished(baseline) {
  if (!baseline) return false;
  const baselineDate = new Date(baseline);
  if (isNaN(baselineDate.getTime())) return false;
  const daysSinceBaseline = (Date.now() - baselineDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceBaseline >= thresholdDays;
}

function isPartOfInitialImport(listing, baseline) {
  if (!listing || !baseline) return true;
  const listingDate = new Date(listing);
  const baselineDate = new Date(baseline);
  if (isNaN(listingDate.getTime()) || isNaN(baselineDate.getTime())) return true;
  const windowMs = windowHours * 60 * 60 * 1000;
  return listingDate.getTime() <= baselineDate.getTime() + windowMs;
}

function isNewListing(firstSeenAt) {
  if (!firstSeenAt) return false;
  const date = new Date(firstSeenAt);
  if (isNaN(date.getTime())) return false;
  const sevenDaysAgo = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
  return date.getTime() > sevenDaysAgo;
}

function shouldShowNewBadge(listing, baseline) {
  if (!isDealerEstablished(baseline)) return false;
  if (isPartOfInitialImport(listing, baseline)) return false;
  return isNewListing(listing);
}

// Fetch and test
const response = await fetch('https://nihontowatch.com/api/browse?limit=500');
const data = await response.json();
const listings = data.listings || [];

// Get unique dealers and their baselines
const dealers = {};
listings.forEach(l => {
  const name = l.dealers?.name;
  if (!dealers[name]) {
    dealers[name] = {
      baseline: l.dealer_earliest_seen_at,
      count: 0,
      badgeCount: 0,
      established: isDealerEstablished(l.dealer_earliest_seen_at),
    };
  }
  dealers[name].count++;

  if (shouldShowNewBadge(l.first_seen_at, l.dealer_earliest_seen_at)) {
    dealers[name].badgeCount++;
  }
});

console.log('Dealers:');
Object.entries(dealers)
  .sort((a, b) => b[1].count - a[1].count)
  .forEach(([name, data]) => {
    const daysOld = data.baseline ? ((Date.now() - new Date(data.baseline)) / (24*60*60*1000)).toFixed(0) : '?';
    console.log(`  ${name}:`);
    console.log(`    established: ${data.established} (${daysOld} days old)`);
    console.log(`    listings: ${data.count}, badges: ${data.badgeCount}`);
  });

// Total badge count
let totalBadges = 0;
listings.forEach(l => {
  if (shouldShowNewBadge(l.first_seen_at, l.dealer_earliest_seen_at)) {
    totalBadges++;
  }
});

console.log(`\nTotal badges: ${totalBadges} / ${listings.length} (${(totalBadges/listings.length*100).toFixed(1)}%)`);
