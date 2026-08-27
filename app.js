const products = window.MINI_PRODUCTS || [];
const money = v => `A$${Number(v || 0).toFixed(2)}`;

const grid = document.querySelector('#productGrid');
const count = document.querySelector('#productCount');

const PROMOS_KEY = 'mini-issued-promos-v2';
const ORDERS_KEY = 'mini-orders-v2';
const CART_KEY = 'mini-keychain-cart-v2';
const CASH_DISCOUNT_PERCENT = 5;

let sortMode = 'default';
let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
let quickProduct = null;
let activePromo = null;
let paymentMethod = 'card';

const read = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); }
  catch { return fallback; }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function round2(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
}

function roundCash(v) {
  return Math.round((Number(v) + Number.EPSILON) * 20) / 20;
}

function productCard(p) {
  const cashPrice = round2(p.price * 0.95);
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
  renderCart();
  toastMsg(`${p.name} added`);
}

function removeFromCart(id) {
  cart = cart.filter(x => x.id !== id);
  saveCart();
  renderCart();
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function cartRows() {
  return cart.map(r => ({ ...r, p: products.find(p => p.id === r.id) })).filter(r => r.p);
}

function subtotal() {
  return round2(cartRows().reduce((s, r) => s + r.p.price * r.qty, 0));
}

function promoPercent() {
  return Number(activePromo?.percent || 0);
}

function cartTotals() {
  const sub = subtotal();
  const promoPct = promoPercent();
  const cashPct = paymentMethod === 'cash' ? CASH_DISCOUNT_PERCENT : 0;

  // User requested cash + promo percentages to stack additively.
  const combinedPct = Math.min(100, promoPct + cashPct);
  const promoDiscount = round2(sub * (promoPct / 100));
  const cashDiscount = round2(sub * (cashPct / 100));

  // Use the exact combined percentage against the original subtotal.
  const rawDiscountedTotal = Math.max(0, sub * (1 - combinedPct / 100));
  const beforeRounding = round2(rawDiscountedTotal);

  let finalTotal = beforeRounding;
  let cashRounding = 0;

  // Australian cash totals are rounded to the nearest 5 cents.
  if (paymentMethod === 'cash') {
    finalTotal = roundCash(rawDiscountedTotal);
    cashRounding = round2(finalTotal - beforeRounding);
  }

  return {
    sub,
    promoPct,
    cashPct,
    combinedPct,
    promoDiscount,
    cashDiscount,
    beforeRounding,
    cashRounding,
    total: round2(finalTotal)
  };
}

function renderCart() {
  const rows = cartRows();
  const qty = rows.reduce((s, r) => s + r.qty, 0);
  const t = cartTotals();

  document.querySelector('#cartCount').textContent = qty;
  document.querySelector('#cartEmpty').classList.toggle('show', !qty);
  document.querySelector('#cartSummary').style.display = qty ? 'block' : 'none';

  document.querySelector('#cartItems').innerHTML = rows.map(({ p, qty }) => `
    <div class="cart-item">
      <img src="${p.image}" onerror="this.onerror=null;this.src='${p.fallback || 'assets/images/smiley.svg'}'" alt="">
      <div><h4>${p.name}</h4><p>${money(p.price)} · Qty ${qty}</p></div>
      <button data-remove="${p.id}">×</button>
    </div>`).join('');

  document.querySelector('#cartSubtotal').textContent = money(t.sub);

  const promoRow = document.querySelector('#cartPromoDiscountRow');
  if (activePromo && t.promoDiscount > 0) {
    promoRow.hidden = false;
    document.querySelector('#cartPromoDiscountLabel').textContent = `Promo discount · ${t.promoPct}%`;
    document.querySelector('#cartPromoDiscount').textContent = `−${money(t.promoDiscount)}`;
  } else {
    promoRow.hidden = true;
  }

  const cashRow = document.querySelector('#cartCashDiscountRow');
  cashRow.hidden = paymentMethod !== 'cash';
  document.querySelector('#cartCashDiscount').textContent = `−${money(t.cashDiscount)}`;

  const roundingRow = document.querySelector('#cashRoundingRow');
  if (paymentMethod === 'cash' && Math.abs(t.cashRounding) >= 0.001) {
    roundingRow.hidden = false;
    const sign = t.cashRounding > 0 ? '+' : '−';
    document.querySelector('#cashRounding').textContent = `${sign}${money(Math.abs(t.cashRounding))}`;
  } else {
    roundingRow.hidden = true;
  }

  document.querySelector('#cartTotal').textContent = money(t.total);
  document.querySelector('#cartTotalLabel').textContent =
    paymentMethod === 'cash' ? 'Cash to collect' : 'Total';

  document.querySelector('#cashSavingNote').hidden = paymentMethod !== 'cash';

  document.querySelectorAll('[data-payment]').forEach(btn => {
    const active = btn.dataset.payment === paymentMethod;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  const checkoutBtn = document.querySelector('#checkoutBtn');
  checkoutBtn.textContent =
    paymentMethod === 'cash' ? `Create cash order · ${money(t.total)}` : `Pay securely with Square · ${money(t.total)}`;

  const note = document.querySelector('#checkoutNote');
  const spinText = qty >= 3
    ? 'This order unlocks one Spin & Win after payment is confirmed.'
    : `Add ${3 - qty} more item${3 - qty === 1 ? '' : 's'} to unlock one Spin & Win.`;

  if (paymentMethod === 'cash') {
    const discountText = activePromo
      ? `Cash 5% + promo ${t.promoPct}% = ${t.combinedPct}% off before cash rounding.`
      : 'Cash gets 5% off automatically.';
    note.textContent = `${discountText} ${spinText}`;
  } else {
    note.textContent = `Card/online payment uses Square. ${spinText}`;
  }
}

document.querySelector('#cartItems').addEventListener('click', e => {
  const b = e.target.closest('[data-remove]');
  if (b) removeFromCart(b.dataset.remove);
});

document.querySelectorAll('[data-payment]').forEach(btn => {
  btn.addEventListener('click', () => {
    paymentMethod = btn.dataset.payment === 'cash' ? 'cash' : 'card';
    renderCart();
  });
});

const drawer = document.querySelector('#cartDrawer');
const overlay = document.querySelector('#overlay');

function openCart() {
  drawer.classList.add('open');
  overlay.classList.add('show');
  document.body.classList.add('locked');
}
function closeCart() {
  drawer.classList.remove('open');
  overlay.classList.remove('show');
  document.body.classList.remove('locked');
}

document.querySelector('#cartToggle').addEventListener('click', openCart);
document.querySelector('#cartClose').addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);

function applyPromoCode() {
  const input = document.querySelector('#promoInput');
  const message = document.querySelector('#promoMessage');
  const code = input.value.trim().toUpperCase();
  const promo = read(PROMOS_KEY, []).find(p => p.code.toUpperCase() === code);

  if (!promo) {
    activePromo = null;
    message.textContent = 'Code not found on this device.';
    message.style.color = '#a33';
    renderCart();
    return;
  }
  if (promo.used) {
    activePromo = null;
    message.textContent = 'This one-time code has already been used.';
    message.style.color = '#a33';
    renderCart();
    return;
  }

  activePromo = promo;
  message.textContent = `${promo.percent}% discount applied.${paymentMethod === 'cash' ? ` With cash, total discount becomes ${promo.percent + CASH_DISCOUNT_PERCENT}%.` : ''}`;
  message.style.color = '#24804a';
  renderCart();
}

document.querySelector('#applyPromo').addEventListener('click', applyPromoCode);
document.querySelector('#promoInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') applyPromoCode();
});

function makeOrderId() {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return `MINI-${Date.now().toString(36).slice(-5).toUpperCase()}-${(a[0] ^ a[1]).toString(36).slice(-4).toUpperCase()}`;
}

function markPromoUsed(orderId) {
  if (!activePromo) return;
  const promos = read(PROMOS_KEY, []).map(p =>
    p.code === activePromo.code
      ? { ...p, used: true, usedAt: new Date().toISOString(), usedForOrder: orderId }
      : p
  );
  write(PROMOS_KEY, promos);
}

function saveLocalOrder({ method, status, demo = false }) {
  const rows = cartRows();
  if (!rows.length) return null;

  const t = cartTotals();
  const id = makeOrderId();

  const order = {
    id,
    demo,
    createdAt: new Date().toISOString(),
    paymentMethod: method,
    paymentStatus: status,
    items: rows.map(r => ({ id: r.id, qty: r.qty, price: r.p.price })),
    subtotal: t.sub,
    promoCode: activePromo?.code || null,
    promoPercent: t.promoPct,
    promoDiscount: t.promoDiscount,
    cashDiscountPercent: t.cashPct,
    cashDiscount: t.cashDiscount,
    combinedDiscountPercent: t.combinedPct,
    beforeCashRounding: t.beforeRounding,
    cashRounding: t.cashRounding,
    total: t.total
  };

  const orders = read(ORDERS_KEY, []);
  orders.push(order);
  write(ORDERS_KEY, orders);
  localStorage.setItem('mini-last-order-id', id);

  markPromoUsed(id);

  cart = [];
  saveCart();
  activePromo = null;
  return order;
}

document.querySelector('#checkoutBtn').addEventListener('click', async () => {
  if (!cart.length) return;

  const btn = document.querySelector('#checkoutBtn');

  // Cash never leaves the site. It creates a cash order with the exact amount due.
  if (paymentMethod === 'cash') {
    const order = saveLocalOrder({
      method: 'cash',
      status: 'cash_due',
      demo: false
    });
    if (order) location.href = `success.html?order=${encodeURIComponent(order.id)}`;
    return;
  }

  // Card/online goes through Square.
  const endpoint = window.MINI_SQUARE?.checkoutEndpoint?.trim();

  if (!endpoint) {
    // Demo-only local order when Square backend is not connected yet.
    const order = saveLocalOrder({
      method: 'card',
      status: 'paid_demo',
      demo: true
    });
    if (order) location.href = `success.html?demo=1&order=${encodeURIComponent(order.id)}`;
    return;
  }

  const rows = cartRows();
  btn.disabled = true;
  btn.textContent = 'Opening Square…';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod: 'card',
        items: rows.map(r => ({ id: r.id, qty: r.qty })),
        promoCode: activePromo?.code || null
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || 'Could not create Square checkout.');
    location.href = data.url;
  } catch (err) {
    toastMsg(err.message || 'Checkout failed. Please try again.');
    btn.disabled = false;
    renderCart();
  }
});

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
  document.querySelector('#quickCashPrice').textContent = money(round2(p.price * 0.95));
  document.querySelector('#quickSize').textContent = p.size;
  document.querySelector('#quickWeight').textContent = `≈ ${p.grams} g`;
  quick.showModal();
}

document.querySelector('#quickClose').addEventListener('click', () => quick.close());
document.querySelector('#quickAdd').addEventListener('click', () => {
  if (quickProduct) {
    addToCart(quickProduct.id);
    quick.close();
    openCart();
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
renderCart();
restartSlider();
