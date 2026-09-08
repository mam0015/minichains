const products = window.MINI_PRODUCTS || [];
const money = v => `A$${Number(v || 0).toFixed(2)}`;

const params = new URLSearchParams(location.search);
const orderId = params.get('order') || localStorage.getItem('mini-last-order-id');
const isDemo = params.get('demo') === '1';

const ORDERS_KEY = 'mini-orders-v2';

const read = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); }
  catch { return fallback; }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let orders = read(ORDERS_KEY, []);
let order = orders.find(o => o.id === orderId) || null;

// Preview fallback if success.html is opened directly.
if (!order) {
  order = {
    id: 'MINI-PREVIEW',
    demo: true,
    createdAt: new Date().toISOString(),
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    items: [
      { id:'KEY-06', qty:1, price:2.00 },
      { id:'KEY-03', qty:1, price:4.00 },
      { id:'KEY-04', qty:1, price:2.00 }
    ],
    subtotal: 8.00,
    cardSurchargePercent: 0,
    cardSurcharge: 0,
    total: 8.00
  };
}

function persistOrder() {
  const all = read(ORDERS_KEY, []);
  const idx = all.findIndex(o => o.id === order.id);
  if (idx >= 0) all[idx] = order;
  else all.push(order);
  write(ORDERS_KEY, all);
}

function isPaid() {
  return order.paymentStatus === 'paid' || order.paymentStatus === 'paid_demo';
}

const demoWarning = document.querySelector('#demoWarning');
if (isDemo || order.demo) demoWarning.hidden = false;

const detailRows = order.items
  .map(row => ({ ...row, product: products.find(p => p.id === row.id) }))
  .filter(x => x.product);

const itemQty = detailRows.reduce((sum, r) => sum + Number(r.qty || 0), 0);

const loyaltyFreeId = order.loyaltyFreeProductId || null;
if (loyaltyFreeId) {
  const p = products.find(x => x.id === loyaltyFreeId);
  const box = document.querySelector('#receiptLoyaltyFree');
  if (box && p) {
    box.hidden = false;
    document.querySelector('#receiptLoyaltyFreeName').textContent = p.name;
  }
}

const rewardsNote = document.querySelector('#rewardsOrderNote');
if (order.rewardsUsername && order.loyaltyRewardType) {
  rewardsNote.hidden = false;
  const visit = order.loyaltyVisitNumber;
  rewardsNote.textContent =
    order.loyaltyRewardType === 'discount10'
      ? `🎉 MiniChains Rewards — Visit ${visit}/3 for ${order.rewardsUsername}: 10% off applied.`
    : order.loyaltyRewardType === 'free_keychain'
      ? `🎁 MiniChains Rewards — Visit ${visit}/3 for ${order.rewardsUsername}: free mystery keychain earned. Cycle complete — next purchase starts a new cycle.`
    : order.loyaltyRewardType === 'visit1'
      ? `MiniChains Rewards — Visit ${visit}/3 for ${order.rewardsUsername}. Come back another day for 10% off.`
      : '';
  if (!rewardsNote.textContent) rewardsNote.hidden = true;
}

function findFeedback() {
  return read('mini-feedback-v1', []).find(x => x.orderId === order.id);
}

function showSurveySubmitted(feedback) {
  document.querySelector('#surveyForm').hidden = true;
  const done = document.querySelector('#surveyDone');
  done.hidden = false;
  const bits = [feedback.firstName || 'Anonymous'];
  if (feedback.level) bits.push(feedback.level);
  if (feedback.comment) bits.push(`“${feedback.comment}”`);
  document.querySelector('#surveyDoneMeta').textContent = bits.join(' · ');
}

function renderSurveyCard() {
  const card = document.querySelector('#surveyCard');
  if (!card || order.id === 'MINI-PREVIEW') return;
  card.hidden = false;

  const feedback = findFeedback();
  if (feedback) showSurveySubmitted(feedback);
}

async function submitSurveyForm(e) {
  e.preventDefault();
  const payload = {
    firstName: document.querySelector('#surveyFirstName').value.trim(),
    level: document.querySelector('#surveyLevel').value.trim(),
    comment: document.querySelector('#surveyComment').value.trim()
  };
  if (!payload.firstName && !payload.level && !payload.comment) {
    toast('Fill in at least one field, or just skip it.');
    return;
  }

  const record = {
    id: `FB-${Date.now().toString(36).toUpperCase()}`,
    orderId: order.id,
    paymentMethod: order.paymentMethod,
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

  showSurveySubmitted(record);
}

document.querySelector('#surveyForm')?.addEventListener('submit', submitSurveyForm);


document.querySelector('#orderRef').textContent = order.id;
document.querySelector('#successItems').innerHTML = detailRows.map(({ product:p, qty, price }) => `
  <article class="success-item">
    <img src="${p.image}" onerror="this.onerror=null;this.src='${p.fallback || 'assets/images/smiley.svg'}'" alt="${p.name}">
    <div><h3>${p.name}</h3><p>MODEL ${p.id} · Qty ${qty}</p></div>
    <strong>${money((price ?? p.price) * qty)}</strong>
  </article>`).join('');

function renderOrderBreakdown() {
  const breakdown = [];
  breakdown.push(`<div><span>Subtotal</span><span>${money(order.subtotal)}</span></div>`);

  if (Number(order.loyaltyDiscountPercent || 0) > 0) {
    breakdown.push(
      `<div class="discount-line"><span>🎉 MiniChains Rewards · ${order.loyaltyDiscountPercent}%</span><span>−${money(order.loyaltyDiscountAmount)}</span></div>`
    );
  }

  if (order.paymentMethod === 'card' && Number(order.cardSurcharge || 0) > 0) {
    breakdown.push(
      `<div><span>Card surcharge · ${order.cardSurchargePercent || 5}%</span><span>+${money(order.cardSurcharge)}</span></div>`
    );
  }

  const totalLabel = isPaid()
    ? 'Paid total'
    : order.paymentMethod === 'cash'
      ? 'Cash due'
      : 'Order total';

  breakdown.push(`<div><span>${totalLabel}</span><span>${money(order.total)}</span></div>`);
  document.querySelector('#orderBreakdown').innerHTML = breakdown.join('');

  document.querySelector('#orderTotal').textContent = money(order.total);
  document.querySelector('#orderPaymentMethod').textContent =
    order.paymentMethod === 'cash' ? 'CASH' : 'CARD / ONLINE';
}

function renderPaymentState() {
  const method = order.paymentMethod === 'cash' ? 'cash' : 'card';

  const statusIcon = document.querySelector('#statusIcon');
  const statusEyebrow = document.querySelector('#statusEyebrow');
  const statusTitle = document.querySelector('#statusTitle');
  const statusLead = document.querySelector('#statusLead');
  const paymentBadge = document.querySelector('#paymentMethodBadge');
  const cashCard = document.querySelector('#cashPaymentCard');

  paymentBadge.textContent = method === 'cash' ? 'CASH' : 'CARD / ONLINE';
  cashCard.hidden = true;

  const paidCopy = () => {
    statusIcon.textContent = '✓';
    statusEyebrow.textContent = 'PAYMENT COMPLETE';
    statusTitle.textContent = 'You’re all paid.';
    statusLead.innerHTML =
      `Your order is ready for the MiniChains team. <strong>Talk to us and show this page</strong> so we can give you your keychains.`;
  };

  if (method === 'cash') {
    if (isPaid()) {
      paidCopy();
    } else {
      statusIcon.textContent = 'A$';
      statusEyebrow.textContent = 'CASH SELECTED';
      statusTitle.textContent = 'Cash payment is due.';
      statusLead.innerHTML =
        `Collect <strong>${money(order.total)}</strong> in cash, then tap <strong>Cash received</strong>. After that, this page becomes the paid confirmation.`;
      cashCard.hidden = false;
      document.querySelector('#cashDueAmount').textContent = money(order.total);
    }
  } else if (order.paymentStatus === 'unverified') {
    // Card, and the server never confirmed it — never shown as paid.
    statusIcon.textContent = '!';
    statusEyebrow.textContent = 'UNABLE TO VERIFY YET';
    statusTitle.textContent = 'We couldn’t confirm this automatically.';
    statusLead.innerHTML =
      `If you completed payment on Square, keep your <strong>order reference</strong> below and refresh this page in a minute, or show it to our team so we can check manually.`;
  } else if (isPaid()) {
    paidCopy();
  } else {
    // Card, redirected back from Square, waiting on order-status/the webhook.
    statusIcon.textContent = '⏳';
    statusEyebrow.textContent = 'CONFIRMING PAYMENT';
    statusTitle.textContent = 'Confirming your payment…';
    statusLead.innerHTML =
      `We’re checking with Square that your payment went through. This usually takes just a few seconds.`;
  }

  renderOrderBreakdown();
}

async function verifyCardPaymentIfNeeded() {
  if (order.id === 'MINI-PREVIEW') return;
  if (order.paymentMethod !== 'card' || isPaid()) return;

  const endpoint = window.MINI_SQUARE?.orderStatusEndpoint?.trim();
  if (!endpoint) {
    order.paymentStatus = 'unverified';
    persistOrder();
    renderPaymentState();
    return;
  }

  const attempts = 8;
  const intervalMs = 2500;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${endpoint}?id=${encodeURIComponent(order.id)}`);
      const data = await res.json().catch(() => null);
      if (data?.found && data.status === 'paid') {
        order.paymentStatus = 'paid';
        order.paidAt = data.paidAt || new Date().toISOString();
        persistOrder();
        renderPaymentState();
        return;
      }
      if (data && data.found === false) break; // no server record — will never resolve
    } catch {
      // network hiccup — just retry
    }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, intervalMs));
  }

  order.paymentStatus = 'unverified';
  persistOrder();
  renderPaymentState();
}

function toast(msg) {
  const t = document.querySelector('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window.__t);
  window.__t = setTimeout(() => t.classList.remove('show'), 1600);
}

// This tap IS the confirmation that cash was actually handed over (see the
// on-page note) — there's no external processor to verify a cash sale the
// way Square's webhook verifies a card one. So this is also the one place
// cash stock gets decremented, mirroring square-webhook's card-side timing:
// only once the sale is actually confirmed, never earlier. If the stock
// call fails for any reason, the cash has still physically changed hands —
// the local paid confirmation must never be blocked or undone by a
// bookkeeping hiccup, so failures here are logged only.
async function confirmCashStock(staffToken) {
  if (order.demo || order.id === 'MINI-PREVIEW') return;
  const endpoint = window.MINI_SQUARE?.confirmCashOrderEndpoint?.trim();
  if (!endpoint) return;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: order.items.map(it => ({ id: it.id, qty: it.qty })), staffToken, orderId: order.id, total: order.total })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.warn('confirm-cash-order:', data.error || res.status);
  } catch (err) {
    console.warn('confirm-cash-order failed; stock not decremented for this sale.', err);
  }
}

// A customer's own device must never be able to mark its own cash order
// paid — that's the whole point of "show us this page" as proof. The PIN
// gate below is the real boundary: nothing here (marking paid locally,
// decrementing stock) happens until a valid staff session exists, either
// already stored or just obtained.
function getValidStaffToken() {
  const token = localStorage.getItem('mini-staff-token');
  const expiresAt = Number(localStorage.getItem('mini-staff-token-expires') || 0);
  return (token && Date.now() < expiresAt) ? token : null;
}

async function completeCashConfirmation(staffToken) {
  confirmCashBtn.disabled = true;

  order.paymentStatus = 'paid';
  order.paidAt = new Date().toISOString();
  persistOrder();

  renderPaymentState();
  toast('Cash marked as received');
  document.querySelector('#statusCard').scrollIntoView({ behavior:'smooth', block:'start' });

  await confirmCashStock(staffToken);
}

const confirmCashBtn = document.querySelector('#confirmCashBtn');
confirmCashBtn.addEventListener('click', () => {
  if (order.paymentMethod !== 'cash' || isPaid()) return;

  const token = getValidStaffToken();
  if (token) {
    completeCashConfirmation(token);
    return;
  }
  document.querySelector('#staffPinBox').hidden = false;
  document.querySelector('#staffPinInput').focus();
});

document.querySelector('#staffPinSubmit').addEventListener('click', async () => {
  const pinInput = document.querySelector('#staffPinInput');
  const submitBtn = document.querySelector('#staffPinSubmit');
  const errorEl = document.querySelector('#staffPinError');
  const pin = pinInput.value.trim();

  errorEl.hidden = true;
  if (!pin) return;

  const endpoint = window.MINI_SQUARE?.staffLoginEndpoint?.trim();
  if (!endpoint) {
    errorEl.textContent = 'Staff login isn’t available right now.';
    errorEl.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Checking…';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.token) {
      errorEl.textContent = 'Incorrect PIN — try again.';
      errorEl.hidden = false;
      pinInput.value = '';
      pinInput.focus();
      return;
    }

    localStorage.setItem('mini-staff-token', data.token);
    localStorage.setItem('mini-staff-token-expires', String(Date.parse(data.expiresAt) || 0));
    document.querySelector('#staffPinBox').hidden = true;
    pinInput.value = '';

    await completeCashConfirmation(data.token);
  } catch {
    errorEl.textContent = 'Network error — try again.';
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirm';
  }
});

document.querySelector('#staffPinInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.querySelector('#staffPinSubmit').click();
  }
});

renderPaymentState();
renderSurveyCard();
verifyCardPaymentIfNeeded();
