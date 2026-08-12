-- 00050_manual_listings.sql
-- Listings that do NOT come from the VMG feed (the first one: a car trailer Dart
-- wants to sell). They live in site_stock like everything else, so they inherit the
-- whole vehicle page, gallery and lead flow for free — the only thing that has to
-- change is that the feed sync must stop treating them as its own.
--
-- See docs/manual-listings-design.md for the reasoning.

-- ── 1. Origin, custom specs, finance control ────────────────────────────────
alter table site_stock
  add column if not exists source        text    not null default 'feed',
  add column if not exists specs         jsonb,
  add column if not exists show_finance  boolean not null default true;

do $$ begin
  alter table site_stock add constraint site_stock_source_chk
    check (source in ('feed', 'manual'));
exception when duplicate_object then null; end $$;

-- specs is an ordered [{label, value}] list. Cars derive their spec grid from feed
-- fields; a trailer needs length/width/carry capacity, so a manual listing carries
-- its own labelled list rather than us adding a column per possible attribute.
do $$ begin
  alter table site_stock add constraint site_stock_specs_is_array
    check (specs is null or jsonb_typeof(specs) = 'array');
exception when duplicate_object then null; end $$;

create index if not exists site_stock_source_idx on site_stock (source);

comment on column site_stock.source is
  'feed = mirrored from VMG and reconciled by /api/sync. manual = created in Dartbooks; the sync must never archive it.';
comment on column site_stock.specs is
  'Manual listings only: ordered [{"label","value"}] rendered in place of the car spec grid.';
comment on column site_stock.show_finance is
  'Whether the "Apply for financing" CTA renders on the detail page. Off for things finance houses will not fund (e.g. a trailer).';

-- ── 2. Dartbooks may write manual rows, and ONLY manual rows ────────────────
-- Dartbooks and the website share this project. Dartbooks previously only READ the
-- site_* tables; the manual-listings manager needs to write them. The boundary is
-- enforced here rather than in the UI: `using` covers read/update/delete and
-- `with check` covers insert/update, so a logged-in browser session can never
-- create, alter or delete a feed car even with a hand-crafted request.
--
-- Not user-scoped on purpose: this is single-dealer, staff-wide business data, the
-- same shape as the existing site_leads_staff_read policy. There is no per-user
-- ownership concept for a car on a dealership's own website.
drop policy if exists site_stock_manual_write on site_stock;
create policy site_stock_manual_write
  on site_stock for all
  to authenticated
  using (source = 'manual')
  with check (source = 'manual');

grant select, insert, update, delete on site_stock to authenticated;

-- ── 3. Photos: a public bucket, because manual listings have no upstream host ─
-- Feed cars hotlink VMG's S3. These have nowhere to be hotlinked from. Public read
-- keeps them servable through a plain <img>, which is what next.config.ts's
-- `images: { unoptimized: true }` exists to guarantee — no photo ever reaches
-- Vercel's metered optimizer. Display sizing is handled by the free weserv CDN in
-- src/lib/img.ts, exactly as it is for VMG photos.
insert into storage.buckets (id, name, public)
values ('site-stock-images', 'site-stock-images', true)
on conflict (id) do nothing;

drop policy if exists site_stock_images_public_read on storage.objects;
create policy site_stock_images_public_read on storage.objects
  for select using (bucket_id = 'site-stock-images');

drop policy if exists site_stock_images_staff_insert on storage.objects;
create policy site_stock_images_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-stock-images');

drop policy if exists site_stock_images_staff_update on storage.objects;
create policy site_stock_images_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'site-stock-images');

-- Deleting a listing (or a single photo mid-edit) must actually reclaim the space.
-- Storage that only ever grows is a slow leak, so staff can delete objects here.
drop policy if exists site_stock_images_staff_delete on storage.objects;
create policy site_stock_images_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-stock-images');

-- ── 4. Publish immediately instead of waiting out the ISR hour ──────────────
-- /api/sync already calls revalidatePath after it writes. Manual listings get the
-- same treatment without shipping a secret in a browser bundle: the database calls
-- the site itself. Same pattern as the AutoTrader pg_cron job.
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.app_config (
  key   text primary key,
  value text not null
);
revoke all on private.app_config from anon, authenticated;

-- Values are inserted out-of-band (they are secrets, they do not belong in git).
insert into private.app_config (key, value)
values ('site_url', 'https://dartmotors.net')
on conflict (key) do nothing;

create or replace function private.notify_site_revalidate()
returns trigger
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  tok  text;
  site text;
begin
  select value into tok  from private.app_config where key = 'revalidate_secret';
  select value into site from private.app_config where key = 'site_url';
  -- Not configured yet: stay silent. A missing secret must never break a save.
  if tok is null or site is null then
    return null;
  end if;

  perform net.http_post(
    url     := site || '/api/revalidate',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || tok,
                 'Content-Type',  'application/json'
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  return null;
end;
$$;

-- Row-level with a WHEN filter: manual listings are edited one at a time, while the
-- 6-hourly feed upsert touches ~35 rows and must not fire this at all.
drop trigger if exists site_stock_manual_revalidate_ins on site_stock;
create trigger site_stock_manual_revalidate_ins
  after insert on site_stock
  for each row when (new.source = 'manual')
  execute function private.notify_site_revalidate();

drop trigger if exists site_stock_manual_revalidate_upd on site_stock;
create trigger site_stock_manual_revalidate_upd
  after update on site_stock
  for each row when (new.source = 'manual' or old.source = 'manual')
  execute function private.notify_site_revalidate();

drop trigger if exists site_stock_manual_revalidate_del on site_stock;
create trigger site_stock_manual_revalidate_del
  after delete on site_stock
  for each row when (old.source = 'manual')
  execute function private.notify_site_revalidate();
