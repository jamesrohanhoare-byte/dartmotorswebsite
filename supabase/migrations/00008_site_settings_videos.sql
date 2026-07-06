-- ============================================================================
-- Extend site_settings with dealer-editable videos: home hero video + the
-- About page "Founded by Marco Ribeiro" video. Same bucket/policies as images.
-- ============================================================================

alter table site_settings
  add column if not exists hero_video_url    text,
  add column if not exists founder_video_url text;
