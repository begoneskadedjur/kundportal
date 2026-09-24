-- Avtalsklockans uppföljning: en ny annons räknas bara när den gäller skadedjur.
-- Matchpoäng 60 räckte inte (nyckelordet "saneringstjänster" gav träff på
-- fukt- och byggsanering). Samma regel som awardRelevance i
-- src/shared/procurementRules.ts: skadedjursord i titeln, eller huvud-CPV
-- 90921 till 90924 utan ord som pekar på annat.
--
-- Additivt: ny funktion och ersatt uppföljningsfunktion.

create or replace function public.procurement_is_pest(p_title text, p_cpv text[])
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select
    coalesce(p_title, '') ~* '(skadedjur|skadeinsekt|råtta|råttor|råttbekämp|gnagare|möss|kackerlack|vägglöss|insektsbekämp|fågelsäkr|fågelskydd|duvor|getingar|myror|mygg|ohyra|pest control|pest-control|rodent)'
    or (
      coalesce(p_cpv[1], '') ~ '^9092[1-9]'
      and coalesce(p_title, '') !~* '(vassklipp|grönyt|grönområd|gräs|snö|städ|lokalvård|fönsterputs|fasadtvätt|kärltvätt|hiss|sotning|försäkring|elektriker|kylservice|storkök|byggservice|facility|fastighetsdrift|fastighetsförvaltning|förvaltningsentreprenör|property maintenance|laboratori|asbest|pcb|marksaner|radon|rivning|fukt|mögel|klotter|brandsaner|industrisaner|avfukt|förorenad|efterbehandling)'
    );
$$;

grant execute on function public.procurement_is_pest(text, text[]) to authenticated;

create or replace function public.procurement_refresh_award_followups()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_result jsonb;
begin
  with base as (
    select a.id, a.buyer_id, a.source, a.source_ref, a.notice_id,
           coalesce(a.corrected_end_date, a.calc_end_date) as end_date,
           coalesce(a.start_basis_date, a.contract_start, a.contract_signed_date, a.award_date,
                    (coalesce(a.corrected_end_date, a.calc_end_date) - interval '48 months')::date) as basis
    from public.procurement_awards a
    where a.excluded_reason is null
  ),
  nn as (
    select distinct on (b.id) b.id, n.id as notice_id, n.title, n.published_at,
           coalesce(n.platform_url, (select s.url from public.procurement_notice_sources s where s.notice_id = n.id order by s.fetched_at desc limit 1)) as url
    from base b
    join public.procurement_notices n
      on n.buyer_id = b.buyer_id
     and n.id is distinct from b.notice_id
     and n.notice_kind in ('tender', 'direct', 'rfi', 'prior_information')
     and n.published_at is not null
     and b.basis is not null
     and (n.published_at at time zone 'Europe/Stockholm')::date >= b.basis + 180
     and (b.end_date is null or (n.published_at at time zone 'Europe/Stockholm')::date >= b.end_date - interval '30 months')
     and public.procurement_is_pest(n.title, n.cpv_codes)
    where b.buyer_id is not null
    order by b.id, n.published_at desc
  ),
  na as (
    select distinct on (b.id) b.id, ob.id as award_id, o.title, ob.basis
    from base b
    join base ob
      on ob.buyer_id = b.buyer_id
     and not (ob.source = b.source and ob.source_ref is not distinct from b.source_ref)
     and b.basis is not null and ob.basis is not null
     and ob.basis >= b.basis + 365
    join public.procurement_awards o on o.id = ob.id
    where b.buyer_id is not null
    order by b.id, ob.basis desc
  ),
  computed as (
    select b.id,
           case
             when nn.id is not null then 'new_notice'
             when na.id is not null then 'new_award'
             when b.end_date is not null and b.end_date < v_today and b.end_date >= v_today - 730 then 'passed_no_notice'
             when b.end_date is not null and b.end_date < v_today - 730 then 'stale'
           end as status,
           nn.notice_id, na.award_id,
           nn.url,
           coalesce(nn.title, na.title) as title,
           coalesce((nn.published_at at time zone 'Europe/Stockholm')::date, na.basis) as fdate
    from base b
    left join nn on nn.id = b.id
    left join na on na.id = b.id
  ),
  upd as (
    update public.procurement_awards a
       set followup_status = c.status,
           followup_notice_id = case when c.status = 'new_notice' then c.notice_id end,
           followup_award_id = case when c.status = 'new_award' then c.award_id end,
           followup_url = case when c.status = 'new_notice' then c.url end,
           followup_title = case when c.status in ('new_notice', 'new_award') then c.title end,
           followup_date = case when c.status in ('new_notice', 'new_award') then c.fdate end,
           followup_checked_at = now()
      from computed c
     where a.id = c.id
    returning a.followup_status
  )
  select jsonb_build_object(
    'checked', count(*),
    'new_notice', count(*) filter (where followup_status = 'new_notice'),
    'new_award', count(*) filter (where followup_status = 'new_award'),
    'passed_no_notice', count(*) filter (where followup_status = 'passed_no_notice'),
    'stale', count(*) filter (where followup_status = 'stale')
  ) into v_result from upd;

  update public.procurement_awards
     set followup_status = null, followup_notice_id = null, followup_award_id = null,
         followup_url = null, followup_title = null, followup_date = null
   where excluded_reason is not null and followup_status is not null;

  return v_result;
end;
$$;

revoke execute on function public.procurement_refresh_award_followups() from public, anon, authenticated;

select public.procurement_refresh_award_followups();
