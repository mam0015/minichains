// MiniChains — records a Terms & Conditions accept/decline. Fire-and-forget
// from the frontend's perspective (the actual gate is client-side, for
// instant response) — this is just the accountable, non-editable record of
// what a visitor agreed to and when.

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

  const visitorId = String(body.visitorId || "").trim();
  const version = String(body.version || "").trim().slice(0, 20);
  const accepted = body.accepted === true;

  if (!VISITOR_ID_RE.test(visitorId) || !version) {
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

  const { error } = await admin.from("mini_terms_acceptance").insert({
    visitor_id: visitorId,
    terms_version: version,
    accepted,
  });

  if (error) {
    console.error("mini_terms_acceptance insert failed", error);
    return json({ error: "Could not record response." }, 500, origin);
  }

  return json({ ok: true }, 200, origin);
});
