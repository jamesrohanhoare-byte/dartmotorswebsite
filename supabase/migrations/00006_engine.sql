-- 00006_engine.sql
-- Add an `engine` field to vehicles (e.g. "2.9L V6 Bi-Turbo").
-- Surfaced as a spec block on the public vehicle detail page and editable
-- in the dealer portal. Shared schema; RLS already isolates rows per dealer.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine text;
