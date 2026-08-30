create table if not exists public.mini_orders (
  id text primary key,
  payment_method text not null
    check (payment_method in ('cash', 'card')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'cash_due', 'cash_received')),
  items jsonb not null,
  subtotal numeric(10,2) not null,
  promo_code text,
  promo_percent numeric(5,2) not null default 0,
  promo_discount numeric(10,2) not null default 0,
  free_prize_product_id text,
  cash_discount_percent numeric(5,2) not null default 0,
  cash_discount numeric(10,2) not null default 0,
  cash_base numeric(10,2),
  total numeric(10,2) not null,
  square_payment_link_id text,
  square_order_id text,
  survey jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.mini_orders enable row level security;

revoke all on table public.mini_orders from anon;
revoke all on table public.mini_orders from authenticated;

create index if not exists mini_orders_status_idx
  on public.mini_orders (status);

create index if not exists mini_orders_square_order_id_idx
  on public.mini_orders (square_order_id);

create index if not exists mini_orders_created_at_idx
  on public.mini_orders (created_at desc);
