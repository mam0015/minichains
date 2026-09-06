-- Phase 3 — real atomic stock reservations (prevents overselling during the
-- payment window, not just at confirmation) and sold-out restock requests.

-- Reservations are rows, not a mutable counter, so they self-expire without
-- needing a cron job: a reservation older than 20 minutes simply stops
-- counting towards "reserved" the next time anything reads live
-- availability — no sweep/cleanup process required.
create table if not exists public.mini_stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  product_id text not null,
  qty integer not null check (qty > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  reserved_at timestamptz not null default now()
);
alter table public.mini_stock_reservations enable row level security;
revoke all on table public.mini_stock_reservations from anon;
revoke all on table public.mini_stock_reservations from authenticated;
create index if not exists mini_stock_reservations_order_idx on public.mini_stock_reservations (order_id);
create index if not exists mini_stock_reservations_product_idx on public.mini_stock_reservations (product_id, status, reserved_at);

-- Phase 1's stock_reserved/stock_available generated column assumed a
-- simple mutable counter, which can't expire on its own — superseded by the
-- reservations table + the live view below. Column deliberately left in
-- place rather than dropped (it'll just mirror stock_on_hand from here on,
-- since stock_reserved never moves again) — the currently-live stock-status
-- and create-square-checkout functions still read it directly and must
-- keep working right up until they're redeployed to read the view instead.

-- The single place every read of "how many are actually available right
-- now" should go through — recomputed fresh on every query, so an expired
-- or confirmed reservation simply stops counting with no cleanup needed.
create or replace view public.mini_products_live as
select
  p.id, p.name, p.description, p.size, p.print_time, p.base_price_cents,
  p.image, p.fallback_image, p.credit, p.source_url, p.active,
  p.limited_edition, p.loyalty_reward_eligible, p.stock_on_hand,
  p.stock_reserved, p.display_order, p.created_at, p.updated_at,
  greatest(p.stock_on_hand - coalesce(r.reserved_qty, 0), 0) as stock_available
from public.mini_products p
left join (
  select product_id, sum(qty) as reserved_qty
  from public.mini_stock_reservations
  where status = 'pending' and reserved_at > now() - interval '20 minutes'
  group by product_id
) r on r.product_id = p.id;

grant select on public.mini_products_live to service_role;

-- Reserves stock for a card checkout attempt, atomic and all-or-nothing —
-- same two-pass check-then-write shape as mini_decrement_stock, but writes
-- reservation rows instead of decrementing stock_on_hand directly (the
-- real decrement only happens later, via mini_confirm_reservation, once
-- payment is actually confirmed). The `for update` lock on mini_products
-- serializes concurrent reservation attempts for the same product.
create or replace function public.mini_reserve_stock(p_order_id text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  pid text;
  qty integer;
  on_hand integer;
  reserved integer;
begin
  for item in select * from jsonb_array_elements(p_items) loop
    pid := item->>'product_id';
    qty := greatest((item->>'qty')::integer, 0);
    if qty = 0 then continue; end if;

    select stock_on_hand into on_hand from public.mini_products where id = pid for update;
    if on_hand is null then
      raise exception 'UNKNOWN_PRODUCT:%', pid;
    end if;

    select coalesce(sum(r.qty), 0) into reserved
      from public.mini_stock_reservations r
      where r.product_id = pid and r.status = 'pending'
        and r.reserved_at > now() - interval '20 minutes';

    if (on_hand - reserved) < qty then
      raise exception 'INSUFFICIENT_STOCK:%:%:%', pid, greatest(on_hand - reserved, 0), qty;
    end if;
  end loop;

  for item in select * from jsonb_array_elements(p_items) loop
    pid := item->>'product_id';
    qty := greatest((item->>'qty')::integer, 0);
    if qty = 0 then continue; end if;

    insert into public.mini_stock_reservations (order_id, product_id, qty, status)
    values (p_order_id, pid, qty, 'pending');
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.mini_reserve_stock(text, jsonb) from public, anon, authenticated;
grant execute on function public.mini_reserve_stock(text, jsonb) to service_role;

-- Converts an order's pending reservations into a real, permanent
-- stock_on_hand decrement — called once, from square-webhook, only when
-- payment is actually confirmed. Self-idempotent: a second call for the
-- same order_id finds zero remaining 'pending' rows (already flipped to
-- 'confirmed' by the first call) and does nothing.
create or replace function public.mini_confirm_reservation(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select product_id, sum(qty) as total_qty
    from public.mini_stock_reservations
    where order_id = p_order_id and status = 'pending'
    group by product_id
  loop
    perform 1 from public.mini_products where id = rec.product_id for update;
    update public.mini_products
      set stock_on_hand = greatest(stock_on_hand - rec.total_qty, 0), updated_at = now()
      where id = rec.product_id;
  end loop;

  update public.mini_stock_reservations
    set status = 'confirmed'
    where order_id = p_order_id and status = 'pending';

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.mini_confirm_reservation(text) from public, anon, authenticated;
grant execute on function public.mini_confirm_reservation(text) to service_role;

-- Sold-out "let us know you want this" demand tracking. One row per
-- (product, visitor) — a repeat request from the same browser is a no-op
-- conflict, not a new row, so one visitor can't inflate demand by clicking
-- repeatedly. visitor_id is a random id generated client-side and stored in
-- localStorage — a device/browser signal, not a verified identity.
create table if not exists public.mini_restock_requests (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  visitor_id text not null,
  note text,
  requested_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'fulfilled', 'dismissed')),
  unique (product_id, visitor_id)
);
alter table public.mini_restock_requests enable row level security;
revoke all on table public.mini_restock_requests from anon;
revoke all on table public.mini_restock_requests from authenticated;
create index if not exists mini_restock_requests_product_idx on public.mini_restock_requests (product_id);
