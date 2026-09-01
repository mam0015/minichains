// MiniChains catalog
// All photos are real MakerWorld listing photos (see `source`). Local JPEGs
// in assets/images are downloaded copies used as the onerror fallback if the
// MakerWorld CDN image ever fails to load.
//
// Pricing: `price` is the CASH price (the base/sticker price). Card/online
// payment adds a 5% surcharge to cover the Square processing + payment-link
// cost: cardPrice = round(price * 1.05, 2), computed per unit at checkout.
// Cash is charged exactly at `price` — no reduction, no rounding needed.
window.MINI_PRODUCTS = [
  {
    id:'KEY-01', name:'Letter Keychains', type:'keychain', size:'Small · single letter, A–Z',
    grams:3.0, printTime:'≈ 15 min', estimatedCost:0.11, price:2.00,
    image:'assets/images/puffer-letters.jpg',
    fallback:'assets/images/puffer-letters.jpg', imagePosition:'center',
    colors:['pink'], tag:'Initial pick',
    desc:'A puffy, bubble-style initial letter charm. Pick any letter A–Z when you collect. In stock: 2, pink.',
    credit:'A_ilterish', source:'https://makerworld.com/en/models/1417671-puffer-letters-full-a-z-set-capital-only', paymentLink:''
  },
  {
    id:'KEY-02', name:'Emoji Keychains', type:'keychain', size:'Small · music note, heart or smiley face',
    grams:3.0, printTime:'≈ 15 min', estimatedCost:0.11, price:2.00,
    image:'assets/images/emoji-keychains.jpg',
    fallback:'assets/images/emoji-keychains.jpg', imagePosition:'center',
    colors:['pink'], tag:'Fun pick',
    desc:'A music note, love heart or smiley face charm. In stock: 2, pink.',
    credit:'', source:'', paymentLink:''
  },
  {
    id:'KEY-03', name:'Panda Keychain', type:'keychain', size:'Medium · flat charm',
    grams:5.2, printTime:'≈ 17 min', estimatedCost:0.95, price:4.00,
    image:'assets/images/panda-real.jpg',
    fallback:'assets/images/panda-real.jpg', imagePosition:'center',
    colors:['white','black'], tag:'Survey pick',
    desc:'Cute panda holding a heart. Flat, quick and beginner-friendly. In stock: 2, white and black.',
    credit:'Nolan3D', source:'https://makerworld.com/en/models/233668-panda-holding-a-heart-keychain', paymentLink:''
  },
  {
    id:'KEY-04', name:'Flower Keychain', type:'keychain', size:'Small · approx. 35–40 mm',
    grams:3.0, printTime:'< 30 min target', estimatedCost:0.70, price:2.00,
    image:'assets/images/daisy-real.jpg',
    fallback:'assets/images/daisy-real.jpg', imagePosition:'center',
    colors:['white','purple'], tag:'Lowest cost',
    desc:'A simple daisy flower charm. In stock: 2, white and purple.',
    credit:'Zazzatore', source:'https://makerworld.com/en/models/3010296-daisy-keychain-no-ams-no-supports', paymentLink:''
  },
  {
    id:'KEY-05', name:'Soccer Ball', type:'keychain', size:'Small · flat soccer ball',
    grams:5.5, printTime:'≈ 30 min', estimatedCost:0.95, price:2.00,
    image:'assets/images/soccer-real.jpg',
    fallback:'assets/images/soccer-real.jpg', imagePosition:'center',
    colors:['white','black'], tag:'Sport pick',
    desc:'A compact soccer ball charm. In stock: 2, white and black.',
    credit:'Keychainguy', source:'https://makerworld.com/en/models/2629300-soccer-ball-keychain', paymentLink:''
  },
  {
    id:'KEY-06', name:'Cute Cat Keychain', type:'keychain', size:'Small · figure',
    grams:7.0, printTime:'≈ 30 min', estimatedCost:0.26, price:3.00,
    image:'assets/images/mini-cat.jpg',
    fallback:'assets/images/mini-cat.jpg', imagePosition:'center',
    colors:['blue'], tag:'Cute pick',
    desc:'A tiny sitting kitten figure, printed no-supports. In stock: 2, blue.',
    credit:'3dPrintInPlace', source:'https://makerworld.com/en/models/1675119-cute-mini-cat-kitten', paymentLink:''
  },
  {
    id:'KEY-07', name:'Eifel Tower Keychain', type:'keychain', size:'Small · detailed tower charm',
    grams:6.5, printTime:'≈ 35 min', estimatedCost:0.24, price:4.00,
    image:'assets/images/eiffel-tower.jpg',
    fallback:'assets/images/eiffel-tower.jpg', imagePosition:'center',
    colors:['black'], tag:'Souvenir pick',
    desc:'A compact Eiffel Tower charm with fine architectural detail. In stock: 2, black.',
    credit:'Duo3DPrint', source:'https://makerworld.com/en/models/2684638-mini-eiffel-tower-keychain-paris-souvenir-print', paymentLink:''
  },
  {
    id:'KEY-08', name:'Dog and Owl Keychains', type:'keychain', size:'Small · figure',
    grams:5.0, printTime:'≈ 25 min', estimatedCost:0.18, price:3.00,
    image:'assets/images/dog-owl.jpg',
    fallback:'assets/images/dog-owl.jpg', imagePosition:'center',
    colors:['green'], tag:'Animal pick',
    desc:'A dog and owl charm pair. In stock: 2, green.',
    credit:'vapebymatte', source:'https://makerworld.com/en/models/1826451-dog-and-owl-keychain', paymentLink:''
  },
  {
    id:'KEY-09', name:'Spiderman Keychain', type:'keychain', size:'Small · flat silhouette',
    grams:4.0, printTime:'≈ 20 min', estimatedCost:0.15, price:2.00,
    image:'assets/images/spiderman.jpg',
    fallback:'assets/images/spiderman.jpg', imagePosition:'center',
    colors:['black','white'], tag:'Hero pick',
    desc:'A bold spider-silhouette charm. In stock: 2, black and white.',
    credit:'rufus', source:'https://makerworld.com/en/models/1127670-spiderman-keychain', paymentLink:''
  }
];
