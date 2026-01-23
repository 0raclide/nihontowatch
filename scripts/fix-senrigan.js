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

  // Step 1: Mark ALL senrigan items as initial import (no "New" badges)
  const { count: initialImportCount, error: err1 } = await supabase
    .from("listings")
    .update({ is_initial_import: true })
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%")
    .select("*", { count: "exact", head: true });

  if (err1) {
    console.error("Error marking initial import:", err1);
    return;
  }
  console.log("\n✓ Marked as initial import (no New badges):", initialImportCount || "all");

  // Step 2: Mark items WITHOUT price as unavailable
  const { count: unavailableCount, error: err2 } = await supabase
    .from("listings")
    .update({ is_available: false })
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%")
    .is("price_value", null)
    .select("*", { count: "exact", head: true });

  if (err2) {
    console.error("Error marking unavailable:", err2);
    return;
  }
  console.log("✓ Marked as unavailable (no price):", unavailableCount || "all without price");

  // Verify final state
  const { count: totalCount } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%");

  const { count: availableCount } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%")
    .eq("is_available", true);

  const { count: initialCount } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%")
    .eq("is_initial_import", true);

  console.log("\n=== Final State ===");
  console.log("Total senrigan items:", totalCount);
  console.log("Available (with price):", availableCount);
  console.log("Unavailable (hidden):", totalCount - availableCount);
  console.log("Marked as initial import:", initialCount);
}

fix();
