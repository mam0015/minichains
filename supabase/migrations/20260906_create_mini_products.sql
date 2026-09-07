-- MiniChains v2 — single authoritative product/inventory source.
-- Replaces the hardcoded PRODUCTS objects duplicated across products.js and
-- 3 Edge Functions, and absorbs what mini_stock did. mini_stock itself is
-- left untouched (archived, not dropped) — nothing reads it after this
-- migration, but no historical data is destroyed.
create table if not exists public.mini_products (
  id text primary key,                              -- slug style: 'panda', 'soccer-ball', 'daisy', ...
  name text not null,
  description text not null default '',
  size text not null default '',
  print_time text not null default '',
  base_price_cents integer not null check (base_price_cents > 0),  -- the single cash/base price. Card = base * 1.05, computed at read time — never stored.
  image text not null default '',
  fallback_image text not null default '',
  credit text not null default '',
  source_url text not null default '',
  active boolean not null default true,             -- false = archived/pending, never hard-deleted
  limited_edition boolean not null default false,
  loyalty_reward_eligible boolean not null default true,
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  stock_reserved integer not null default 0 check (stock_reserved >= 0),   -- unused until the real-reservation phase; present now so that phase needs no further migration
  stock_available integer generated always as (greatest(stock_on_hand - stock_reserved, 0)) stored,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mini_products enable row level security;
revoke all on table public.mini_products from anon;
revoke all on table public.mini_products from authenticated;

-- Official v2 catalog (13 products, 4 price tiers). Soccer Ball/Spiderman/
-- Panda are the same physical models as the old KEY-05/KEY-08/KEY-03 —
-- their stock_on_hand carries over from mini_stock's last known counts (2,
-- 2, 3). Every other new-model product starts at 0 (shows correctly as
-- unavailable) until real counts are supplied — never fabricated. "Gold" is
-- seeded inactive/pending: no verified source model has been identified for
-- it yet, per an explicit instruction not to invent one.
insert into public.mini_products
  (id, name, description, size, print_time, base_price_cents, image, fallback_image, credit, source_url, active, limited_edition, stock_on_hand, display_order)
values
  ('music-note', 'Music Note Mini Keychain', 'A small beamed music-note charm. Simple and low-material — the lowest-cost pick in the range.', 'Small · single note charm', '≈ 15 min', 300, 'assets/images/music-note-real.jpg', 'assets/images/music-note-real.jpg', 'kevin.goetz', 'https://makerworld.com/en/models/1356704', true, false, 0, 1),
  ('daisy', 'Daisy Keychain', 'A simple daisy flower charm, low material usage.', 'Small · flat flower charm', '≈ 17 min', 300, 'assets/images/daisy-new.jpg', 'assets/images/daisy-new.jpg', 'Tunamy', 'https://makerworld.com/en/models/1613597-daisy-keychain', true, false, 0, 2),
  ('paw', 'Paw Keychain', 'A simple paw-print charm with a heart cutout.', 'Small · flat charm', '≈ 17 min', 300, 'assets/images/paw.jpg', 'assets/images/paw.jpg', '0_Tuli_0', 'https://makerworld.com/en/models/652635-key-chain-paw', true, false, 0, 3),

  ('basketball', 'Basket Ball Keychain', 'A flat basketball charm — sport-themed, stronger visual appeal than the basic entry charms.', 'Small · flat charm', '≈ 23 min', 300, 'assets/images/basketball-real.jpg', 'assets/images/basketball-real.jpg', 'fikuss30', 'https://makerworld.com/en/models/124469-basket-ball-keychain', true, false, 0, 4),
  ('soccer-ball', 'Soccer Ball Keychain', 'A compact soccer ball charm.', 'Small · flat soccer ball', '≈ 30 min', 300, 'assets/images/soccer-real.jpg', 'assets/images/soccer-real.jpg', 'Keychainguy', 'https://makerworld.com/en/models/2629300-soccer-ball-keychain', true, false, 2, 5),
  ('spiderman', 'Spiderman Keychain', 'A bold spider-silhouette charm.', 'Small · flat silhouette', '≈ 20 min', 300, 'assets/images/spiderman.jpg', 'assets/images/spiderman.jpg', 'rufus', 'https://makerworld.com/en/models/1127670-spiderman-keychain', true, false, 2, 6),
  ('fortnite-logo', 'Fortnite Logo Keychain', 'A quick logo-style print with high recognisable-brand appeal.', 'Small · flat logo charm', '≈ 18 min', 300, 'assets/images/fortnite-logo.jpg', 'assets/images/fortnite-logo.jpg', 'IronSerif', 'https://makerworld.com/en/models/1635423-fortnite-logo-keychain', true, false, 0, 7),
  ('cute-happy-cat', 'Cute Happy Cat Keychain', 'A cute-category charm with stronger perceived value than the most basic flat designs.', 'Small · flat charm', '≈ 24 min', 300, 'assets/images/cute-happy-cat-real.jpg', 'assets/images/cute-happy-cat-real.jpg', 'FC2M3D', 'https://makerworld.com/en/models/2298763-cute-happy-cat-keychain', true, false, 0, 8),

  ('panda', 'Panda Holding a Heart Keychain', 'Cute panda holding a heart. Flat, quick and beginner-friendly.', 'Medium · flat charm', '≈ 17 min', 300, 'assets/images/panda-real.jpg', 'assets/images/panda-real.jpg', 'Nolan3D', 'https://makerworld.com/en/models/233668-panda-holding-a-heart-keychain', true, false, 3, 9),
  ('minecraft-block', 'Minecraft Creeper Keychain', 'A cube-format Creeper charm — a longer print and higher perceived physical value than a flat charm.', 'Medium · block format', '≈ 35 min', 300, 'assets/images/minecraft-creeper.jpg', 'assets/images/minecraft-creeper.jpg', 'Misakov', 'https://makerworld.com/en/models/1340033-minecraft-creeper', true, false, 0, 10),
  ('gold', 'Gold Design', 'Pending — model not yet confirmed. Provisional price only; not orderable until identified and restocked.', '', '', 400, '', '', '', '', false, false, 0, 11),

  ('maltese-dog', 'Little Maltese Dog Keychain Edition', 'A detailed figure-style dog design — Limited Edition, more production complexity than the flat charms.', 'Medium · figure-style', '≈ 35 min', 400, 'assets/images/maltese-dog.jpg', 'assets/images/maltese-dog.jpg', 'Wolhart', 'https://makerworld.com/en/models/1309033-little-maltese-dog-keychain-edition', true, true, 0, 12),
  ('jordan', 'Jordan Keychain', 'The Jumpman logo silhouette — one of the strongest perceived-value designs in the range.', 'Small · flat logo charm', '≈ 45 min', 300, 'assets/images/jordan.jpg', 'assets/images/jordan.jpg', 'MORTI$', 'https://makerworld.com/en/models/919000-jordan-keychain', true, false, 0, 13),
  ('nike-shox', 'Nike Shox Keychain', 'A detailed Nike Shox-style sneaker charm — Limited Edition, the most detailed design in the range.', 'Small · figure-style shoe', '≈ 45 min', 500, 'assets/images/nike-shox.jpg', 'assets/images/nike-shox.jpg', 'FORMASTAMPA', 'https://makerworld.com/en/models/2562091-nike-shox-se-left-foot', true, true, 0, 14)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  size = excluded.size,
  print_time = excluded.print_time,
  base_price_cents = excluded.base_price_cents,
  image = excluded.image,
  fallback_image = excluded.fallback_image,
  credit = excluded.credit,
  source_url = excluded.source_url,
  active = excluded.active,
  limited_edition = excluded.limited_edition,
  display_order = excluded.display_order,
  updated_at = now();
  -- Note: stock_on_hand is deliberately NOT in the update list — re-running
  -- this migration (e.g. to fix a typo) must never reset a real, live stock
  -- count back to its seed value.

-- Same atomic all-or-nothing shape as the old mini_decrement_stock, now
-- targeting mini_products.stock_on_hand instead of mini_stock.available.
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

    select stock_on_hand into cur from public.mini_products where id = pid for update;
    if found and cur < qty then
      raise exception 'INSUFFICIENT_STOCK:%:%:%', pid, cur, qty;
    end if;
  end loop;

  for item in select * from jsonb_array_elements(p_items) loop
    pid := item->>'product_id';
    qty := greatest((item->>'qty')::integer, 0);
    if qty = 0 then continue; end if;

    update public.mini_products set stock_on_hand = stock_on_hand - qty, updated_at = now()
      where id = pid;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.mini_decrement_stock(jsonb) from public;
revoke all on function public.mini_decrement_stock(jsonb) from anon;
revoke all on function public.mini_decrement_stock(jsonb) from authenticated;
grant execute on function public.mini_decrement_stock(jsonb) to service_role;
