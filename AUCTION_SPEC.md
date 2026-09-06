# Daily Auction — specification for when it's re-enabled

Auction is disabled for customers as of 2026-09-06 (school launch) — see
"How it was disabled" below. This file preserves the exact rules the owner
gave for when it's turned back on, plus the gaps between those rules and
the current Phase 11 build so whoever re-enables it doesn't have to
rediscover them.

## Rules

1. Opening Auction must first show a **separate** Auction Terms & Conditions
   screen — distinct from the main store Terms modal.
2. Customer chooses **Accept** or **Decline**.
3. If declined: Auction stays unavailable to that customer, but normal
   MiniChains shopping must still work, and there must be a button to
   review/accept the Auction Terms later.
4. If accepted: bidding becomes available.
5. Every bid needs: First Name, Last Name, Phone Number, Proposed Bid Amount.
6. Bidding is completely free — no money is charged when placing a bid.
7. A new bid must be at least **A$0.50** higher than the current highest bid
   (not a large fixed jump like $5 or $10). Example: current bid A$5.00 →
   valid next bids are A$5.50, A$6.00, A$7.00, A$10.00, or anything higher
   in valid increments.
8. Highest valid bid wins.
9. Must be explained clearly to customers:
   - The winner is determined the following day.
   - Customers return to the MiniChains stall to check if they won.
   - Winners pay when collecting the item.
   - Non-winners pay nothing.
10. No card/payment info is collected during bidding.
11. Terms must make clear: bidding is free, it doesn't guarantee winning,
    highest valid bid wins, winner pays only after winning, and contact
    info stays private.

## Gaps vs. the current Phase 11 build (not fixed — disabled instead)

Found while wiring the disable flag, not yet reconciled:

- **No separate Auction Terms gate.** Today the only auction-related terms
  text is one paragraph inside the main store-wide Terms modal
  (`#termsAuctionClause` in [index.html](index.html) / [checkout.html](checkout.html)).
  Rules 1–3 above (a dedicated Accept/Decline screen, gating only Auction,
  with a persistent "review later" option) don't exist yet.
- **Bid form fields don't match.** The current form
  (`#auctionBidForm` in [index.html](index.html)) collects First Name, Last
  Name, Year Level, and a Contact Method (Email/Phone choice) — not the
  Phone-Number-specifically field Rule 5 calls for.
- **Increment isn't a fixed $0.50 rule.** `admin-data`'s `create_auction`
  action (`supabase/functions/admin-data/index.ts`) takes a per-auction
  `minIncrement` that defaults to $1 if the staff member doesn't set one —
  it's configurable per auction, not a hardcoded $0.50 floor enforced
  everywhere per Rule 7.

## How it was disabled (2026-09-06)

Nothing was deleted — only the customer-facing surface was switched off:

- [auction.js](auction.js): `const AUCTION_ENABLED = false` at the top;
  `refreshAuctions()` returns immediately when false, so it never fetches
  `auction-status`, never reveals `#auctionTab`, and the bid modal/section
  are never reachable (they're only ever shown from code paths that start
  with a successful `refreshAuctions()` call).
- [index.html](index.html) / [checkout.html](checkout.html): the
  `#termsAuctionClause` paragraph in the store-wide Terms modal is marked
  `hidden` so customers don't read about a feature they can't use.
- Database tables, RPCs, `mini-auctions`/`auction-bid`/`auction-checkout`
  functions, and the admin dashboard's Auctions tab are all untouched.

**To re-enable later:** flip `AUCTION_ENABLED` back to `true` in
auction.js, remove `hidden` from both `#termsAuctionClause` paragraphs —
and decide whether to close the gaps above first.
