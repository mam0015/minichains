// MiniChains — first-party funnel analytics. Fire-and-forget: never awaited
// by callers, never throws, and a failure here must never affect the
// action being tracked. Verified sales/revenue live in mini_orders and are
// read directly by the admin dashboard — this is only for pre-purchase
// funnel behaviour (views, searches, add-to-cart, checkout started) that
// has no other record.
function track(event, data) {
  try {
    const endpoint = window.MINI_SQUARE?.trackEventEndpoint?.trim();
    if (!endpoint || typeof getVisitorId !== 'function') return;
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: getVisitorId(), event, data: data || {} })
    }).catch(() => {});
  } catch {
    // Analytics must never break the page it's called from.
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // One per browser per day is plenty for a rough "sessions" estimate
  // without needing a more invasive session concept.
  const key = 'mini-session-tracked-' + new Date().toISOString().slice(0, 10);
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1');
    track('session_start', { page: location.pathname.split('/').pop() || 'index.html' });
  }
});
