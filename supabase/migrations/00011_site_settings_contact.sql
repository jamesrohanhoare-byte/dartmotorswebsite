-- ============================================================================
-- Extend site_settings with the Contact page banner photo so it's editable
-- from the portal Site media manager (defaults to the current storefront image).
-- ============================================================================

alter table site_settings
  add column if not exists contact_image_url text;

update site_settings
  set contact_image_url = coalesce(contact_image_url, '/showroom/storefront.jpg');
