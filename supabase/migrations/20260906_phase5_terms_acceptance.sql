-- Phase 5 — Terms & Conditions acceptance record. The actual gate (showing
-- the modal, blocking checkout) runs client-side for instant response; this
-- table exists so there's a real, server-side, non-editable record of what
-- version a visitor accepted/declined and when, for accountability.
create table if not exists public.mini_terms_acceptance (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  terms_version text not null,
  accepted boolean not null,
  created_at timestamptz not null default now()
);
alter table public.mini_terms_acceptance enable row level security;
revoke all on table public.mini_terms_acceptance from anon;
revoke all on table public.mini_terms_acceptance from authenticated;
create index if not exists mini_terms_acceptance_visitor_idx on public.mini_terms_acceptance (visitor_id);
