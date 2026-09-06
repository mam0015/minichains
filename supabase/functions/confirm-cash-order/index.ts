// MiniChains — confirms a cash sale and decrements stock for it.
// Cash has no external processor like Square, so there is no independent
// "was this actually paid" signal to verify — the seller's own tap of
// "Cash received" (after the cash has physically changed hands) IS the
// confirmation. Because of that, this is also the one place a customer's
// own device must NOT be able to act unsupervised: a valid staff session
// token (from staff-login, gated by the STAFF_PIN secret) is required, or
// the call is rejected outright — no token, no stock decrement, no "paid".
// This function's job is to make a real staff confirmation also decrement
// real inventory, atomically and safely, the same way square-webhook does
// for card once a payment is confirmed. It never touches price — cash
// pricing stays exactly as already computed client-side.

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

type InputItem = { id?: unknown; qty?: unknown };

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
  if (!body || !Array.isArray(body.items) || !body.items.length) {
    return json({ error: "Invalid request." }, 400, origin);
  }

  const orderId = typeof body.orderId === "string" && /^[A-Za-z0-9-]{4,64}$/.test(body.orderId)
    ? body.orderId
    : null;
  const total = Number(body.total);

  const items: { product_id: string; qty: number }[] = [];
  let totalUnits = 0;

  for (const raw of body.items as InputItem[]) {
    const id = String(raw.id || "");
    const qty = Number(raw.qty);

    if (!id) {
      return json({ error: "Invalid product id." }, 400, origin);
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      return json({ error: `Invalid quantity for ${id}.` }, 400, origin);
    }

    totalUnits += qty;
    if (totalUnits > 50) {
      return json({ error: "Too many items in one order." }, 400, origin);
    }

    items.push({ product_id: id, qty });
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

  const staffToken = String(body.staffToken || "");
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

  // mini_products is the single authoritative product list — validated live
  // instead of against a hardcoded id set that would otherwise be a 4th
  // hand-maintained copy of the catalog.
  const requestedIds = items.map((it) => it.product_id);
  const { data: knownProducts, error: productErr } = await admin
    .from("mini_products")
    .select("id")
    .in("id", requestedIds)
    .eq("active", true);
  if (productErr) {
    console.error("mini_products lookup failed", productErr);
    return json({ error: "Could not verify products." }, 500, origin);
  }
  const knownIds = new Set((knownProducts || []).map((r) => r.id as string));
  const unknown = requestedIds.find((id) => !knownIds.has(id));
  if (unknown) {
    return json({ error: `Unknown product: ${unknown}` }, 400, origin);
  }

  const { error } = await admin.rpc("mini_decrement_stock", { p_items: items });

  if (error) {
    const match = /INSUFFICIENT_STOCK:([^:]+):(\d+):(\d+)/.exec(error.message || "");
    if (match) {
      const [, productId, available] = match;
      return json({
        error: `Only ${available} left of ${productId} - please lower the quantity.`,
        productId,
        available: Number(available),
      }, 409, origin);
    }
    console.error("mini_decrement_stock failed", error);
    return json({ error: "Could not update stock." }, 500, origin);
  }

  // Cash sales otherwise have zero server-side record at all — this is the
  // only point one exists, so the admin dashboard's Orders/Cash/Overview
  // views aren't silently blind to every cash sale. Best-effort: the stock
  // decrement above (the part that actually matters for not overselling)
  // has already succeeded, so a failure here is logged only, never
  // surfaced as if the confirmation itself failed.
  if (orderId && Number.isFinite(total)) {
    const { error: orderErr } = await admin.from("mini_orders").insert({
      id: orderId,
      payment_method: "cash",
      status: "paid",
      items: items.map((it) => ({ id: it.product_id, qty: it.qty })),
      subtotal: total,
      total,
      paid_at: new Date().toISOString(),
    });
    // 23505 = this order id was already recorded (e.g. a retried request) — not a real error.
    if (orderErr && orderErr.code !== "23505") {
      console.error("mini_orders insert (cash) failed", orderErr);
    }
  }

  return json({ ok: true }, 200, origin);
});
