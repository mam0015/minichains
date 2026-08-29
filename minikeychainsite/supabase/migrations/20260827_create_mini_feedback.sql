create extension if not exists pgcrypto;

create table if not exists public.mini_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id text,
  payment_method text
    check (payment_method is null or payment_method in ('cash', 'card')),
  first_name text,
  level text,
  comment text,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mini_feedback enable row level security;

revoke all on table public.mini_feedback from anon;
revoke all on table public.mini_feedback from authenticated;

create index if not exists mini_feedback_created_at_idx
  on public.mini_feedback (created_at desc);

create index if not exists mini_feedback_payment_method_idx
  on public.mini_feedback (payment_method);

create index if not exists mini_feedback_level_idx
  on public.mini_feedback (level);
