-- Stock/inventory limits for MiniChains products.
-- A product with NO row here is treated as unlimited (no cap). A product
-- with a row is capped at `available` units, enforced server-side by both
-- the card flow (create-square-checkout soft-checks it, square-webhook
-- hard-decrements it once payment is confirmed) and the cash flow
-- (confirm-cash-order hard-decrements it once cash is confirmed received).
create table if not exists public.mini_stock (
  product_id text primary key,
  available integer not null default 0
    check (available >= 0),
  updated_at timestamptz not null default now()
);

alter table public.mini_stock enable row level security;

revoke all on table public.mini_stock from anon;
revoke all on table public.mini_stock from authenticated;

-- Starting counts as given by the seller. Re-running this INSERT is safe —
-- it only fills in a row the first time; it never resets an existing count
-- (use a plain UPDATE to restock later, e.g.
--  update public.mini_stock set available = 5 where product_id = 'KEY-03';).
insert into public.mini_stock (product_id, available) values
  ('KEY-03', 3), -- Panda Keychain
  ('KEY-05', 2), -- Soccer Ball
  ('KEY-07', 1), -- Dog Keychain
  ('KEY-08', 2)  -- Spiderman Keychain
on conflict (product_id) do nothing;

-- Atomically decrements stock for every item in an order, all-or-nothing:
-- if ANY capped item in the batch doesn't have enough available, the whole
-- call raises and nothing is decremented. A product with no mini_stock row
-- is uncapped and always succeeds. Runs as a single implicit transaction
-- (the `for update` row lock also serializes concurrent callers safely),
-- so this is the one place that may ever change `available`.
create or replace function public.mini_decrement_stock(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  pid text;
  qty integer;
  cur integer;
begin
  for item in select * from jsonb_array_elements(p_items) loop
    pid := item->>'product_id';
    qty := greatest((item->>'qty')::integer, 0);
    if qty = 0 then continue; end if;

    select available into cur from public.mini_stock where product_id = pid for update;
    if found and cur < qty then
      raise exception 'INSUFFICIENT_STOCK:%:%:%', pid, cur, qty;
    end if;
  end loop;

  for item in select * from jsonb_array_elements(p_items) loop
    pid := item->>'product_id';
    qty := greatest((item->>'qty')::integer, 0);
    if qty = 0 then continue; end if;

    update public.mini_stock set available = available - qty, updated_at = now()
      where product_id = pid;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.mini_decrement_stock(jsonb) from public;
revoke all on function public.mini_decrement_stock(jsonb) from anon;
revoke all on function public.mini_decrement_stock(jsonb) from authenticated;
grant execute on function public.mini_decrement_stock(jsonb) to service_role;
