-- 20261023_min_kundresa_rpc.sql
-- Min kundresa (nya teknikervyn): en rad per eget skickat dokument med tidpunkterna
-- ur Oneflow-loggen. Security definer så att sidan inte behöver läsa oneflow_sync_log
-- direkt; funktionen lämnar bara ut den inloggades egna dokument.
--
-- Teknikern: profiles.user_id = auth.uid(), e-post ur technicians.email via
-- profiles.technician_id (annars profiles.email). Matchas mot
-- contracts.begone_employee_email med lower(trim()) så att stavningsavvikelser
-- (versal, mellanslag) inte tappar dokument.
--
-- Skickad:   första contract:publish i oneflow_sync_log. För offerter utan händelse
--            används created_at som reserv (188 av 189 offerter skickas inom 10 min).
-- Signerad:  första contract:sign (INTE contracts.signed_at, som inte är signeringsdagen).
-- Förföll:   sista contract:signing_period_expire.
-- Arkiv:     legacy_archived_at satt eller skickad före 2026-05-01 (arkivgränsen) räknas inte.
-- Bokad:     booked_case_id med starttid ur cases, private_cases eller business_cases.

create index if not exists idx_oneflow_sync_log_contract_event
  on public.oneflow_sync_log (oneflow_contract_id, event_type);

create or replace function public.min_kundresa(
  p_typ text,
  p_fran timestamptz,
  p_till timestamptz
)
returns table (
  id uuid,
  typ text,
  kundnamn text,
  belopp numeric,
  skickad_at timestamptz,
  signerad_at timestamptz,
  forfoll_at timestamptz,
  status text,
  signing_deadline date,
  booked_case_id uuid,
  bokad_start timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with mig as (
    select lower(trim(coalesce(nullif(trim(t.email), ''), p.email))) as epost
    from public.profiles p
    left join public.technicians t on t.id = p.technician_id
    where p.user_id = auth.uid()
    limit 1
  ),
  dok as (
    select c.*,
      (select min(l.created_at) from public.oneflow_sync_log l
        where l.oneflow_contract_id = c.oneflow_contract_id and l.event_type = 'contract:publish') as pub,
      (select min(l.created_at) from public.oneflow_sync_log l
        where l.oneflow_contract_id = c.oneflow_contract_id and l.event_type = 'contract:sign') as sig,
      (select max(l.created_at) from public.oneflow_sync_log l
        where l.oneflow_contract_id = c.oneflow_contract_id and l.event_type = 'contract:signing_period_expire') as exp
    from public.contracts c, mig
    where mig.epost is not null
      and mig.epost <> ''
      and lower(trim(c.begone_employee_email)) = mig.epost
      and c.legacy_archived_at is null
      and c.status is distinct from 'draft'
      and (p_typ is null or c.type = p_typ)
  ),
  skickade as (
    select d.*, coalesce(d.pub, case when d.type = 'offer' then d.created_at end) as skickad
    from dok d
  )
  select
    s.id,
    s.type as typ,
    coalesce(nullif(trim(s.company_name), ''), nullif(trim(s.contact_person), ''), 'Okänd kund') as kundnamn,
    s.total_value as belopp,
    s.skickad as skickad_at,
    s.sig as signerad_at,
    case when s.sig is null and s.status = 'overdue' then s.exp end as forfoll_at,
    s.status,
    s.signing_deadline,
    s.booked_case_id,
    coalesce(
      (select k.scheduled_start from public.cases k where k.id = s.booked_case_id),
      (select k.start_date from public.private_cases k where k.id = s.booked_case_id),
      (select k.start_date from public.business_cases k where k.id = s.booked_case_id)
    ) as bokad_start
  from skickade s
  where s.skickad is not null
    and s.skickad >= greatest(p_fran, timestamptz '2026-05-01 00:00:00+02')
    and s.skickad < p_till
  order by s.skickad desc;
$$;

revoke all on function public.min_kundresa(text, timestamptz, timestamptz) from public, anon;
grant execute on function public.min_kundresa(text, timestamptz, timestamptz) to authenticated, service_role;

comment on function public.min_kundresa(text, timestamptz, timestamptz) is
  'Min kundresa för inloggad tekniker: egna skickade dokument (begone_employee_email, lower/trim) med skickad, signerad och förföll ur oneflow_sync_log, utan arkiverade och utan dokument skickade före 2026-05-01.';
