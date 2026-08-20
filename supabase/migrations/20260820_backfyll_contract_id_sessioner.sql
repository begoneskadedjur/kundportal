-- 20260820_backfyll_contract_id_sessioner.sql
-- Kopplar befintliga kontrollbesök och återkommande scheman till rätt avtal.
-- Kolumnerna station_inspection_sessions.contract_id och
-- recurring_schedules.contract_id fanns redan men fylldes aldrig i av
-- skapandeflödena (åtgärdat i samma commit via src/services/contractResolver.ts).
--
-- Prioritet — samma som resolvern i koden:
--   1. Avtal som BOR på kundraden (importrester räknas inte)
--   2. Avtal som TÄCKER raden via contract_sites (aktiv täckning idag)
-- Rader utan entydig träff lämnas som null; de syns som otäckta i Avtalskartan
-- och ska lösas där (dra in enheten i rätt avtal) i stället för att gissas här.

-- Sessioner
with resolved as (
  select s.id,
         coalesce(
           (select c.id from contracts c
             where c.customer_id = s.customer_id
               and c.status in ('signed','active')
               and coalesce(c.template_id,'') <> 'imported'
               and coalesce(c.oneflow_contract_id,'') not like 'imported-%'
             order by c.created_at desc limit 1),
           (select cs.contract_id from contract_sites cs
              join contracts c2 on c2.id = cs.contract_id
             where cs.customer_id = s.customer_id
               and c2.status in ('signed','active')
               and (cs.active_from is null or cs.active_from <= current_date)
               and (cs.active_to is null or cs.active_to >= current_date)
             order by c2.created_at desc limit 1)
         ) as contract_id
  from station_inspection_sessions s
  where s.contract_id is null
)
update station_inspection_sessions s
   set contract_id = r.contract_id
  from resolved r
 where s.id = r.id and r.contract_id is not null;

-- Återkommande scheman
with resolved as (
  select rs.id,
         coalesce(
           (select c.id from contracts c
             where c.customer_id = rs.customer_id
               and c.status in ('signed','active')
               and coalesce(c.template_id,'') <> 'imported'
               and coalesce(c.oneflow_contract_id,'') not like 'imported-%'
             order by c.created_at desc limit 1),
           (select cs.contract_id from contract_sites cs
              join contracts c2 on c2.id = cs.contract_id
             where cs.customer_id = rs.customer_id
               and c2.status in ('signed','active')
               and (cs.active_from is null or cs.active_from <= current_date)
               and (cs.active_to is null or cs.active_to >= current_date)
             order by c2.created_at desc limit 1)
         ) as contract_id
  from recurring_schedules rs
  where rs.contract_id is null
)
update recurring_schedules rs
   set contract_id = r.contract_id
  from resolved r
 where rs.id = r.id and r.contract_id is not null;
