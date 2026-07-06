-- ============================================================================
-- Recently Sold: track sold date, expose sold cars to the public site (no price
-- shown in UI), and auto-prune so only the 5 most recent sold cars are ever kept.
-- ============================================================================

alter table vehicles add column if not exists sold_at timestamptz;

-- Stamp sold_at when a car becomes 'sold'; clear it when it leaves 'sold'.
create or replace function set_sold_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'sold' then
    if new.sold_at is null then new.sold_at = now(); end if;
  else
    new.sold_at = null;
  end if;
  return new;
end; $$;

drop trigger if exists vehicles_set_sold_at on vehicles;
create trigger vehicles_set_sold_at before insert or update on vehicles
  for each row execute function set_sold_at();

-- Keep only the 5 most recently sold cars; delete older sold ones automatically.
create or replace function prune_sold_vehicles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'sold' then
    delete from vehicles
    where dealer_id = new.dealer_id
      and status = 'sold'
      and id not in (
        select id from vehicles
        where dealer_id = new.dealer_id and status = 'sold'
        order by sold_at desc nulls last
        limit 5
      );
  end if;
  return null;
end; $$;

drop trigger if exists vehicles_prune_sold on vehicles;
create trigger vehicles_prune_sold after insert or update of status on vehicles
  for each row execute function prune_sold_vehicles();

-- Public can now read available AND sold cars (sold = for the Recently Sold page).
drop policy if exists vehicles_public_read on vehicles;
create policy vehicles_public_read on vehicles for select
  using (status in ('available', 'sold'));

drop policy if exists vehicle_images_public_read on vehicle_images;
create policy vehicle_images_public_read on vehicle_images for select
  using (exists (select 1 from vehicles v
                 where v.id = vehicle_images.vehicle_id
                   and v.status in ('available', 'sold')));

-- Marco's updates:
-- 911 Carrera Black Edition is recently sold; Evoque photos are wrong -> hide until corrected.
update vehicles set status = 'sold'   where slug like '2015-porsche-911-carrera-black-edition%';
update vehicles set status = 'hidden' where slug like '2017-land-rover-range-rover-evoque%';
