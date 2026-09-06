-- Phase 7 — loyalty identity security. Today a plain username string is
-- the entire lookup key for mini_loyalty_accounts: anyone who knows or
-- guesses someone else's Rewards Username can check and spend their
-- progress. This adds a secret "ownership" token behind the username —
-- generated the first time a username is used, stored in the customer's
-- own browser, required to advance/redeem an already-claimed account.
--
-- Nullable/additive by design: any account that predates this migration
-- has owner_secret = null ("unclaimed") and gets claimed automatically by
-- whichever secret next checks out for that username — no forced reset,
-- no data loss, matches the "prefer additive migrations" rule.
alter table public.mini_loyalty_accounts
  add column if not exists owner_secret text;

alter table public.mini_orders
  add column if not exists rewards_username_secret text;
