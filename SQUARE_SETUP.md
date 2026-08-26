# Square setup for mini (GitHub Pages)

The site is static, so the Square access token must NEVER be stored in GitHub, `app.js`, `square-config.js`, or browser JavaScript.

## Recommended flow

GitHub Pages cart → private serverless endpoint → Square Checkout API → Square-hosted checkout → payment verification → `success.html` → 3+ Spin.

## 1. Square account

Choose **Individual / Sole Trader** during onboarding. Square Australia allows this account type to sign up with or without an ABN. Do not invent an ABN and do not use someone else's ABN.

Link the Australian bank account that should receive payouts and complete Square identity verification.

## 2. Create a Square developer app

Open the Square Developer Dashboard and create an application for the mini project.

Start in **Sandbox**. Copy these private values:

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`

Keep the access token server-side only.

## 3. Create a private checkout endpoint

Use a serverless backend such as Supabase Edge Functions, Cloudflare Workers, Vercel Functions, or Netlify Functions.

The endpoint should:

1. Accept only product IDs + quantities from the browser.
2. Ignore any price sent by the browser.
3. Look up the official prices server-side:
   - KEY-01 = 409 cents
   - KEY-02 = 460 cents
   - KEY-03 = 307 cents
   - KEY-04 = 358 cents
   - KEY-05 = 409 cents
   - KEY-06 = 511 cents
4. Create the order using Square `POST /v2/online-checkout/payment-links`.
5. Set `checkout_options.redirect_url` to the site's payment-result route.
6. Return only the Square checkout URL to the browser.

## 4. Verify payment before unlocking prizes

A redirect to `success.html` is not proof of payment by itself. Subscribe to Square `payment.updated` webhooks and confirm the matching payment has `status = COMPLETED` before marking the order paid.

The 3+ wheel, free-item claim, and one-time discount code should be issued server-side for live sales so clearing browser storage cannot create a second prize/code.

## 5. Connect this frontend

After deploying the private endpoint, edit `square-config.js`:

```js
window.MINI_SQUARE = {
  checkoutEndpoint: 'https://YOUR_PRIVATE_ENDPOINT'
};
```

Then upload the site to GitHub Pages.

## 6. Test before live mode

- Use Square Sandbox first.
- Test 1-item, 2-item, and 3-item orders.
- Confirm the price seen on Square exactly matches the website.
- Confirm the wheel stays locked for fewer than 3 items.
- Confirm one paid order can spin only once.
- Confirm discount codes can be redeemed once only.
- Only then switch the private backend from Sandbox credentials to Production credentials.

## Pricing note

The website now builds the 2.2% online Square processing cost into the displayed product prices instead of adding a separate card surcharge at checkout.


## v7 payment-method behaviour

The website now sends only Card / Online orders to Square.

Cash orders do **not** call Square. They are calculated locally:
- 5% automatic cash discount
- one-time promo percentage, if present
- percentages are added together
- final cash total is rounded to the nearest $0.05

For a real production backend, never trust prices sent by the browser. Recalculate product prices and promo validity server-side.
