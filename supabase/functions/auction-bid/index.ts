// MiniChains — places a free auction bid. No payment is collected here or
// anywhere near it; bidding costs nothing and this function never touches
// Square. All validation (auction actually open, bid amount, rate limit)
// happens atomically server-side via mini_place_bid — the frontend's own
// displayed "current bid"/countdown is never trusted.

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

const VISITOR_ID_RE = /^[a-zA-Z0-9-]{8,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\s-]{6,20}$/;

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
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
  if (!body) return json({ error: "Invalid request." }, 400, origin);

  const auctionId = clean(body.auctionId, 100);
  const visitorId = clean(body.visitorId, 64);
  const firstName = clean(body.firstName, 40);
  const lastName = clean(body.lastName, 40);
  const yearLevel = clean(body.yearLevel, 20);
  const contactMethod = clean(body.contactMethod, 10);
  const contactValue = clean(body.contactValue, 100);
  const amount = Number(body.amount);

  if (!auctionId || !VISITOR_ID_RE.test(visitorId)) {
    return json({ error: "Invalid request." }, 400, origin);
  }
  if (!firstName || !lastName) {
    return json({ error: "First and last name are required." }, 400, origin);
  }
  if (!yearLevel) {
    return json({ error: "Year level is required." }, 400, origin);
  }
  if (contactMethod !== "phone" && contactMethod !== "email") {
    return json({ error: "Choose a contact method." }, 400, origin);
  }
  if (contactMethod === "email" && !EMAIL_RE.test(contactValue)) {
    return json({ error: "Enter a valid email address." }, 400, origin);
  }
  if (contactMethod === "phone" && !PHONE_RE.test(contactValue)) {
    return json({ error: "Enter a valid phone number." }, 400, origin);
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    return json({ error: "Invalid bid amount." }, 400, origin);
  }
  const amountCents = Math.round(amount * 100);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return json({ error: "Server configuration error." }, 500, origin);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("mini_place_bid", {
    p_auction_id: auctionId,
    p_visitor_id: visitorId,
    p_first_name: firstName,
    p_last_name: lastName,
    p_year_level: yearLevel,
    p_contact_method: contactMethod,
    p_contact_value: contactValue,
    p_amount_cents: amountCents,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("AUCTION_NOT_FOUND")) {
      return json({ error: "This auction doesn't exist." }, 404, origin);
    }
    if (msg.includes("AUCTION_NOT_OPEN")) {
      return json({ error: "This auction isn't open for bids right now." }, 409, origin);
    }
    if (msg.includes("RATE_LIMITED")) {
      return json({ error: "Too many bids too quickly — please wait a moment and try again." }, 429, origin);
    }
    const tooLow = /BID_TOO_LOW:(-?\d+):(\d+)/.exec(msg);
    if (tooLow) {
      const minNext = (Number(tooLow[1]) + Number(tooLow[2])) / 100;
      return json({ error: `Your bid must be at least $${minNext.toFixed(2)}.`, minNextBid: minNext }, 409, origin);
    }
    console.error("mini_place_bid failed", error);
    return json({ error: "Could not place your bid — please try again." }, 500, origin);
  }

  return json({ ok: true }, 200, origin);
});
