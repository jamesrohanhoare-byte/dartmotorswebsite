-- Migration 00046: let Dart staff delete site enquiries + finance apps (2026-07-13).
--
-- ⚠️ ISOLATION CONTRACT (same as 00044/00045): policy-only, touches ONLY the site_
-- website tables, never the finance/market tables.
--
-- The dealer wants to manage leads by hand (a delete button in Dartbooks) instead
-- of scheduled auto-purge — they explicitly did NOT want a month-rollover job
-- silently deleting someone's lead. 00044 created no delete policy, so deletes were
-- denied for authenticated users. Add explicit delete policies for authenticated
-- staff (same trust model as the existing *_staff_read policies). The daily sync's
-- retention purge is being disabled in parallel (LEAD_RETENTION_DAYS default -> 0).

grant delete on site_leads, site_finance_applications to authenticated;

drop policy if exists site_leads_staff_delete on site_leads;
create policy site_leads_staff_delete
  on site_leads for delete
  to authenticated
  using (true);

drop policy if exists site_finance_staff_delete on site_finance_applications;
create policy site_finance_staff_delete
  on site_finance_applications for delete
  to authenticated
  using (true);
