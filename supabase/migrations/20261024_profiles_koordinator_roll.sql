-- Koordinatorer läser personalens profiler även när bara rollen är satt.
--
-- profiles_consolidated_select släppte igenom is_admin eller is_koordinator.
-- En koordinator som skapas via personalkortet (api/enable-technician-auth)
-- får role = 'koordinator' men is_koordinator = false, och såg då bara sin egen
-- profil: tom kollegelista i Frågor och uppdrag, tomma namn i scheman och listor.
-- Hittat i testkörningen av nya teknikervyn 2026-10-24. Övriga policyer
-- (my_case_scope, cases) räknar redan rollen.

alter policy profiles_consolidated_select on public.profiles
  using (
    (user_id = auth.uid())
    or exists (
      select 1
        from get_user_profile() p(user_id, role, is_admin, is_koordinator, customer_id, technician_id, organization_id, multisite_role)
       where p.is_admin or p.is_koordinator or p.role = 'koordinator'
    )
    or (
      (((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role') = any (array['technician', 'säljare']))
      and (role::text = any (array['admin', 'koordinator', 'technician', 'säljare']))
    )
  );

-- Grundorsaken: rollen koordinator ska alltid bära flaggan is_koordinator, som
-- flera policyer läser (visits, case_updates_log, billing_audit_log m.fl.).
-- Flaggan sätts aldrig till false av triggern; den som byter bort rollen sköter flaggan.
create or replace function public.koordinator_flagga_ur_roll()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role::text = 'koordinator' and coalesce(new.is_koordinator, false) = false then
    new.is_koordinator := true;
  end if;
  return new;
end;
$$;

create trigger koordinator_flagga_ur_roll
  before insert or update of role, is_koordinator on public.profiles
  for each row execute function public.koordinator_flagga_ur_roll();

update public.profiles set is_koordinator = true
 where role::text = 'koordinator' and coalesce(is_koordinator, false) = false;
