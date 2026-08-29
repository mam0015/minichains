import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_PRODUCTION_ORIGIN = "https://mam0015.github.io";

function corsHeaders(origin: string | null) {
  const isLocal =
    !!origin &&
    (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    );

  const allowedOrigin =
    origin === ALLOWED_PRODUCTION_ORIGIN || isLocal
      ? origin
      : ALLOWED_PRODUCTION_ORIGIN;

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().slice(0, max);
  return cleaned.length ? cleaned : null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers },
    );
  }

  const isAllowedOrigin =
    !origin ||
    origin === ALLOWED_PRODUCTION_ORIGIN ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:");

  if (!isAllowedOrigin) {
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers },
    );
  }

  try {
    const body = await req.json();

    const firstName = cleanText(body.firstName, 40);
    const level = cleanText(body.level, 30);
    const comment = cleanText(body.comment, 500);
    const orderId = cleanText(body.orderId, 100);

    const paymentMethod =
      body.paymentMethod === "cash" || body.paymentMethod === "card"
        ? body.paymentMethod
        : null;

    if (!firstName && !level && !comment) {
      return new Response(
        JSON.stringify({ error: "No feedback fields were provided" }),
        { status: 400, headers },
      );
    }

    const clientCreatedAt =
      typeof body.createdAt === "string" && !Number.isNaN(Date.parse(body.createdAt))
        ? body.createdAt
        : null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase server environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { error } = await admin
      .from("mini_feedback")
      .insert({
        order_id: orderId,
        payment_method: paymentMethod,
        first_name: firstName,
        level,
        comment,
        client_created_at: clientCreatedAt,
      });

    if (error) {
      console.error("mini_feedback insert failed", error);
      return new Response(
        JSON.stringify({ error: "Could not save feedback" }),
        { status: 500, headers },
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      { status: 400, headers },
    );
  }
});
