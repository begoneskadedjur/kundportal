-- 20261005_web_inquiries_rattigheter.sql
-- Leads (Webb), efter 20261005_web_inquiries.sql:
--  1. Rollkontrollen räknar även is_admin (bakåtkompatibelt admin-flagga, som AuthContext).
--  2. Säkerhetsrådgivarens varningar: anon får inte köra security definer-funktionerna, och
--     triggerfunktionen ska inte gå att anropa direkt av någon roll.
-- Inga DROP-satser.

create or replace function public.is_web_inquiry_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.is_active, true)
      and (
        p.role::text in ('admin', 'koordinator', 'säljare')
        or coalesce(p.is_admin, false)
        or p.extra_roles && array['admin', 'koordinator', 'säljare']::text[]
      )
  );
$$;

revoke execute on function public.is_web_inquiry_staff() from public, anon;
grant execute on function public.is_web_inquiry_staff() to authenticated;

revoke execute on function public.web_inquiries_new_count() from public, anon;
grant execute on function public.web_inquiries_new_count() to authenticated;

revoke execute on function public.web_inquiries_after_update() from public, anon, authenticated;
revoke execute on function public.web_inquiries_before_update() from public, anon, authenticated;
