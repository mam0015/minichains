// mini school-project catalog — survey-selected keychain lineup
// Four cards use real MakerWorld/Bambu listing photos. Flower/music use local fallbacks
// until a permitted commercial model/photo is locked in.
window.MINI_PRODUCTS = [
  {
    id:'KEY-01', name:'Cute Panda Heart', type:'keychain', size:'Medium · 49 × 35 mm',
    grams:5.2, printTime:'≈ 17 min', estimatedCost:0.95, price:4.09,
    image:'https://makerworld.bblmw.com/makerworld/model/US3c9373901c932c/design/2024-03-06_375ff7f26db4d.jpeg?x-oss-process=image%2Fresize%2Cw_1000%2Fformat%2Cwebp',
    fallback:'assets/images/panda.svg', imagePosition:'center',
    colors:['white','black','pink'], tag:'Survey pick',
    desc:'Cute animal pick from the survey. Flat, quick and beginner-friendly, with no supports listed on the MakerWorld profile.',
    credit:'Nolan3D', source:'https://makerworld.com/en/models/233668-panda-holding-a-heart-keychain', paymentLink:''
  },
  {
    id:'KEY-02', name:'Cinnamon Roll Tray', type:'keychain', size:'Medium · mini bakery tray',
    grams:6.0, printTime:'≈ 25–35 min', estimatedCost:1.15, price:4.60,
    image:'https://wsrv.3dprinterfiles.com/?h=828&n=40&output=webp&q=100&url=https%3A%2F%2Fmakerworld.bblmw.com%2Fmakerworld%2Fmodel%2FUS7b142a7fa870c3%2Fdesign%2F2025-10-28_899e3360f846a8.jpeg&w=828',
    fallback:'assets/images/cinnamon.svg', imagePosition:'center',
    colors:['brown','white','pink'], tag:'Cute food',
    desc:'Cinnamon roll was directly requested in the survey. The tray format has strong perceived value while still staying small enough for a school-project batch.',
    credit:'Bluverie Studio', source:'https://3dgo.app/models/makerworld/1935512', paymentLink:''
  },
  {
    id:'KEY-03', name:'Daisy Flower', type:'keychain', size:'Small · approx. 35–40 mm',
    grams:3.0, printTime:'< 30 min target', estimatedCost:0.70, price:3.07,
    image:'assets/images/daisy.svg',
    fallback:'assets/images/daisy.svg', imagePosition:'center',
    colors:['white','yellow','pink'], tag:'Lowest cost',
    desc:'Flower was mentioned more than once in the survey. This is the entry-price item: simple shape, little filament and easy colour combinations.',
    credit:'Survey-selected flower concept', source:'https://makerworld.com/en/models/3010296-daisy-keychain-no-ams-no-supports', paymentLink:''
  },
  {
    id:'KEY-04', name:'Retro Music Cassette', type:'keychain', size:'Medium · retro cassette',
    grams:4.0, printTime:'≈ 25–40 min target', estimatedCost:0.90, price:3.58,
    image:'assets/images/cassette.svg',
    fallback:'assets/images/cassette.svg', imagePosition:'center',
    colors:['pink','black','white'], tag:'Music pick',
    desc:'Music and CD-style keychains were requested in the survey. This retro cassette look gives the music category a clear visual identity.',
    credit:'Music category concept', source:'https://makerworld.com/en/models/178456', paymentLink:''
  },
  {
    id:'KEY-05', name:'Soccer Ball', type:'keychain', size:'Small · flat soccer ball',
    grams:5.5, printTime:'≈ 30 min', estimatedCost:0.95, price:4.09,
    image:'https://wsrv.3dprinterfiles.com/?h=828&n=40&output=webp&q=100&url=https%3A%2F%2Fmakerworld.bblmw.com%2Fmakerworld%2Fmodel%2FUSe42e055ddc0436%2Fdesign%2F9b08211b705719ac.jpeg&w=828',
    fallback:'assets/images/soccer.svg', imagePosition:'center',
    colors:['white','black','pink'], tag:'Sport pick',
    desc:'Sport was directly requested. This Bambu/MakerWorld-style soccer keychain is compact and benefits from batch printing because colour-switch waste is shared.',
    credit:'Keychainguy', source:'https://3dgo.app/models/makerworld/2629300', paymentLink:''
  },
  {
    id:'KEY-06', name:'Tung Tung Sahur', type:'keychain', size:'Large · meme character',
    grams:7.0, printTime:'≈ 40–60 min target', estimatedCost:1.25, price:5.11,
    image:'https://wsrv.3dprinterfiles.com/?h=828&n=40&output=webp&q=100&url=https%3A%2F%2Fmakerworld.bblmw.com%2Fmakerworld%2Fmodel%2FUSf9034317a8c927%2Fdesign%2Fe7494c0aa799e4b7.jpg&w=828',
    fallback:'assets/images/tung.svg', imagePosition:'center',
    colors:['brown','black','pink'], tag:'Meme pick',
    desc:'A direct survey request and the premium novelty option. Priced higher because it is larger and more material-heavy than the flat keychains.',
    credit:'MakerWorld meme reference', source:'https://makerworld.com/en/search/models?keyword=tag%3A%20tung%20sahur', paymentLink:''
  }
];
