# MINI — Square Production Setup

Everything code-side is done. What's left are manual steps in the Supabase and Square dashboards — nothing here involves editing code.

## 1. Supabase Secrets

Supabase Dashboard → Project Settings → Edge Functions → Secrets. Add:

| Secret | Value |
|---|---|
| `SQUARE_ACCESS_TOKEN` | Your Square **Production** access token |
| `SQUARE_LOCATION_ID` | Your Square **Production** location ID |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | The signature key Square gives you in step 4 below (add this one after step 4) |

Never put any of these in GitHub, `square-config.js`, or any frontend file. The code only ever reads them via `Deno.env.get(...)` on the server side — confirmed nowhere in this repo are they hardcoded.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` do NOT need to be added manually — Supabase injects those into every Edge Function automatically.

## 2. Deploy the Edge Functions

Four functions live in `supabase/functions/`:

- `rapid-handler` — existing feedback function, unchanged.
- `create-square-checkout` — **rewritten this session.** If you previously pasted different code into this function's slug in the dashboard, replace it with `supabase/functions/create-square-checkout/index.ts`. This was the actual bug: the deployed function under this name was not this code.
- `square-webhook` — **new.** Deploy it as-is.
- `order-status` — **new.** Deploy it as-is.

Deploy all four (dashboard paste-and-deploy, or `supabase functions deploy <name>` via CLI if you have it set up).

## 3. Turn off JWT enforcement for each function

`supabase/config.toml` already sets `verify_jwt = false` for all four functions, but on at least one function (`rapid-handler`) the live dashboard setting didn't match the repo config — it was still enforcing JWT and returning 401. For each of the four functions, check Edge Functions → (function name) → and make sure "Enforce JWT Verification" is switched **off**. These functions are called by anonymous site visitors and by Square's own servers — none of them can require a Supabase login JWT.

## 4. Run the new database migration

SQL Editor → run `supabase/migrations/20260830_create_mini_orders.sql`. This creates a `mini_orders` table (RLS enabled, no direct public access — only the Edge Functions can read/write it via the service role). This table is what lets a payment actually get verified instead of just trusted on redirect.

## 5. Create the Square webhook subscription

Square Dashboard → your application → Webhooks → Add Endpoint:

- **URL:** `https://hkjgitxovfiamibgpoan.supabase.co/functions/v1/square-webhook`
- **Events:** subscribe to at least `payment.updated`
- **API version:** whatever's current/default is fine

Square will show you a **Signature Key** for this endpoint the moment you create it. Copy that value and add it to Supabase Secrets as `SQUARE_WEBHOOK_SIGNATURE_KEY` (step 1). Until this secret is set, the webhook function will reject every event with a 500 — so add it right after creating the endpoint.

This step is what makes "payment complete" mean something real: Square calls this URL directly, server-to-server, after a payment actually clears — the site never has to take the customer's word for it.

## 6. First real test

Use one cheap item, Card / Online, no promo code (promo codes are intentionally blocked on card checkout for now — see the limitation below).

Expected flow: MINI checkout page → `create-square-checkout` (creates a `pending` row in `mini_orders`, returns a Square-hosted URL) → Square's hosted checkout page → pay → Square redirects to `success.html?order=...` → the page polls `order-status` for a few seconds → **at the same time**, Square's webhook hits `square-webhook` and flips that order to `paid` in the database → the success page sees `paid` and shows "Payment complete." If the webhook hasn't arrived yet after ~20 seconds, the page shows "Unable to verify yet" rather than falsely claiming success — refreshing shortly after works because the webhook has almost always landed by then.

## Known limitation, by design

Spin & Win promo codes are still generated and checked in the browser (`localStorage`), so they're forgeable. Rather than trust an unverifiable code against a real payment, `create-square-checkout` currently **refuses** a card checkout that has an active promo code (with a clear error message). Cash checkout still accepts promo codes normally, since cash is confirmed in person. Making promo codes safe for card checkout would mean issuing and validating them server-side — a reasonable next step, not done in this pass since it wasn't required to fix the payment bug.

Cash checkout is completely unchanged: full basket subtotal → 5% cash discount → promo if any → floor to the nearest whole dollar.
