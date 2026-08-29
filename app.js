const products = window.MINI_PRODUCTS || [];
const money = v => `A$${Number(v || 0).toFixed(2)}`;

const grid = document.querySelector('#productGrid');
const count = document.querySelector('#productCount');

const PROMOS_KEY = 'mini-issued-promos-v2';
const CART_KEY = 'mini-keychain-cart-v2';
const CASH_DISCOUNT_PERCENT = 5;

let sortMode = 'default';
let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
let quickProduct = null;
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
  const cashPrice = Math.floor(p.price * (1 - CASH_DISCOUNT_PERCENT / 100));
  const tag = p.tag ? `<span class="tag">${p.tag}</span>` : '';
  return `
    <article class="product-card">
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
          <span class="price">${money(p.price)}</span>
        </div>
        <div class="product-specs"><span>${p.size}</span><span>≈ ${p.grams} g PLA</span></div>
        <div class="cash-line"><span>Cash price</span><strong>${money(cashPrice)}</strong><small>5% off</small></div>
        <div class="product-actions">
          <button class="add-btn" data-add="${p.id}">Add to bag</button>
          <button class="view-btn" data-view="${p.id}" aria-label="View product details">Details <span>↗</span></button>
        </div>
        <p class="model-credit">Design source: <a href="${p.source}" target="_blank" rel="noopener">${p.credit}</a></p>
      </div>
    </article>`;
}

function renderProducts() {
  let rows = [...products];
  if (sortMode === 'price-low') rows.sort((a, b) => a.price - b.price);
  if (sortMode === 'smallest') rows.sort((a, b) => a.grams - b.grams);
  grid.innerHTML = rows.map(productCard).join('');
  count.textContent = `${rows.length} design${rows.length === 1 ? '' : 's'}`;
}

document.querySelectorAll('[data-sort]').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('[data-sort]').forEach(x => x.classList.remove('active'));
  btn.classList.add('active');
  sortMode = btn.dataset.sort;
  renderProducts();
}));

grid.addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  const view = e.target.closest('[data-view]');
  if (add) addToCart(add.dataset.add);
  else if (view) openQuick(view.dataset.view);
});

function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const row = cart.find(x => x.id === id);
  row ? row.qty++ : cart.push({ id, qty: 1 });
  saveCart();
  updateCartBadge();
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
  const sub = round2(rows.reduce((s, r) => s + r.p.price * r.qty, 0));
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
  const qi = document.querySelector('#quickImage');
  qi.src = p.image;
  qi.referrerPolicy = 'no-referrer';
  qi.style.objectPosition = p.imagePosition || 'center';
  qi.onerror = () => { qi.onerror = null; qi.src = p.fallback || 'assets/images/smiley.svg'; };
  document.querySelector('#quickName').textContent = p.name;
  document.querySelector('#quickModel').textContent = `MODEL ${p.id}`;
  document.querySelector('#quickPrice').textContent = money(p.price);
  document.querySelector('#quickCashPrice').textContent = money(Math.floor(p.price * (1 - CASH_DISCOUNT_PERCENT / 100)));
  document.querySelector('#quickSize').textContent = p.size;
  document.querySelector('#quickWeight').textContent = `≈ ${p.grams} g`;
  quick.showModal();
}

document.querySelector('#quickClose').addEventListener('click', () => quick.close());
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

renderProducts();
updateCartBadge();
restartSlider();


/* =========================================================
   FIRST-LOAD SPIN & WIN
   ========================================================= */
const SPIN_OPENED_KEY = 'mini-entry-spin-opened-v1';
const SPIN_RESULT_KEY = 'mini-entry-spin-result-v1';

const entrySegments = [
  { key:'empty-a', type:'empty', weight:25, visualIndex:0 },
  { key:'off-5', type:'discount', percent:5, weight:12, visualIndex:1 },
  { key:'empty-b', type:'empty', weight:20, visualIndex:2 },
  { key:'free', type:'free', weight:10, visualIndex:3 },
  { key:'empty-c', type:'empty', weight:20, visualIndex:4 },
  { key:'off-10', type:'discount', percent:10, weight:8, visualIndex:5 },
  { key:'off-20', type:'discount', percent:20, weight:5, visualIndex:6 }
];

function entryCryptoFloat() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}

function chooseEntrySegment() {
  const total = entrySegments.reduce((s, x) => s + x.weight, 0);
  let n = entryCryptoFloat() * total;
  for (const seg of entrySegments) {
    if (n < seg.weight) return seg;
    n -= seg.weight;
  }
  return entrySegments[0];
}

function spinTargetRotation(seg) {
  const visualSlice = 360 / entrySegments.length;
  const centerDeg = seg.visualIndex * visualSlice + visualSlice / 2;
  return 360 * 8 + (360 - centerDeg);
}

function prizeCode(prefix='WIN') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint32Array(7);
  crypto.getRandomValues(a);
  return `MINI-${prefix}-${[...a].map(n => chars[n % chars.length]).join('')}`;
}

function storePromoPrize(prize) {
  const promos = read(PROMOS_KEY, []);
  promos.push(prize);
  write(PROMOS_KEY, promos);
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
    text.textContent = 'Use this one-time code at checkout.';
    code.textContent = result.code;
  } else if (result.type === 'free') {
    const p = products.find(x => x.id === result.freeProductId);
    title.textContent = 'FREE KEYCHAIN';
    text.textContent = `You won ${p?.name || 'a free keychain'}. Enter the code at checkout and it will appear on your order.`;
    code.textContent = result.code;
  } else {
    title.textContent = 'NO PRIZE';
    text.textContent = 'No prize this time. You can still shop the mini drop.';
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

document.querySelector('#launchSpinBtn')?.addEventListener('click', () => {
  const existing = read(SPIN_RESULT_KEY, null);
  if (existing) {
    renderEntrySpinResult(existing, false);
    return;
  }

  const seg = chooseEntrySegment();
  const wheel = document.querySelector('#launchWheel');
  const btn = document.querySelector('#launchSpinBtn');

  btn.disabled = true;
  btn.textContent = '...';
  wheel.style.transform = `rotate(${spinTargetRotation(seg)}deg)`;

  const result = {
    type: seg.type,
    createdAt: new Date().toISOString()
  };

  if (seg.type === 'discount') {
    result.percent = seg.percent;
    result.code = prizeCode(`${seg.percent}OFF`);
    storePromoPrize({
      code: result.code,
      percent: result.percent,
      type:'discount',
      source:'entry-spin',
      used:false,
      createdAt:result.createdAt
    });
  } else if (seg.type === 'free') {
    const freeProduct = products[Math.floor(entryCryptoFloat()*products.length)];
    result.freeProductId = freeProduct.id;
    result.code = prizeCode('FREE');
    storePromoPrize({
      code: result.code,
      percent:0,
      type:'free',
      freeProductId:freeProduct.id,
      source:'entry-spin',
      used:false,
      createdAt:result.createdAt
    });
  } else {
    // Empty still gets a code receipt, but it carries no checkout value.
    result.code = prizeCode('EMPTY');
    storePromoPrize({
      code: result.code,
      percent:0,
      type:'empty',
      source:'entry-spin',
      used:false,
      createdAt:result.createdAt
    });
  }

  write(SPIN_RESULT_KEY, result);

  setTimeout(() => {
    renderEntrySpinResult(result, true);
  }, 5300);
});

// Show the spin when the site first opens.
// If the user has already spun on this device, do not force it again.
window.addEventListener('load', () => {
  const hasResult = read(SPIN_RESULT_KEY, null);
  const opened = localStorage.getItem(SPIN_OPENED_KEY);

  if (!opened && !hasResult) {
    setTimeout(openEntrySpin, 450);
  }
});
