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
      { id:'KEY-01', qty:1, price:4.09 },
      { id:'KEY-05', qty:1, price:4.09 },
      { id:'KEY-06', qty:1, price:5.11 }
    ],
    subtotal: 13.29,
    promoCode: null,
    promoPercent: 0,
    promoDiscount: 0,
    cashDiscountPercent: 5,
    cashDiscount: 0.66,
    combinedDiscountPercent: 5,
    beforeCashRounding: 12.63,
    cashRounding: 0.02,
    total: 12.65
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
      `<div class="discount-line"><span>Cash discount · ${order.cashDiscountPercent || 5}%</span><span>−${money(order.cashDiscount)}</span></div>`
    );

    if (Math.abs(Number(order.cashRounding || 0)) >= 0.001) {
      const r = Number(order.cashRounding);
      const sign = r > 0 ? '+' : '−';
      breakdown.push(
        `<div><span>Cash rounding</span><span>${sign}${money(Math.abs(r))}</span></div>`
      );
    }

    if (Number(order.combinedDiscountPercent || 0) > 0) {
      breakdown.push(
        `<div class="combined-discount"><span>Total discount rate</span><span>${order.combinedDiscountPercent}%</span></div>`
      );
    }
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
  const announcementStatus = document.querySelector('#announcementStatus');
  const cashCard = document.querySelector('#cashPaymentCard');

  paymentBadge.textContent = method === 'cash' ? 'CASH' : 'CARD / ONLINE';

  if (method === 'cash' && !isPaid()) {
    statusIcon.textContent = 'A$';
    statusEyebrow.textContent = 'CASH SELECTED';
    statusTitle.textContent = 'Cash payment is due.';
    statusLead.innerHTML =
      `Collect <strong>${money(order.total)}</strong> in cash, then tap <strong>Cash received</strong>. After that, this page becomes the paid confirmation and the Spin & Win unlocks if the order has 3+ items.`;
    announcementStatus.textContent = 'Cash payment due';
    cashCard.hidden = false;
    document.querySelector('#cashDueAmount').textContent = money(order.total);
  } else {
    statusIcon.textContent = '✓';
    statusEyebrow.textContent = 'PAYMENT COMPLETE';
    statusTitle.textContent = 'You’re all paid.';
    statusLead.innerHTML =
      `Your order is ready for the mini team. <strong>Talk to us and show this page</strong> so we can give you your keychains.`;
    announcementStatus.textContent = 'Payment confirmed';
    cashCard.hidden = true;
  }

  renderOrderBreakdown();
}

const wheelSection = document.querySelector('#wheelSection');
const spinBtn = document.querySelector('#spinBtn');
const wheel = document.querySelector('#prizeWheel');
const wheelCenterText = document.querySelector('#wheelCenterText');
const spinStatus = document.querySelector('#spinStatus');
const result = document.querySelector('#prizeResult');

const segments = [
  { key:'empty-a', label:'No prize', type:'empty', weight:25, start:0, end:25 },
  { key:'off-5', label:'5% off', type:'discount', percent:5, weight:12, start:25, end:37 },
  { key:'empty-b', label:'No prize', type:'empty', weight:20, start:37, end:57 },
  { key:'free', label:'Free item', type:'free', weight:10, start:57, end:67 },
  { key:'empty-c', label:'No prize', type:'empty', weight:20, start:67, end:87 },
  { key:'off-10', label:'10% off', type:'discount', percent:10, weight:8, start:87, end:95 },
  { key:'off-20', label:'20% off', type:'discount', percent:20, weight:5, start:95, end:100 }
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
  const n = cryptoFloat() * 100;
  return segments.find(s => n >= s.start && n < s.end) || segments[0];
}

function targetRotation(seg) {
  const centerPercent = (seg.start + seg.end) / 2;
  const centerDeg = centerPercent * 3.6;
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
  return code;
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
        : 'Your order is still confirmed. There are three no-prize sections so the wheel does not hand out prizes to half the school.';
    wheelCenterText.textContent = 'NEXT TIME';
  }

  spinBtn.disabled = true;
  spinBtn.textContent = 'Spin already used';
  spinStatus.textContent = 'This paid order has already used its one spin.';
}

function renderWheelState() {
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
    'Because this paid order contains at least 3 items, you get one random spin. One spin per paid order.';

  const existing = getSpin();
  if (existing) {
    const seg = segments.find(s => s.key === existing.segmentKey) || segments[0];
    wheel.style.transform = `rotate(${targetRotation(seg)}deg)`;
    showResult(existing);
  } else {
    spinBtn.disabled = false;
    spinBtn.textContent = 'Spin the wheel';
    spinStatus.textContent = 'Your result is saved to this order after spinning.';
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

spinBtn.addEventListener('click', () => {
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
  }

  saveSpin(spin);
  wheel.style.transform = `rotate(${targetRotation(seg)}deg)`;

  setTimeout(() => {
    showResult(spin);
    result.scrollIntoView({ behavior:'smooth', block:'center' });
  }, 5350);
});

document.querySelector('#copyCode').addEventListener('click', async () => {
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
