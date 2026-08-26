# mini — Keychain Drop v3 (Real MakerWorld/Bambu Photos)

This version replaces the fake SVG product mockups with the real photo URLs from the referenced MakerWorld/Bambu listings.

## GitHub Pages
1. Upload everything inside this folder to the root of your GitHub repo.
2. GitHub → Settings → Pages.
3. Deploy from your main branch, `/root`.
4. Open the GitHub Pages URL after deployment.

No build step is needed.

## Important about the photos
The product images are hot-linked from MakerWorld's image CDN so they stay identical to the Bambu/MakerWorld listing photos. Internet access is required for them to load. Local SVG fallbacks remain in the package if a remote image ever fails.

## Model credits / licensing used in the catalog
- Panda Heart — Nolan3D — MakerWorld model 233668. Creator states the designs can be printed and sold; CC Attribution is shown on MakerWorld.
- Bubble Tea variants — Yokoprints3D — MakerWorld model 435974, listed as a commercial-license Bubble Tea keychain set; CC Attribution-NoDerivatives shown on MakerWorld.
- AU Trolley Key — Alyte_ — MakerWorld model 1253156; CC Attribution-ShareAlike shown on MakerWorld.
- Hard Hat — Jowitka — MakerWorld model 1529908; CC Attribution-ShareAlike shown on MakerWorld.

Attribution links are shown directly under each product card. Do not remove them unless you have verified the license no longer requires attribution.

## Pricing
Prices are intentionally small school-project prices, not commercial-store pricing:
- Quick/small: around A$3.00
- Medium: A$3.50–A$4.00
- More detailed/multicolour: A$4.50

The gram estimates are planning estimates. Slice the exact models/plate in Bambu Studio before printing the batch and update `grams` / `estimatedCost` in `products.js` using the slicer's actual filament estimate.

## Payments
`paymentLink` is still blank. Add Stripe or Square links later if needed.
