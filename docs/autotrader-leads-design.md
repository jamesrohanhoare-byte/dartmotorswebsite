# AutoTrader Leads → site_leads Integration (Dart Motors)

**Date:** 2026-07-13 · **Status:** Approved design, ready to implement · **Owner:** James / Social Agencies

## Purpose
Funnel Dart Motors' AutoTrader leads into the same `site_leads` table the website already writes to, so they appear automatically on the Dartbooks **Sales & Leads** page (`/sales`), badged "AutoTrader", right next to website leads. This is the first feeder of the unified per-dealer lead inbox, built as a **reusable module**: one Social Agencies AutoTrader credential, one DID per dealer.

## Locked decisions (2026-07-13)
- **Auto-reply to the customer:** NOT in v1. Logging only.
- **Lead streams:** pull BOTH endpoints. The `/leads/dealers` WhatsApp-click stream is noisy (repeat clicks by one person), so it is **deduped by phone** (one lead per person, most recent). Live proof: 46 raw clicks → 24 unique people.
- **Dedupe:** additive `external_id` column + a plain (non-partial) unique index. Contact leads key `at:{id}`; WhatsApp leads key `atd:{phone}`.
- **Poll interval:** every 5 min via a **Supabase pg_cron** job (reliable, in-database, free) — NOT GitHub Actions, which drops frequent crons. See the Scheduler section.
- **Retention:** NO auto-purge. The dealer deletes leads by hand (delete button per row; migration 00046 grants the staff delete policy). `LEAD_RETENTION_DAYS` now defaults to 0 (off) so nothing disappears on a month rollover.
- **Page organization (Dartbooks Sales & Leads):** three tabs — **Enquiries** (real leads incl. AutoTrader, excl. poll), **Finance applications**, **Where did you find us** (the "heard-about-us" poll answers, kept out of enquiries so they don't mislead the count). Stat tiles are all **weekly** (last 7 days), not lifetime totals.
- **Finance:** AutoTrader has no finance-application feed — only a `preQualifiedStatus` flag per lead, surfaced as a green "Pre-qualified" badge. Full finance applications stay the website wizard (the Finance tab).

## API facts (confirmed working live 2026-07-13)
- Base `https://services.autotrader.co.za`, HTTP Basic auth (Social Agencies credential; token stored in `Operations/Accounts.md`, Dart section).
- Dart DID: **31613**.
- `GET /api/lead/v2.0/leads?dealerIds={DID}&received=false` → `sendContactMessageLeads[]`
- `GET /api/lead/v2.0/leads/dealers?dealerIds={DID}&received=false` → `dealerLeads[]`
- `POST /api/lead/v2.0/leads/set-received` `{ ids:[], received:true }`
- `POST /api/lead/v2.0/leads/dealers/received` `{ ids:[], received:true }`
- Pull-only. No customer-reply endpoint. Rate limits undocumented (poll gently, handle 429).

## Architecture

### 1. The courier (website repo `dart-motors-web`, under `web/`)
- New route `web/src/app/api/autotrader/route.ts` — a copy of `web/src/app/api/sync/route.ts`: exports GET + POST, `authorized()` accepts `x-vercel-cron: 1` OR `Authorization: Bearer ${SYNC_SECRET}`; `runtime="nodejs"`, `dynamic="force-dynamic"`, `maxDuration=60`. (Repo's `AGENTS.md` warns Next.js 16 is non-standard — mirror the existing sync route, do not freelance route code.)
- New lib `web/src/lib/autotrader/poll.ts`:
  1. Fetch both endpoints with `received=false` for `AUTOTRADER_DEALER_ID`.
  2. Map each lead → a `site_leads` row (mapping below).
  3. Insert via `createServiceClient()` (service-role) with `ON CONFLICT (external_id) DO NOTHING`.
  4. Collect the ids we actually stored, then POST set-received to both endpoints (only for stored ids — so a lead is never acknowledged until it is safely saved).
  5. Update `site_sync_state` row `autotrader_leads` → now().
- Config env: `AUTOTRADER_API_TOKEN` (shared SA Basic token), `AUTOTRADER_DEALER_ID` (31613 for Dart); reuse `SUPABASE_SERVICE_ROLE_KEY`, `SYNC_SECRET`.

### 2. Data mapping (AutoTrader → `site_leads`)
| site_leads column | value |
|---|---|
| `name` | `lead.name` |
| `contact` | `lead.emailAddress` (fallback `phoneNumber`) |
| `channel` | `"autotrader"` |
| `message` | `lead.message`; if generic (e.g. WhatsApp "Contact Buyer…"), prefix with the car |
| `meta` (jsonb) | `{ source:"AutoTrader", phone, car:"{year} {make} {model} {variant}", price, stockNumber, registrationNumber, preQualifiedStatus, isVerifiedEmail, atSource: lead.source, listingId }` |
| `external_id` | `"at:{id}"` (leads) / `"atd:{id}"` (dealers) — prevents cross-endpoint id collision |
| `stock_slug` | best-effort match `stockNumber` → `site_stock`; else `null` (car still shown via message/meta) |
| `created_at` | `lead.date` (real enquiry time, NOT ingest time) |

Also add `"autotrader"` to the channel allowlist in `web/src/app/api/lead/route.ts` for consistency (the poller writes direct via service-role, so this is cosmetic but keeps the allowlist honest).

### 3. DB migration (website repo owns `site_*`)
`web/supabase/migrations/00045_autotrader_leads.sql` (confirm next number at build time):
- `alter table site_leads add column external_id text;`
- `create unique index site_leads_external_id_uq on site_leads (external_id) where external_id is not null;`
- `create table if not exists site_sync_state (key text primary key, last_run_at timestamptz not null default now(), note text);`
- RLS on `site_sync_state`: enable + a staff-read policy mirroring `site_leads_staff_read` (authenticated read). Writes are service-role only.
- **Dartbooks only READS these — never alters `site_*`.**

### 4. Dartbooks display (repo `dartbooks`, read-only on `site_*`)
- `src/hooks/useSales.ts`: extend `Lead.meta` shape (optional `car`, `price`, `preQualifiedStatus`, `isVerifiedEmail`); allow `channel:"autotrader"`.
- `src/pages/sales/SalesPage.tsx`: add `autotrader: 'AutoTrader'` to `CHANNEL_LABEL`; render a badge when `channel === 'autotrader'` (reuse the `SourceBadge` pill style or a channel-coloured pill). Optionally surface price / a "pre-qualified" flag.
- Add a **"Last synced X ago"** stamp near the Enquiries tab, reading `site_sync_state` where `key='autotrader_leads'`. This is the watchdog (no separate alerting in v1, per James).

## Scheduler — Supabase pg_cron (the reliable standard)
- **Poller = a `pg_cron` job inside the dealer's own Supabase** (`autotrader-leads-sync`, `*/5 * * * *`) that uses `pg_net` to `net.http_post` the route with `Authorization: Bearer ${AUTOTRADER_SYNC_SECRET}` (a dedicated secret, separate from the shared `SYNC_SECRET`). Reliable, in-database, free, no external service.
- **Why NOT GitHub Actions:** GitHub silently drops frequent scheduled crons — a `*/15` fired **0 times in 40 min** (2026-07-13). It only honours long intervals (fine for the 6h VMG stock sync, useless for lead polling). pg_cron is a real Postgres cron and fires on time. **This is now the standard scheduler for lead pollers on every dealer build.** The old `autotrader.yml` GitHub Action was removed once pg_cron proved out; the route still accepts either secret, so a GitHub backup could be re-added if ever wanted.
- Setup SQL (run once per dealer via the Management API):
  ```sql
  create extension if not exists pg_cron; create extension if not exists pg_net;
  select cron.schedule('autotrader-leads-sync','*/5 * * * *',
    $job$ select net.http_post(
      url:='https://<dealer-domain>/api/autotrader',
      headers:=jsonb_build_object('Authorization','Bearer <AUTOTRADER_SYNC_SECRET>','Content-Type','application/json'),
      body:='{}'::jsonb, timeout_milliseconds:=55000); $job$);
  ```
- Watchdog = the last-synced stamp on the page (amber threshold 3h; effectively never trips at a 5-min cadence).

## Out of scope (v1)
- Auto-reply email to the customer (Phase 1.5 toggle).
- Meta click-to-WhatsApp ad leads (Phase 2 = WhatsApp Business Cloud API + WhatsApp CRM).
- Guaranteed link of every lead to its exact on-site car (best-effort match only in v1).

## Reusable module — onboarding a new dealer
1. AutoTrader (Yu-Lin) links the new dealer to the Social Agencies account and provides their DID.
2. Set `AUTOTRADER_DEALER_ID` + a fresh per-dealer `AUTOTRADER_SYNC_SECRET` on that dealer's site; reuse the shared `AUTOTRADER_API_TOKEN`. Deploy.
3. Set up the **pg_cron poller** on that dealer's Supabase (Scheduler SQL above, URL pointed at their domain). This is the reliable scheduler — do NOT rely on GitHub Actions for lead polling.
4. Same engine, new number. Later: codify as an extension of the `dealer-lead-flow` skill.

## Test plan (verify before "done")
1. Manual poll vs Dart DID 31613 → the 14 unreceived leads land in `site_leads` (channel `autotrader`, correct car/price/contact/date).
2. They render on the Dartbooks Sales & Leads page with the AutoTrader badge.
3. Second poll → zero duplicates (`external_id`) and set-received stops re-pulls.
4. Last-synced stamp updates.
5. Push both repos to GitHub.
