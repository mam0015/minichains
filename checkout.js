const products = window.MINI_PRODUCTS || [];
const money = v => `A$${Number(v || 0).toFixed(2)}`;

const PROMOS_KEY = 'mini-issued-promos-v2';
const ORDERS_KEY = 'mini-orders-v2';
const CART_KEY = 'mini-keychain-cart-v2';
const CARD_SURCHARGE_PERCENT = 5;

let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
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

function toastMsg(msg) {
  const t = document.querySelector('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window.__miniToast);
  window.__miniToast = setTimeout(() => t.classList.remove('show'), 1700);
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

// `p.price` is the cash (base) price. Card/online adds a 5% surcharge per
// unit to cover the Square processing + payment-link cost.
function cardUnitPrice(p) {
  return round2(p.price * (1 + CARD_SURCHARGE_PERCENT / 100));
}
function unitPrice(p) {
  return paymentMethod === 'card' ? cardUnitPrice(p) : p.price;
}

function cartTotals() {
  const rows = cartRows();
  const cashSub = round2(rows.reduce((s, r) => s + r.p.price * r.qty, 0));
  const cardSub = round2(rows.reduce((s, r) => s + cardUnitPrice(r.p) * r.qty, 0));
  // Spin & Win % discount codes apply to Card/online only. A free-item
  // prize is unaffected by this: it has no percent value and is handled
  // separately either way.
  const promoPct = paymentMethod === 'card' ? promoPercent() : 0;

  const sub = paymentMethod === 'card' ? cardSub : cashSub;
  let promoDiscount = 0;
  let total = cashSub;

  if (paymentMethod === 'card') {
    promoDiscount = round2(cardSub * (promoPct / 100));
    total = round2(Math.max(0, cardSub - promoDiscount));
  }

  return {
    sub,
    cashSub,
    cardSub,
    promoPct,
    promoDiscount,
    cardSurchargePercent: paymentMethod === 'card' ? CARD_SURCHARGE_PERCENT : 0,
    cardSurcharge: paymentMethod === 'card' ? round2(cardSub - cashSub) : 0,
    total: round2(total)
  };
}

function removeFromCart(id) {
  cart = cart.filter(x => x.id !== id);
  saveCart();
  renderCart();
}

function changeCartQuantity(id, delta) {
  const row = cart.find(x => x.id === id);
  if (!row) return;

  row.qty += delta;

  if (row.qty <= 0) {
    cart = cart.filter(x => x.id !== id);
  }

  saveCart();
  renderCart();
}

function renderCart() {
  const rows = cartRows();
  const qty = rows.reduce((s, r) => s + r.qty, 0);
  const t = cartTotals();

  document.querySelector('#cartEmpty').classList.toggle('show', !qty);
  document.querySelector('#cartSummary').style.display = qty ? '' : 'none';
  document.querySelector('.checkout-items-col').classList.toggle('is-empty', !qty);

  document.querySelector('#cartItems').innerHTML = rows.map(({ p, qty }) => `
    <div class="cart-item">
      <img src="${p.image}" onerror="this.onerror=null;this.src='${p.fallback || 'assets/images/smiley.svg'}'" alt="${p.name}">
      <div class="cart-item-main">
        <h4>${p.name}</h4>
        <p>${money(unitPrice(p))} each</p>

        <div class="qty-control" aria-label="Quantity for ${p.name}">
          <button type="button" class="qty-btn" data-qty-minus="${p.id}" aria-label="Decrease ${p.name} quantity">−</button>
          <span class="qty-number">${qty}</span>
          <button type="button" class="qty-btn" data-qty-plus="${p.id}" aria-label="Increase ${p.name} quantity">+</button>
        </div>
      </div>
      <div class="cart-item-side">
        <strong>${money(unitPrice(p) * qty)}</strong>
        <button class="remove-item" type="button" data-remove="${p.id}" aria-label="Remove ${p.name}">×</button>
      </div>
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

  const freePrizeRow = document.querySelector('#cartFreePrizeRow');
  if (activePromo?.type === 'free') {
    const p = products.find(x => x.id === activePromo.freeProductId);
    freePrizeRow.hidden = false;
    document.querySelector('#cartFreePrizeLabel').textContent = `Free prize · ${p?.name || 'Keychain'}`;
    document.querySelector('#cartFreePrize').textContent = 'A$0.00';
  } else {
    freePrizeRow.hidden = true;
  }

  const cashRow = document.querySelector('#cartCashDiscountRow');
  cashRow.hidden = paymentMethod !== 'card' || t.cardSurcharge <= 0;
  document.querySelector('#cartCashDiscount').textContent = `+${money(t.cardSurcharge)}`;

  const roundingRow = document.querySelector('#cashRoundingRow');
  roundingRow.hidden = true;

  document.querySelector('#cartTotal').textContent = money(t.total);
  document.querySelector('#cartTotalLabel').textContent =
    paymentMethod === 'cash' ? 'Cash to collect' : 'Total';

  document.querySelector('#cashSavingNote').hidden = paymentMethod !== 'card';

  document.querySelectorAll('[data-payment]').forEach(btn => {
    const active = btn.dataset.payment === paymentMethod;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  const checkoutBtn = document.querySelector('#checkoutBtn');
  checkoutBtn.disabled = !qty;
  checkoutBtn.textContent =
    paymentMethod === 'cash' ? `Create cash order · ${money(t.total)}` : `Pay securely with Square · ${money(t.total)}`;

  const note = document.querySelector('#checkoutNote');
  const spinText = qty >= 3
    ? 'This order unlocks one Spin & Win after payment is confirmed.'
    : qty ? `Add ${3 - qty} more item${3 - qty === 1 ? '' : 's'} to unlock one Spin & Win.` : '';

  if (paymentMethod === 'cash') {
    const cashText = activePromo?.type === 'free'
      ? 'Cash is the standard listed price — plus your free item. Promo % codes don’t apply to cash.'
      : 'Cash is the standard listed price, no surcharge.';
    note.textContent = `${cashText} ${spinText}`;
  } else {
    note.textContent = `Card/online payment uses Square, with a 5% surcharge per item to cover processing. ${spinText}`;
  }
}

document.querySelector('#cartItems').addEventListener('click', e => {
  const plus = e.target.closest('[data-qty-plus]');
  const minus = e.target.closest('[data-qty-minus]');
  const remove = e.target.closest('[data-remove]');

  if (plus) { changeCartQuantity(plus.dataset.qtyPlus, 1); return; }
  if (minus) { changeCartQuantity(minus.dataset.qtyMinus, -1); return; }
  if (remove) removeFromCart(remove.dataset.remove);
});

document.querySelectorAll('[data-payment]').forEach(btn => {
  btn.addEventListener('click', () => {
    paymentMethod = btn.dataset.payment === 'cash' ? 'cash' : 'card';
    renderCart();
  });
});

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

  if (promo.type === 'empty') {
    activePromo = null;
    message.textContent = 'This spin code has no prize value.';
    message.style.color = '#756871';
    renderCart();
    return;
  }

  activePromo = promo;

  if (promo.type === 'free') {
    const p = products.find(x => x.id === promo.freeProductId);
    message.textContent = `Free prize applied: ${p?.name || 'keychain'}. Works with Cash or Card.`;
  } else {
    message.textContent = `${promo.percent}% discount ready. Applies automatically if you pay by Card. Not available on Cash.`;
  }

  message.style.color = '#24804a';
  renderCart();
}

document.querySelector('#applyPromo').addEventListener('click', applyPromoCode);
document.querySelector('#promoInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); applyPromoCode(); }
});

function customerSurveyPayload() {
  return {
    firstName: (document.querySelector('#surveyFirstName')?.value || '').trim(),
    level: (document.querySelector('#surveyLevel')?.value || '').trim(),
    comment: (document.querySelector('#surveyComment')?.value || '').trim()
  };
}

async function submitSurvey(orderId, method) {
  const payload = customerSurveyPayload();
  const hasAny = payload.firstName || payload.level || payload.comment;
  if (!hasAny) return;

  const record = {
    id: `FB-${Date.now().toString(36).toUpperCase()}`,
    orderId,
    paymentMethod: method,
    ...payload,
    createdAt: new Date().toISOString()
  };

  const local = read('mini-feedback-v1', []);
  local.push(record);
  write('mini-feedback-v1', local);

  const endpoint = window.MINI_FEEDBACK?.endpoint?.trim();
  if (!endpoint) return;

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
  } catch (err) {
    console.warn('Feedback endpoint failed; local copy kept.', err);
  }
}

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

function saveLocalOrder({ method, status, demo = false, id }) {
  const rows = cartRows();
  if (!rows.length) return null;

  const t = cartTotals();
  id = id || makeOrderId();

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
    freePrizeProductId: activePromo?.type === 'free' ? activePromo.freeProductId : null,
    cardSurchargePercent: t.cardSurchargePercent,
    cardSurcharge: t.cardSurcharge,
    cashSub: t.cashSub,
    cardSub: t.cardSub,
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
    const order = saveLocalOrder({ method: 'cash', status: 'cash_due', demo: false });
    if (order) {
      submitSurvey(order.id, 'cash'); // best-effort — never block the redirect on it
      location.href = `success.html?order=${encodeURIComponent(order.id)}`;
    }
    return;
  }

  // Card/online goes through Square. No fake "paid" fallback: if the
  // backend isn't configured, say so instead of pretending payment happened.
  const endpoint = window.MINI_SQUARE?.checkoutEndpoint?.trim();

  if (!endpoint) {
    toastMsg('Card payment isn’t available right now — please choose Cash, or try again shortly.');
    return;
  }

  const rows = cartRows();
  btn.disabled = true;
  btn.textContent = 'Opening Square…';

  // Reserved now so the redirect Square sends the customer back to can find
  // this exact order, and so the backend can insert it under this same id.
  const pendingId = makeOrderId();

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod: 'card',
        orderId: pendingId,
        items: rows.map(r => ({ id: r.id, qty: r.qty })),
        promoCode: activePromo?.code || null,
        survey: customerSurveyPayload(),
        redirectUrl: new URL(`success.html?order=${encodeURIComponent(pendingId)}`, window.location.href).href
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || 'Could not create Square checkout.');

    // Not "paid" — Square hasn't confirmed anything yet, this only records
    // what was ordered so success.html has something to show while it polls
    // the server (order-status, updated by the square-webhook function) for
    // the real, verified state. The redirect alone is never treated as proof.
    const order = saveLocalOrder({ method: 'card', status: 'pending', demo: false, id: data.orderId || pendingId });
    if (order) submitSurvey(order.id, 'card'); // best-effort — never block the redirect on it

    location.href = data.url;
  } catch (err) {
    toastMsg(err.message || 'Checkout failed. Please try again.');
    btn.disabled = false;
    renderCart();
  }
});

renderCart();
