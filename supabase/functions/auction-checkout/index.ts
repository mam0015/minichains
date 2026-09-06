// MiniChains — payment for a confirmed auction winner. Bidding itself is
// always free; this is the ONLY place an auction ever touches Square, and
// only after the auction has actually ended with this visitor as the
// recorded winning bidder. The charge is the exact winning bid amount —
// never anything the browser proposes.

import { createClient } from "npm:@supabase/supabase-js@2";

const SQUARE_VERSION = "2026-08-19";
const SQUARE_ENDPOINT = "https://connect.squareup.com/v2/online-checkout/payment-links";

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

function isAllowedRedirect(url: string) {
  try {
    const u = new URL(url);
    if (u.origin === "https://mam0015.github.io") return true;
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    return false;
  } catch {
    return false;
  }
}

function makeOrderId() {
  const rand = crypto.getRandomValues(new Uint32Array(2));
  const time = Date.now().toString(36).slice(-5).toUpperCase();
  const tail = (rand[0] ^ rand[1]).toString(36).slice(-4).toUpperCase();
  return `MINI-AUC-${time}-${tail}`;
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

  const body = await req.json().catch(() => null);
  const auctionId = String(body?.auctionId || "").trim();
  const visitorId = String(body?.visitorId || "").trim();
  const redirectUrl = String(body?.redirectUrl || "").trim();

  if (!auctionId || !visitorId || !redirectUrl || !isAllowedRedirect(redirectUrl)) {
    return json({ error: "Invalid request." }, 400, origin);
  }

  const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
  const locationId = Deno.env.get("SQUARE_LOCATION_ID");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!accessToken || !locationId || !supabaseUrl || !serviceRoleKey) {
    console.error("Missing Square/Supabase configuration");
    return json({ error: "Payment service is not configured yet." }, 500, origin);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await admin.rpc("mini_finalize_auction", { p_auction_id: auctionId });

  const { data: auction, error: auctionErr } = await admin
    .from("mini_auctions")
    .select("id, title, status, winner_bid_id, winner_payment_status, winner_payment_deadline")
    .eq("id", auctionId)
    .maybeSingle();
  if (auctionErr) {
    console.error("mini_auctions lookup failed", auctionErr);
    return json({ error: "Could not load auction." }, 500, origin);
  }
  if (!auction || auction.status !== "ended" || !auction.winner_bid_id) {
    return json({ error: "This auction hasn't ended with a winner yet." }, 409, origin);
  }
  if (auction.winner_payment_status === "paid") {
    return json({ error: "This auction has already been paid for." }, 409, origin);
  }
  if (auction.winner_payment_deadline && new Date(auction.winner_payment_deadline as string).getTime() < Date.now()) {
    return json({ error: "The payment window for this auction has passed — please contact MiniChains." }, 409, origin);
  }

  const { data: winningBid, error: bidErr } = await admin
    .from("mini_auction_bids")
    .select("id, visitor_id, amount_cents")
    .eq("id", auction.winner_bid_id)
    .maybeSingle();
  if (bidErr || !winningBid) {
    console.error("mini_auction_bids lookup failed", bidErr);
    return json({ error: "Could not verify the winning bid." }, 500, origin);
  }
  if (winningBid.visitor_id !== visitorId) {
    return json({ error: "This checkout link only works for the winning bidder's own device." }, 403, origin);
  }

  const orderId = makeOrderId();

  try {
    const squareRes = await fetch(SQUARE_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Square-Version": SQUARE_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        description: "MiniChains auction win",
        order: {
          location_id: locationId,
          line_items: [{
            name: `Auction win: ${auction.title}`,
            quantity: "1",
            base_price_money: { amount: winningBid.amount_cents, currency: "AUD" },
          }],
        },
        checkout_options: {
          redirect_url: redirectUrl,
          allow_tipping: false,
          ask_for_shipping_address: false,
        },
        payment_note: `MiniChains auction ${auctionId}`,
      }),
    });

    const squareData = await squareRes.json().catch(() => ({}));
    if (!squareRes.ok) {
      console.error("Square CreatePaymentLink error:", squareData);
      throw new Error(squareData?.errors?.[0]?.detail || "Square could not create the checkout.");
    }
    const paymentLink = squareData?.payment_link;
    if (!paymentLink?.url) throw new Error("Square returned an invalid checkout response.");

    const { error: orderErr } = await admin.from("mini_orders").insert({
      id: orderId,
      payment_method: "card",
      status: "pending",
      items: [],
      subtotal: winningBid.amount_cents / 100,
      total: winningBid.amount_cents / 100,
      square_payment_link_id: paymentLink.id || null,
      square_order_id: paymentLink.order_id || null,
      auction_id: auctionId,
    });
    if (orderErr) console.error("mini_orders insert (auction) failed", orderErr);

    return json({ url: paymentLink.url, orderId }, 200, origin);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Checkout failed." }, 500, origin);
  }
});
