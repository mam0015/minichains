// MiniChains Rewards — read-only status lookup, used by the cart to show
// "Welcome back, X — 2/3 visits" live as the customer types their rewards
// username. Never writes anything; visit progress only ever advances from
// square-webhook, at the moment a card payment is actually confirmed.
//
// POST (not GET) so the caller's locally-stored ownership secret can travel
// in the body instead of a URL query string — usernames are already
// low-sensitivity, but the secret is exactly the kind of value that
// shouldn't end up in server logs or browser history.

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

// Kept byte-for-byte identical in create-square-checkout and square-webhook
// so all three functions agree on what "today" and "a valid username" mean.
function melbourneDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}
function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}
const USERNAME_RE = /^[a-zA-Z0-9]{3,20}$/;

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
  const rawUsername = String(body?.username || "");
  const clientSecret = String(body?.secret || "");
  if (!USERNAME_RE.test(rawUsername.trim())) {
    return json({ error: "Invalid username." }, 400, origin);
  }
  const username = normalizeUsername(rawUsername);

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
    .from("mini_loyalty_accounts")
    .select("display_username, current_cycle_visits, last_eligible_purchase_date, total_eligible_visits, completed_cycles, owner_secret")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("mini_loyalty_accounts lookup failed", error);
    return json({ error: "Lookup failed." }, 500, origin);
  }

  if (!data) {
    return json({
      found: false,
      username,
      nextVisitNumber: 1,
      nextRewardType: "visit1",
    }, 200, origin);
  }

  // Unclaimed (no owner_secret yet, e.g. a pre-Phase-7 account) always
  // matches — the next checkout to use it claims it. A claimed account only
  // matches the browser that actually holds its secret; anyone else sees
  // ownerMatch:false and the frontend must not treat the account as theirs.
  const ownerMatch = !data.owner_secret || data.owner_secret === clientSecret;

  const today = melbourneDate();
  const wouldAdvanceToday = data.last_eligible_purchase_date !== today;
  const nextVisitNumber = wouldAdvanceToday
    ? data.current_cycle_visits + 1
    : data.current_cycle_visits; // same-day repeat: would not advance
  const nextRewardType =
    nextVisitNumber === 1 ? "visit1" :
    nextVisitNumber === 2 ? "discount10" :
    nextVisitNumber === 3 ? "free_keychain" : "none";

  return json({
    found: true,
    ownerMatch,
    displayUsername: data.display_username,
    currentCycleVisits: data.current_cycle_visits,
    totalEligibleVisits: data.total_eligible_visits,
    completedCycles: data.completed_cycles,
    wouldAdvanceToday,
    nextVisitNumber,
    nextRewardType,
  }, 200, origin);
});
