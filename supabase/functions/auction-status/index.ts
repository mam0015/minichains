// MiniChains — public, read-only auction status. Never exposes bidder
// identity — only the current highest AMOUNT and a bid count. Server time
// decides whether an auction is actually open; the client's own countdown
// is cosmetic and re-syncs against `serverNow`/`endsAt` on every poll.

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return json({ error: "Server configuration error." }, 500, origin);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Lazily close/open anything whose window has just passed/arrived before
  // reading — see mini_finalize_auction for why there's no cron job.
  const { data: candidates } = await admin
    .from("mini_auctions")
    .select("id")
    .in("status", ["scheduled", "active"]);
  for (const row of candidates || []) {
    await admin.rpc("mini_finalize_auction", { p_auction_id: row.id });
  }

  const { data: auctions, error } = await admin
    .from("mini_auctions")
    .select("id, product_id, title, description, image, starting_bid_cents, min_increment_cents, starts_at, ends_at, status, current_highest_bid_cents")
    .in("status", ["scheduled", "active", "ended"])
    .order("starts_at", { ascending: true });
  if (error) {
    console.error("mini_auctions lookup failed", error);
    return json({ error: "Could not load auctions." }, 500, origin);
  }

  const results = [];
  for (const a of auctions || []) {
    const { count: bidCount } = await admin
      .from("mini_auction_bids")
      .select("*", { count: "exact", head: true })
      .eq("auction_id", a.id);
    results.push({
      id: a.id,
      productId: a.product_id,
      title: a.title,
      description: a.description,
      image: a.image,
      startingBidCents: a.starting_bid_cents,
      minIncrementCents: a.min_increment_cents,
      currentHighestBidCents: a.current_highest_bid_cents,
      nextMinBidCents: a.current_highest_bid_cents
        ? a.current_highest_bid_cents + a.min_increment_cents
        : a.starting_bid_cents,
      bidCount: bidCount || 0,
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      status: a.status,
    });
  }

  return json({ auctions: results, serverNow: new Date().toISOString() }, 200, origin);
});
