// MINI — Square webhook receiver.
// Square calls this server-to-server (no browser, no CORS, no Supabase JWT).
// Authenticity comes entirely from the HMAC-SHA256 signature Square attaches
// to every notification — this is the ONLY thing that may mark an order paid.

import { createClient } from "npm:@supabase/supabase-js@2";

// Must match the exact "Notification URL" configured for this webhook
// subscription in the Square Dashboard — the signature is computed over
// this URL, so any mismatch (trailing slash, http vs https) breaks it.
const NOTIFICATION_URL =
  "https://hkjgitxovfiamibgpoan.supabase.co/functions/v1/square-webhook";

async function isValidSignature(rawBody: string, signatureHeader: string | null, signatureKey: string) {
  if (!signatureHeader) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(NOTIFICATION_URL + rawBody),
  );

  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Constant-time-ish comparison: lengths must match, then compare every byte.
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signatureKey = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY");
  if (!signatureKey) {
    console.error("Missing SQUARE_WEBHOOK_SIGNATURE_KEY");
    // 500, not 200 — a missing secret should surface as a delivery failure
    // in the Square dashboard rather than being silently swallowed.
    return new Response(JSON.stringify({ error: "Webhook not configured." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-square-hmacsha256-signature");

  if (!(await isValidSignature(rawBody, signatureHeader, signatureKey))) {
    console.error("Square webhook signature mismatch");
    return new Response(JSON.stringify({ error: "Invalid signature." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // We only care about payment status. Every other subscribed event type
  // (if any) is acknowledged with 200 so Square doesn't keep retrying it.
  const payment = event?.data?.object?.payment;
  if (!event?.type?.startsWith("payment.") || !payment) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (payment.status !== "COMPLETED") {
    return new Response(JSON.stringify({ ok: true, status: payment.status }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const squareOrderId = payment.order_id || null;
  if (!squareOrderId) {
    console.error("Completed payment with no order_id", payment.id);
    return new Response(JSON.stringify({ ok: true, unmatched: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Idempotent: a duplicate delivery of the same event just re-applies the
    // same update, and orders already marked paid are left untouched.
    const { data, error } = await admin
      .from("mini_orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("square_order_id", squareOrderId)
      .neq("status", "paid")
      .select("id");

    if (error) {
      console.error("mini_orders update failed", error);
      return new Response(JSON.stringify({ error: "Could not update order." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!data || data.length === 0) {
      console.error("No matching pending order for square_order_id", squareOrderId);
    }

    return new Response(JSON.stringify({ ok: true, matched: data?.length || 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Webhook processing failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
