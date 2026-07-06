-- Per-vehicle view tracking (simple, owned instrumentation).

alter table vehicles add column if not exists views int not null default 0;

-- Public (anonymous) callable: increment a vehicle's view count.
create or replace function bump_views(vehicle uuid)
returns void language sql security definer set search_path = public as $$
  update vehicles set views = views + 1 where id = vehicle;
$$;

grant execute on function bump_views(uuid) to anon, authenticated;
