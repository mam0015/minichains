// MINI — dynamic Square Checkout
// Public endpoint called by the GitHub Pages storefront.
// Square credentials stay server-side in Supabase Secrets.

import { createClient } from "npm:@supabase/supabase-js@2";

const SQUARE_VERSION = "2026-08-19";
const SQUARE_ENDPOINT = "https://connect.squareup.com/v2/online-checkout/payment-links";

const PRODUCTS: Record<string, { name: string; cents: number }> = {
  "KEY-01": { name: "Mini Eiffel Tower Keychain", cents: 511 },
  "KEY-02": { name: "Adorable Cupcake Keychain", cents: 511 },
  "KEY-03": { name: "Cute Mini Cat Keychain", cents: 409 },
  "KEY-04": { name: "Animal Keychain Collection", cents: 409 },
};

// Must match the wheel's real segments (app.js / success.js) — this is a
// second line of defense on top of record-prize already rejecting
// anything outside these values.
const ALLOWED_PERCENTS = new Set([5, 10, 20]);

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

function isAllowedRedirect(url: string) {
  try {
    const u = new URL(url);
    if (u.origin === "https://mam0015.github.io") return true;
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    return false;
  } catch {
    return false;
  }
}

function makeOrderId() {
  const rand = crypto.getRandomValues(new Uint32Array(2));
  const time = Date.now().toString(36).slice(-5).toUpperCase();
  const tail = (rand[0] ^ rand[1]).toString(36).slice(-4).toUpperCase();
  return `MINI-${time}-${tail}`;
}

type InputItem = { id?: unknown; qty?: unknown };

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

  let admin: ReturnType<typeof createClient> | null = null;
  let claimedPromoCode: string | null = null;

  try {
    const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
    const locationId = Deno.env.get("SQUARE_LOCATION_ID");

    if (!accessToken || !locationId) {
      console.error("Missing SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID");
      return json({ error: "Payment service is not configured yet." }, 500, origin);
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.items)) {
      return json({ error: "Invalid checkout request." }, 400, origin);
    }

    const redirectUrl = String(body.redirectUrl || "").trim();
    if (!redirectUrl || !isAllowedRedirect(redirectUrl)) {
      return json({ error: "Invalid confirmation URL." }, 400, origin);
    }

    // The frontend proposes an order id (so it can build redirectUrl up
    // front) but it carries no trust — every price below is recalculated
    // from our own PRODUCTS table, never from the browser.
    const orderId =
      typeof body.orderId === "string" && /^[A-Za-z0-9-]{4,64}$/.test(body.orderId)
        ? body.orderId
        : makeOrderId();

    const orderItems: { id: string; qty: number; price: number }[] = [];
    const lineItems = [];
    let subtotalCents = 0;
    let totalUnits = 0;

    for (const raw of body.items as InputItem[]) {
      const id = String(raw.id || "");
      const product = PRODUCTS[id];
      const qty = Number(raw.qty);

      if (!product) {
        return json({ error: `Unknown product: ${id}` }, 400, origin);
      }

      if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
        return json({ error: `Invalid quantity for ${id}.` }, 400, origin);
      }

      totalUnits += qty;
      if (totalUnits > 50) {
        return json({ error: "Too many items in one order." }, 400, origin);
      }

      subtotalCents += product.cents * qty;
      orderItems.push({ id, qty, price: product.cents / 100 });
      lineItems.push({
        name: product.name,
        quantity: String(qty),
        base_price_money: {
          amount: product.cents,
          currency: "AUD",
        },
      });
    }

    if (!lineItems.length) {
      return json({ error: "Your bag is empty." }, 400, origin);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return json({ error: "Server configuration error." }, 500, origin);
    }
    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Spin & Win prize codes: validated and claimed against the
    // server-side record-prize table (never trusted from the browser).
    // A code is "claimed" (marked used) here, before we ever call Square,
    // so two simultaneous requests can't both redeem it — if the Square
    // call subsequently fails for an unrelated reason, the claim is
    // rolled back in the catch block below.
    const promoCodeInput = String(body.promoCode || "").trim().toUpperCase();
    let promoPercent = 0;
    let promoDiscountCents = 0;
    let freeProductId: string | null = null;
    const discounts: { name: string; percentage: string; scope: string }[] = [];

    if (promoCodeInput) {
      const { data: promo, error: promoErr } = await admin
        .from("mini_promo_codes")
        .select("code, type, percent, free_product_id, used")
        .eq("code", promoCodeInput)
        .maybeSingle();

      if (promoErr) {
        console.error("mini_promo_codes lookup failed", promoErr);
        return json({ error: "Could not verify promo code." }, 500, origin);
      }
      if (!promo) {
        return json({ error: "This promo code isn't recognised by our server yet — try again in a moment, or remove it." }, 400, origin);
      }
      if (promo.used) {
        return json({ error: "This one-time code has already been used." }, 409, origin);
      }

      const { data: claimed, error: claimErr } = await admin
        .from("mini_promo_codes")
        .update({ used: true, used_at: new Date().toISOString(), used_for_order: orderId })
        .eq("code", promoCodeInput)
        .eq("used", false)
        .select("code");

      if (claimErr) {
        console.error("mini_promo_codes claim failed", claimErr);
        return json({ error: "Could not verify promo code." }, 500, origin);
      }
      if (!claimed || claimed.length === 0) {
        return json({ error: "This one-time code has already been used." }, 409, origin);
      }
      claimedPromoCode = promoCodeInput;

      if (promo.type === "discount") {
        const pct = Number(promo.percent);
        if (!ALLOWED_PERCENTS.has(pct)) {
          throw new Error("Recorded promo code has an invalid percent.");
        }
        promoPercent = pct;
        promoDiscountCents = Math.round(subtotalCents * pct / 100);
        discounts.push({
          name: `Spin & Win ${pct}% off`,
          percentage: String(pct),
          scope: "ORDER",
        });
      } else if (promo.type === "free") {
        const freeProduct = promo.free_product_id ? PRODUCTS[promo.free_product_id] : null;
        if (!freeProduct) {
          throw new Error("Recorded promo code has an unknown free product.");
        }
        freeProductId = promo.free_product_id as string;
        lineItems.push({
          name: `${freeProduct.name} (free — Spin & Win)`,
          quantity: "1",
          base_price_money: { amount: 0, currency: "AUD" },
        });
      }
    }

    const squareBody: Record<string, unknown> = {
      idempotency_key: crypto.randomUUID(),
      description: "MINI Keychains online order",
      order: {
        location_id: locationId,
        line_items: lineItems,
        ...(discounts.length ? { discounts } : {}),
      },
      checkout_options: {
        redirect_url: redirectUrl,
        allow_tipping: false,
        ask_for_shipping_address: false,
      },
      payment_note: `MINI order ${orderId}`,
    };

    const squareRes = await fetch(SQUARE_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Square-Version": SQUARE_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(squareBody),
    });

    const squareData = await squareRes.json().catch(() => ({}));

    if (!squareRes.ok) {
      console.error("Square CreatePaymentLink error:", squareData);
      const detail =
        squareData?.errors?.[0]?.detail ||
        squareData?.errors?.[0]?.code ||
        "Square could not create the checkout.";
      throw new Error(detail);
    }

    const paymentLink = squareData?.payment_link;
    if (!paymentLink?.url) {
      console.error("Square response missing payment_link.url:", squareData);
      throw new Error("Square returned an invalid checkout response.");
    }

    // Record the order as pending. This is what the webhook later flips to
    // "paid" once Square confirms — the redirect alone is never treated as
    // proof of payment. A failure here is logged but does not block the
    // customer from paying; it just means this order won't be trackable
    // server-side, so we still return the Square URL.
    try {
      const { error } = await admin.from("mini_orders").insert({
        id: orderId,
        payment_method: "card",
        status: "pending",
        items: orderItems,
        subtotal: subtotalCents / 100,
        promo_code: claimedPromoCode,
        promo_percent: promoPercent,
        promo_discount: promoDiscountCents / 100,
        free_prize_product_id: freeProductId,
        total: (subtotalCents - promoDiscountCents) / 100,
        square_payment_link_id: paymentLink.id || null,
        square_order_id: paymentLink.order_id || null,
        survey: body.survey && typeof body.survey === "object" ? body.survey : null,
      });
      if (error) console.error("mini_orders insert failed", error);
    } catch (dbErr) {
      console.error("mini_orders insert threw", dbErr);
    }

    return json({
      url: paymentLink.url,
      orderId,
      squareOrderId: paymentLink.order_id || null,
      paymentLinkId: paymentLink.id || null,
    }, 200, origin);

  } catch (error) {
    // A promo code was claimed but the checkout didn't actually go
    // through (Square rejected it, etc.) — give it back rather than
    // burning a real prize for nothing.
    if (admin && claimedPromoCode) {
      const { error: revertErr } = await admin
        .from("mini_promo_codes")
        .update({ used: false, used_at: null, used_for_order: null })
        .eq("code", claimedPromoCode);
      if (revertErr) console.error("Could not revert promo claim", revertErr);
    }
    console.error(error);
    return json({
      error: error instanceof Error ? error.message : "Checkout failed."
    }, 500, origin);
  }
});
