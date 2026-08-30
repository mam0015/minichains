// MINI — records a Spin & Win prize the moment it's won, so
// create-square-checkout has a server-side source of truth for which codes
// were actually issued. Without this, any code typed into checkout would
// have to be trusted blindly, since prizes are otherwise only ever
// generated in browser localStorage.
//
// This endpoint is intentionally narrow about what it will accept: it only
// ever records the exact discount tiers and product ids the wheel can
// actually produce, so calling it directly (bypassing the wheel) can never
// mint a bigger discount or a fake product than a real spin could.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://mam0015.github.io",
]);

const ALLOWED_PERCENTS = new Set([5, 10, 20]);
const ALLOWED_PRODUCT_IDS = new Set([
  "KEY-01", "KEY-02", "KEY-03", "KEY-04",
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

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid request." }, 400, origin);

  const code = String(body.code || "").trim().toUpperCase();
  const type = String(body.type || "").trim();

  if (!/^[A-Z0-9-]{6,40}$/.test(code)) {
    return json({ error: "Invalid code format." }, 400, origin);
  }
  if (type !== "discount" && type !== "free") {
    return json({ error: "Invalid prize type." }, 400, origin);
  }

  let percent = 0;
  let freeProductId: string | null = null;

  if (type === "discount") {
    percent = Number(body.percent);
    if (!ALLOWED_PERCENTS.has(percent)) {
      return json({ error: "Invalid discount percent." }, 400, origin);
    }
  } else {
    freeProductId = String(body.freeProductId || "");
    if (!ALLOWED_PRODUCT_IDS.has(freeProductId)) {
      return json({ error: "Invalid product id." }, 400, origin);
    }
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

  // A conflict here just means this code was already recorded (e.g. a
  // retried request) — not an error worth surfacing to the caller.
  const { error } = await admin.from("mini_promo_codes").insert({
    code,
    type,
    percent,
    free_product_id: freeProductId,
  });

  if (error && error.code !== "23505") {
    console.error("mini_promo_codes insert failed", error);
    return json({ error: "Could not record prize." }, 500, origin);
  }

  return json({ ok: true }, 200, origin);
});
