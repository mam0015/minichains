// MINI — Square webhook receiver.
// Square calls this server-to-server (no browser, no CORS, no Supabase JWT).
// Authenticity comes entirely from the HMAC-SHA256 signature Square attaches
// to every notification — this is the ONLY thing that may mark an order paid.

import { createClient } from "npm:@supabase/supabase-js@2";

function melbourneDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

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
    // same update, and orders already marked paid are left untouched. This
    // is also what makes loyalty processing below safe to run unconditionally
    // right after — it only executes the one time an order actually flips
    // from non-paid to paid.
    const { data, error } = await admin
      .from("mini_orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("square_order_id", squareOrderId)
      .neq("status", "paid")
      .select("id, items, free_prize_product_id, rewards_username, rewards_username_display, rewards_username_secret, loyalty_visit_number, loyalty_reward_type, loyalty_discount_amount, loyalty_free_product_id, loyalty_processed, square_order_id, square_payment_link_id, auction_id");

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

    const order = data && data[0];

    // Stock: decrement here, and only here — exactly like loyalty below,
    // this only runs when THIS call just flipped the order to paid (see the
    // .neq("status","paid") guard above), so a duplicate webhook delivery
    // naturally skips it. The real cart items were already atomically
    // reserved in create-square-checkout (mini_reserve_stock) — confirming
    // here just converts that reservation into a permanent stock_on_hand
    // decrement; it can't fail for "insufficient stock" since the
    // reservation already guaranteed the units exist. Free extras (a Spin &
    // Win prize or a MiniChains Rewards visit-3 item) were never reserved —
    // they're rare, low-volume, and chosen from live stock at
    // checkout-creation time, so a decrement failure here is logged only
    // rather than treated as a real error; the payment already succeeded
    // and must never be made to look like it failed over inventory
    // bookkeeping. At this small, in-person scale an occasional oversell on
    // a free extra just means the seller notices and handles it directly.
    if (order) {
      const { error: confirmErr } = await admin.rpc("mini_confirm_reservation", { p_order_id: order.id });
      if (confirmErr) console.error("mini_confirm_reservation failed for order", order.id, confirmErr);

      const freeItems = [
        ...(order.free_prize_product_id ? [{ product_id: order.free_prize_product_id as string, qty: 1 }] : []),
        ...(order.loyalty_free_product_id ? [{ product_id: order.loyalty_free_product_id as string, qty: 1 }] : []),
      ];
      if (freeItems.length) {
        const { error: stockErr } = await admin.rpc("mini_decrement_stock", { p_items: freeItems });
        if (stockErr) console.error("mini_decrement_stock failed for order", order.id, stockErr);
      }

      // Auction win payment: the order this webhook just marked paid was
      // for a specific auction's winning bid (see auction-checkout) —
      // one confirmation path (this webhook) settles both the order and
      // the auction, instead of building a second payment-confirmation
      // route just for auctions.
      if (order.auction_id) {
        const { error: auctionErr } = await admin
          .from("mini_auctions")
          .update({ winner_payment_status: "paid", updated_at: new Date().toISOString() })
          .eq("id", order.auction_id);
        if (auctionErr) console.error("mini_auctions payment update failed", order.auction_id, auctionErr);
      }
    }

    // MiniChains Rewards: this is the ONLY place visit counts are ever
    // written. `order` is only present when THIS call just flipped the
    // order to paid (see the .neq("status","paid") guard above), so a
    // duplicate webhook delivery naturally skips this block entirely.
    if (order && order.rewards_username && order.loyalty_reward_type && !order.loyalty_processed) {
      try {
        const username: string = order.rewards_username;
        const today = melbourneDate();

        const { data: account, error: acctErr } = await admin
          .from("mini_loyalty_accounts")
          .select("*")
          .eq("username", username)
          .maybeSingle();

        if (acctErr) {
          console.error("mini_loyalty_accounts lookup failed", acctErr);
        } else if (account && account.last_eligible_purchase_date === today) {
          // Same calendar day as their last counted visit — does not advance
          // the cycle, no matter how many times they buy today. Checked
          // before computing nextVisit so this is also correct immediately
          // after a Visit-3 reset (current_cycle_visits back at 0).
          await admin.from("mini_loyalty_history").insert({
            username, order_id: order.id, square_order_id: order.square_order_id,
            purchase_date: today, reward_type: "same_day_repeat",
            visit_number: account.current_cycle_visits,
          });
        } else {
          // Covers both a brand-new username (nextVisit=1) and an existing
          // account starting a fresh cycle after a Visit-3 reset (also
          // nextVisit=1, since current_cycle_visits is back at 0) — both are
          // "Visit 1 of a cycle", just an insert vs. an update.
          const base = account || {
            current_cycle_visits: 0, total_eligible_visits: 0,
            completed_cycles: 0, discounts_redeemed: 0, free_keychains_redeemed: 0,
          };
          const nextVisit = base.current_cycle_visits + 1;

          if (nextVisit === 1) {
            // create-square-checkout already required a matching secret for
            // any account that had one, so it's always safe to (re-)claim
            // with whatever secret rode along on this order.
            const patch = {
              current_cycle_visits: 1,
              last_eligible_purchase_date: today,
              total_eligible_visits: base.total_eligible_visits + 1,
              owner_secret: order.rewards_username_secret,
              updated_at: new Date().toISOString(),
            };
            if (!account) {
              const { error: insErr } = await admin.from("mini_loyalty_accounts").insert({
                username, display_username: order.rewards_username_display || username, ...patch,
              });
              if (insErr) console.error("mini_loyalty_accounts insert failed", insErr);
            } else {
              await admin.from("mini_loyalty_accounts").update(patch).eq("username", username);
            }
            await admin.from("mini_loyalty_history").insert({
              username, order_id: order.id, square_order_id: order.square_order_id,
              purchase_date: today, reward_type: "visit1", visit_number: 1,
            });
          } else if (nextVisit === 2) {
            await admin.from("mini_loyalty_accounts").update({
              current_cycle_visits: 2,
              last_eligible_purchase_date: today,
              total_eligible_visits: base.total_eligible_visits + 1,
              discounts_redeemed: base.discounts_redeemed + 1,
              owner_secret: order.rewards_username_secret,
              updated_at: new Date().toISOString(),
            }).eq("username", username);
            await admin.from("mini_loyalty_history").insert({
              username, order_id: order.id, square_order_id: order.square_order_id,
              purchase_date: today, reward_type: "discount10", visit_number: 2,
              discount_amount: order.loyalty_discount_amount || 0,
            });
          } else {
            // nextVisit === 3 (can't be more: current_cycle_visits is
            // constrained to 0-2 by the table's own check constraint).
            // Cycle complete: reset to 0 — their next eligible purchase
            // starts a brand-new cycle at Visit 1.
            await admin.from("mini_loyalty_accounts").update({
              current_cycle_visits: 0,
              last_eligible_purchase_date: today,
              total_eligible_visits: base.total_eligible_visits + 1,
              completed_cycles: base.completed_cycles + 1,
              free_keychains_redeemed: base.free_keychains_redeemed + 1,
              owner_secret: order.rewards_username_secret,
              updated_at: new Date().toISOString(),
            }).eq("username", username);

            let freeProductName: string | null = null;
            if (order.loyalty_free_product_id) {
              const { data: freeProduct } = await admin
                .from("mini_products")
                .select("name")
                .eq("id", order.loyalty_free_product_id)
                .maybeSingle();
              freeProductName = freeProduct?.name || null;
            }
            await admin.from("mini_loyalty_history").insert({
              username, order_id: order.id, square_order_id: order.square_order_id,
              purchase_date: today, reward_type: "free_keychain", visit_number: 3,
              free_product_id: order.loyalty_free_product_id,
              free_product_name: freeProductName,
            });
          }
        }

        await admin.from("mini_orders").update({ loyalty_processed: true }).eq("id", order.id);
      } catch (loyaltyErr) {
        // Payment is already confirmed and mini_orders is already marked
        // paid above — a loyalty-side failure must never make that look
        // like it failed, so this is logged only, not surfaced as an error.
        console.error("Loyalty processing failed", loyaltyErr);
      }
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
