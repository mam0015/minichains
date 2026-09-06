-- Phase 10 — Coming Soon products. Reuses mini_restock_requests /
-- restock-request for interest tracking rather than duplicating an
-- identical table+function pair — "let us know you want this" is the same
-- mechanism whether the item is sold out or not yet released. The admin
-- dashboard tells the two apart by checking each requested product's
-- current active/coming_soon flags, not by a separate table.
alter table public.mini_products
  add column if not exists coming_soon boolean not null default false;
