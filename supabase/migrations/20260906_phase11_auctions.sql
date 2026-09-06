-- Phase 11 — Daily Auction. Server time and server logic are authoritative
-- for everything that matters (whether an auction is open, who's winning,
-- who won) — the client's countdown is cosmetic only.
--
-- No cron/scheduled job exists in this project, so auctions close lazily:
-- mini_finalize_auction() is called at the top of every read/write path
-- that touches an auction, and closes anything whose ends_at has passed
-- but is still marked 'active' — the exact same pattern Phase 3's stock
-- reservations use to expire without a background sweep.
create table if not exists public.mini_auctions (
  id uuid primary key default gen_random_uuid(),
  product_id text references public.mini_products(id),
  title text not null,
  description text not null default '',
  image text not null default '',
  starting_bid_cents integer not null check (starting_bid_cents > 0),
  min_increment_cents integer not null default 100 check (min_increment_cents > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'ended', 'cancelled')),
  current_highest_bid_cents integer,
  current_highest_bid_id uuid,
  winner_bid_id uuid,
  winner_payment_deadline timestamptz,
  winner_payment_status text check (winner_payment_status in ('pending', 'paid', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mini_auctions enable row level security;
revoke all on table public.mini_auctions from anon;
revoke all on table public.mini_auctions from authenticated;

create table if not exists public.mini_auction_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.mini_auctions(id),
  visitor_id text not null,
  first_name text not null,
  last_name text not null,
  year_level text not null,
  contact_method text not null check (contact_method in ('phone', 'email')),
  contact_value text not null,
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);
alter table public.mini_auction_bids enable row level security;
revoke all on table public.mini_auction_bids from anon;
revoke all on table public.mini_auction_bids from authenticated;
create index if not exists mini_auction_bids_auction_idx on public.mini_auction_bids (auction_id, amount_cents desc);
create index if not exists mini_auction_bids_visitor_idx on public.mini_auction_bids (auction_id, visitor_id, created_at desc);

-- Optional link from a real order (card payment or cash) back to the
-- auction it settles, so square-webhook can mark the auction paid the same
-- moment it marks the order paid — one confirmation path, not two.
alter table public.mini_orders
  add column if not exists auction_id uuid references public.mini_auctions(id);

-- Idempotent: closing an already-closed auction is a harmless no-op, so
-- every caller can unconditionally call this before reading/writing
-- without needing to check status first.
create or replace function public.mini_finalize_auction(p_auction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
begin
  select * into a from public.mini_auctions where id = p_auction_id for update;
  if not found then return; end if;
  if a.status = 'active' and a.ends_at <= now() then
    update public.mini_auctions
      set status = 'ended',
          winner_bid_id = a.current_highest_bid_id,
          winner_payment_status = case when a.current_highest_bid_id is not null then 'pending' else null end,
          winner_payment_deadline = case when a.current_highest_bid_id is not null then now() + interval '48 hours' else null end,
          updated_at = now()
      where id = p_auction_id;
  elsif a.status = 'scheduled' and a.starts_at <= now() and a.ends_at > now() then
    update public.mini_auctions set status = 'active', updated_at = now() where id = p_auction_id;
  end if;
end;
$$;
revoke all on function public.mini_finalize_auction(uuid) from public, anon, authenticated;
grant execute on function public.mini_finalize_auction(uuid) to service_role;

-- Places a bid atomically: locks the auction row (serialising concurrent
-- bids on the same auction), re-validates against the live current-highest
-- under that lock, inserts the bid, and updates the cached highest — all
-- inside one transaction, so two near-simultaneous bids can never both
-- "win" the same increment.
create or replace function public.mini_place_bid(
  p_auction_id uuid, p_visitor_id text, p_first_name text, p_last_name text,
  p_year_level text, p_contact_method text, p_contact_value text, p_amount_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  bid_id uuid;
  recent_bids integer;
begin
  perform public.mini_finalize_auction(p_auction_id);
  select * into a from public.mini_auctions where id = p_auction_id for update;

  if not found then
    raise exception 'AUCTION_NOT_FOUND';
  end if;
  if a.status <> 'active' or now() < a.starts_at or now() >= a.ends_at then
    raise exception 'AUCTION_NOT_OPEN';
  end if;

  select count(*) into recent_bids from public.mini_auction_bids
    where auction_id = p_auction_id and visitor_id = p_visitor_id and created_at > now() - interval '60 seconds';
  if recent_bids >= 5 then
    raise exception 'RATE_LIMITED';
  end if;

  if p_amount_cents < a.starting_bid_cents
     or (a.current_highest_bid_cents is not null and p_amount_cents < a.current_highest_bid_cents + a.min_increment_cents) then
    raise exception 'BID_TOO_LOW:%:%', coalesce(a.current_highest_bid_cents, a.starting_bid_cents - a.min_increment_cents), a.min_increment_cents;
  end if;

  insert into public.mini_auction_bids
    (auction_id, visitor_id, first_name, last_name, year_level, contact_method, contact_value, amount_cents)
    values (p_auction_id, p_visitor_id, p_first_name, p_last_name, p_year_level, p_contact_method, p_contact_value, p_amount_cents)
    returning id into bid_id;

  update public.mini_auctions
    set current_highest_bid_cents = p_amount_cents, current_highest_bid_id = bid_id, updated_at = now()
    where id = p_auction_id;

  return jsonb_build_object('ok', true, 'bidId', bid_id);
end;
$$;
revoke all on function public.mini_place_bid(uuid, text, text, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.mini_place_bid(uuid, text, text, text, text, text, text, integer) to service_role;
