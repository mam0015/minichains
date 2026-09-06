// MiniChains — exchanges the shared staff PIN for a session token.
// The PIN itself is never stored in the database or sent to the frontend —
// it's a Supabase secret (STAFF_PIN), checked here and only here. The
// returned token is what actually authorises staff-only actions like
// confirm-cash-order; a customer's own device never has one unless someone
// who knows the PIN typed it in.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://mam0015.github.io",
]);

const SESSION_HOURS = 12;

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

// Constant-time-ish comparison so response timing doesn't leak how many
// leading characters of a guess were correct.
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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

  const staffPin = Deno.env.get("STAFF_PIN");
  if (!staffPin) {
    console.error("Missing STAFF_PIN");
    return json({ error: "Staff login is not configured yet." }, 500, origin);
  }

  const body = await req.json().catch(() => null);
  const pin = String(body?.pin || "");

  if (!pin || !safeEqual(pin, staffPin)) {
    return json({ error: "Incorrect PIN." }, 401, origin);
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

  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("mini_staff_sessions").insert({ token, expires_at: expiresAt });
  if (error) {
    console.error("mini_staff_sessions insert failed", error);
    return json({ error: "Could not start session." }, 500, origin);
  }

  return json({ token, expiresAt }, 200, origin);
});
