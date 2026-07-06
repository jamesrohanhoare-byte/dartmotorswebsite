-- ============================================================================
-- Storage: vehicle-images bucket (public read; owner-only writes within their
-- dealer folder). Path convention: {dealer_id}/{vehicle_id}/{file}
-- Used by the dealer portal's multi-image uploader for NEW uploads.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('vehicle-images', 'vehicle-images', true)
on conflict (id) do nothing;

-- Public can read images (the public site shows them)
drop policy if exists vehicle_images_public_read on storage.objects;
create policy vehicle_images_public_read on storage.objects
  for select using (bucket_id = 'vehicle-images');

-- Authenticated owner can write/update/delete only within their dealer folder
drop policy if exists vehicle_images_owner_insert on storage.objects;
create policy vehicle_images_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vehicle-images'
    and (storage.foldername(name))[1] = get_my_dealer_id()::text
  );

drop policy if exists vehicle_images_owner_update on storage.objects;
create policy vehicle_images_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vehicle-images'
    and (storage.foldername(name))[1] = get_my_dealer_id()::text
  );

drop policy if exists vehicle_images_owner_delete on storage.objects;
create policy vehicle_images_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vehicle-images'
    and (storage.foldername(name))[1] = get_my_dealer_id()::text
  );
