-- Phase 6 — server-authoritative Spin & Win. Today the wheel picks its own
-- result client-side (crypto.getRandomValues in the browser) and only
-- *reports* what it picked to record-prize — a modified browser could pick
-- whatever it wants and report a fake win. One row per visitor_id (unique)
-- both records the outcome and enforces "one spin ever" server-side,
-- closing the "clear localStorage and spin again" loophole the old
-- client-only SPIN_OPENED_KEY check had no real defense against.
create table if not exists public.mini_spins (
  visitor_id text primary key,
  result_type text not null check (result_type in ('empty', 'discount')),
  percent integer not null default 0,
  code text,
  created_at timestamptz not null default now()
);
alter table public.mini_spins enable row level security;
revoke all on table public.mini_spins from anon;
revoke all on table public.mini_spins from authenticated;
