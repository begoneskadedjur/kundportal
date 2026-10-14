-- 20261014_specialrapporter_handelse_ordning.sql
-- Specialrapporter 3.55.0: händelser får en egen ordning (position) så att
-- teknikern kan flytta dem upp och ned. Befintliga händelser numreras i den
-- ordning de visas i dag (datum, sedan när de skapades), så inget byter plats.

alter table public.special_report_events
  add column if not exists position integer not null default 0;

update public.special_report_events e
set position = x.rn
from (
  select id, row_number() over (partition by section_id order by event_date, created_at, id) as rn
  from public.special_report_events
) x
where x.id = e.id and e.position = 0;

create index if not exists special_report_events_position_idx
  on public.special_report_events (section_id, position);
