// MiniChains — Daily Auction. Bidding is always free; this file never
// calls Square except via auctionCheckout(), which only runs after the
// server confirms this exact browser is the auction's winning bidder.
// The countdown shown here is cosmetic — auction-bid re-validates timing
// server-side on every bid, using its own clock, not this one.
//
// Temporarily disabled for launch (customer-facing only) — backend,
// database and admin auction code are untouched. Flip this back to true
// once Auction is ready to go live; nothing else needs to change here.
const AUCTION_ENABLED = false;
const money2 = v => `A$${Number(v || 0).toFixed(2)}`;

let auctions = [];
let activeBidAuction = null;
let countdownTimer = null;

async function refreshAuctions() {
  if (!AUCTION_ENABLED) return;
  const endpoint = window.MINI_SQUARE?.auctionStatusEndpoint?.trim();
  if (!endpoint) return;
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.auctions)) return;
    auctions = data.auctions;
    const hasVisible = auctions.some(a => a.status === 'active' || a.status === 'scheduled' || a.status === 'ended');
    const tab = document.querySelector('#auctionTab');
    if (tab) tab.hidden = !hasVisible;
    if (typeof categoryMode !== 'undefined' && categoryMode === 'auction') renderAuctionSection();
  } catch {
    // Offline or not deployed yet — the Auction tab just stays hidden.
  }
}

function auctionCountdownText(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Ending…';
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function auctionCard(a) {
  const isOpen = a.status === 'active';
  const currentBid = a.currentHighestBidCents != null ? money2(a.currentHighestBidCents / 100) : `${money2(a.startingBidCents / 100)} (starting)`;
  const nextBid = money2(a.nextMinBidCents / 100);
  const actionHtml = isOpen
    ? `<button class="btn btn-primary" data-auction-bid="${a.id}">Place bid</button>`
    : a.status === 'scheduled'
    ? `<span class="auction-ended-note">Opens ${new Date(a.startsAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span>`
    : a.bidCount
    ? `<span class="auction-ended-note">Auction ended.</span> <button class="btn btn-ghost" data-auction-pay="${a.id}">I won this — pay now</button>`
    : `<span class="auction-ended-note">Auction ended — no bids received.</span>`;

  return `
    <article class="auction-card" data-auction-id="${a.id}">
      <div class="auction-image"><img src="${a.image || 'assets/images/smiley.svg'}" alt="${a.title}" onerror="this.onerror=null;this.src='assets/images/smiley.svg'"></div>
      <div class="auction-body">
        <span class="tag">DAILY AUCTION</span>
        <h3>${a.title}</h3>
        <p>${a.description || ''}</p>
        <div class="auction-stat-row">
          <div><span>Current bid</span><strong>${currentBid}</strong></div>
          ${isOpen ? `<div><span>Minimum next bid</span><strong>${nextBid}</strong></div>` : ''}
          ${isOpen ? `<div><span>Time left</span><strong class="auction-countdown" data-ends="${a.endsAt}">${auctionCountdownText(a.endsAt)}</strong></div>` : ''}
        </div>
        ${actionHtml}
      </div>
    </article>`;
}

function renderAuctionSection() {
  const grid = document.querySelector('#productGrid');
  const emptyEl = document.querySelector('#emptyResults');
  const countEl = document.querySelector('#productCount');
  if (!grid) return;

  const visible = auctions.filter(a => a.status === 'active' || a.status === 'scheduled' || a.status === 'ended');
  if (!visible.length) {
    grid.innerHTML = '';
    emptyEl.hidden = false;
    emptyEl.textContent = 'No auctions right now — check back soon.';
    countEl.textContent = '0 auctions';
    return;
  }
  emptyEl.hidden = true;
  countEl.textContent = `${visible.length} auction${visible.length === 1 ? '' : 's'}`;
  grid.innerHTML = visible.map(auctionCard).join('');

  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    document.querySelectorAll('.auction-countdown').forEach(el => {
      el.textContent = auctionCountdownText(el.dataset.ends);
    });
  }, 1000);
}

document.querySelector('#productGrid')?.addEventListener('click', e => {
  const bidBtn = e.target.closest('[data-auction-bid]');
  const payBtn = e.target.closest('[data-auction-pay]');
  if (bidBtn) openBidModal(bidBtn.dataset.auctionBid);
  else if (payBtn) payForAuctionWin(payBtn.dataset.auctionPay, payBtn);
});

// The server is the real gate here: it only issues a Square link if this
// browser's visitor_id matches the recorded winning bid. Showing the
// button to every visitor of an ended auction (rather than only to
// whoever we think won) is simpler and no less secure, since a non-winner
// just gets a clear rejection instead of a payment link.
async function payForAuctionWin(auctionId, btn) {
  const endpoint = window.MINI_SQUARE?.auctionCheckoutEndpoint?.trim();
  if (!endpoint) { toastMsg('Auction payment isn’t available right now.'); return; }

  btn.disabled = true;
  btn.textContent = 'Opening Square…';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auctionId,
        visitorId: getVisitorId(),
        redirectUrl: new URL(`success.html?auction=${encodeURIComponent(auctionId)}`, window.location.href).href
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || 'Could not start payment.');
    location.href = data.url;
  } catch (err) {
    toastMsg(err.message);
    btn.disabled = false;
    btn.textContent = "I won this — pay now";
  }
}

function openBidModal(auctionId) {
  const a = auctions.find(x => x.id === auctionId);
  if (!a) return;
  activeBidAuction = a;

  document.querySelector('#auctionBidImage').src = a.image || 'assets/images/smiley.svg';
  document.querySelector('#auctionBidTitle').textContent = a.title;
  document.querySelector('#auctionBidCurrent').textContent = a.currentHighestBidCents != null ? money2(a.currentHighestBidCents / 100) : money2(a.startingBidCents / 100);
  document.querySelector('#auctionBidMin').textContent = money2(a.nextMinBidCents / 100);
  document.querySelector('#bidAmount').value = (a.nextMinBidCents / 100).toFixed(2);
  document.querySelector('#bidAmount').min = (a.nextMinBidCents / 100).toFixed(2);
  document.querySelector('#auctionBidError').hidden = true;
  document.querySelector('#auctionBidForm').hidden = false;
  document.querySelector('#auctionBidDone').hidden = true;

  document.querySelector('#auctionBidModal').showModal();
}
document.querySelector('#auctionBidClose')?.addEventListener('click', () => document.querySelector('#auctionBidModal').close());

document.querySelector('#bidContactMethod')?.addEventListener('change', e => {
  const label = document.querySelector('#bidContactValueLabel');
  const input = document.querySelector('#bidContactValue');
  if (e.target.value === 'phone') {
    label.firstChild.textContent = 'Phone';
    input.type = 'tel';
  } else {
    label.firstChild.textContent = 'Email';
    input.type = 'email';
  }
});

document.querySelector('#auctionBidForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!activeBidAuction) return;

  const errorEl = document.querySelector('#auctionBidError');
  const submitBtn = document.querySelector('#auctionBidSubmit');
  errorEl.hidden = true;

  const payload = {
    auctionId: activeBidAuction.id,
    visitorId: getVisitorId(),
    firstName: document.querySelector('#bidFirstName').value.trim(),
    lastName: document.querySelector('#bidLastName').value.trim(),
    yearLevel: document.querySelector('#bidYearLevel').value.trim(),
    contactMethod: document.querySelector('#bidContactMethod').value,
    contactValue: document.querySelector('#bidContactValue').value.trim(),
    amount: Number(document.querySelector('#bidAmount').value),
  };

  const endpoint = window.MINI_SQUARE?.auctionBidEndpoint?.trim();
  if (!endpoint) { errorEl.textContent = 'Bidding isn’t available right now.'; errorEl.hidden = false; return; }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Placing bid…';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not place your bid.');

    document.querySelector('#auctionBidForm').hidden = true;
    document.querySelector('#auctionBidDone').hidden = false;
    refreshAuctions();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place bid';
  }
});

refreshAuctions();
setInterval(refreshAuctions, 20000);
