const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyze() {
  const { data: dealer } = await supabase
    .from("dealers")
    .select("id")
    .eq("name", "Choshuya")
    .single();

  // Get ALL senrigan items (not just first 1000)
  const { count: totalCount } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%");

  console.log("Total senrigan items in DB:", totalCount);

  // Get items with prices
  const { data: itemsWithPrice, count: priceCount } = await supabase
    .from("listings")
    .select("url, title, price_value, price_currency, item_type", { count: "exact" })
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%")
    .not("price_value", "is", null);

  console.log("Items WITH price:", priceCount);

  // Get items without prices
  const { count: noPriceCount } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%")
    .is("price_value", null);

  console.log("Items WITHOUT price:", noPriceCount);

  const { data: items } = await supabase
    .from("listings")
    .select("url, title, price_value, price_currency, is_available, is_sold, status, item_type, first_seen_at")
    .eq("dealer_id", dealer.id)
    .gte("first_seen_at", "2026-01-23")
    .like("url", "%choshuya.co.jp%")
    .limit(2000);

  console.log("Total senrigan items:", items?.length);

  const byStatus = {};
  const byAvailable = { available: 0, sold: 0, unknown: 0 };
  const withPrice = { hasPrice: 0, noPrice: 0 };
  const byItemType = {};

  items?.forEach(item => {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;

    if (item.is_sold) byAvailable.sold++;
    else if (item.is_available) byAvailable.available++;
    else byAvailable.unknown++;

    if (item.price_value) withPrice.hasPrice++;
    else withPrice.noPrice++;

    byItemType[item.item_type || "null"] = (byItemType[item.item_type || "null"] || 0) + 1;
  });

  console.log("\nBy status:", byStatus);
  console.log("By availability:", byAvailable);
  console.log("With price:", withPrice);
  console.log("By item type:", byItemType);

  // Sample items without price
  const noPrice = items?.filter(i => i.price_value === null).slice(0, 5);
  console.log("\nSample items WITHOUT price:");
  noPrice?.forEach(i => console.log("  -", i.title));

  // Sample items with price
  const hasPrice = items?.filter(i => i.price_value !== null).slice(0, 5);
  console.log("\nSample items WITH price:");
  hasPrice?.forEach(i => console.log("  -", i.title, "|", i.price_value, i.price_currency));

  // Check URL patterns
  const urlPatterns = {};
  items?.forEach(item => {
    const path = item.url.split("choshuya.co.jp")[1]?.split("/")[1] || "root";
    urlPatterns[path] = (urlPatterns[path] || 0) + 1;
  });
  console.log("\nURL patterns:", urlPatterns);

  // List ALL items with prices (these are likely current inventory)
  console.log("\n=== ALL ITEMS WITH PRICES (likely current inventory) ===");
  itemsWithPrice?.forEach((item, i) => {
    console.log(`${i+1}. ${item.title}`);
    console.log(`   Price: ¥${item.price_value?.toLocaleString()} | Type: ${item.item_type}`);
    console.log(`   URL: ${item.url}`);
    console.log("");
  });
}

analyze();
