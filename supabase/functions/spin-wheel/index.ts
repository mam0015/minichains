// MiniChains — server-authoritative Spin & Win. The browser only asks
// "what did I win" and animates the wheel to land on whatever comes back;
// it never decides the result itself. Also enforces one spin per visitor
// server-side (unique visitor_id row) — the old client-only localStorage
// check had no real defense against someone clearing storage and spinning
// again.
//
// Kept in sync with the wheel's visual segments in app.js/success.js — if
// those weights ever change, change them here too so the odds actually
// match what the wheel shows.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://mam0015.github.io",
]);

const SEGMENTS = [
  { type: "empty", percent: 0, weight: 15 },
  { type: "discount", percent: 5, weight: 12 },
  { type: "empty", percent: 0, weight: 15 },
  { type: "discount", percent: 10, weight: 8 },
  { type: "empty", percent: 0, weight: 15 },
  { type: "discount", percent: 20, weight: 5 },
  { type: "empty", percent: 0, weight: 15 },
  { type: "empty", percent: 0, weight: 15 },
];

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

function chooseSegment() {
  const totalWeight = SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
  const rand = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  let n = rand * totalWeight;
  for (const seg of SEGMENTS) {
    if (n < seg.weight) return seg;
    n -= seg.weight;
  }
  return SEGMENTS[0];
}

function makeCode(percent: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  const tail = [...bytes].map((b) => chars[b % chars.length]).join("");
  return `MINI${percent}-${tail}`;
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
  const visitorId = String(body?.visitorId || "").trim();
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

  // Already spun (e.g. localStorage was cleared, or a different device) —
  // hand back the SAME result rather than granting a second free spin.
  const { data: existing, error: existingErr } = await admin
    .from("mini_spins")
    .select("result_type, percent, code")
    .eq("visitor_id", visitorId)
    .maybeSingle();
  if (existingErr) {
    console.error("mini_spins lookup failed", existingErr);
    return json({ error: "Could not check spin status." }, 500, origin);
  }
  if (existing) {
    return json({
      type: existing.result_type,
      percent: existing.percent,
      code: existing.code,
      alreadySpun: true,
    }, 200, origin);
  }

  const seg = chooseSegment();
  const code = seg.type === "discount" ? makeCode(seg.percent) : null;

  // Record the spin AND (for a real prize) the redeemable code in one
  // step — no separate record-prize round-trip needed for this wheel.
  const { error: insertErr } = await admin.from("mini_spins").insert({
    visitor_id: visitorId,
    result_type: seg.type,
    percent: seg.percent,
    code,
  });
  if (insertErr) {
    // A 23505 here means a race — two near-simultaneous requests from the
    // same visitor. Fetch and return whichever result actually won rather
    // than erroring.
    if (insertErr.code === "23505") {
      const { data: raced } = await admin
        .from("mini_spins")
        .select("result_type, percent, code")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (raced) {
        return json({ type: raced.result_type, percent: raced.percent, code: raced.code, alreadySpun: true }, 200, origin);
      }
    }
    console.error("mini_spins insert failed", insertErr);
    return json({ error: "Could not record your spin." }, 500, origin);
  }

  if (code) {
    const { error: promoErr } = await admin.from("mini_promo_codes").insert({
      code,
      type: "discount",
      percent: seg.percent,
    });
    if (promoErr) console.error("mini_promo_codes insert failed", promoErr);
  }

  return json({ type: seg.type, percent: seg.percent, code, alreadySpun: false }, 200, origin);
});
