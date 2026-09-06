// Products with active:false (e.g. a not-yet-identified pending model) are
// kept in products.js for reference but never shown or orderable.
const products = (window.MINI_PRODUCTS || []).filter(p => p.active !== false);
const money = v => `A$${Number(v || 0).toFixed(2)}`;

const PROMOS_KEY = 'mini-issued-promos-v2';
const ORDERS_KEY = 'mini-orders-v2';
const CART_KEY = 'mini-keychain-cart-v2';
const CARD_SURCHARGE_PERCENT = 5;

let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
let activePromo = null;
let paymentMethod = 'card';
let loyaltyStatus = null; // last result from loyalty-status for the current username input
let loyaltyChecking = false;

// Live stock + price — same pattern as app.js: both start from products.js's
// bundled numbers and are replaced by the real live numbers once
// stock-status resolves. These are only ever a soft, UX-level cap/preview
// here — the server (create-square-checkout for card, confirm-cash-order
// for cash) is the real enforcement and the real price calculator.
let liveStock = {};
let livePrice = {};
function remainingStock(p) {
  if (Object.prototype.hasOwnProperty.call(liveStock, p.id)) return liveStock[p.id];
  return typeof p.stock === 'number' ? p.stock : Infinity;
}
function currentPrice(p) {
  return typeof livePrice[p.id] === 'number' ? livePrice[p.id] : p.price;
}
async function refreshStockStatus() {
  const endpoint = window.MINI_SQUARE?.stockStatusEndpoint?.trim();
  if (!endpoint) return;
  try {
    const res = await fetch(endpoint);
    const data = await res.json().catch(() => null);
    if (data && data.products && typeof data.products === 'object') {
      const stock = {}, price = {};
      for (const [id, row] of Object.entries(data.products)) {
        if (typeof row.available === 'number') stock[id] = row.available;
        if (typeof row.priceCents === 'number') price[id] = round2(row.priceCents / 100);
      }
      liveStock = stock;
      livePrice = price;
      renderCart();
    }
  } catch {
    // Offline or not deployed yet — bundled numbers in products.js keep working as a fallback.
  }
}

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

// currentPrice(p) is the cash (base) price — live from the server when
// available, else the bundled products.js fallback. Card/online adds a 5%
// surcharge per unit to cover the Square processing + payment-link cost.
function cardUnitPrice(p) {
  return round2(currentPrice(p) * (1 + CARD_SURCHARGE_PERCENT / 100));
}
function unitPrice(p) {
  return paymentMethod === 'card' ? cardUnitPrice(p) : currentPrice(p);
}

// MiniChains Rewards — this is a CLIENT-SIDE PREVIEW ONLY, driven by the
// read-only loyalty-status check. The server (create-square-checkout)
// independently re-checks the account and is the only thing that actually
// applies the discount / free item to a real charge — a customer editing
// this in devtools changes nothing about what they're billed.
function loyaltyRewardType() {
  if (paymentMethod !== 'card' || !loyaltyStatus) return null;
  if (loyaltyStatus.found && !loyaltyStatus.ownerMatch) return null;
  if (!loyaltyStatus.wouldAdvanceToday) return null;
  return loyaltyStatus.nextRewardType || null;
}
function loyaltyDiscountPct() {
  return loyaltyRewardType() === 'discount10' ? 10 : 0;
}

function cartTotals() {
  const rows = cartRows();
  const cashSub = round2(rows.reduce((s, r) => s + currentPrice(r.p) * r.qty, 0));
  const cardSub = round2(rows.reduce((s, r) => s + cardUnitPrice(r.p) * r.qty, 0));
  // Spin & Win % discount codes apply to Card/online only. A free-item
  // prize is unaffected by this: it has no percent value and is handled
  // separately either way.
  const promoPct = paymentMethod === 'card' ? promoPercent() : 0;
  const loyaltyPct = loyaltyDiscountPct();

  const sub = paymentMethod === 'card' ? cardSub : cashSub;
  let promoDiscount = 0;
  let loyaltyDiscount = 0;
  let total = cashSub;

  if (paymentMethod === 'card') {
    promoDiscount = round2(cardSub * (promoPct / 100));
    loyaltyDiscount = round2(cardSub * (loyaltyPct / 100));
    total = round2(Math.max(0, cardSub - promoDiscount - loyaltyDiscount));
  }

  return {
    sub,
    cashSub,
    cardSub,
    promoPct,
    promoDiscount,
    loyaltyPct,
    loyaltyDiscount,
    loyaltyFreeKeychain: loyaltyRewardType() === 'free_keychain',
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

  if (delta > 0) {
    const p = products.find(x => x.id === id);
    const remaining = p ? remainingStock(p) : Infinity;
    if (row.qty >= remaining) {
      toastMsg(remaining <= 0 ? `${p.name} is sold out` : `Only ${remaining} of ${p.name} left`);
      return;
    }
  }

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

  document.querySelector('#cartItems').innerHTML = rows.map(({ p, qty }) => {
    const remaining = remainingStock(p);
    const atMax = qty >= remaining;
    const stockNote = remaining !== Infinity
      ? `<small class="cart-stock-note">${remaining <= 0 ? 'Sold out' : `Only ${remaining} left`}</small>`
      : '';
    return `
    <div class="cart-item">
      <img src="${p.image}" onerror="this.onerror=null;this.src='${p.fallback || 'assets/images/smiley.svg'}'" alt="${p.name}">
      <div class="cart-item-main">
        <h4>${p.name}</h4>
        <p>${money(unitPrice(p))} each</p>
        ${stockNote}

        <div class="qty-control" aria-label="Quantity for ${p.name}">
          <button type="button" class="qty-btn" data-qty-minus="${p.id}" aria-label="Decrease ${p.name} quantity">−</button>
          <span class="qty-number">${qty}</span>
          <button type="button" class="qty-btn" data-qty-plus="${p.id}" aria-label="Increase ${p.name} quantity"${atMax ? ' disabled' : ''}>+</button>
        </div>
      </div>
      <div class="cart-item-side">
        <strong>${money(unitPrice(p) * qty)}</strong>
        <button class="remove-item" type="button" data-remove="${p.id}" aria-label="Remove ${p.name}">×</button>
      </div>
    </div>`;
  }).join('');

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

  const loyaltyRow = document.querySelector('#cartLoyaltyDiscountRow');
  loyaltyRow.hidden = !(t.loyaltyPct > 0 && t.loyaltyDiscount > 0);
  document.querySelector('#cartLoyaltyDiscount').textContent = `−${money(t.loyaltyDiscount)}`;

  document.querySelector('#cartLoyaltyFreeRow').hidden = !t.loyaltyFreeKeychain;

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

  renderRewardsUI();
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

// ---------- MiniChains Rewards ----------
const USERNAME_RE = /^[a-zA-Z0-9]{3,20}$/;
const LOYALTY_SECRETS_KEY = 'mini-loyalty-secrets-v1';
// Mirrors the server's normalizeUsername() exactly, so the secret saved
// under a given username is always looked up under the same key.
function normalizeUsernameClient(raw) {
  return raw.trim().toLowerCase();
}

// A username alone doesn't prove ownership — a per-username secret, minted
// server-side the first time each username is used and kept only in this
// browser, does. Without the matching secret, someone else's Rewards
// Username can be looked up (read-only) but never advanced or redeemed —
// see create-square-checkout's ownership check.
function getLoyaltySecret(username) {
  return read(LOYALTY_SECRETS_KEY, {})[username] || '';
}
function saveLoyaltySecret(username, secret) {
  if (!username || !secret) return;
  const map = read(LOYALTY_SECRETS_KEY, {});
  map[username] = secret;
  write(LOYALTY_SECRETS_KEY, map);
}

function renderRewardsUI() {
  const statusBox = document.querySelector('#rewardsStatus');
  const dotsBox = document.querySelector('#rewardsDots');
  const title = document.querySelector('#rewardsStatusTitle');
  const sub = document.querySelector('#rewardsStatusSub');
  const cashNote = document.querySelector('#rewardsCashNote');

  const raw = document.querySelector('#rewardsUsernameInput').value.trim();
  cashNote.hidden = !(raw && paymentMethod === 'cash');

  if (!raw || !loyaltyStatus) {
    statusBox.hidden = true;
    return;
  }
  statusBox.hidden = false;

  const visitsForDots = loyaltyStatus.found ? loyaltyStatus.currentCycleVisits : 0;
  dotsBox.querySelectorAll('span').forEach((dot, i) => dot.classList.toggle('filled', i < visitsForDots));

  if (!loyaltyStatus.found) {
    title.textContent = 'Welcome to MiniChains Rewards!';
    sub.textContent = 'Your first eligible card purchase will start your rewards progress.';
    return;
  }

  if (!loyaltyStatus.ownerMatch) {
    title.textContent = 'Username already in use';
    sub.textContent = 'This Rewards Username is already registered on another device. Use the same device you signed up with, or choose a different username.';
    dotsBox.querySelectorAll('span').forEach(dot => dot.classList.remove('filled'));
    return;
  }

  title.textContent = `Welcome back, ${loyaltyStatus.displayUsername} 👋`;

  if (paymentMethod !== 'card') {
    sub.textContent = `${loyaltyStatus.currentCycleVisits} / 3 visits completed. Pay by card to progress or redeem rewards.`;
    return;
  }

  if (!loyaltyStatus.wouldAdvanceToday) {
    sub.textContent = `${loyaltyStatus.currentCycleVisits} / 3 visits completed. You already have a visit counted today — come back another day to progress.`;
    return;
  }

  if (loyaltyStatus.nextRewardType === 'visit1') {
    sub.textContent = 'This card purchase will start your rewards journey (Visit 1 / 3).';
  } else if (loyaltyStatus.nextRewardType === 'discount10') {
    sub.textContent = '🎉 Visit 2 Reward Unlocked — 10% OFF applied to this order.';
  } else if (loyaltyStatus.nextRewardType === 'free_keychain') {
    sub.textContent = '🎁 Visit 3 Reward Unlocked! You’ve earned a FREE mystery keychain, randomly selected from our range.';
  }
}

let loyaltyDebounce = null;
async function checkLoyaltyStatus() {
  const raw = document.querySelector('#rewardsUsernameInput').value.trim();
  const hint = document.querySelector('#rewardsUsernameHint');

  if (!raw) {
    loyaltyStatus = null;
    hint.textContent = 'e.g. ali123 — letters and numbers, 3–20 characters.';
    hint.style.color = '';
    renderRewardsUI();
    renderCart();
    return;
  }
  if (!USERNAME_RE.test(raw)) {
    loyaltyStatus = null;
    hint.textContent = 'Letters and numbers only, 3–20 characters.';
    hint.style.color = '#a33';
    renderRewardsUI();
    renderCart();
    return;
  }
  hint.textContent = 'e.g. ali123 — letters and numbers, 3–20 characters.';
  hint.style.color = '';

  const endpoint = window.MINI_SQUARE?.loyaltyStatusEndpoint?.trim();
  if (!endpoint) { loyaltyStatus = null; renderRewardsUI(); renderCart(); return; }

  loyaltyChecking = true;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: raw, secret: getLoyaltySecret(normalizeUsernameClient(raw)) })
    });
    const data = await res.json().catch(() => null);
    // Ignore a stale response if the input changed while this was in flight.
    if (document.querySelector('#rewardsUsernameInput').value.trim() !== raw) return;
    loyaltyStatus = (data && !data.error) ? data : null;
  } catch {
    loyaltyStatus = null;
  } finally {
    loyaltyChecking = false;
    renderRewardsUI();
    renderCart();
  }
}

document.querySelector('#rewardsUsernameInput').addEventListener('input', () => {
  clearTimeout(loyaltyDebounce);
  loyaltyDebounce = setTimeout(checkLoyaltyStatus, 500);
});

function customerSurveyPayload() {
  return {
    firstName: (document.querySelector('#surveyFirstName')?.value || '').trim(),
    level: (document.querySelector('#surveyLevel')?.value || '').trim(),
    comment: (document.querySelector('#surveyComment')?.value || '').trim()
  };
}

// Independently submittable — filling this in doesn't require actually
// completing checkout, so it has its own visible Submit button and "done"
// state (same pattern as the post-purchase survey on success.html) rather
// than silently piggy-backing on whatever the customer does next.
function showCheckoutSurveySubmitted(feedback) {
  document.querySelector('#checkoutSurveyForm').hidden = true;
  const done = document.querySelector('#surveyDone');
  done.hidden = false;
  const bits = [feedback.firstName || 'Anonymous'];
  if (feedback.level) bits.push(feedback.level);
  if (feedback.comment) bits.push(`“${feedback.comment}”`);
  document.querySelector('#surveyDoneMeta').textContent = bits.join(' · ');
}

async function submitCheckoutSurveyForm(e) {
  e.preventDefault();
  const payload = customerSurveyPayload();
  if (!payload.firstName && !payload.level && !payload.comment) {
    toastMsg('Fill in at least one field, or just skip it.');
    return;
  }

  const record = {
    id: `FB-${Date.now().toString(36).toUpperCase()}`,
    orderId: null,
    paymentMethod: paymentMethod,
    ...payload,
    createdAt: new Date().toISOString()
  };

  const local = read('mini-feedback-v1', []);
  local.push(record);
  write('mini-feedback-v1', local);

  const btn = document.querySelector('#surveySubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  const endpoint = window.MINI_FEEDBACK?.endpoint?.trim();
  if (endpoint) {
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

  showCheckoutSurveySubmitted(record);
}
document.querySelector('#checkoutSurveyForm')?.addEventListener('submit', submitCheckoutSurveyForm);

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

function saveLocalOrder({ method, status, demo = false, id, loyalty = null }) {
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
    items: rows.map(r => ({ id: r.id, qty: r.qty, price: currentPrice(r.p) })),
    subtotal: t.sub,
    promoCode: activePromo?.code || null,
    promoPercent: t.promoPct,
    promoDiscount: t.promoDiscount,
    freePrizeProductId: activePromo?.type === 'free' ? activePromo.freeProductId : null,
    cardSurchargePercent: t.cardSurchargePercent,
    cardSurcharge: t.cardSurcharge,
    cashSub: t.cashSub,
    cardSub: t.cardSub,
    // Server-confirmed MiniChains Rewards outcome for this order (card only;
    // null for cash, since rewards never apply there). This comes straight
    // from create-square-checkout's response — never computed client-side —
    // because it's the only place that knows which free product was picked.
    rewardsUsername: loyalty?.username || null,
    loyaltyVisitNumber: loyalty?.visitNumber || null,
    loyaltyRewardType: loyalty?.rewardType || null,
    loyaltyDiscountPercent: loyalty?.discountPercent || 0,
    loyaltyDiscountAmount: loyalty?.discountAmount || 0,
    loyaltyFreeProductId: loyalty?.freeProductId || null,
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
  if (typeof track === 'function') track('checkout_started', { paymentMethod, itemCount: cart.length });

  if (typeof hasAcceptedTerms === 'function' && !hasAcceptedTerms()) {
    toastMsg("MiniChains can't process purchases unless the Terms & Conditions are accepted.");
    openTermsModal();
    return;
  }

  const btn = document.querySelector('#checkoutBtn');

  // Cash never leaves the site. It creates a cash order with the exact amount due.
  if (paymentMethod === 'cash') {
    // Soft check against the last-known live stock — catches the case where
    // stock ran out after this page loaded. The real, hard enforcement is
    // confirm-cash-order, called once cash is actually confirmed received
    // (success.html) — not here, since the cash hasn't changed hands yet.
    for (const { p, qty } of cartRows()) {
      const remaining = remainingStock(p);
      if (qty > remaining) {
        toastMsg(remaining <= 0 ? `${p.name} is sold out.` : `Only ${remaining} of ${p.name} left — please lower the quantity.`);
        return;
      }
    }

    const order = saveLocalOrder({ method: 'cash', status: 'cash_due', demo: false });
    if (order) {
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
        rewardsUsername: document.querySelector('#rewardsUsernameInput').value.trim() || null,
        rewardsSecret: getLoyaltySecret(normalizeUsernameClient(document.querySelector('#rewardsUsernameInput').value.trim())),
        survey: customerSurveyPayload(),
        redirectUrl: new URL(`success.html?order=${encodeURIComponent(pendingId)}`, window.location.href).href
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || 'Could not create Square checkout.');

    // The server mints/confirms a per-username ownership secret on every
    // checkout that carries a Rewards Username — save it so future visits
    // from this browser prove ownership instead of just typing the name.
    if (data.loyalty?.username && data.loyalty?.secret) {
      saveLoyaltySecret(data.loyalty.username, data.loyalty.secret);
    }

    // Not "paid" — Square hasn't confirmed anything yet, this only records
    // what was ordered so success.html has something to show while it polls
    // the server (order-status, updated by the square-webhook function) for
    // the real, verified state. The redirect alone is never treated as proof.
    // Loyalty visit counts specifically only ever advance from
    // square-webhook once payment is confirmed — data.loyalty here is just
    // what THIS checkout would be worth, for display.
    saveLocalOrder({ method: 'card', status: 'pending', demo: false, id: data.orderId || pendingId, loyalty: data.loyalty });

    location.href = data.url;
  } catch (err) {
    toastMsg(err.message || 'Checkout failed. Please try again.');
    btn.disabled = false;
    renderCart();
  }
});

renderCart();
refreshStockStatus();
