-- Senaste och nästa kontroll per kund för kundlistan på Stationer.
-- Kolumnen Senaste kontroll visade tidigare datumet då senaste stationen placerades
-- (max placed_at), och Nästa kontroll kunde bara se teknikerns egna bokningar 400 dagar
-- framåt. Funktionen ger det verkliga svaret per kund i ett anrop, utan att klienten
-- läser alla kontrolltillfällen (PostgREST klipper tyst vid 1 000 rader).
-- Bara läsning. Körs med anroparens behörighet, så RLS på tabellerna gäller.

create or replace function public.stationer_kundoversikt(p_customer_ids uuid[])
returns table(
  customer_id uuid,
  senaste_kontroll timestamptz,
  nasta_kontroll timestamptz,
  nasta_tekniker_id uuid,
  nasta_tekniker_namn text,
  nasta_frekvens text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    k.id,
    (select max(s.completed_at)
       from station_inspection_sessions s
      where s.customer_id = k.id
        and s.status = 'completed'),
    n.scheduled_at,
    n.technician_id,
    t.name,
    rs.frequency::text
  from unnest(p_customer_ids) as k(id)
  left join lateral (
    select s.scheduled_at, s.technician_id, s.recurring_schedule_id
      from station_inspection_sessions s
     where s.customer_id = k.id
       and s.status = 'scheduled'
       and s.scheduled_at >= now()
     order by s.scheduled_at
     limit 1
  ) n on true
  left join technicians t on t.id = n.technician_id
  left join recurring_schedules rs on rs.id = n.recurring_schedule_id;
$$;

revoke all on function public.stationer_kundoversikt(uuid[]) from public, anon;
grant execute on function public.stationer_kundoversikt(uuid[]) to authenticated;
