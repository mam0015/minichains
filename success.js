const products = window.MINI_PRODUCTS || [];
const money = v => `A$${Number(v || 0).toFixed(2)}`;

const params = new URLSearchParams(location.search);
const orderId = params.get('order') || localStorage.getItem('mini-last-order-id');
const isDemo = params.get('demo') === '1';

const ORDERS_KEY = 'mini-orders-v2';
const SPINS_KEY = 'mini-spins-v2';
const PROMOS_KEY = 'mini-issued-promos-v2';

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
      { id:'KEY-01', qty:1, price:5.11 },
      { id:'KEY-03', qty:1, price:4.09 },
      { id:'KEY-04', qty:1, price:4.09 }
    ],
    subtotal: 13.29,
    promoCode: null,
    promoPercent: 0,
    promoDiscount: 0,
    cashDiscountPercent: 5,
    cashDiscount: 3.29,
    cashBase: 10.00,
    total: 10.00
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

const freePrizeId = order.freePrizeProductId || null;
if (freePrizeId) {
  const p = products.find(x => x.id === freePrizeId);
  const box = document.querySelector('#receiptPrize');
  if (box && p) {
    box.hidden = false;
    document.querySelector('#receiptPrizeName').textContent = p.name;
  }
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

  if (Number(order.promoPercent || 0) > 0) {
    breakdown.push(
      `<div class="discount-line"><span>Promo discount · ${order.promoPercent}%${order.promoCode ? ` · ${order.promoCode}` : ''}</span><span>−${money(order.promoDiscount)}</span></div>`
    );
  }

  if (order.paymentMethod === 'cash') {
    breakdown.push(
      `<div class="discount-line"><span>Cash saving · 5% per item, rounded down</span><span>−${money(order.cashDiscount)}</span></div>`
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
      `Your order is ready for the mini team. <strong>Talk to us and show this page</strong> so we can give you your keychains.`;
  };

  if (method === 'cash') {
    if (isPaid()) {
      paidCopy();
    } else {
      statusIcon.textContent = 'A$';
      statusEyebrow.textContent = 'CASH SELECTED';
      statusTitle.textContent = 'Cash payment is due.';
      statusLead.innerHTML =
        `Collect <strong>${money(order.total)}</strong> in cash, then tap <strong>Cash received</strong>. After that, this page becomes the paid confirmation and the Spin & Win unlocks if the order has 3+ items.`;
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
        renderWheelState();
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

const wheelSection = document.querySelector('#wheelSection');
const spinBtn = document.querySelector('#spinBtn');
const wheel = document.querySelector('#prizeWheel');
const wheelCenterText = document.querySelector('#wheelCenterText');
const spinStatus = document.querySelector('#spinStatus');
const result = document.querySelector('#prizeResult');

// Kept in sync with app.js's entrySegments (same 5-empty-slice layout,
// same total odds) even though this wheel's markup isn't wired into
// success.html yet — see the note left for the user about that.
const segments = [
  { key:'empty-a', label:'Empty', type:'empty', weight:13, visualIndex:0 },
  { key:'off-5', label:'5% off', type:'discount', percent:5, weight:12, visualIndex:1 },
  { key:'empty-b', label:'Empty', type:'empty', weight:13, visualIndex:2 },
  { key:'free', label:'Free keychain', type:'free', weight:10, visualIndex:3 },
  { key:'empty-c', label:'Empty', type:'empty', weight:13, visualIndex:4 },
  { key:'off-10', label:'10% off', type:'discount', percent:10, weight:8, visualIndex:5 },
  { key:'empty-d', label:'Empty', type:'empty', weight:13, visualIndex:6 },
  { key:'off-20', label:'20% off', type:'discount', percent:20, weight:5, visualIndex:7 },
  { key:'empty-e', label:'Empty', type:'empty', weight:13, visualIndex:8 }
];

function cryptoFloat() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}

function randomCode(percent) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint32Array(6);
  crypto.getRandomValues(a);
  const tail = [...a].map(n => chars[n % chars.length]).join('');
  return `MINI${percent}-${tail}`;
}

function randomProduct() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return products[a[0] % products.length];
}

function chooseSegment() {
  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
  let n = cryptoFloat() * totalWeight;

  for (const seg of segments) {
    if (n < seg.weight) return seg;
    n -= seg.weight;
  }
  return segments[0];
}

function targetRotation(seg) {
  const visualSlice = 360 / segments.length;
  const centerDeg = (seg.visualIndex * visualSlice) + (visualSlice / 2);
  return 360 * 7 + (360 - centerDeg);
}

function toast(msg) {
  const t = document.querySelector('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window.__t);
  window.__t = setTimeout(() => t.classList.remove('show'), 1600);
}

function saveSpin(spin) {
  const spins = read(SPINS_KEY, []).filter(s => s.orderId !== order.id);
  spins.push(spin);
  write(SPINS_KEY, spins);
}

function getSpin() {
  return read(SPINS_KEY, []).find(s => s.orderId === order.id);
}

function issuePromo(percent, orderId) {
  const code = randomCode(percent);
  const promos = read(PROMOS_KEY, []);
  promos.push({
    code,
    percent,
    orderId,
    used: false,
    createdAt: new Date().toISOString()
  });
  write(PROMOS_KEY, promos);
  reportPrizeToServer({ code, type: 'discount', percent });
  return code;
}

// Same server-side record as app.js's entry spin — see reportPrizeToServer
// there for why this matters for card redemption.
function reportPrizeToServer(prize) {
  const endpoint = window.MINI_SQUARE?.recordPrizeEndpoint?.trim();
  if (!endpoint) return;
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: prize.code,
      type: prize.type,
      percent: prize.percent || 0,
      freeProductId: prize.freeProductId || null
    })
  }).catch(() => {});
}

function rewardStackText(spin) {
  if (order.paymentMethod !== 'cash' || spin.type !== 'discount') return '';
  const cashPct = Number(order.cashDiscountPercent || 5);
  const totalRewardPct = cashPct + Number(spin.percent || 0);
  return ` You already received ${cashPct}% off for paying cash, and you also won a ${spin.percent}% one-time code for your next order. That is ${totalRewardPct}% in combined reward percentages across this order and your next one.`;
}

function showResult(spin) {
  result.hidden = false;

  const title = document.querySelector('#resultTitle');
  const text = document.querySelector('#resultText');
  const codeBox = document.querySelector('#promoCodeBox');
  const freeBox = document.querySelector('#freeItemBox');

  codeBox.hidden = true;
  freeBox.hidden = true;

  if (spin.type === 'discount') {
    title.textContent = `You won ${spin.percent}% off.`;
    text.textContent =
      `Your one-time code is ready for a future mini order.${rewardStackText(spin)}`;
    document.querySelector('#promoCode').textContent = spin.code;
    codeBox.hidden = false;
    wheelCenterText.textContent = `${spin.percent}% OFF`;
  } else if (spin.type === 'free') {
    const p = products.find(x => x.id === spin.freeProductId) || products[0];
    title.textContent = 'You won a free keychain.';
    text.textContent = `Your random free item is ${p.name}. Show this result to us when you collect your order.`;
    const im = document.querySelector('#freeItemImage');
    im.src = p.image;
    im.onerror = () => {
      im.onerror = null;
      im.src = p.fallback || 'assets/images/smiley.svg';
    };
    document.querySelector('#freeItemName').textContent = p.name;
    freeBox.hidden = false;
    wheelCenterText.textContent = 'FREE!';
  } else {
    title.textContent = 'No prize this time.';
    text.textContent =
      order.paymentMethod === 'cash'
        ? `No wheel prize this time, but your ${order.cashDiscountPercent || 5}% cash discount was already applied to this order.`
        : 'No prize this time. Your order is still confirmed.';
    wheelCenterText.textContent = 'NEXT TIME';
  }

  spinBtn.disabled = true;
  spinBtn.textContent = 'Spin already used';
  spinStatus.textContent = 'This order has already used its spin.';
}

function renderWheelState() {
  if (!wheelSection) return;
  wheelSection.classList.remove('locked-wheel');

  if (!isPaid()) {
    wheelSection.classList.add('locked-wheel');
    document.querySelector('#wheelTitle').textContent = 'Spin unlocks after payment.';
    document.querySelector('#wheelIntro').textContent =
      order.paymentMethod === 'cash'
        ? 'Receive the cash and confirm it above. If this order has 3 or more items, the wheel will unlock immediately.'
        : 'Payment must be confirmed before the wheel can be used.';
    return;
  }

  if (itemQty < 3) {
    wheelSection.classList.add('locked-wheel');
    document.querySelector('#wheelTitle').textContent = 'Spin not unlocked on this order.';
    document.querySelector('#wheelIntro').textContent =
      `This order has ${itemQty} item${itemQty === 1 ? '' : 's'}. Buy 3 or more items in one paid order to unlock one spin.`;
    return;
  }

  document.querySelector('#wheelTitle').textContent = 'Your spin is unlocked.';
  document.querySelector('#wheelIntro').textContent =
    'You might win a free keychain.';

  const existing = getSpin();
  if (existing) {
    const seg = segments.find(s => s.key === existing.segmentKey) || segments[0];
    wheel.style.transform = `rotate(${targetRotation(seg)}deg)`;
    showResult(existing);
  } else {
    spinBtn.disabled = false;
    spinBtn.textContent = 'Spin the wheel';
    spinStatus.textContent = 'Tap SPIN and see what you get.';
  }
}

const confirmCashBtn = document.querySelector('#confirmCashBtn');
confirmCashBtn.addEventListener('click', () => {
  if (order.paymentMethod !== 'cash' || isPaid()) return;

  order.paymentStatus = 'paid';
  order.paidAt = new Date().toISOString();
  persistOrder();

  renderPaymentState();
  renderWheelState();
  toast('Cash marked as received');
  document.querySelector('#statusCard').scrollIntoView({ behavior:'smooth', block:'start' });
});

spinBtn?.addEventListener('click', () => {
  if (!isPaid() || itemQty < 3 || getSpin()) return;

  spinBtn.disabled = true;
  spinBtn.textContent = 'Spinning…';
  spinStatus.textContent = 'Random draw in progress…';

  const seg = chooseSegment();
  const spin = {
    orderId: order.id,
    segmentKey: seg.key,
    type: seg.type,
    createdAt: new Date().toISOString()
  };

  if (seg.type === 'discount') {
    spin.percent = seg.percent;
    spin.code = issuePromo(seg.percent, order.id);
  }
  if (seg.type === 'free') {
    spin.freeProductId = randomProduct().id;
    spin.code = randomCode('FREE');
    const promos = read(PROMOS_KEY, []);
    promos.push({
      code: spin.code,
      percent: 0,
      type: 'free',
      freeProductId: spin.freeProductId,
      orderId: order.id,
      used: false,
      createdAt: new Date().toISOString()
    });
    write(PROMOS_KEY, promos);
    reportPrizeToServer({ code: spin.code, type: 'free', freeProductId: spin.freeProductId });
  }

  saveSpin(spin);
  wheel.style.transform = `rotate(${targetRotation(seg)}deg)`;

  setTimeout(() => {
    showResult(spin);
    result.scrollIntoView({ behavior:'smooth', block:'center' });
  }, 5350);
});

document.querySelector('#copyCode')?.addEventListener('click', async () => {
  const code = document.querySelector('#promoCode').textContent;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    toast('Code copied');
  } catch {
    toast(code);
  }
});

renderPaymentState();
renderWheelState();
renderSurveyCard();
verifyCardPaymentIfNeeded();

window.addEventListener('DOMContentLoaded',()=>{document.querySelector('#wheelSection')?.setAttribute('hidden','');});
