// MINI — dynamic Square Checkout
// Public endpoint called by the GitHub Pages storefront.
// Square credentials stay server-side in Supabase Secrets.

const SQUARE_VERSION = "2026-08-19";
const SQUARE_ENDPOINT = "https://connect.squareup.com/v2/online-checkout/payment-links";

const PRODUCTS: Record<string, { name: string; cents: number }> = {
  "KEY-01": { name: "Cute Panda Heart", cents: 409 },
  "KEY-02": { name: "Cinnamon Roll Tray", cents: 460 },
  "KEY-03": { name: "Daisy Flower", cents: 307 },
  "KEY-04": { name: "Retro Music Cassette", cents: 358 },
  "KEY-05": { name: "Soccer Ball", cents: 409 },
  "KEY-06": { name: "Tung Tung Sahur", cents: 511 },
};

const ALLOWED_ORIGINS = new Set([
  "https://mam0015.github.io",
  "http://localhost:8000",
  "http://localhost:5500",
  "http://127.0.0.1:8000",
  "http://127.0.0.1:5500",
]);

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://mam0015.github.io";
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

type InputItem = { id?: unknown; qty?: unknown };

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, origin);
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: "Origin not allowed." }, 403, origin);
  }

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

    const lineItems = [];
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

    // IMPORTANT:
    // Current V16 prize codes are generated only in browser localStorage.
    // They are not secure enough to validate for real-money checkout yet.
    // We therefore refuse a promo-bearing card checkout instead of trusting
    // a forgeable browser discount. The promo system should be moved
    // server-side before enabling it for production card payments.
    const promoCode = String(body.promoCode || "").trim();
    if (promoCode) {
      return json({
        error: "Prize-code card checkout is being secured. Remove the promo code for this payment."
      }, 409, origin);
    }

    const squareBody = {
      idempotency_key: crypto.randomUUID(),
      description: "MINI Keychains online order",
      order: {
        location_id: locationId,
        line_items: lineItems,
      },
      checkout_options: {
        redirect_url: redirectUrl,
        allow_tipping: false,
        ask_for_shipping_address: false,
      },
      payment_note: "MINI Keychains online order",
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
      return json({ error: detail }, 502, origin);
    }

    const paymentLink = squareData?.payment_link;
    if (!paymentLink?.url) {
      console.error("Square response missing payment_link.url:", squareData);
      return json({ error: "Square returned an invalid checkout response." }, 502, origin);
    }

    return json({
      url: paymentLink.url,
      squareOrderId: paymentLink.order_id || null,
      paymentLinkId: paymentLink.id || null,
    }, 200, origin);

  } catch (error) {
    console.error(error);
    return json({
      error: error instanceof Error ? error.message : "Checkout failed."
    }, 500, origin);
  }
});
