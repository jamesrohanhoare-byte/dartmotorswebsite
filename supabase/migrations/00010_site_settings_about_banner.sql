-- ============================================================================
-- Extend site_settings with the About page wide banner photo
-- ("Quality over volume, always").
-- ============================================================================

alter table site_settings
  add column if not exists about_banner_image_url text;
