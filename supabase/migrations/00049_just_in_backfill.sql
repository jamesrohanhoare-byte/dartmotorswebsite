-- Migration 00049: "Just In" launch-batch backfill (2026-07-29). DATA-ONLY.
-- (00046-00048 live in the Dartbooks repo — the two repos share one database
-- and one migration number line.)
--
-- The shop page now shows a "Just In — listed in the last 30 days" section,
-- keyed off site_stock.created_at (the first time /api/sync saw the car; the
-- sync upsert never rewrites it). The 31 cars imported by the July 5-6 2026
-- launch sync were on the lot long before the site existed, so their
-- created_at is pushed out of the window to keep the section honest.
--
-- Applied by hand via the service-role client on 2026-07-29 (31 rows).
update site_stock
set created_at = '2026-06-01T00:00:00Z'
where created_at < '2026-07-07T00:00:00Z';
