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


## v9 — probability text removed everywhere in the customer UI

Homepage and success wheel now show only the visible outcomes:
EMPTY, 5% OFF, 10% OFF, 20% OFF, FREE KEYCHAIN.

Customer-facing copy:
Try your luck.
You might win a free keychain.

No odds percentages or chance breakdown are displayed.
All visible wheel slices are equal-sized.


## v10 — premium homepage / UX cleanup

- Search removed.
- Colour dots removed.
- Customer-facing print time removed.
- Entry / Standard / Premium removed.
- Added Card / Online vs Cash 5% off guide.
- Product cards show size + PLA only.
- Details modal shows only size + PLA, plus card/cash prices.
- Header, hero, payment guide, product cards and modal redesigned.
- Exact new MakerWorld/Bambu product designs can be swapped in later through products.js.


## v11 — mobile-first release

The storefront is now intentionally designed around phone customers first (360–430 px).

Mobile improvements:
- compact floating header and hamburger navigation
- single-column hero with larger readable copy
- full-width mobile CTAs
- stacked payment explanation cards
- one-column product catalog
- 46–54 px touch targets
- full-screen cart
- full-screen product details
- floating bag shortcut after adding a product
- responsive cash/card checkout
- mobile-sized Spin & Win
- mobile payment-success and cash-confirmation screens
- safe-area spacing for modern phones
- horizontal overflow prevention


## v12 — entry spin, cash floor pricing, invoice and survey

- removed Spin & Win from top navigation
- removed the old homepage spin section
- new full-screen Spin & Win appears on first site open
- animated premium wheel with confetti
- every spin generates a unique code receipt
- discount prize codes work in checkout
- free-keychain codes show the won item and add it to the receipt as a free prize
- one spin per device in the static-school-project version
- card / online uses the listed price with no cash discount
- cash gets 5% off each unit, then every cash unit price is rounded DOWN to a whole dollar
- cash invoice shows items, free prize, method and amount to collect
- optional checkout survey: First name / Level / Comment
- local survey storage works immediately
- optional shared feedback endpoint supported through `feedback-config.js`
- see `FEEDBACK_STORAGE.md`


## v13 — basket cash rounding + quantity controls

Cash:
- subtotal first, including all quantities
- 5% cash discount applied to the whole basket
- any promo discount then applies
- final cash total is rounded DOWN to a whole dollar

Quantity:
- every cart line now has `−  quantity  +`
- plus increases quantity
- minus decreases quantity
- minus from 1 removes the item
- line price, subtotal, discounts and receipt totals update automatically


## v14 — Supabase feedback endpoint connected

The checkout feedback form now POSTs to:

`https://hkjgitxovfiamibgpoan.supabase.co/functions/v1/rapid-handler`

The package includes matching `rapid-handler` Edge Function code and SQL migration.


## v15 — checkout scroll / Safari fix

The cart architecture was changed so the entire checkout drawer is the scroll container.

Fixes:
- no nested scroll trap
- cart, discounts, payment method, survey and checkout button can all be reached
- sticky cart header
- sticky checkout button without covering content
- Safari momentum scrolling
- mobile safe-area support
- laptop / short-screen layout tuning
- separate desktop and mobile spacing


## v16 — Safari cart rebuild

This version fixes the root checkout scrolling issue.

Architecture:
- cart drawer = fixed app shell
- drawer header = non-scrolling row
- `#cartScroll` = the only vertical scroll container
- cart items, payment method, promo, survey and checkout all live in that one scroll flow

Critical fixes:
- removed `touch-action:none` from locked body
- added `touch-action:pan-y` to the actual cart scroller
- removed nested cart-item scrolling
- neutralised legacy `.cart-summary > div { display:flex }` layout corruption
- checkout button is no longer sticky inside Safari scroll region
- added `100svh` / `100dvh` support
- mobile and laptop layouts remain separate
