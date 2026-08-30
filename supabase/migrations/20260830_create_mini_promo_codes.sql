create table if not exists public.mini_promo_codes (
  code text primary key,
  type text not null
    check (type in ('discount', 'free')),
  percent numeric(5,2) not null default 0,
  free_product_id text,
  used boolean not null default false,
  used_at timestamptz,
  used_for_order text,
  created_at timestamptz not null default now()
);

alter table public.mini_promo_codes enable row level security;

revoke all on table public.mini_promo_codes from anon;
revoke all on table public.mini_promo_codes from authenticated;

create index if not exists mini_promo_codes_used_idx
  on public.mini_promo_codes (used);
