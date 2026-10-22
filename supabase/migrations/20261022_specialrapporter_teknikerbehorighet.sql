-- 20261022_specialrapporter_teknikerbehorighet.sql
-- Specialrapporter: vem en tekniker får se.
--
-- Regel (Christian 2026-10-22): en tekniker ser bara rapporter hen själv
-- skapat och rapporter på ärenden där hen är delaktig. Delaktig = tekniker 1-3
-- på ärendet (cases.primary/secondary/tertiary_technician_id,
-- private_cases/business_cases primary/secondary/tertiary_assignee_id) eller
-- tekniker på något av ärendets besök (visits.technician_id eller
-- visits.technicians [{id,...}]). Admin och koordinator ser allt som förut.
--
-- Policyerna på special_reports, special_report_sections/blocks/events/images/
-- versions och storage-bucketen special-reports går redan via
-- can_access_special_report / can_access_special_report_section /
-- can_access_case_for_report / can_access_special_report_folder. De ändras
-- inte; i stället byggs funktionerna om med CREATE OR REPLACE så att samma
-- regel gäller överallt:
--
--   tekniker_delaktig_i_arende(case_id, case_type)   delaktighet, ingen personalgenväg
--   tekniker_far_se_specialrapport(report_id)        skaparen eller delaktig
--   can_access_case_for_report(case_id, case_type)   personal eller delaktig
--   can_access_special_report(report_id)             personal eller tekniker_far_se_specialrapport
--   mina_specialrapport_ids()                        rapporter där jag är skapare eller delaktig
--
-- mina_specialrapport_ids() används av teknikervyn (/technician/specialrapporter)
-- så att även profiler med adminflagga (t.ex. tekniker med extra_roles admin)
-- bara ser sina egna och delaktiga rapporter där. RLS kan inte veta vilken vy
-- som är aktiv; personal ser allt i koordinatorvyn som tidigare.

-- ---------------------------------------------------------------------------
-- 1. Delaktighet i ett ärende (utan personalgenväg)
-- ---------------------------------------------------------------------------
create or replace function public.tekniker_delaktig_i_arende(p_case_id uuid, p_case_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.technician_id
    from public.profiles p
    where p.user_id = auth.uid()
      and p.technician_id is not null
    limit 1
  )
  select coalesce((
    select
      case p_case_type
        when 'contract' then exists (
          select 1 from public.cases c
          where c.id = p_case_id
            and me.technician_id in (c.primary_technician_id, c.secondary_technician_id, c.tertiary_technician_id)
        )
        when 'private' then exists (
          select 1 from public.private_cases pc
          where pc.id = p_case_id
            and me.technician_id in (pc.primary_assignee_id, pc.secondary_assignee_id, pc.tertiary_assignee_id)
        )
        when 'business' then exists (
          select 1 from public.business_cases bc
          where bc.id = p_case_id
            and me.technician_id in (bc.primary_assignee_id, bc.secondary_assignee_id, bc.tertiary_assignee_id)
        )
        else false
      end
      or exists (
        select 1 from public.visits v
        where v.case_id = p_case_id
          and v.case_type = p_case_type
          and (
            v.technician_id = me.technician_id
            or v.technicians @> jsonb_build_array(jsonb_build_object('id', me.technician_id::text))
          )
      )
    from me
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- 2. Personal (admin/koordinator) eller delaktig. Samma personalregel som förut.
-- ---------------------------------------------------------------------------
create or replace function public.can_access_case_for_report(p_case_id uuid, p_case_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      coalesce(p.is_admin, false)
      or coalesce(p.is_koordinator, false)
      or p.role::text in ('admin', 'koordinator')
      or coalesce(p.extra_roles, array[]::text[]) && array['admin', 'koordinator']::text[]
    from public.profiles p
    where p.user_id = auth.uid()
    limit 1
  ), false)
  or public.tekniker_delaktig_i_arende(p_case_id, p_case_type);
$$;

-- ---------------------------------------------------------------------------
-- 3. Teknikerregeln för en rapport: skaparen eller delaktig i ärendet
-- ---------------------------------------------------------------------------
create or replace function public.tekniker_far_se_specialrapport(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select (r.created_by is not null and r.created_by = auth.uid())
      or public.tekniker_delaktig_i_arende(r.case_id, r.case_type)
    from public.special_reports r
    where r.id = p_report_id
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- 4. Rapportåtkomst (policyerna och storage-funktionen går via denna)
-- ---------------------------------------------------------------------------
create or replace function public.can_access_special_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select (r.created_by is not null and r.created_by = auth.uid())
      or public.can_access_case_for_report(r.case_id, r.case_type)
    from public.special_reports r
    where r.id = p_report_id
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- 5. Teknikervyns lista: rapporter där jag är skapare eller delaktig
-- ---------------------------------------------------------------------------
create or replace function public.mina_specialrapport_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.id
  from public.special_reports r
  where (r.created_by is not null and r.created_by = auth.uid())
     or public.tekniker_delaktig_i_arende(r.case_id, r.case_type);
$$;

revoke all on function public.tekniker_delaktig_i_arende(uuid, text) from public, anon;
revoke all on function public.tekniker_far_se_specialrapport(uuid) from public, anon;
revoke all on function public.mina_specialrapport_ids() from public, anon;
grant execute on function public.tekniker_delaktig_i_arende(uuid, text) to authenticated, service_role;
grant execute on function public.tekniker_far_se_specialrapport(uuid) to authenticated, service_role;
grant execute on function public.mina_specialrapport_ids() to authenticated, service_role;
