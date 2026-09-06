-- Phase 4 — staff-only "Confirm Cash Received". Today ANY browser sitting
-- on success.html (customer's own phone included) can tap that button with
-- no gate at all. This adds a minimal real auth primitive: a shared staff
-- PIN (never stored here — checked against the STAFF_PIN Supabase secret in
-- the staff-login function) exchanged for an opaque session token, so only
-- someone who knows the PIN can complete a cash sale. Deliberately small —
-- a single shared PIN, not per-staff accounts — appropriate for a one/two
-- person school-project register; Phase 8's admin dashboard can build a
-- fuller auth model on top of this if that's ever actually needed.
create table if not exists public.mini_staff_sessions (
  token text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.mini_staff_sessions enable row level security;
revoke all on table public.mini_staff_sessions from anon;
revoke all on table public.mini_staff_sessions from authenticated;
create index if not exists mini_staff_sessions_expires_idx on public.mini_staff_sessions (expires_at);
