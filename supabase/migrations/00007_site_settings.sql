-- ============================================================================
-- Site settings: dealer-editable site imagery (home showroom photo + about photo).
-- One row per dealer. Public can read (the public site displays them); only the
-- owner can write their own dealer's row. Images live in the existing
-- `vehicle-images` bucket under {dealer_id}/site/... (covered by its policies).
-- ============================================================================

create table if not exists site_settings (
  dealer_id          uuid primary key references dealers(id) on delete cascade,
  showroom_image_url text,
  about_image_url    text,
  updated_at         timestamptz not null default now()
);

alter table site_settings enable row level security;

-- Public read (image URLs are non-sensitive; the live site needs them anonymously)
drop policy if exists site_settings_public_read on site_settings;
create policy site_settings_public_read on site_settings
  for select using (true);

-- Owner can insert/update/delete only their own dealer's settings row
drop policy if exists site_settings_owner_write on site_settings;
create policy site_settings_owner_write on site_settings
  for all
  using (dealer_id = get_my_dealer_id())
  with check (dealer_id = get_my_dealer_id());

-- Seed a row for the existing Autocrat dealer
insert into site_settings (dealer_id)
values ('11111111-1111-1111-1111-111111111111')
on conflict (dealer_id) do nothing;
