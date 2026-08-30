// mini school-project catalog
// All four cards use real MakerWorld listing photos (see `source`). Local
// JPEGs in assets/images are downloaded copies used as the onerror fallback
// if the MakerWorld CDN image ever fails to load.
//
// Pricing: `price` is the Card/Online (Square) price. Cash price is computed
// at checkout as floor(price * 0.95) per unit, rounded down to a whole
// dollar so cash payment never needs coins — not a basket-level discount.
window.MINI_PRODUCTS = [
  {
    id:'KEY-01', name:'Mini Eiffel Tower Keychain', type:'keychain', size:'Small · detailed tower charm',
    grams:6.5, printTime:'≈ 35 min', estimatedCost:0.24, price:5.10,
    image:'https://makerworld.bblmw.com/makerworld/model/USb9d7b65bb140d5/design/0bc37a373b76adbb.webp?x-oss-process=image/resize,w_1000/format,webp',
    fallback:'assets/images/eiffel-tower.jpg', imagePosition:'center',
    colors:['white','black','silver'], tag:'Souvenir pick',
    desc:'A compact Eiffel Tower charm with fine architectural detail — a small piece of Paris on your keys or bag.',
    credit:'Duo3DPrint', source:'https://makerworld.com/en/models/2684638-mini-eiffel-tower-keychain-paris-souvenir-print', paymentLink:''
  },
  {
    id:'KEY-02', name:'Adorable Cupcake Keychain', type:'keychain', size:'Small · flat charm',
    grams:5.5, printTime:'≈ 25 min', estimatedCost:0.20, price:5.10,
    image:'https://makerworld.bblmw.com/makerworld/model/USe99c09efcdbc78/design/206c53efbdd0711d.png?x-oss-process=image/resize,w_1000/format,webp',
    fallback:'assets/images/cupcake.jpg', imagePosition:'center',
    colors:['pink','white','red'], tag:'Cute pick',
    desc:'A cheerful cupcake charm with a cherry on top — bright colours, simple shape, easy to spot on a keyring.',
    credit:'GAF 3D', source:'https://makerworld.com/en/models/2966793-adorable-cupcake-keychain', paymentLink:''
  },
  {
    id:'KEY-03', name:'Cute Mini Cat Keychain', type:'keychain', size:'Small · figure',
    grams:7.0, printTime:'≈ 30 min', estimatedCost:0.26, price:4.08,
    image:'assets/images/mini-cat.jpg',
    fallback:'assets/images/mini-cat.jpg', imagePosition:'center',
    colors:['orange','purple','teal'], tag:'Lowest cost',
    desc:'A tiny sitting kitten figure, printed no-supports. The entry-price item in this batch.',
    credit:'3dPrintInPlace', source:'https://makerworld.com/en/models/1675119-cute-mini-cat-kitten', paymentLink:''
  },
  {
    id:'KEY-04', name:'Animal Keychain Collection', type:'keychain', size:'Small · random animal design',
    grams:6.0, printTime:'≈ 25 min', estimatedCost:0.22, price:4.08,
    image:'assets/images/animal-collection-clean.jpg',
    fallback:'assets/images/animal-collection-clean.jpg', imagePosition:'center',
    colors:['assorted'], tag:'Surprise pick',
    desc:'One design pulled from a 25-animal keychain collection — lion, cat, frog, bear and more. Which one you get is a surprise.',
    credit:'Katkad3d', source:'https://makerworld.com/en/models/2928490-keychain-collection-all-in-one-25-packs', paymentLink:''
  },
  {
    id:'KEY-05', name:'Mecha Mandalorian Keychain', type:'keychain', size:'Small · armoured figure',
    grams:6.0, printTime:'≈ 30 min', estimatedCost:0.22, price:5.10,
    image:'https://makerworld.bblmw.com/makerworld/model/US5fda13bfe5dab8/design/2025-07-28_722457b3973cf8.jpg?x-oss-process=image/resize,w_1000/format,webp',
    fallback:'assets/images/mandalorian.jpg', imagePosition:'center',
    colors:['white','black'], tag:'Sci-fi pick',
    desc:'A mecha-armoured bounty hunter charm with fine helmet and armour detail.',
    credit:'Osmand', source:'https://makerworld.com/en/models/1646242-mecha-mandalorian-keychain', paymentLink:''
  },
  {
    id:'KEY-06', name:'Spiderman Keychain', type:'keychain', size:'Small · flat silhouette',
    grams:4.0, printTime:'≈ 20 min', estimatedCost:0.15, price:3.06,
    image:'https://makerworld.bblmw.com/makerworld/model/US4181a6f29e27/design/2025-02-19_3a25bfbb52fc.webp?x-oss-process=image/resize,w_1000/format,webp',
    fallback:'assets/images/spiderman.jpg', imagePosition:'center',
    colors:['black','white'], tag:'Lowest cost',
    desc:'A bold spider-silhouette charm, simple flat print, quick to make.',
    credit:'rufus', source:'https://makerworld.com/en/models/1127670-spiderman-keychain', paymentLink:''
  },
  {
    id:'KEY-07', name:'Weight Plate Keychain', type:'keychain', size:'Small · round plate charm',
    grams:5.0, printTime:'≈ 25 min', estimatedCost:0.18, price:4.08,
    image:'https://makerworld.bblmw.com/makerworld/model/US3278d2b909ddbe/design/2025-11-19_ddbedcfbd3ab8.png?x-oss-process=image/resize,w_1000/format,webp',
    fallback:'assets/images/weight-plate.jpg', imagePosition:'center',
    colors:['navy','black'], tag:'Gym pick',
    desc:'"No Pain No Gain" gym weight plate charm — a fun pick for anyone who lifts.',
    credit:'egitoni', source:'https://makerworld.com/en/models/2014647-weight-plate-keychain', paymentLink:''
  },
  {
    id:'KEY-08', name:'Puffer Letters Keychain', type:'keychain', size:'Small · single letter, A–Z',
    grams:3.0, printTime:'≈ 15 min', estimatedCost:0.11, price:2.55,
    image:'https://makerworld.bblmw.com/makerworld/model/US8791c061658b1e/design/2025-05-15_7293f7d175291.jpg?x-oss-process=image/resize,w_1000/format,webp',
    fallback:'assets/images/puffer-letters.jpg', imagePosition:'center',
    colors:['assorted'], tag:'Initial pick',
    desc:'A puffy, bubble-style initial letter charm. Pick any letter A–Z when you collect.',
    credit:'A_ilterish', source:'https://makerworld.com/en/models/1417671-puffer-letters-full-a-z-set-capital-only', paymentLink:''
  },
  {
    id:'KEY-09', name:'iPhone Keyring', type:'keychain', size:'Small · phone charm',
    grams:5.0, printTime:'≈ 25 min', estimatedCost:0.18, price:3.06,
    image:'https://makerworld.bblmw.com/makerworld/model/USc5cc82c68ad8b2/design/2025-10-05_9981c002d65d58.png?x-oss-process=image/resize,w_1000/format,webp',
    fallback:'assets/images/iphone-keyring.jpg', imagePosition:'center',
    colors:['assorted'], tag:'Trendy pick',
    desc:'A tiny iPhone-shaped charm in a range of colours — a fun pick for phone lovers.',
    credit:'Zap 3D', source:'https://makerworld.com/en/models/1745498-iphone-17-keyring', paymentLink:''
  }
];
