// MiniChains — records "let us know you want this" interest on a sold-out
// (or not-yet-available) product, so the seller knows real demand before
// deciding what to print next. One row per (product, visitor) — a repeat
// request from the same browser is a no-op, not a new row, so a single
// visitor clicking repeatedly can't inflate demand.

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

  const productId = String(body.productId || "").trim();
  const visitorId = String(body.visitorId || "").trim();
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : null;

  if (!productId) {
    return json({ error: "Missing product." }, 400, origin);
  }
  if (!VISITOR_ID_RE.test(visitorId)) {
    return json({ error: "Invalid request." }, 400, origin);
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

  // Any known product (active or not — a pending "coming soon"-style item
  // can legitimately collect interest too), never a fabricated id.
  const { data: product, error: productErr } = await admin
    .from("mini_products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();
  if (productErr) {
    console.error("mini_products lookup failed", productErr);
    return json({ error: "Could not verify product." }, 500, origin);
  }
  if (!product) {
    return json({ error: "Unknown product." }, 400, origin);
  }

  const { error } = await admin.from("mini_restock_requests").insert({
    product_id: productId,
    visitor_id: visitorId,
    note,
  });

  // A conflict just means this visitor already requested this product —
  // treated as success, not an error, so the UI can show the same
  // "thanks, we've noted it" confirmation either way.
  if (error && error.code !== "23505") {
    console.error("mini_restock_requests insert failed", error);
    return json({ error: "Could not record your request." }, 500, origin);
  }

  return json({ ok: true }, 200, origin);
});
