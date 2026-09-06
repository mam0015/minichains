// MiniChains — staff dashboard. Shares the same staff session token as the
// "Confirm Cash Received" PIN gate on success.html (mini-staff-token in
// localStorage) — logging in once on either page covers both, since it's
// the same staff-login function and the same session table either way.
const money = v => `A$${Number(v || 0).toFixed(2)}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

function getValidStaffToken() {
  const token = localStorage.getItem('mini-staff-token');
  const expiresAt = Number(localStorage.getItem('mini-staff-token-expires') || 0);
  return (token && Date.now() < expiresAt) ? token : null;
}

function showLoggedOut() {
  document.querySelector('#adminLoginCard').hidden = false;
  document.querySelector('#adminDashboard').hidden = true;
  document.querySelector('#adminLogoutBtn').hidden = true;
}
function showLoggedIn() {
  document.querySelector('#adminLoginCard').hidden = true;
  document.querySelector('#adminDashboard').hidden = false;
  document.querySelector('#adminLogoutBtn').hidden = false;
  loadView(currentView);
}

document.querySelector('#adminPinSubmit').addEventListener('click', async () => {
  const pinInput = document.querySelector('#adminPinInput');
  const submitBtn = document.querySelector('#adminPinSubmit');
  const errorEl = document.querySelector('#adminPinError');
  const pin = pinInput.value.trim();
  errorEl.hidden = true;
  if (!pin) return;

  const endpoint = window.MINI_SQUARE?.staffLoginEndpoint?.trim();
  if (!endpoint) { errorEl.textContent = 'Staff login isn’t available right now.'; errorEl.hidden = false; return; }

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
    pinInput.value = '';
    showLoggedIn();
  } catch {
    errorEl.textContent = 'Network error — try again.';
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log in';
  }
});

document.querySelector('#adminPinInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.querySelector('#adminPinSubmit').click(); }
});

document.querySelector('#adminLogoutBtn').addEventListener('click', () => {
  localStorage.removeItem('mini-staff-token');
  localStorage.removeItem('mini-staff-token-expires');
  showLoggedOut();
});

let currentView = 'overview';
document.querySelectorAll('#adminTabs button').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('#adminTabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentView = btn.dataset.view;
  loadView(currentView);
}));

async function fetchView(view) {
  const endpoint = window.MINI_SQUARE?.adminDataEndpoint?.trim();
  const token = getValidStaffToken();
  if (!endpoint || !token) return null;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ view, staffToken: token })
  });
  if (res.status === 401) { showLoggedOut(); return null; }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Could not load data.');
  return data;
}

function table(headers, rows) {
  if (!rows.length) return '<p class="admin-empty">Nothing here yet.</p>';
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

async function loadView(view) {
  const content = document.querySelector('#adminContent');
  const loading = document.querySelector('#adminLoading');
  loading.hidden = false;
  content.innerHTML = '';

  let data;
  try {
    data = await fetchView(view);
  } catch (err) {
    loading.hidden = true;
    content.innerHTML = `<p class="admin-empty">${esc(err.message)}</p>`;
    return;
  }
  loading.hidden = true;
  if (!data) return;

  if (view === 'overview') {
    content.innerHTML = `
      <div class="admin-stat-grid">
        <div class="admin-stat"><span>Paid orders</span><strong>${data.paidOrders}</strong></div>
        <div class="admin-stat"><span>Revenue</span><strong>${money(data.revenue)}</strong></div>
        <div class="admin-stat"><span>Units sold</span><strong>${data.unitsSold}</strong></div>
        <div class="admin-stat"><span>Card / Cash</span><strong>${data.cardOrders} / ${data.cashOrders}</strong></div>
        <div class="admin-stat"><span>Open restock requests</span><strong>${data.openRestockRequests}</strong></div>
        <div class="admin-stat"><span>Sold-out products</span><strong>${data.soldOutProducts.length}</strong></div>
      </div>
      <h3>Most popular</h3>
      ${table(['Product', 'Units sold'], data.mostPopular.map(p => [esc(p.name), p.qty]))}
      ${data.soldOutProducts.length ? `<h3>Currently sold out</h3><ul class="admin-list">${data.soldOutProducts.map(p => `<li>${esc(p.name)}</li>`).join('')}</ul>` : ''}
    `;
  } else if (view === 'products') {
    content.innerHTML = table(
      ['Product', 'Price', 'On hand', 'Available', 'Status'],
      data.products.map(p => [
        esc(p.name) + (p.limited_edition ? ' <span class="admin-tag">LTD</span>' : ''),
        money(p.base_price_cents / 100),
        p.stock_on_hand,
        p.stock_available,
        p.active ? (p.stock_available > 0 ? 'Active' : '<span class="admin-warn">Sold out</span>') : '<span class="admin-muted">Inactive</span>',
      ])
    );
  } else if (view === 'orders') {
    content.innerHTML = table(
      ['Order', 'Method', 'Status', 'Items', 'Total', 'Placed'],
      data.orders.map(o => [
        esc(o.id),
        o.payment_method === 'card' ? 'Card' : 'Cash',
        o.status === 'paid' ? '<span class="admin-ok">Paid</span>' : esc(o.status),
        (o.items || []).map(it => `${it.qty}× ${esc(it.id)}`).join(', '),
        money(o.total),
        new Date(o.created_at).toLocaleString('en-AU'),
      ])
    );
  } else if (view === 'loyalty') {
    content.innerHTML = table(
      ['Username', 'Cycle progress', 'Total visits', 'Cycles completed', 'Discounts used', 'Free items won'],
      data.accounts.map(a => [
        esc(a.display_username),
        `${a.current_cycle_visits} / 3`,
        a.total_eligible_visits,
        a.completed_cycles,
        a.discounts_redeemed,
        a.free_keychains_redeemed,
      ])
    );
  } else if (view === 'promotions') {
    content.innerHTML = table(
      ['Code', 'Type', 'Value', 'Used', 'Created'],
      data.promotions.map(p => [
        esc(p.code),
        p.type === 'discount' ? 'Discount' : 'Free item',
        p.type === 'discount' ? `${p.percent}%` : esc(p.free_product_id || ''),
        p.used ? '<span class="admin-ok">Used</span>' : '<span class="admin-muted">Unused</span>',
        new Date(p.created_at).toLocaleString('en-AU'),
      ])
    );
  } else if (view === 'analytics') {
    const f = data.funnel;
    content.innerHTML = `
      <div class="admin-stat-grid">
        <div class="admin-stat"><span>Estimated visitors</span><strong>${data.estimatedVisitors}</strong></div>
        <div class="admin-stat"><span>Product views</span><strong>${f.productViews}</strong></div>
        <div class="admin-stat"><span>Added to cart</span><strong>${f.addToCart}</strong></div>
        <div class="admin-stat"><span>Checkout started</span><strong>${f.checkoutStarted}</strong></div>
        <div class="admin-stat"><span>Paid orders</span><strong>${f.paid}</strong></div>
      </div>
      <h3>Most viewed products</h3>
      ${table(['Product', 'Views'], data.topProducts.map(p => [esc(p.key), p.count]))}
      <h3>Top searches</h3>
      ${table(['Search term', 'Count'], data.topSearches.map(p => [esc(p.key), p.count]))}
      <h3>Category clicks</h3>
      ${table(['Category', 'Clicks'], data.topCategories.map(p => [esc(p.key), p.count]))}
      <p class="admin-empty">${esc(data.note)}</p>
    `;
  } else if (view === 'restock') {
    const counts = Object.entries(data.countsByProduct).sort((a, b) => b[1] - a[1]);
    const comingSoonCounts = Object.entries(data.comingSoonCountsByProduct || {}).sort((a, b) => b[1] - a[1]);
    content.innerHTML = `
      <h3>Most requested sold-out items</h3>
      ${table(['Product', 'Requests'], counts.map(([id, n]) => [esc(id), n]))}
      <h3>Recent sold-out requests</h3>
      ${table(['Product', 'Note', 'Requested'], data.requests.slice(0, 50).map(r => [esc(r.product_id), esc(r.note || '—'), new Date(r.requested_at).toLocaleString('en-AU')]))}
      <h3>Coming Soon interest</h3>
      ${table(['Product', 'Interested'], comingSoonCounts.map(([id, n]) => [esc(id), n]))}
    `;
  } else if (view === 'auctions') {
    renderAuctionsAdmin(data.auctions);
  }
}

async function callAdminAction(payload) {
  const endpoint = window.MINI_SQUARE?.adminDataEndpoint?.trim();
  const token = getValidStaffToken();
  if (!endpoint || !token) return { error: 'Not logged in.' };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, staffToken: token })
  });
  return res.json().catch(() => ({ error: 'Unexpected response.' }));
}

function statusBadge(status) {
  if (status === 'active') return '<span class="admin-ok">Active</span>';
  if (status === 'scheduled') return '<span class="admin-muted">Scheduled</span>';
  if (status === 'cancelled') return '<span class="admin-warn">Cancelled</span>';
  return 'Ended';
}

function renderAuctionsAdmin(auctions) {
  const content = document.querySelector('#adminContent');
  const fmt = d => new Date(d).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });

  const rows = auctions.map(a => {
    const winner = a.winner ? `${esc(a.winner.firstName)} ${esc(a.winner.lastName)} (${esc(a.winner.yearLevel)}) — ${a.winner.contactMethod}: ${esc(a.winner.contactValue)}` : '—';
    const actions = [];
    if (a.status === 'active') actions.push(`<button class="btn btn-ghost" data-end-auction="${a.id}">End now</button>`);
    if (a.status === 'scheduled' || a.status === 'active') actions.push(`<button class="btn btn-ghost" data-cancel-auction="${a.id}">Cancel</button>`);
    return [
      esc(a.title),
      statusBadge(a.status),
      a.current_highest_bid_cents != null ? money(a.current_highest_bid_cents / 100) : money(a.starting_bid_cents / 100) + ' (start)',
      `${a.bidCount} bids`,
      `${fmt(a.starts_at)} → ${fmt(a.ends_at)}`,
      a.status === 'ended' ? `${winner}${a.winner ? ` <br><small>Payment: ${esc(a.winner_payment_status || 'pending')}</small>` : ''}` : '—',
      actions.join(' '),
    ];
  });

  content.innerHTML = `
    <h3>Create auction</h3>
    <form id="createAuctionForm" class="auction-bid-form" style="margin-bottom:28px;max-width:480px">
      <label>Title<input id="newAuctionTitle" required maxlength="100" placeholder="e.g. Hand-painted Panda — one of a kind"></label>
      <label>Description<input id="newAuctionDesc" maxlength="500"></label>
      <label>Image URL (optional, real photo only)<input id="newAuctionImage" maxlength="300"></label>
      <div class="auction-bid-row">
        <label>Starting bid (A$)<input id="newAuctionStart" type="number" step="0.01" min="0.01" required></label>
        <label>Minimum increment (A$)<input id="newAuctionIncrement" type="number" step="0.01" min="0.01" value="1.00" required></label>
      </div>
      <div class="auction-bid-row">
        <label>Starts<input id="newAuctionStartsAt" type="datetime-local" required></label>
        <label>Ends<input id="newAuctionEndsAt" type="datetime-local" required></label>
      </div>
      <small class="auction-bid-error" id="createAuctionError" hidden></small>
      <button class="btn btn-primary full" type="submit">Create auction</button>
    </form>
    <h3>All auctions</h3>
    ${table(['Title', 'Status', 'Current bid', 'Bids', 'Window', 'Winner', 'Actions'], rows)}
  `;

  document.querySelector('#createAuctionForm').addEventListener('submit', async e => {
    e.preventDefault();
    const errorEl = document.querySelector('#createAuctionError');
    errorEl.hidden = true;
    const result = await callAdminAction({
      action: 'create_auction',
      title: document.querySelector('#newAuctionTitle').value.trim(),
      description: document.querySelector('#newAuctionDesc').value.trim(),
      image: document.querySelector('#newAuctionImage').value.trim(),
      startingBid: Number(document.querySelector('#newAuctionStart').value),
      minIncrement: Number(document.querySelector('#newAuctionIncrement').value),
      startsAt: new Date(document.querySelector('#newAuctionStartsAt').value).toISOString(),
      endsAt: new Date(document.querySelector('#newAuctionEndsAt').value).toISOString(),
    });
    if (result.error) { errorEl.textContent = result.error; errorEl.hidden = false; return; }
    loadView('auctions');
  });

  content.querySelectorAll('[data-end-auction]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('End this auction now? The highest current bid (if any) will become the winner.')) return;
    await callAdminAction({ action: 'end_auction_now', auctionId: btn.dataset.endAuction });
    loadView('auctions');
  }));
  content.querySelectorAll('[data-cancel-auction]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Cancel this auction? This cannot be undone.')) return;
    await callAdminAction({ action: 'cancel_auction', auctionId: btn.dataset.cancelAuction });
    loadView('auctions');
  }));
}

if (getValidStaffToken()) showLoggedIn();
else showLoggedOut();
