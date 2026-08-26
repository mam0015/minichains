# mini keychains v7 — Card + Cash checkout

This release adds a two-method checkout flow for the school project.

## What changed

- Card / Online: keeps the Square checkout flow.
- Cash: automatically gives 5% off.
- Cash totals are rounded to the nearest 5 cents.
- Existing one-time promo codes stack additively with the 5% cash discount.
  Example: 10% promo + 5% cash = 15% off before cash rounding.
- Cash orders open on the order confirmation page as **Cash Due**.
- After the money is physically received, tap **Cash received**.
- Only then is the order marked paid and the 3+ item Spin & Win unlocks.
- Payment method and every discount are shown on the confirmation page.
- Wheel discount prizes are still one-time codes for a future order.
- Free-item wheel prizes still choose one of the six current keychains randomly.

## Important security note

GitHub Pages is a static site.

The local cash confirmation and one-time promo enforcement are suitable for the school-project workflow on your own device, but they are not tamper-proof.

For production online card payments:
- keep Square secret keys in a private backend only;
- verify the Square payment server-side;
- create/validate one-time promo codes server-side.

See `SQUARE_SETUP.md` for the existing Square backend notes.


## v8 — proper Spin & Win wheel

The customer now sees:
- a large circular wheel
- a centre SPIN button
- visible result slices only
- 5% OFF
- 10% OFF
- 20% OFF
- FREE KEYCHAIN
- three EMPTY slices

Customer-facing copy:
"Try your luck. You might win a free keychain."

No probability breakdown is shown on the page.
