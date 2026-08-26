# mini keychains v4 — Payment Success + Spin & Win

Static GitHub Pages package for the mini school project.

## New route
- `success.html` — payment-success / collection page.
- Shows the purchased items, paid total and order reference.
- Tells the customer to speak to the mini team and show the page to collect the items.
- Orders with 3+ units unlock exactly one prize-wheel spin.

## Wheel odds
The wheel is intentionally NOT equal-probability:
- Free keychain: 10%
- Any discount: 25% total
  - 5% off: 12%
  - 10% off: 8%
  - 20% off: 5%
- No prize: 65% total across three separate no-prize sections.

The browser uses `crypto.getRandomValues()` for the draw. If Free Item wins, one of the six catalog keychains is selected randomly and shown by name/photo.

## One-time codes
The current GitHub-only demo stores issued discount codes in `localStorage` and marks a code used after demo checkout. This makes it one-use **on the same browser**, which is enough for a classroom prototype but NOT enough to stop deliberate abuse across devices or cleared browser storage.

For a live payment system, issue/redeem codes on a backend (e.g. Supabase Edge Function) and verify the Stripe/Square payment server-side before creating a prize claim. Do not trust `success.html`, URL parameters or browser localStorage as proof of payment.

## Demo flow
1. Open `index.html`.
2. Add 3 or more items.
3. Open cart and click Checkout.
4. The demo stores an order and opens `success.html?demo=1&order=...`.
5. Spin once.
6. Refresh/reopen the order: the same result remains and the spin cannot be repeated on that browser.

## GitHub Pages
Upload every file/folder in this package to the repository root. `index.html` and `success.html` must stay next to each other.
