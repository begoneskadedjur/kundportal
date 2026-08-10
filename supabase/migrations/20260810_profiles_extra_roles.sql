-- 20260810_profiles_extra_roles.sql
-- Fritt kombinerbara portalroller: profiles.extra_roles kompletterar primärrollen
-- (profiles.role) så att en användare kan ha valfri kombination av
-- admin/koordinator/tekniker-vyerna. is_admin behålls och hålls synkad av
-- appen ('admin' i extra_roles <=> is_admin) eftersom befintliga RLS-policies
-- och api/_lib/auth.ts läser den.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS extra_roles text[] NOT NULL DEFAULT '{}'
    CHECK (extra_roles <@ ARRAY['admin','koordinator','technician']);

-- Backfill: dagens dual-role-användare (tekniker med is_admin) får 'admin' i extra_roles
UPDATE profiles
SET extra_roles = array_append(extra_roles, 'admin')
WHERE is_admin = true
  AND role IS DISTINCT FROM 'admin'
  AND NOT ('admin' = ANY(extra_roles));
