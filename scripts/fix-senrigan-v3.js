const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
  const { data: dealer } = await supabase
    .from("dealers")
    .select("id")
    .eq("name", "Choshuya")
    .single();

  console.log("Dealer ID:", dealer.id);

  // Get all senrigan item IDs without price
  let allIds = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data: items } = await supabase
      .from("listings")
      .select("id")
      .eq("dealer_id", dealer.id)
      .gte("first_seen_at", "2026-01-23")
      .like("url", "%choshuya.co.jp%")
      .is("price_value", null)
      .range(offset, offset + batchSize - 1);

    if (!items || items.length === 0) break;
    allIds = allIds.concat(items.map(i => i.id));
    offset += batchSize;
    console.log(`Fetched ${allIds.length} IDs so far...`);
  }

  console.log(`\nTotal items without price: ${allIds.length}`);

  // Update STATUS (not is_available) - the trigger will handle the rest
  const updateBatchSize = 500;
  let updated = 0;

  for (let i = 0; i < allIds.length; i += updateBatchSize) {
    const batch = allIds.slice(i, i + updateBatchSize);
    const { error } = await supabase
      .from("listings")
      .update({ status: "presumed_sold" })
      .in("id", batch);

    if (error) {
      console.error("Error updating batch:", error);
      return;
    }
    updated += batch.length;
    console.log(`Updated ${updated}/${allIds.length}`);
  }

  console.log("\n✓ Done! Set status='presumed_sold' for", updated, "items");

  // Verify
  const { count: available } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%")
    .eq("is_available", true);

  const { count: unavailable } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%")
    .eq("is_available", false);

  console.log("\n=== Final State ===");
  console.log("Available (visible in browse):", available);
  console.log("Unavailable (hidden):", unavailable);
}

fix();
