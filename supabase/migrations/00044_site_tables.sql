-- Migration 00044: Dart Motors WEBSITE tables (2026-07-03).
--
-- ⚠️ ISOLATION CONTRACT (James's #1 requirement — the live finance app must not
-- be disturbed): this migration is ADDITIVE ONLY. It CREATEs three new tables,
-- all `site_`-prefixed, and NEVER touches / alters / reads the finance tables,
-- their policies, or their functions. This mirrors exactly how the `market_`
-- tables were added (migration 00038) and coexisted safely with the live books.
--
-- These tables power the public dartmotors.net website (separate repo + Vercel
-- project) which reads/writes ONLY here. RLS intentionally diverges from the
-- "user_id-scoped" project rule (like the market_ tables) because a public
-- website's anon key must read stock and accept form submissions.
--
-- Security model:
--   • anon (browser)  → SELECT site_stock ; INSERT site_leads / site_finance_applications. Nothing else.
--   • authenticated (Dart staff) → also SELECT the leads/finance for the future CRM.
--   • service_role (server-only, /api/sync) → full access to write stock (bypasses RLS).
-- No sensitive fields (VIN / M&M code / licence) are stored here — the site never
-- displays them, so they are deliberately omitted from the anon-readable table.

-- ── 1. site_stock — VMG-feed-synced public inventory ─────────────────────────
create table if not exists site_stock (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,             -- "stock-{stockID}" (stable key)
  stock_id      integer not null,
  make          text not null,
  variant       text,
  title         text,                             -- "{year} {make} {variant}"
  year          integer,
  price         integer,                          -- whole rand; 0/null => POA
  mileage       integer,
  colour        text,
  new_used      text,
  condition     text,
  extras        text,                             -- raw feature blob (split in UI)
  description   text,
  reference_id  integer,
  date_updated  timestamptz,
  images        text[] not null default '{}',     -- hotlinked VMG S3 URLs, ordered
  status        text not null default 'available',-- available | sold (soft-delete)
  featured      boolean not null default false,
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists site_stock_status_idx on site_stock (status);
create index if not exists site_stock_make_idx   on site_stock (make);

-- ── 2. site_leads — general + per-car website enquiries ──────────────────────
create table if not exists site_leads (
  id          uuid primary key default gen_random_uuid(),
  stock_slug  text,                               -- null = general enquiry
  name        text,
  contact     text,                               -- phone/email as entered
  channel     text not null default 'form',       -- form | whatsapp | email | newsletter
  message     text,
  meta        jsonb,                              -- utm / page / extras
  created_at  timestamptz not null default now()
);
create index if not exists site_leads_created_idx on site_leads (created_at desc);

-- ── 3. site_finance_applications — the multi-step finance wizard ─────────────
create table if not exists site_finance_applications (
  id                  uuid primary key default gen_random_uuid(),
  name                text,
  surname             text,
  vehicle_of_interest text,
  details             jsonb not null,             -- all 28 fields, verbatim
  created_at          timestamptz not null default now()
);
create index if not exists site_finance_created_idx on site_finance_applications (created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table site_stock                enable row level security;
alter table site_leads                enable row level security;
alter table site_finance_applications enable row level security;

-- Explicit privilege grants (RLS still gates rows on top of these).
grant select on site_stock to anon, authenticated;
grant insert on site_leads, site_finance_applications to anon, authenticated;
grant select on site_leads, site_finance_applications to authenticated;

-- Public may READ stock only.
create policy site_stock_read
  on site_stock for select
  to anon, authenticated
  using (true);

-- Public may INSERT enquiries, but never read/update/delete them.
create policy site_leads_insert
  on site_leads for insert
  to anon, authenticated
  with check (true);

create policy site_finance_insert
  on site_finance_applications for insert
  to anon, authenticated
  with check (true);

-- Staff (authenticated Dart users) may READ submissions (future CRM).
create policy site_leads_staff_read
  on site_leads for select
  to authenticated
  using (true);

create policy site_finance_staff_read
  on site_finance_applications for select
  to authenticated
  using (true);

-- No update/delete policies exist → those ops are denied for anon/authenticated.
-- The sync writer (/api/sync) uses the service_role key which bypasses RLS.
