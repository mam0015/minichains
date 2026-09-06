-- MiniChains Rewards (loyalty) system.
-- Visit counting/advancement happens only in the square-webhook function,
-- at the moment a card payment is actually confirmed — never from anything
-- the browser sends directly. See supabase/functions/square-webhook and
-- supabase/functions/create-square-checkout for the read/write split.

create table if not exists public.mini_loyalty_accounts (
  username text primary key,              -- normalized: trimmed, lowercased
  display_username text not null,         -- original casing, for display only
  current_cycle_visits int not null default 0
    check (current_cycle_visits >= 0 and current_cycle_visits <= 2),
  last_eligible_purchase_date date,       -- Melbourne-local date of the most recent counted visit
  total_eligible_visits int not null default 0,
  completed_cycles int not null default 0,
  discounts_redeemed int not null default 0,
  free_keychains_redeemed int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mini_loyalty_accounts enable row level security;
revoke all on table public.mini_loyalty_accounts from anon;
revoke all on table public.mini_loyalty_accounts from authenticated;

create table if not exists public.mini_loyalty_history (
  id uuid primary key default gen_random_uuid(),
  username text not null references public.mini_loyalty_accounts(username),
  order_id text not null unique,          -- one loyalty outcome per order, ever
  square_order_id text,
  square_payment_id text,
  purchase_date date not null,            -- Melbourne-local date
  reward_type text not null
    check (reward_type in ('visit1', 'discount10', 'free_keychain', 'same_day_repeat')),
  visit_number int not null,
  discount_amount numeric(10,2) not null default 0,
  free_product_id text,
  free_product_name text,
  created_at timestamptz not null default now()
);

alter table public.mini_loyalty_history enable row level security;
revoke all on table public.mini_loyalty_history from anon;
revoke all on table public.mini_loyalty_history from authenticated;

create index if not exists mini_loyalty_history_username_idx
  on public.mini_loyalty_history (username);

-- mini_orders gains the columns needed to carry a loyalty decision from
-- checkout-creation time through to webhook-confirmation time.
alter table public.mini_orders
  add column if not exists rewards_username text,
  add column if not exists rewards_username_display text,
  add column if not exists loyalty_visit_number int,
  add column if not exists loyalty_reward_type text,
  add column if not exists loyalty_discount_percent numeric(5,2) not null default 0,
  add column if not exists loyalty_discount_amount numeric(10,2) not null default 0,
  add column if not exists loyalty_free_product_id text,
  add column if not exists loyalty_processed boolean not null default false;
