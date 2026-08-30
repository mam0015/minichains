// MINI — read-only order status lookup.
// Lets success.html ask "has Square actually confirmed this payment?"
// instead of trusting that merely being redirected here means paid.

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

  const id = new URL(req.url).searchParams.get("id");
  if (!id || !/^[A-Za-z0-9-]{4,64}$/.test(id)) {
    return json({ error: "Invalid order id." }, 400, origin);
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

  const { data, error } = await admin
    .from("mini_orders")
    .select("id, status, payment_method, total, paid_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("mini_orders lookup failed", error);
    return json({ error: "Lookup failed." }, 500, origin);
  }

  if (!data) {
    return json({ found: false }, 200, origin);
  }

  return json({
    found: true,
    status: data.status,
    paymentMethod: data.payment_method,
    total: data.total,
    paidAt: data.paid_at,
  }, 200, origin);
});
