# MINI — Square Production Setup (V17)

## 1. Supabase Secrets
In Supabase Dashboard → Edge Functions → Secrets add:

- `SQUARE_ACCESS_TOKEN` = your **Production Access Token**
- `SQUARE_LOCATION_ID` = your **Production Location ID**

Never put either value in GitHub or frontend JavaScript.

## 2. Function
Open:

`Edge Functions → create-square-checkout → index.ts`

Replace the default/template code with:

`supabase/functions/create-square-checkout/index.ts`

Deploy the function.

The function URL is:

`https://hkjgitxovfiamibgpoan.supabase.co/functions/v1/create-square-checkout`

## 3. JWT
This storefront has no customer login. The function must be publicly invokable.

Config:

```toml
[functions.create-square-checkout]
verify_jwt = false
```

## 4. Frontend
`square-config.js` is already connected to the Supabase function.

The live storefront sends product IDs and quantities only. Product prices are recalculated server-side.

The return URL is generated from the currently deployed website automatically:

`new URL('success.html', window.location.href).href`

So no GitHub repository name has to be hard-coded.

## 5. Important production limitation in this V17
The old Spin & Win promo codes are still browser/localStorage-generated. They are forgeable, so the production Square function deliberately refuses a card checkout when a promo code is active.

Next security upgrade:
- server-side promo/spin issuance in Supabase
- one-time promo validation
- Square webhook
- server-side order status

Cash checkout remains unchanged.

## 6. First real test
Use one cheap product, Card / Online, no promo code.

The flow should be:

MINI → create-square-checkout → Square hosted checkout → payment → `success.html`

After that, add webhook verification before public launch.
