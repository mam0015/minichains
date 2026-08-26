# mini NFC Catalog — GitHub Pages

A static, mobile-first mini product catalog built for GitHub Pages and NFC/QR entry.

## Run locally
Open `index.html` in a browser, or run a small local server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy to GitHub Pages
1. Create a GitHub repository.
2. Upload **all files and folders inside this package** to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your main branch and `/ (root)`.
6. Save and wait for GitHub to publish the URL.

## Edit products
Edit `products.js`.

Each product has:
- `id` — model code
- `name`
- `type` — set / dispenser / holder / tumbler / tray / bin
- `price`
- `image`
- `colors`
- `tag`
- `desc`
- `paymentLink`

The 20 products and prices in this starter build are demo content until you replace them with the real mini range.

## Replace product images
Put your real product photos inside `assets/images/`, then change each product's `image` value in `products.js`.

Example:

```js
image: 'assets/images/my-real-product.jpg'
```

## Payments
The design is ready for Stripe Payment Links or Square payment links. Never put a Stripe secret key in GitHub Pages JavaScript.

For a single-product purchase, paste a hosted checkout URL into `paymentLink` in `products.js`.

For a multi-item cart with dynamic checkout, use a small backend/serverless function (for example Supabase Edge Functions, Cloudflare Workers, or Vercel) to create the Stripe Checkout Session securely.

## NFC links
For one NFC tag that opens the catalog, write your GitHub Pages/custom-domain URL, for example:

`https://your-domain.com/`

For NFC tags tied to individual models, the next version can use URLs such as:

`https://your-domain.com/?model=DSP-01`

and automatically open that product.

## Brand assets
The supplied `mini` logo is included as `assets/images/mini-logo.png` with its outer black background removed while preserving the black face details.
