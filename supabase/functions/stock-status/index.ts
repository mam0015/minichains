// MiniChains product status — read-only public endpoint, used by the
// homepage and cart to show live price + "N left" / "Sold out" instead of
// trusting the bundled products.js numbers, which only reflect the values
// as of the last deploy. mini_products is the single authoritative source —
// changing a price or stock count there updates the whole store with no
// code redeploy needed.

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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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
  if (req.method !== "GET") {
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

  // mini_products_live nets out other customers' still-active reservations
  // too, not just confirmed sales, so "N left" is accurate even while
  // someone else is mid-checkout for the same units.
  const { data, error } = await admin
    .from("mini_products_live")
    .select("id, name, base_price_cents, stock_available, created_at")
    .eq("active", true);

  if (error) {
    console.error("mini_products_live lookup failed", error);
    return json({ error: "Could not check product status." }, 500, origin);
  }

  const products: Record<string, { available: number; priceCents: number; name: string; createdAt: string }> = {};
  for (const row of data || []) {
    products[row.id as string] = {
      available: row.stock_available as number,
      priceCents: row.base_price_cents as number,
      name: row.name as string,
      createdAt: row.created_at as string,
    };
  }

  return json({ products }, 200, origin);
});
