const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  const { data: dealer } = await supabase
    .from("dealers")
    .select("id")
    .eq("name", "Choshuya")
    .single();

  // Check price distribution
  const { count: withPrice } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%")
    .not("price_value", "is", null);

  const { count: noPrice } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%")
    .is("price_value", null);

  console.log("Items WITH price_value:", withPrice);
  console.log("Items WITHOUT price_value (null):", noPrice);

  // Check availability
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

  console.log("\nItems is_available=true:", available);
  console.log("Items is_available=false:", unavailable);

  // Sample of items without price but still available
  const { data: samples } = await supabase
    .from("listings")
    .select("url, title, price_value, is_available")
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%")
    .is("price_value", null)
    .eq("is_available", true)
    .limit(5);

  console.log("\nSample items WITHOUT price but STILL available:");
  samples?.forEach(s => {
    console.log("  -", s.title);
    console.log("    price_value:", s.price_value, "| is_available:", s.is_available);
  });
}

verify();
