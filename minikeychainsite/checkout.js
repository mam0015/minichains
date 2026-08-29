const products = window.MINI_PRODUCTS || [];
const money = v => `A$${Number(v || 0).toFixed(2)}`;

const PROMOS_KEY = 'mini-issued-promos-v2';
const ORDERS_KEY = 'mini-orders-v2';
const CART_KEY = 'mini-keychain-cart-v2';
const CASH_DISCOUNT_PERCENT = 5;

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

function cartTotals() {
  const rows = cartRows();
  const sub = round2(rows.reduce((s, r) => s + r.p.price * r.qty, 0));
  const promoPct = promoPercent();

  let promoDiscount = 0;
  let cashDiscount = 0;
  let cashBase = sub;
  let total = sub;

  if (paymentMethod === 'card') {
    // Card / online: listed price, then prize/promo discount only.
    promoDiscount = round2(sub * (promoPct / 100));
    total = round2(Math.max(0, sub - promoDiscount));
  } else {
    // Cash rule:
    // 1) calculate the full basket subtotal including quantities
    // 2) apply the 5% cash discount to the WHOLE basket
    // 3) apply any prize/promo discount
    // 4) round the final cash amount DOWN to the nearest whole dollar
    const afterCashDiscount = round2(sub * (1 - CASH_DISCOUNT_PERCENT / 100));
    cashDiscount = round2(sub - afterCashDiscount);

    promoDiscount = round2(afterCashDiscount * (promoPct / 100));
    cashBase = round2(Math.max(0, afterCashDiscount - promoDiscount));

    total = Math.max(0, Math.floor(cashBase));
  }

  return {
    sub,
    promoPct,
    promoDiscount,
    cashDiscountPercent: paymentMethod === 'cash' ? CASH_DISCOUNT_PERCENT : 0,
    cashDiscount,
    cashBase,
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
        <p>${money(p.price)} each</p>

        <div class="qty-control" aria-label="Quantity for ${p.name}">
          <button type="button" class="qty-btn" data-qty-minus="${p.id}" aria-label="Decrease ${p.name} quantity">−</button>
          <span class="qty-number">${qty}</span>
          <button type="button" class="qty-btn" data-qty-plus="${p.id}" aria-label="Increase ${p.name} quantity">+</button>
        </div>
      </div>
      <div class="cart-item-side">
        <strong>${money(p.price * qty)}</strong>
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
  cashRow.hidden = paymentMethod !== 'cash';
  document.querySelector('#cartCashDiscount').textContent = `−${money(t.cashDiscount)}`;

  const roundingRow = document.querySelector('#cashRoundingRow');
  const roundingAmount = paymentMethod === 'cash' ? round2(t.cashBase - t.total) : 0;
  roundingRow.hidden = !(paymentMethod === 'cash' && roundingAmount > 0);
  document.querySelector('#cashRounding').textContent = `−${money(roundingAmount)}`;

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
  checkoutBtn.disabled = !qty;
  checkoutBtn.textContent =
    paymentMethod === 'cash' ? `Create cash order · ${money(t.total)}` : `Pay securely with Square · ${money(t.total)}`;

  const note = document.querySelector('#checkoutNote');
  const spinText = qty >= 3
    ? 'This order unlocks one Spin & Win after payment is confirmed.'
    : qty ? `Add ${3 - qty} more item${3 - qty === 1 ? '' : 's'} to unlock one Spin & Win.` : '';

  if (paymentMethod === 'cash') {
    const discountText = activePromo
      ? `Cash 5% + promo ${t.promoPct}% off before cash rounding.`
      : 'Cash gets 5% off the full basket, then the final amount is rounded down to a whole dollar.';
    note.textContent = `${discountText} ${spinText}`;
  } else {
    note.textContent = `Card/online payment uses Square. ${spinText}`;
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
    message.textContent = `Free prize applied: ${p?.name || 'keychain'}.`;
  } else {
    message.textContent = `${promo.percent}% discount applied.${paymentMethod === 'cash' ? ' Cash whole-dollar pricing is also active.' : ''}`;
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
    freePrizeProductId: activePromo?.type === 'free' ? activePromo.freeProductId : null,
    cashDiscountPercent: t.cashDiscountPercent,
    cashDiscount: t.cashDiscount,
    cashBase: t.cashBase,
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
      await submitSurvey(order.id, 'cash');
      location.href = `success.html?order=${encodeURIComponent(order.id)}`;
    }
    return;
  }

  // Card/online goes through Square.
  const endpoint = window.MINI_SQUARE?.checkoutEndpoint?.trim();

  if (!endpoint) {
    // Demo-only local order when Square backend is not connected yet.
    const order = saveLocalOrder({ method: 'card', status: 'paid_demo', demo: true });
    if (order) {
      await submitSurvey(order.id, 'card');
      location.href = `success.html?demo=1&order=${encodeURIComponent(order.id)}`;
    }
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
        promoCode: activePromo?.code || null,
        survey: customerSurveyPayload()
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

renderCart();
