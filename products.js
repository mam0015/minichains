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
    grams:6.5, printTime:'≈ 35 min', estimatedCost:0.24, price:5.11,
    image:'https://makerworld.bblmw.com/makerworld/model/USb9d7b65bb140d5/design/0bc37a373b76adbb.webp?x-oss-process=image/resize,w_1000/format,webp',
    fallback:'assets/images/eiffel-tower.jpg', imagePosition:'center',
    colors:['white','black','silver'], tag:'Souvenir pick',
    desc:'A compact Eiffel Tower charm with fine architectural detail — a small piece of Paris on your keys or bag.',
    credit:'Duo3DPrint', source:'https://makerworld.com/en/models/2684638-mini-eiffel-tower-keychain-paris-souvenir-print', paymentLink:''
  },
  {
    id:'KEY-02', name:'Adorable Cupcake Keychain', type:'keychain', size:'Small · flat charm',
    grams:5.5, printTime:'≈ 25 min', estimatedCost:0.20, price:5.11,
    image:'https://makerworld.bblmw.com/makerworld/model/USe99c09efcdbc78/design/206c53efbdd0711d.png?x-oss-process=image/resize,w_1000/format,webp',
    fallback:'assets/images/cupcake.jpg', imagePosition:'center',
    colors:['pink','white','red'], tag:'Cute pick',
    desc:'A cheerful cupcake charm with a cherry on top — bright colours, simple shape, easy to spot on a keyring.',
    credit:'GAF 3D', source:'https://makerworld.com/en/models/2966793-adorable-cupcake-keychain', paymentLink:''
  },
  {
    id:'KEY-03', name:'Cute Mini Cat Keychain', type:'keychain', size:'Small · figure',
    grams:7.0, printTime:'≈ 30 min', estimatedCost:0.26, price:4.09,
    image:'https://makerworld.bblmw.com/makerworld/model/USe5b035dfb3cfe/design/2025-08-06_c64e803e6cafa8.jpg?x-oss-process=image/resize,w_1000/format,webp',
    fallback:'assets/images/mini-cat.jpg', imagePosition:'center',
    colors:['orange','purple','teal'], tag:'Lowest cost',
    desc:'A tiny sitting kitten figure, printed no-supports. The entry-price item in this batch.',
    credit:'3dPrintInPlace', source:'https://makerworld.com/en/models/1675119-cute-mini-cat-kitten', paymentLink:''
  },
  {
    id:'KEY-04', name:'Animal Keychain Collection', type:'keychain', size:'Small · random animal design',
    grams:6.0, printTime:'≈ 25 min', estimatedCost:0.22, price:4.09,
    image:'https://makerworld.bblmw.com/makerworld/model/USe87a443210ba22/design/7cc5d5aded3a75e1.png?x-oss-process=image/resize,w_1000/format,webp',
    fallback:'assets/images/animal-collection.jpg', imagePosition:'center',
    colors:['assorted'], tag:'Surprise pick',
    desc:'One design pulled from a 25-animal keychain collection — lion, cat, frog, bear and more. Which one you get is a surprise.',
    credit:'Katkad3d', source:'https://makerworld.com/en/models/2928490-keychain-collection-all-in-one-25-packs', paymentLink:''
  }
];
