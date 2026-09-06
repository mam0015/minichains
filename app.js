// Products with active:false (e.g. a not-yet-identified pending model) are
// kept in products.js for reference but never shown or orderable.
const products = (window.MINI_PRODUCTS || []).filter(p => p.active !== false);
const money = v => `A$${Number(v || 0).toFixed(2)}`;

const grid = document.querySelector('#productGrid');
const count = document.querySelector('#productCount');

const PROMOS_KEY = 'mini-issued-promos-v2';
const CART_KEY = 'mini-keychain-cart-v2';
const CARD_SURCHARGE_PERCENT = 5;

let sortMode = 'default';
let categoryMode = 'all';
let searchQuery = '';
let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
let quickProduct = null;

// Live stock + price — both start from products.js's bundled numbers (the
// values as of last deploy) and are replaced by the real live numbers once
// stock-status resolves. mini_products in Supabase is the actual source of
// truth; a price/stock change there updates the whole store without a code
// redeploy. A product with no live entry falls back to its bundled value.
let liveStock = {};
let livePrice = {};
let liveCreatedAt = {};
function remainingStock(p) {
  if (Object.prototype.hasOwnProperty.call(liveStock, p.id)) return liveStock[p.id];
  return typeof p.stock === 'number' ? p.stock : Infinity;
}
function currentPrice(p) {
  return typeof livePrice[p.id] === 'number' ? livePrice[p.id] : p.price;
}
// "Newest" sort needs a real timestamp, not just array order — falls back
// to products.js's declared order (its index) until the live fetch resolves.
function createdAtMs(p) {
  if (liveCreatedAt[p.id]) return liveCreatedAt[p.id];
  return products.indexOf(p);
}
async function refreshStockStatus() {
  const endpoint = window.MINI_SQUARE?.stockStatusEndpoint?.trim();
  if (!endpoint) return;
  try {
    const res = await fetch(endpoint);
    const data = await res.json().catch(() => null);
    if (data && data.products && typeof data.products === 'object') {
      const stock = {}, price = {}, createdAt = {};
      for (const [id, row] of Object.entries(data.products)) {
        if (typeof row.available === 'number') stock[id] = row.available;
        if (typeof row.priceCents === 'number') price[id] = round2(row.priceCents / 100);
        if (row.createdAt) createdAt[id] = Date.parse(row.createdAt) || 0;
      }
      liveStock = stock;
      livePrice = price;
      liveCreatedAt = createdAt;
      renderProducts();
    }
  } catch {
    // Offline or not deployed yet — bundled numbers in products.js keep working as a fallback.
  }
}
// The homepage never changes payment method or applies promos — those live
// on the checkout page. Card-price totals here are just a badge/bar preview.
const activePromo = null;
const paymentMethod = 'card';

const read = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); }
  catch { return fallback; }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function round2(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
}

function productCard(p) {
  const price = currentPrice(p);
  const cardPrice = round2(price * (1 + CARD_SURCHARGE_PERCENT / 100));
  const remaining = remainingStock(p);
  const soldOut = !p.comingSoon && remaining <= 0;
  const lowStock = !p.comingSoon && remaining !== Infinity && remaining > 0;
  const tag = p.comingSoon
    ? `<span class="tag tag-coming-soon">Coming soon</span>`
    : soldOut
    ? `<span class="tag tag-sold-out">Sold out</span>`
    : p.tag ? `<span class="tag">${p.tag}</span>` : '';
  const stockNote = lowStock ? `<span class="stock-left">Only ${remaining} left</span>` : '';

  // Coming Soon isn't for sale at all yet — no price, no Add to bag; the
  // primary action opens the quick-view's "let us know you want this"
  // panel instead (same panel a sold-out item uses).
  const priceBlock = p.comingSoon
    ? `<span class="price price-coming-soon">Coming soon</span>`
    : `<span class="price">${money(price)}</span>`;
  const cashLine = p.comingSoon ? '' : `<div class="cash-line"><span>Card price</span><strong>${money(cardPrice)}</strong><small>+5%</small></div>`;
  const primaryBtn = p.comingSoon
    ? `<button class="add-btn" data-view="${p.id}">I'm interested</button>`
    : `<button class="add-btn" data-add="${p.id}"${soldOut ? ' disabled' : ''}>${soldOut ? 'Sold out' : 'Add to bag'}</button>`;

  return `
    <article class="product-card${soldOut ? ' is-sold-out' : ''}${p.comingSoon ? ' is-coming-soon' : ''}">
      <button class="product-image" data-view="${p.id}" aria-label="View ${p.name}">
        <img src="${p.image}" alt="${p.name}" loading="lazy" referrerpolicy="no-referrer"
          style="object-position:${p.imagePosition || 'center'}"
          onerror="this.onerror=null;this.src='${p.fallback || 'assets/images/smiley.svg'}'">
        ${tag}
        <span class="detail-corner" aria-hidden="true">↗</span>
      </button>
      <div class="product-info">
        <div class="product-topline">
          <div><div class="model">MODEL ${p.id}</div><h3 class="product-name">${p.name}</h3></div>
          ${priceBlock}
        </div>
        <div class="product-specs"><span>${p.size}</span><span>≈ ${p.grams} g PLA</span>${stockNote}</div>
        ${cashLine}
        <div class="product-actions">
          ${primaryBtn}
          <button class="view-btn" data-view="${p.id}" aria-label="View product details">Details <span>↗</span></button>
        </div>
        <p class="model-credit">Design source: <a href="${p.source}" target="_blank" rel="noopener">${p.credit}</a></p>
      </div>
    </article>`;
}

// Category chooses WHICH products show; sort decides the ORDER of that
// filtered set — e.g. Limited Edition + Price High to Low. Search narrows
// further, on top of whichever category is active.
function matchesCategory(p) {
  if (categoryMode === 'in-stock') return !p.comingSoon && remainingStock(p) > 0;
  if (categoryMode === 'limited') return !!p.limitedEdition;
  if (categoryMode === 'coming-soon') return !!p.comingSoon;
  return true;
}
function matchesSearch(p) {
  if (!searchQuery) return true;
  const q = searchQuery.toLowerCase();
  return p.name.toLowerCase().includes(q) || (p.desc || '').toLowerCase().includes(q);
}

function renderProducts() {
  // The Auction category renders a completely different card shape (bid
  // amount/countdown, not price/Add to bag) — handled by auction.js, which
  // owns #productGrid entirely while this category is active.
  if (categoryMode === 'auction') {
    if (typeof renderAuctionSection === 'function') renderAuctionSection();
    return;
  }

  let rows = products.filter(p => matchesCategory(p) && matchesSearch(p));
  if (sortMode === 'price-low') rows.sort((a, b) => currentPrice(a) - currentPrice(b));
  if (sortMode === 'price-high') rows.sort((a, b) => currentPrice(b) - currentPrice(a));
  if (sortMode === 'newest') rows.sort((a, b) => createdAtMs(b) - createdAtMs(a));

  grid.innerHTML = rows.map(productCard).join('');
  document.querySelector('#emptyResults').hidden = rows.length > 0;
  count.textContent = `${rows.length} design${rows.length === 1 ? '' : 's'}`;
}

document.querySelectorAll('[data-sort]').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('[data-sort]').forEach(x => x.classList.remove('active'));
  btn.classList.add('active');
  sortMode = btn.dataset.sort;
  renderProducts();
}));

document.querySelectorAll('[data-category]').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('[data-category]').forEach(x => {
    x.classList.remove('active');
    x.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');
  categoryMode = btn.dataset.category;
  renderProducts();
  if (typeof track === 'function') track('category_view', { category: categoryMode });
}));

let searchDebounce = null;
document.querySelector('#shopSearch').addEventListener('input', e => {
  clearTimeout(searchDebounce);
  const value = e.target.value;
  searchDebounce = setTimeout(() => {
    searchQuery = value.trim();
    renderProducts();
    if (searchQuery && typeof track === 'function') track('search', { query: searchQuery });
  }, 400);
});

grid.addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  const view = e.target.closest('[data-view]');
  if (add) addToCart(add.dataset.add);
  else if (view) openQuick(view.dataset.view);
});

function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const remaining = remainingStock(p);
  const row = cart.find(x => x.id === id);
  const currentQty = row ? row.qty : 0;
  if (currentQty >= remaining) {
    toastMsg(remaining <= 0 ? `${p.name} is sold out` : `Only ${remaining} of ${p.name} left`);
    return;
  }
  row ? row.qty++ : cart.push({ id, qty: 1 });
  saveCart();
  updateCartBadge();
  if (typeof track === 'function') track('add_to_cart', { productId: id });
  toastMsg(`${p.name} added`);
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function cartRows() {
  return cart.map(r => ({ ...r, p: products.find(p => p.id === r.id) })).filter(r => r.p);
}

function promoPercent() {
  return activePromo?.type === 'discount' ? Number(activePromo.percent || 0) : 0;
}

function cartTotals() {
  const rows = cartRows();
  const sub = round2(rows.reduce((s, r) => s + currentPrice(r.p) * r.qty, 0));
  const promoDiscount = round2(sub * (promoPercent() / 100));
  return { sub, total: round2(Math.max(0, sub - promoDiscount)) };
}

function updateCartBadge() {
  const rows = cartRows();
  const qty = rows.reduce((s, r) => s + r.qty, 0);
  document.querySelector('#cartCount').textContent = qty;
  renderMobileCartBar();
}

function renderMobileCartBar() {
  const bar = document.querySelector('#mobileCartBar');
  if (!bar) return;

  const rows = cartRows();
  const qty = rows.reduce((sum, row) => sum + row.qty, 0);
  const total = cartTotals().total;

  document.querySelector('#mobileCartSummary').textContent =
    qty ? `${qty} item${qty === 1 ? '' : 's'} · ${money(total)}` : '0 items';

  bar.classList.toggle('show', qty > 0 && window.innerWidth <= 760);
}

window.addEventListener('resize', renderMobileCartBar);

const quick = document.querySelector('#quickView');

function openQuick(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  quickProduct = p;
  if (typeof track === 'function') track('product_view', { productId: id });
  const qi = document.querySelector('#quickImage');
  qi.src = p.image;
  qi.referrerPolicy = 'no-referrer';
  qi.style.objectPosition = p.imagePosition || 'center';
  qi.onerror = () => { qi.onerror = null; qi.src = p.fallback || 'assets/images/smiley.svg'; };
  document.querySelector('#quickName').textContent = p.name;
  document.querySelector('#quickModel').textContent = `MODEL ${p.id}`;
  const price = currentPrice(p);
  document.querySelector('#quickPrice').textContent = money(price);
  document.querySelector('#quickCashPrice').textContent = money(round2(price * (1 + CARD_SURCHARGE_PERCENT / 100)));
  document.querySelector('#quickSize').textContent = p.size;
  document.querySelector('#quickWeight').textContent = `≈ ${p.grams} g`;

  const remaining = remainingStock(p);
  const soldOut = !p.comingSoon && remaining <= 0;
  const showInterestPanel = soldOut || p.comingSoon;
  const addBtn = document.querySelector('#quickAdd');
  addBtn.hidden = showInterestPanel;

  const restockBox = document.querySelector('#restockBox');
  restockBox.hidden = !showInterestPanel;
  if (showInterestPanel) {
    document.querySelector('.restock-lead').textContent = p.comingSoon
      ? "This item isn't released yet. Want us to let you know when it's available?"
      : 'This item is currently sold out. Want us to make another one?';
    document.querySelector('#restockNote').value = '';
    document.querySelector('#restockDone').hidden = true;
    const btn = document.querySelector('#restockBtn');
    btn.hidden = false;
    btn.disabled = false;
    btn.textContent = "Let us know you're interested";
  }

  quick.showModal();
}

document.querySelector('#quickClose').addEventListener('click', () => quick.close());

// getVisitorId() lives in terms.js (loaded before this file) — shared
// between the Terms gate and restock requests rather than duplicated.

document.querySelector('#restockBtn').addEventListener('click', async () => {
  if (!quickProduct) return;
  const endpoint = window.MINI_SQUARE?.restockRequestEndpoint?.trim();
  const btn = document.querySelector('#restockBtn');
  const note = document.querySelector('#restockNote').value.trim();

  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    if (endpoint) {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: quickProduct.id, visitorId: getVisitorId(), note })
      });
    }
  } catch {
    // Best-effort — still show the same thank-you either way.
  }

  btn.hidden = true;
  document.querySelector('#restockDone').hidden = false;
});
document.querySelector('#quickAdd').addEventListener('click', () => {
  if (quickProduct) {
    addToCart(quickProduct.id);
    quick.close();
  }
});

const mobile = document.querySelector('#mobileNav');
document.querySelector('#menuToggle').addEventListener('click', () => mobile.classList.toggle('open'));
mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobile.classList.remove('open')));

function toastMsg(msg) {
  const t = document.querySelector('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window.__miniToast);
  window.__miniToast = setTimeout(() => t.classList.remove('show'), 1700);
}

const slides = [...document.querySelectorAll('.hero-slide')];
const dots = [...document.querySelectorAll('[data-slide-to]')];
let slide = 0;
let timer;

function showSlide(n) {
  slide = (n + slides.length) % slides.length;
  slides.forEach((s, i) => s.classList.toggle('active', i === slide));
  dots.forEach((d, i) => d.classList.toggle('active', i === slide));
  restartSlider();
}
function restartSlider() {
  clearInterval(timer);
  timer = setInterval(() => showSlide(slide + 1), 5500);
}

document.querySelector('#nextSlide').addEventListener('click', () => showSlide(slide + 1));
document.querySelector('#prevSlide').addEventListener('click', () => showSlide(slide - 1));
dots.forEach(d => d.addEventListener('click', () => showSlide(+d.dataset.slideTo)));

// Only show the Coming Soon tab once there's an actual coming-soon product
// to show — an always-visible, permanently-empty tab would look broken
// rather than helpful.
if (products.some(p => p.comingSoon)) {
  document.querySelector('#comingSoonTab').hidden = false;
}

renderProducts();
updateCartBadge();
restartSlider();
refreshStockStatus();


/* =========================================================
   FIRST-LOAD SPIN & WIN
   ========================================================= */
const SPIN_OPENED_KEY = 'mini-entry-spin-opened-v1';
const SPIN_RESULT_KEY = 'mini-entry-spin-result-v1';

// Free-keychain prize removed from the wheel. Its 10 weight was returned to
// "empty" rather than to the discount tiers, so the odds of winning a
// discount stay exactly what they were (12+8+5=25); only the free-item
// chance is gone, redistributed evenly across the 5 empty slices (75/5=15).
const entrySegments = [
  { key:'empty-a', type:'empty', weight:15, visualIndex:0 },
  { key:'off-5', type:'discount', percent:5, weight:12, visualIndex:1 },
  { key:'empty-b', type:'empty', weight:15, visualIndex:2 },
  { key:'off-10', type:'discount', percent:10, weight:8, visualIndex:3 },
  { key:'empty-c', type:'empty', weight:15, visualIndex:4 },
  { key:'off-20', type:'discount', percent:20, weight:5, visualIndex:5 },
  { key:'empty-d', type:'empty', weight:15, visualIndex:6 },
  { key:'empty-e', type:'empty', weight:15, visualIndex:7 }
];

function spinTargetRotation(seg) {
  const visualSlice = 360 / entrySegments.length;
  const centerDeg = seg.visualIndex * visualSlice + visualSlice / 2;
  return 360 * 8 + (360 - centerDeg);
}

function launchConfetti() {
  const layer = document.querySelector('#confettiLayer');
  if (!layer) return;
  layer.innerHTML = '';
  const chars = ['✦','●','◆','★','♥'];
  for (let i=0;i<70;i++) {
    const span = document.createElement('span');
    span.textContent = chars[Math.floor(Math.random()*chars.length)];
    span.style.left = `${Math.random()*100}%`;
    span.style.animationDelay = `${Math.random()*.8}s`;
    span.style.animationDuration = `${1.7 + Math.random()*1.4}s`;
    span.style.fontSize = `${10 + Math.random()*14}px`;
    layer.appendChild(span);
  }
}

function openEntrySpin() {
  const modal = document.querySelector('#spinLaunch');
  if (!modal) return;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('locked');
  localStorage.setItem(SPIN_OPENED_KEY, '1');

  const existing = read(SPIN_RESULT_KEY, null);
  if (existing) renderEntrySpinResult(existing, false);
}

function closeEntrySpin() {
  const modal = document.querySelector('#spinLaunch');
  modal?.classList.remove('show');
  modal?.setAttribute('aria-hidden','true');
  document.body.classList.remove('locked');
}

function renderEntrySpinResult(result, celebrate=true) {
  const box = document.querySelector('#launchResult');
  const title = document.querySelector('#launchResultTitle');
  const text = document.querySelector('#launchResultText');
  const code = document.querySelector('#launchPrizeCode');
  const spinBtn = document.querySelector('#launchSpinBtn');

  box.hidden = false;
  spinBtn.disabled = true;
  spinBtn.textContent = 'DONE';

  if (result.type === 'discount') {
    title.textContent = `${result.percent}% OFF`;
    text.textContent = 'Use this one-time code at checkout. Applies to Card / Online payment only — cash is already the standard listed price.';
    code.textContent = result.code;
  } else if (result.type === 'free') {
    const p = products.find(x => x.id === result.freeProductId);
    title.textContent = 'FREE KEYCHAIN';
    text.textContent = `You won ${p?.name || 'a free keychain'}, chosen completely at random. Enter the code at checkout and it will appear on your order — works with Cash or Card.`;
    code.textContent = result.code;
  } else {
    title.textContent = 'NO PRIZE';
    text.textContent = 'No prize this time. You can still shop the MiniChains drop.';
    code.textContent = result.code;
  }

  if (celebrate && result.type !== 'empty') launchConfetti();
}

document.querySelector('#spinAgainCard')?.addEventListener('click', openEntrySpin);
document.querySelector('#spinLaunchClose')?.addEventListener('click', closeEntrySpin);
document.querySelector('#launchContinue')?.addEventListener('click', closeEntrySpin);

document.querySelector('#launchCopyCode')?.addEventListener('click', async () => {
  const code = document.querySelector('#launchPrizeCode').textContent.trim();
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    toastMsg('Prize code copied');
  } catch {
    toastMsg(code);
  }
});

document.querySelector('#launchSpinBtn')?.addEventListener('click', async () => {
  const existing = read(SPIN_RESULT_KEY, null);
  if (existing) {
    renderEntrySpinResult(existing, false);
    return;
  }

  const btn = document.querySelector('#launchSpinBtn');
  const endpoint = window.MINI_SQUARE?.spinWheelEndpoint?.trim();
  if (!endpoint) {
    toastMsg('Spin & Win isn’t available right now — please try again shortly.');
    return;
  }

  btn.disabled = true;
  btn.textContent = '...';

  // The server picks the outcome and is the only thing that ever writes a
  // real, redeemable code — this call can't be skipped or spoofed into a
  // better prize the way a purely client-side random pick could.
  let data;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: getVisitorId() })
    });
    data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.type) throw new Error(data?.error || 'Spin failed.');
  } catch (err) {
    toastMsg(err.message || 'Could not spin right now — please try again.');
    btn.disabled = false;
    btn.textContent = 'SPIN';
    return;
  }

  // The wheel only animates to a segment that visually matches the
  // server's outcome — which exact one doesn't matter when several are
  // interchangeable (the 5 empty slices all mean the same "no prize").
  const matches = entrySegments.filter(s =>
    s.type === data.type && (data.type !== 'discount' || s.percent === data.percent));
  const seg = matches[Math.floor(Math.random() * matches.length)] || entrySegments[0];
  document.querySelector('#launchWheel').style.transform = `rotate(${spinTargetRotation(seg)}deg)`;

  const result = {
    type: data.type,
    percent: data.percent || 0,
    code: data.code,
    createdAt: new Date().toISOString()
  };

  if (result.type === 'discount' && result.code) {
    const promos = read(PROMOS_KEY, []);
    promos.push({
      code: result.code, percent: result.percent, type: 'discount',
      source: 'entry-spin', used: false, createdAt: result.createdAt
    });
    write(PROMOS_KEY, promos);
  }

  write(SPIN_RESULT_KEY, result);

  setTimeout(() => {
    renderEntrySpinResult(result, true);
  }, 5300);
});

// Show the spin when the site first opens — but only once Terms have been
// accepted (per the Terms gate: declining blocks purchases and the reward
// wheel alike). If Terms haven't been resolved yet, wait for the gate's
// own "responded" event instead of guessing with a timeout.
window.addEventListener('load', () => {
  const hasResult = read(SPIN_RESULT_KEY, null);
  const opened = localStorage.getItem(SPIN_OPENED_KEY);
  if (opened || hasResult) return;

  if (typeof hasAcceptedTerms === 'function' && hasAcceptedTerms()) {
    setTimeout(openEntrySpin, 450);
  } else {
    document.addEventListener('minichains:terms-responded', (e) => {
      if (e.detail.accepted) setTimeout(openEntrySpin, 300);
    }, { once: true });
  }
});
