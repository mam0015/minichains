// MiniChains catalog — v2 official 13-product price list (4 tiers: $2/$3/$4/$5).
// All photos are real photos from each product's MakerWorld/3dgo listing
// (see `source`). Local JPEGs in assets/images are downloaded copies used
// as the onerror fallback if the primary image URL ever fails to load.
//
// Pricing: `price` is the CASH price (the base/sticker price). Card/online
// payment adds a 5% surcharge to cover the Square processing + payment-link
// cost: cardPrice = round(price * 1.05, 2). Any discount/promo is applied
// AFTER that surcharge (on the surcharge-inclusive card subtotal), never on
// the base price — see checkout.js's cartTotals().
//
// `stock`: the last-known count, used only as the pre-fetch fallback before
// the live stock-status response overlays the real number (see app.js's
// `liveStock`). The database (`mini_products`) is the actual source of
// truth — updating a product's price or stock there updates the whole
// store without touching this file.
window.MINI_PRODUCTS = [
  {
    id:'music-note', name:'Music Note Mini Keychain', type:'keychain', size:'Small · single note charm',
    grams:2.5, printTime:'≈ 15 min', estimatedCost:0.10, price:2.00, stock:0,
    image:'assets/images/music-note.jpg',
    fallback:'assets/images/music-note.jpg', imagePosition:'center',
    colors:['black'], tag:'Entry pick',
    desc:'A small beamed music-note charm. Simple and low-material — our lowest-cost pick.',
    credit:'kevin.goetz', source:'https://makerworld.com/en/models/1356704', paymentLink:'',
    loyaltyRewardEligible:true
  },
  {
    id:'daisy', name:'Daisy Keychain', type:'keychain', size:'Small · flat flower charm',
    grams:3.0, printTime:'≈ 17 min', estimatedCost:0.11, price:2.00, stock:0,
    image:'assets/images/daisy-new.jpg',
    fallback:'assets/images/daisy-new.jpg', imagePosition:'center',
    colors:['white'], tag:'Lowest cost',
    desc:'A simple daisy flower charm, low material usage.',
    credit:'Tunamy', source:'https://makerworld.com/en/models/1613597-daisy-keychain', paymentLink:'',
    loyaltyRewardEligible:true
  },
  {
    id:'paw', name:'Paw Keychain', type:'keychain', size:'Small · flat charm',
    grams:3.2, printTime:'≈ 17 min', estimatedCost:0.11, price:2.00, stock:0,
    image:'assets/images/paw.jpg',
    fallback:'assets/images/paw.jpg', imagePosition:'center',
    colors:['white'], tag:'Entry pick',
    desc:'A simple paw-print charm with a heart cutout.',
    credit:'0_Tuli_0', source:'https://makerworld.com/en/models/652635-key-chain-paw', paymentLink:'',
    loyaltyRewardEligible:true
  },
  {
    id:'basketball', name:'Basket Ball Keychain', type:'keychain', size:'Small · flat charm',
    grams:4.0, printTime:'≈ 23 min', estimatedCost:0.20, price:3.00, stock:0,
    image:'assets/images/basketball.jpg',
    fallback:'assets/images/basketball.jpg', imagePosition:'center',
    colors:['white','black'], tag:'Sport pick',
    desc:'A flat basketball charm — sport-themed with stronger visual appeal than the basic entry charms.',
    credit:'fikuss30', source:'https://makerworld.com/en/models/124469-basket-ball-keychain', paymentLink:'',
    loyaltyRewardEligible:true
  },
  {
    id:'soccer-ball', name:'Soccer Ball Keychain', type:'keychain', size:'Small · flat soccer ball',
    grams:5.5, printTime:'≈ 30 min', estimatedCost:0.95, price:3.00, stock:2,
    image:'assets/images/soccer-real.jpg',
    fallback:'assets/images/soccer-real.jpg', imagePosition:'center',
    colors:['white','black'], tag:'Sport pick',
    desc:'A compact soccer ball charm.',
    credit:'Keychainguy', source:'https://makerworld.com/en/models/2629300-soccer-ball-keychain', paymentLink:'',
    loyaltyRewardEligible:true
  },
  {
    id:'spiderman', name:'Spiderman Keychain', type:'keychain', size:'Small · flat silhouette',
    grams:4.0, printTime:'≈ 20 min', estimatedCost:0.15, price:3.00, stock:2,
    image:'assets/images/spiderman.jpg',
    fallback:'assets/images/spiderman.jpg', imagePosition:'center',
    colors:['black','white'], tag:'Hero pick',
    desc:'A bold spider-silhouette charm.',
    credit:'rufus', source:'https://makerworld.com/en/models/1127670-spiderman-keychain', paymentLink:'',
    loyaltyRewardEligible:true
  },
  {
    id:'fortnite-logo', name:'Fortnite Logo Keychain', type:'keychain', size:'Small · flat logo charm',
    grams:3.5, printTime:'≈ 18 min', estimatedCost:0.18, price:3.00, stock:0,
    image:'assets/images/fortnite-logo.jpg',
    fallback:'assets/images/fortnite-logo.jpg', imagePosition:'center',
    colors:['blue','white'], tag:'Gaming pick',
    desc:'A quick logo-style print with strong gaming appeal.',
    credit:'IronSerif', source:'https://makerworld.com/en/models/1635423-fortnite-logo-keychain', paymentLink:'',
    loyaltyRewardEligible:true
  },
  {
    id:'cute-happy-cat', name:'Cute Happy Cat Keychain', type:'keychain', size:'Small · flat charm',
    grams:3.8, printTime:'≈ 24 min', estimatedCost:0.19, price:3.00, stock:0,
    image:'assets/images/cute-happy-cat.jpg',
    fallback:'assets/images/cute-happy-cat.jpg', imagePosition:'center',
    colors:['white','black'], tag:'Cute pick',
    desc:'A cute-category charm with stronger perceived value than the most basic flat designs.',
    credit:'FC2M3D', source:'https://makerworld.com/en/models/2298763-cute-happy-cat-keychain', paymentLink:'',
    loyaltyRewardEligible:true
  },
  {
    id:'panda', name:'Panda Holding a Heart Keychain', type:'keychain', size:'Medium · flat charm',
    grams:5.2, printTime:'≈ 17 min', estimatedCost:0.95, price:4.00, stock:3,
    image:'assets/images/panda-real.jpg',
    fallback:'assets/images/panda-real.jpg', imagePosition:'center',
    colors:['white','black'], tag:'Premium pick',
    desc:'Cute panda holding a heart. Flat, quick and beginner-friendly.',
    credit:'Nolan3D', source:'https://makerworld.com/en/models/233668-panda-holding-a-heart-keychain', paymentLink:'',
    loyaltyRewardEligible:true
  },
  {
    id:'minecraft-block', name:'Minecraft Block Keychain', type:'keychain', size:'Medium · block format',
    grams:6.5, printTime:'≈ 35 min', estimatedCost:0.45, price:4.00, stock:0,
    image:'assets/images/minecraft-block.jpg',
    fallback:'assets/images/minecraft-block.jpg', imagePosition:'center',
    colors:['white','black'], tag:'Premium pick',
    desc:'A cube/block-format charm with a longer print and higher perceived physical value than a flat charm.',
    credit:'Vismond', source:'https://makerworld.com/en/models/1486318-minecraft-block-keychain', paymentLink:'',
    loyaltyRewardEligible:true
  },
  {
    id:'gold', name:'Gold Design', type:'keychain', size:'',
    grams:0, printTime:'', estimatedCost:0, price:4.00, stock:0,
    image:'', fallback:'assets/images/smiley.svg', imagePosition:'center',
    colors:[], tag:'Coming soon',
    desc:'Pending — the exact model for this product hasn’t been confirmed yet. Not orderable until identified and restocked.',
    credit:'', source:'', paymentLink:'',
    loyaltyRewardEligible:false, active:false
  },
  {
    id:'maltese-dog', name:'Little Maltese Dog Keychain Edition', type:'keychain', size:'Medium · figure-style',
    grams:7.0, printTime:'≈ 35 min', estimatedCost:0.60, price:5.00, stock:0,
    image:'assets/images/maltese-dog.jpg',
    fallback:'assets/images/maltese-dog.jpg', imagePosition:'center',
    colors:['white'], tag:'Limited Edition',
    desc:'A detailed figure-style dog design. Limited Edition — more production complexity than the flat charms.',
    credit:'Wolhart', source:'https://makerworld.com/en/models/1309033-little-maltese-dog-keychain-edition', paymentLink:'',
    loyaltyRewardEligible:true, limitedEdition:true
  },
  {
    id:'jordan', name:'Jordan Keychain', type:'keychain', size:'Small · flat logo charm',
    grams:4.5, printTime:'≈ 45 min', estimatedCost:0.30, price:5.00, stock:0,
    image:'assets/images/jordan.jpg',
    fallback:'assets/images/jordan.jpg', imagePosition:'center',
    colors:['black','white'], tag:'Limited Edition',
    desc:'The Jumpman logo silhouette. Limited Edition — one of the strongest perceived-value designs in the range.',
    credit:'MORTI$', source:'https://makerworld.com/en/models/919000-jordan-keychain', paymentLink:'',
    loyaltyRewardEligible:true, limitedEdition:true
  }
];
