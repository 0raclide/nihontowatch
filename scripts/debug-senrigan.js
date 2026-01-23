const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debug() {
  // Pick one specific item without price and try to update it
  const { data: dealer } = await supabase
    .from("dealers")
    .select("id")
    .eq("name", "Choshuya")
    .single();

  const { data: item } = await supabase
    .from("listings")
    .select("id, title, price_value, is_available")
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%")
    .is("price_value", null)
    .limit(1)
    .single();

  console.log("Before update:");
  console.log("  ID:", item.id);
  console.log("  Title:", item.title);
  console.log("  price_value:", item.price_value);
  console.log("  is_available:", item.is_available);

  // Try to update this specific item
  const { data: updated, error } = await supabase
    .from("listings")
    .update({ is_available: false })
    .eq("id", item.id)
    .select("id, is_available");

  console.log("\nUpdate result:");
  console.log("  Error:", error);
  console.log("  Returned data:", updated);

  // Re-fetch to verify
  const { data: after } = await supabase
    .from("listings")
    .select("id, is_available")
    .eq("id", item.id)
    .single();

  console.log("\nAfter update (re-fetch):");
  console.log("  is_available:", after.is_available);
}

debug();
