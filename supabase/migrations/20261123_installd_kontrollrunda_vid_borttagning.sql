-- Ogenomförd kontrollrunda ställs in när ärendet tas bort (3.132.16, Christian
-- 2026-11-23): "om ärendet tas bort eller avslutas utan att vi genomfört
-- kontrollerna, då ska inte ärendet finnas kvar någonstans."
--
-- När ett avtalsärende (cases) får status 'Borttaget' sätts dess
-- station_inspection_sessions i läge scheduled eller in_progress till
-- 'cancelled'. Samma mönster som cancelVisitsAfterEnd (terminationVisits.ts) och
-- cancelRecurringSchedule (recurringScheduleService.ts), som också sätter
-- ärendet till Borttaget och rundan till cancelled. Inga rader raderas:
-- registrerade stationskontroller i en påbörjad runda ligger kvar.
-- Genomförda rundor (completed) rörs inte. Schemat, övriga besök och
-- stationerna rörs inte.
--
-- AFTER UPDATE: körs efter BEFORE-spärren stoppa_borttagning_skickad_faktura.
-- Stoppas borttagningen körs den här aldrig. SECURITY DEFINER så att det
-- fungerar oavsett vem som tar bort ärendet.
--
-- Städning av de 8 rundor som låg kvar på borttagna ärenden (granskat
-- 2026-11-23, alla från återkommande scheman, inga registrerade stationskontroller).
-- Läge före: scheduled för alla. Sätts tillbaka med status = 'scheduled' på id.
--   f3e690a7-78ee-4a75-972e-fa0e37197d24  BE-0008625  2026-08-28 07:00 UTC
--   da732e27-e3ee-4acf-aaad-30abb4dc3a74  BE-0008641  2026-09-01 05:00 UTC
--   f6132c37-d3e1-4626-9bde-cf3979a0dff1  BE-0008635  2026-09-01 07:00 UTC
--   bc78adf4-a335-44f9-bb3c-9bd173ff251a  BE-0008645  2026-09-01 08:01 UTC
--   2a701229-653a-4a1b-9b87-d1e0da912279  BE-0008917  2026-10-19 05:00 UTC
--   29db5f89-1086-4e44-9996-730e9f660994  BE-0008915  2026-10-19 07:00 UTC
--   db3dda43-4e8a-4fd7-85a4-529f671bbecc  BE-0009791  2026-11-13 08:00 UTC
--   7c563ab6-13d4-45d1-aa27-094d758340e8  BE-0008918  2026-11-18 06:00 UTC

create or replace function public.stall_in_kontrollrunda_vid_borttagning()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  update public.station_inspection_sessions s
     set status = 'cancelled'
   where s.case_id = new.id
     and s.status in ('scheduled', 'in_progress');
  return null;
end;
$fn$;

revoke all on function public.stall_in_kontrollrunda_vid_borttagning() from public, anon, authenticated;

comment on function public.stall_in_kontrollrunda_vid_borttagning() is
  'Sätter ärendets ogenomförda kontrollrundor (scheduled, in_progress) till cancelled när ärendet får status Borttaget. Genomförda rundor rörs inte.';

create or replace trigger stall_in_kontrollrunda_vid_borttagning
  after update of status on public.cases
  for each row
  when (new.status = 'Borttaget' and old.status is distinct from 'Borttaget')
  execute function public.stall_in_kontrollrunda_vid_borttagning();

-- Städning: de 8 rundorna ovan
update public.station_inspection_sessions s
   set status = 'cancelled'
 where s.id in (
         'f3e690a7-78ee-4a75-972e-fa0e37197d24', 'da732e27-e3ee-4acf-aaad-30abb4dc3a74',
         'f6132c37-d3e1-4626-9bde-cf3979a0dff1', 'bc78adf4-a335-44f9-bb3c-9bd173ff251a',
         '2a701229-653a-4a1b-9b87-d1e0da912279', '29db5f89-1086-4e44-9996-730e9f660994',
         'db3dda43-4e8a-4fd7-85a4-529f671bbecc', '7c563ab6-13d4-45d1-aa27-094d758340e8')
   and s.status = 'scheduled'
   and exists (select 1 from public.cases c where c.id = s.case_id and c.status = 'Borttaget');
