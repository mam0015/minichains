// MiniChains — Terms & Conditions gate. Shared by index.html and
// checkout.html (a plain script, not an Edge Function, so unlike the
// backend it's fine for both pages to load the exact same file).
//
// Increment TERMS_VERSION whenever the terms text materially changes —
// everyone who accepted an older version will be asked again.
const TERMS_VERSION = '2026-09-06-v2'; // v2: added the Daily Auction clause when Phase 11 shipped

// Same visitor-id concept app.js's restock-request flow already uses — a
// random per-browser id, not an identity, just enough to record "did this
// browser accept" without needing an account.
function getVisitorId() {
  let id = localStorage.getItem('mini-visitor-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('mini-visitor-id', id);
  }
  return id;
}

function hasRespondedToTerms() {
  return localStorage.getItem('mini-terms-version') === TERMS_VERSION;
}
function hasAcceptedTerms() {
  return hasRespondedToTerms() && localStorage.getItem('mini-terms-accepted') === 'true';
}

function reportTermsResponse(accepted) {
  const endpoint = window.MINI_SQUARE?.termsAcceptanceEndpoint?.trim();
  if (!endpoint) return;
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId: getVisitorId(), version: TERMS_VERSION, accepted })
  }).catch(() => {});
}

function openTermsModal() {
  const modal = document.querySelector('#termsModal');
  if (!modal) return;
  // Reviewing again always starts back on the accept/decline choice, even
  // if the last response was "declined".
  const actions = document.querySelector('#termsActions');
  const declinedState = document.querySelector('#termsDeclinedState');
  if (actions) actions.hidden = false;
  if (declinedState) declinedState.hidden = true;

  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('locked');
}
function closeTermsModal() {
  const modal = document.querySelector('#termsModal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('locked');
}

function respondToTerms(accepted) {
  localStorage.setItem('mini-terms-version', TERMS_VERSION);
  localStorage.setItem('mini-terms-accepted', accepted ? 'true' : 'false');
  reportTermsResponse(accepted);
  document.dispatchEvent(new CustomEvent('minichains:terms-responded', { detail: { accepted } }));

  if (accepted) {
    closeTermsModal();
    return;
  }
  // Declining doesn't lock the whole site or loop the modal on them — just
  // makes the "can't purchase yet" consequence clear, with an easy way
  // back to Review Terms whenever they're ready.
  const actions = document.querySelector('#termsActions');
  const declinedState = document.querySelector('#termsDeclinedState');
  if (actions) actions.hidden = true;
  if (declinedState) declinedState.hidden = false;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#termsAccept')?.addEventListener('click', () => respondToTerms(true));
  document.querySelector('#termsDecline')?.addEventListener('click', () => respondToTerms(false));
  document.querySelector('#termsReviewAgain')?.addEventListener('click', openTermsModal);
  document.querySelector('#termsContinueBrowsing')?.addEventListener('click', closeTermsModal);
  document.querySelectorAll('[data-review-terms]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault();
    openTermsModal();
  }));

  if (!hasRespondedToTerms()) {
    openTermsModal();
  }
});
