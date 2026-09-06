-- Phase 9 — generic funnel analytics. Verified sales/revenue/units already
-- live in mini_orders (status='paid'); promo wins/redemption, loyalty
-- membership, and restock demand already have their own tables. This table
-- only fills the actual gap: pre-purchase funnel behaviour that has no
-- other home — views, searches, category clicks, add-to-cart, checkout
-- started. visitor_id is the same random per-browser id used elsewhere
-- (Terms, restock requests) — a device/browser estimate, not a verified
-- identity, and never cross-referenced with anything personal.
create table if not exists public.mini_analytics_events (
  id bigint generated always as identity primary key,
  visitor_id text not null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.mini_analytics_events enable row level security;
revoke all on table public.mini_analytics_events from anon;
revoke all on table public.mini_analytics_events from authenticated;
create index if not exists mini_analytics_events_type_idx on public.mini_analytics_events (event_type, created_at desc);
create index if not exists mini_analytics_events_visitor_idx on public.mini_analytics_events (visitor_id);
