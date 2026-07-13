-- Migration 00045: AutoTrader leads support (2026-07-13).
--
-- ⚠️ ISOLATION CONTRACT (same as 00044): ADDITIVE ONLY. Extends the site_ website
-- tables; NEVER touches / alters / reads the finance or market_ tables. Dartbooks
-- (the finance app, shared DB) only READS these — it must never alter them here.
--
-- Purpose: let a background poller funnel AutoTrader leads into site_leads so they
-- appear on the Dartbooks Sales & Leads page next to website leads.
--   1. site_leads.external_id — a dedupe key so an AutoTrader lead can never be
--      inserted twice, even if a poll retries (website form leads leave it null).
--   2. site_sync_state — a heartbeat table so the leads page can show
--      "last synced X ago" (the watchdog; no alerting in v1).

-- ── 1. Dedupe key on site_leads ──────────────────────────────────────────────
alter table site_leads add column if not exists external_id text;

-- Plain (non-partial) unique index. NULLs are distinct in Postgres, so the many
-- website form leads with NULL external_id coexist fine. It must be non-partial:
-- a "where external_id is not null" partial index would NOT satisfy the arbiter
-- inference for `on conflict (external_id)` that the poller's upsert relies on.
create unique index if not exists site_leads_external_id_uq
  on site_leads (external_id);

-- ── 2. site_sync_state — background poller heartbeat ─────────────────────────
create table if not exists site_sync_state (
  key          text primary key,                    -- e.g. 'autotrader_leads'
  last_run_at  timestamptz not null default now(),
  ok           boolean not null default true,
  note         text
);

alter table site_sync_state enable row level security;

-- Staff (authenticated Dart users) may READ the heartbeat for the "last synced"
-- stamp. Writes are service_role only (the poller), which bypasses RLS — mirroring
-- how /api/sync writes site_stock without an explicit service_role grant.
grant select on site_sync_state to authenticated;

create policy site_sync_state_staff_read
  on site_sync_state for select
  to authenticated
  using (true);

-- No insert/update/delete policies → those ops are denied for anon/authenticated;
-- only the service_role poller writes here.
