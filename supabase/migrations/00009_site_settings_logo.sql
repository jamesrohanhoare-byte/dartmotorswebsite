-- ============================================================================
-- Extend site_settings with a dealer-editable logo (used in the header + footer).
-- Best uploaded as a transparent PNG so it sits cleanly on the dark theme.
-- ============================================================================

alter table site_settings
  add column if not exists logo_url text;
