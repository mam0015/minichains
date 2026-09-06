// MiniChains — read-only admin dashboard data. Every request must carry a
// valid staff session token (from staff-login); nothing here is reachable
// without the PIN. One consolidated endpoint (a `view` selects the
// dataset) rather than one function per view, purely to keep the
// manual-paste deploy count down — there's no security reason to split it.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://mam0015.github.io",
]);

function isAllowedOrigin(origin: string | null) {
  return (
    !!origin &&
    (
      ALLOWED_ORIGINS.has(origin) ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    )
  );
}

function cors(origin: string | null) {
  const allowed = isAllowedOrigin(origin) ? origin! : "https://mam0015.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

type OrderItem = { id: string; qty: number; price?: number };

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, origin);
  }
  if (origin && !isAllowedOrigin(origin)) {
    return json({ error: "Origin not allowed." }, 403, origin);
  }

  const body = await req.json().catch(() => null);
  const view = String(body?.view || "");
  const action = String(body?.action || "");
  const staffToken = String(body?.staffToken || "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return json({ error: "Server configuration error." }, 500, origin);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!staffToken) {
    return json({ error: "Staff login required." }, 401, origin);
  }
  const { data: session, error: sessionErr } = await admin
    .from("mini_staff_sessions")
    .select("token, expires_at")
    .eq("token", staffToken)
    .maybeSingle();
  if (sessionErr) {
    console.error("mini_staff_sessions lookup failed", sessionErr);
    return json({ error: "Could not verify staff session." }, 500, origin);
  }
  if (!session || new Date(session.expires_at as string).getTime() < Date.now()) {
    return json({ error: "Staff session expired - please log in again." }, 401, origin);
  }

  if (view === "products") {
    const { data, error } = await admin
      .from("mini_products_live")
      .select("id, name, base_price_cents, stock_on_hand, stock_available, active, limited_edition, display_order")
      .order("display_order", { ascending: true });
    if (error) { console.error(error); return json({ error: "Could not load products." }, 500, origin); }
    return json({ products: data || [] }, 200, origin);
  }

  if (view === "orders") {
    const { data, error } = await admin
      .from("mini_orders")
      .select("id, payment_method, status, items, total, promo_code, rewards_username_display, loyalty_reward_type, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { console.error(error); return json({ error: "Could not load orders." }, 500, origin); }
    return json({ orders: data || [] }, 200, origin);
  }

  if (view === "loyalty") {
    const { data, error } = await admin
      .from("mini_loyalty_accounts")
      .select("display_username, current_cycle_visits, total_eligible_visits, completed_cycles, discounts_redeemed, free_keychains_redeemed, created_at")
      .order("total_eligible_visits", { ascending: false })
      .limit(200);
    // owner_secret intentionally excluded — never leaves the server, even to admin.
    if (error) { console.error(error); return json({ error: "Could not load loyalty accounts." }, 500, origin); }
    return json({ accounts: data || [] }, 200, origin);
  }

  if (view === "promotions") {
    const { data, error } = await admin
      .from("mini_promo_codes")
      .select("code, type, percent, free_product_id, used, used_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { console.error(error); return json({ error: "Could not load promo codes." }, 500, origin); }
    return json({ promotions: data || [] }, 200, origin);
  }

  if (view === "restock") {
    const { data, error } = await admin
      .from("mini_restock_requests")
      .select("product_id, note, status, requested_at")
      .order("requested_at", { ascending: false })
      .limit(500);
    if (error) { console.error(error); return json({ error: "Could not load restock requests." }, 500, origin); }

    // Same table/endpoint serves both "restock this sold-out item" and
    // "notify me when this coming-soon item launches" — split for display
    // by checking what each requested product currently is, rather than
    // maintaining a second identical table.
    const { data: productFlags } = await admin.from("mini_products").select("id, coming_soon");
    const comingSoonIds = new Set((productFlags || []).filter((p) => p.coming_soon).map((p) => p.id as string));

    const counts: Record<string, number> = {};
    const comingSoonCounts: Record<string, number> = {};
    for (const row of data || []) {
      const bucket = comingSoonIds.has(row.product_id as string) ? comingSoonCounts : counts;
      bucket[row.product_id as string] = (bucket[row.product_id as string] || 0) + 1;
    }
    return json({
      requests: (data || []).filter((r) => !comingSoonIds.has(r.product_id as string)),
      countsByProduct: counts,
      comingSoonRequests: (data || []).filter((r) => comingSoonIds.has(r.product_id as string)),
      comingSoonCountsByProduct: comingSoonCounts,
    }, 200, origin);
  }

  if (view === "overview") {
    const { data: orders, error } = await admin
      .from("mini_orders")
      .select("payment_method, items, total, created_at")
      .eq("status", "paid");
    if (error) { console.error(error); return json({ error: "Could not load overview." }, 500, origin); }

    let revenue = 0;
    let unitsSold = 0;
    const unitsByProduct: Record<string, number> = {};
    let cardOrders = 0, cashOrders = 0;

    for (const order of orders || []) {
      revenue += Number(order.total) || 0;
      if (order.payment_method === "card") cardOrders++;
      else cashOrders++;
      for (const item of (order.items as OrderItem[] | null) || []) {
        unitsSold += item.qty;
        unitsByProduct[item.id] = (unitsByProduct[item.id] || 0) + item.qty;
      }
    }

    const { count: restockOpenCount } = await admin
      .from("mini_restock_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");

    const { data: products } = await admin.from("mini_products").select("id, name, active");
    const nameById = new Map((products || []).map((p) => [p.id as string, p.name as string]));
    const mostPopular = Object.entries(unitsByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, qty]) => ({ id, name: nameById.get(id) || id, qty }));

    const { data: liveProducts } = await admin
      .from("mini_products_live")
      .select("id, name, stock_available")
      .eq("active", true);
    const soldOut = (liveProducts || []).filter((p) => (p.stock_available as number) <= 0)
      .map((p) => ({ id: p.id, name: p.name }));

    return json({
      paidOrders: (orders || []).length,
      cardOrders,
      cashOrders,
      revenue: Math.round(revenue * 100) / 100,
      unitsSold,
      mostPopular,
      soldOutProducts: soldOut,
      openRestockRequests: restockOpenCount || 0,
    }, 200, origin);
  }

  if (view === "analytics") {
    const { data: events, error } = await admin
      .from("mini_analytics_events")
      .select("visitor_id, event_type, event_data, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) { console.error(error); return json({ error: "Could not load analytics." }, 500, origin); }

    const visitors = new Set<string>();
    const counts: Record<string, number> = {};
    const topProducts: Record<string, number> = {};
    const topSearches: Record<string, number> = {};
    const topCategories: Record<string, number> = {};

    for (const e of events || []) {
      visitors.add(e.visitor_id as string);
      counts[e.event_type as string] = (counts[e.event_type as string] || 0) + 1;
      const data = (e.event_data || {}) as Record<string, string>;
      if (e.event_type === "product_view" && data.productId) {
        topProducts[data.productId] = (topProducts[data.productId] || 0) + 1;
      }
      if (e.event_type === "search" && data.query) {
        const q = data.query.toLowerCase();
        topSearches[q] = (topSearches[q] || 0) + 1;
      }
      if (e.event_type === "category_view" && data.category) {
        topCategories[data.category] = (topCategories[data.category] || 0) + 1;
      }
    }

    const { count: paidCount } = await admin
      .from("mini_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "paid");

    const top = (obj: Record<string, number>, n = 8) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));

    return json({
      estimatedVisitors: visitors.size,
      totalEvents: (events || []).length,
      eventCounts: counts,
      funnel: {
        productViews: counts.product_view || 0,
        addToCart: counts.add_to_cart || 0,
        checkoutStarted: counts.checkout_started || 0,
        paid: paidCount || 0,
      },
      topProducts: top(topProducts),
      topSearches: top(topSearches),
      topCategories: top(topCategories),
      note: "Estimated visitors are a device/browser count, not verified unique humans - clearing site data or using another device/browser counts as a new visitor.",
    }, 200, origin);
  }

  if (view === "auctions") {
    const { data: auctions, error } = await admin
      .from("mini_auctions")
      .select("id, product_id, title, starting_bid_cents, min_increment_cents, starts_at, ends_at, status, current_highest_bid_cents, winner_bid_id, winner_payment_status, winner_payment_deadline")
      .order("starts_at", { ascending: false })
      .limit(100);
    if (error) { console.error(error); return json({ error: "Could not load auctions." }, 500, origin); }

    const withBids = [];
    for (const a of auctions || []) {
      const { data: bids } = await admin
        .from("mini_auction_bids")
        .select("id, first_name, last_name, year_level, contact_method, contact_value, amount_cents, created_at")
        .eq("auction_id", a.id)
        .order("amount_cents", { ascending: false })
        .limit(50);
      // Winner contact details are only ever included here, in the admin
      // view, for an auction that has actually ended with that bid as the
      // winner — never in the public auction-status response.
      const winner = a.winner_bid_id ? (bids || []).find((b) => b.id === a.winner_bid_id) : null;
      withBids.push({
        ...a,
        bidCount: (bids || []).length,
        bids: (bids || []).map((b) => ({
          firstName: b.first_name, lastName: b.last_name, yearLevel: b.year_level,
          amountCents: b.amount_cents, createdAt: b.created_at,
        })),
        winner: winner ? {
          firstName: winner.first_name, lastName: winner.last_name, yearLevel: winner.year_level,
          contactMethod: winner.contact_method, contactValue: winner.contact_value, amountCents: winner.amount_cents,
        } : null,
      });
    }
    return json({ auctions: withBids }, 200, origin);
  }

  if (action === "update_stock") {
    const productId = String(body?.productId || "");
    const stockOnHand = Number(body?.stockOnHand);
    if (!productId || !Number.isInteger(stockOnHand) || stockOnHand < 0) {
      return json({ error: "Invalid product or quantity." }, 400, origin);
    }
    const { error } = await admin.from("mini_products")
      .update({ stock_on_hand: stockOnHand, updated_at: new Date().toISOString() })
      .eq("id", productId);
    if (error) { console.error(error); return json({ error: "Could not update stock." }, 500, origin); }
    return json({ ok: true }, 200, origin);
  }

  if (action === "create_auction") {
    const title = String(body?.title || "").trim().slice(0, 100);
    const productId = body?.productId ? String(body.productId) : null;
    const description = String(body?.description || "").trim().slice(0, 500);
    const image = String(body?.image || "").trim().slice(0, 300);
    const startingBid = Number(body?.startingBid);
    const minIncrement = Number(body?.minIncrement || 1);
    const startsAt = String(body?.startsAt || "");
    const endsAt = String(body?.endsAt || "");

    if (!title || !Number.isFinite(startingBid) || startingBid <= 0 || !startsAt || !endsAt) {
      return json({ error: "Missing or invalid auction fields." }, 400, origin);
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      return json({ error: "End time must be after start time." }, 400, origin);
    }

    const { error } = await admin.from("mini_auctions").insert({
      product_id: productId,
      title,
      description,
      image,
      starting_bid_cents: Math.round(startingBid * 100),
      min_increment_cents: Math.round(minIncrement * 100),
      starts_at: startsAt,
      ends_at: endsAt,
      status: "scheduled",
    });
    if (error) { console.error(error); return json({ error: "Could not create auction." }, 500, origin); }
    return json({ ok: true }, 200, origin);
  }

  if (action === "cancel_auction") {
    const auctionId = String(body?.auctionId || "");
    if (!auctionId) return json({ error: "Missing auction id." }, 400, origin);
    const { error } = await admin.from("mini_auctions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", auctionId);
    if (error) { console.error(error); return json({ error: "Could not cancel auction." }, 500, origin); }
    return json({ ok: true }, 200, origin);
  }

  if (action === "end_auction_now") {
    const auctionId = String(body?.auctionId || "");
    if (!auctionId) return json({ error: "Missing auction id." }, 400, origin);
    const { error: updErr } = await admin.from("mini_auctions")
      .update({ ends_at: new Date().toISOString() })
      .eq("id", auctionId)
      .eq("status", "active");
    if (updErr) { console.error(updErr); return json({ error: "Could not end auction." }, 500, origin); }
    const { error: finalizeErr } = await admin.rpc("mini_finalize_auction", { p_auction_id: auctionId });
    if (finalizeErr) { console.error(finalizeErr); return json({ error: "Could not finalize auction." }, 500, origin); }
    return json({ ok: true }, 200, origin);
  }

  return json({ error: "Unknown view." }, 400, origin);
});
