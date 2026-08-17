-- Capture VIN + M&M code from the VMG feed.
--
-- `vin` is a required field of Meta's vehicle catalog and is published in the
-- public feed at /api/feed/meta, so storing it in the anon-readable site_stock
-- exposes nothing that is not already public by design. A VIN is printed on the
-- windscreen and listed on every portal; it is not personal data.
--
-- `mm_code` is the canonical SA Mead & McGrouther identifier for a
-- make/model/variant — the join key for any future pricing or
-- demand-intelligence work. Not sensitive, free to store now.
--
-- ⚠️ VMG also publishes <licenceNumber>. It is deliberately NOT captured here:
-- a registration number is personal data about the owner and must never reach a
-- public feed. Do not add it.
--
-- Applied to gqppfaicijzejjxgyhji 2026-08-17 via the Management API.
-- Additive and nullable: no data rewrite, no impact on the Dartbooks tables that
-- share this database.
ALTER TABLE site_stock
  ADD COLUMN IF NOT EXISTS vin TEXT,
  ADD COLUMN IF NOT EXISTS mm_code BIGINT;
