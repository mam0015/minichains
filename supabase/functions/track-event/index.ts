// MiniChains — first-party funnel analytics. Fire-and-forget from the
// frontend's perspective: it must never block or slow down the action it's
// tracking, and a failure here must never surface to the customer. No
// invasive fingerprinting — visitor_id is the same random per-browser id
// used for Terms/restock requests, a device estimate, not an identity.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://mam0015.github.io",
]);

// Narrow, explicit allowlist — this endpoint can never be used to log
// arbitrary free-form events or become a general write API.
const ALLOWED_EVENTS = new Set([
  "session_start",
  "product_view",
  "category_view",
  "search",
  "add_to_cart",
  "checkout_started",
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
  const visitorId = String(body?.visitorId || "").trim();
  const eventType = String(body?.event || "").trim();

  // Always 2xx-shaped for an invalid/unrecognised event — a caller
  // shouldn't need to handle analytics-specific error branches.
  if (!VISITOR_ID_RE.test(visitorId) || !ALLOWED_EVENTS.has(eventType)) {
    return json({ ok: true, ignored: true }, 200, origin);
  }

  // event_data is small, bounded free text/ids only — never PII.
  const rawData = body?.data && typeof body.data === "object" ? body.data : {};
  const eventData: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawData)) {
    if (typeof v === "string" || typeof v === "number") {
      eventData[k.slice(0, 40)] = String(v).slice(0, 200);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return json({ ok: true }, 200, origin); // never block the caller over config issues
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await admin.from("mini_analytics_events").insert({
    visitor_id: visitorId,
    event_type: eventType,
    event_data: eventData,
  });
  if (error) console.error("mini_analytics_events insert failed", error);

  return json({ ok: true }, 200, origin);
});
