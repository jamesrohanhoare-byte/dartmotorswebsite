-- ============================================================================
-- Autocrat Motors — initial schema
-- Multi-tenant-ready (dealer = tenant) so this can later host more dealers.
-- Strict owner-scoped RLS on writes; public read only for available stock.
-- ============================================================================

-- ── Tenant: dealers ────────────────────────────────────────────────────────
create table if not exists dealers (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ── Profiles: link auth users to a dealer + role ───────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  dealer_id   uuid references dealers(id) on delete set null,
  email       text,
  role        text not null default 'owner',
  created_at  timestamptz not null default now()
);

-- Helper: the dealer the current user belongs to (used in every policy).
create or replace function get_my_dealer_id()
returns uuid language sql security definer stable as $$
  select dealer_id from profiles where id = auth.uid()
$$;

-- ── Vehicles ───────────────────────────────────────────────────────────────
create table if not exists vehicles (
  id            uuid primary key default gen_random_uuid(),
  dealer_id     uuid not null references dealers(id) on delete cascade,
  slug          text not null,
  make          text not null,
  model         text not null,
  year          int  not null,
  price         numeric,                 -- null => POA
  mileage       int,
  fuel_type     text,
  transmission  text,
  body_type     text,
  colour        text,
  condition     text,
  description    text,
  status        text not null default 'available',  -- available | sold | hidden
  featured      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (dealer_id, slug)
);
create index if not exists vehicles_dealer_idx  on vehicles (dealer_id);
create index if not exists vehicles_status_idx  on vehicles (status);
create index if not exists vehicles_make_idx    on vehicles (make);

-- ── Vehicle images (ordered gallery, many per vehicle) ─────────────────────
create table if not exists vehicle_images (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid not null references vehicles(id) on delete cascade,
  storage_path text not null,
  public_url   text not null,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists vehicle_images_vehicle_idx on vehicle_images (vehicle_id, sort_order);

-- ── Enquiries (lead capture — every WhatsApp/email/form enquiry) ───────────
create table if not exists enquiries (
  id          uuid primary key default gen_random_uuid(),
  dealer_id   uuid not null references dealers(id) on delete cascade,
  vehicle_id  uuid references vehicles(id) on delete set null,
  name        text,
  contact     text,
  channel     text not null default 'form',  -- whatsapp | email | form
  message     text,
  created_at  timestamptz not null default now()
);
create index if not exists enquiries_dealer_idx on enquiries (dealer_id, created_at desc);

-- ── Finance applications (preserve current-site finance functionality) ─────
create table if not exists finance_applications (
  id          uuid primary key default gen_random_uuid(),
  dealer_id   uuid not null references dealers(id) on delete cascade,
  vehicle_id  uuid references vehicles(id) on delete set null,
  name        text,
  contact     text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists finance_dealer_idx on finance_applications (dealer_id, created_at desc);

-- ── updated_at trigger ─────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists vehicles_set_updated_at on vehicles;
create trigger vehicles_set_updated_at before update on vehicles
  for each row execute function set_updated_at();

-- ── Auto-create a profile on signup, attached to the Autocrat dealer ───────
-- (single-tenant for now: the owner who signs up becomes the dealer admin)
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, dealer_id, role)
  values (new.id, new.email,
          (select id from dealers order by created_at limit 1), 'owner');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ── Row Level Security ─────────────────────────────────────────────────────
alter table dealers              enable row level security;
alter table profiles             enable row level security;
alter table vehicles             enable row level security;
alter table vehicle_images       enable row level security;
alter table enquiries            enable row level security;
alter table finance_applications enable row level security;

-- dealers: public can read; members can update their own dealer
create policy dealers_public_read on dealers for select using (true);
create policy dealers_member_update on dealers for update
  using (id = get_my_dealer_id()) with check (id = get_my_dealer_id());

-- profiles: a user manages only their own profile row
create policy profiles_own on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- vehicles: public sees AVAILABLE only; owner has full control of their dealer's
create policy vehicles_public_read on vehicles for select
  using (status = 'available');
create policy vehicles_owner_read on vehicles for select
  using (dealer_id = get_my_dealer_id());
create policy vehicles_owner_insert on vehicles for insert
  with check (dealer_id = get_my_dealer_id());
create policy vehicles_owner_update on vehicles for update
  using (dealer_id = get_my_dealer_id()) with check (dealer_id = get_my_dealer_id());
create policy vehicles_owner_delete on vehicles for delete
  using (dealer_id = get_my_dealer_id());

-- vehicle_images: public sees images of available vehicles; owner full control
create policy vehicle_images_public_read on vehicle_images for select
  using (exists (select 1 from vehicles v
                 where v.id = vehicle_images.vehicle_id and v.status = 'available'));
create policy vehicle_images_owner_all on vehicle_images for all
  using (exists (select 1 from vehicles v
                 where v.id = vehicle_images.vehicle_id and v.dealer_id = get_my_dealer_id()))
  with check (exists (select 1 from vehicles v
                 where v.id = vehicle_images.vehicle_id and v.dealer_id = get_my_dealer_id()));

-- enquiries: anyone can submit; only the owner can read their dealer's leads
create policy enquiries_public_insert on enquiries for insert with check (true);
create policy enquiries_owner_read on enquiries for select
  using (dealer_id = get_my_dealer_id());

-- finance applications: same shape as enquiries
create policy finance_public_insert on finance_applications for insert with check (true);
create policy finance_owner_read on finance_applications for select
  using (dealer_id = get_my_dealer_id());

-- ── Seed the Autocrat dealer (fixed id so vehicle seeds can reference it) ───
insert into dealers (id, slug, name)
values ('11111111-1111-1111-1111-111111111111', 'autocrat-motors', 'Autocrat Motors')
on conflict (id) do nothing;
