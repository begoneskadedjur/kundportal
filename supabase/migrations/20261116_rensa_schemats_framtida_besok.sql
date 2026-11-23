-- Rensar ett återkommande schemas framtida, ej påbörjade besök (session + ärende) i ett svep.
-- Används när schemat ändras (rescheduleExistingSessions). Klienten raderade tidigare själv,
-- men en tekniker får bara radera ärenden där hen är ansvarig tekniker: sessionerna försvann,
-- kollegans ärenden blev kvar utan koppling och inget fel syntes (Heimstaden Ferdinand 2026-11-13).
-- Samma behörighet som station_inspection_sessions (personal eller tekniker).

create or replace function public.rensa_schemats_framtida_besok(p_schedule_id uuid)
returns table(deleted_sessions integer, deleted_cases integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
  v_case_ids uuid[];
  v_sessions integer;
  v_cases integer;
begin
  select coalesce(s.is_staff, false) or s.technician_id is not null
    into v_ok
    from my_case_scope() s;
  if not coalesce(v_ok, false) then
    raise exception 'Behörighet saknas';
  end if;

  select coalesce(array_agg(case_id) filter (where case_id is not null), '{}')
    into v_case_ids
    from station_inspection_sessions
   where recurring_schedule_id = p_schedule_id
     and status = 'scheduled'
     and scheduled_at > now();

  delete from station_inspection_sessions
   where recurring_schedule_id = p_schedule_id
     and status = 'scheduled'
     and scheduled_at > now();
  get diagnostics v_sessions = row_count;

  -- Avslutade ärenden rörs aldrig
  delete from cases
   where id = any(v_case_ids)
     and status <> 'Avslutat';
  get diagnostics v_cases = row_count;

  return query select v_sessions, v_cases;
end;
$$;

revoke all on function public.rensa_schemats_framtida_besok(uuid) from public, anon;
grant execute on function public.rensa_schemats_framtida_besok(uuid) to authenticated;
