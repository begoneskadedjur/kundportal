-- Väntande provision stryks när ärendet tas bort (3.132.16, Christian 2026-11-23):
-- "Om ärendet raderas så ska ju inte provisionen utgå. Om kunden är fakturerad
-- så ska provisionen utgå, men då ska inte ärendet gå att radera."
--
-- Mönster: provisionsposter i pending_invoice raderas, samma som
-- ProvisionService.upsertPostsForCase/upsertPostsForVisits gör när ärendets
-- provision räknas om. Status 'cancelled' finns inte (commission_posts_status_check),
-- och en raderad post försvinner ur provisionsvyerna, summorna och exporten.
-- Poster i senare läge (ready_for_payout, approved, paid_out) rörs aldrig.
--
-- AFTER UPDATE: triggern körs efter BEFORE-spärren stoppa_borttagning_skickad_faktura
-- (20261123_sparr_borttagning_skickad_faktura.sql). Stoppas borttagningen körs
-- den här aldrig, och allt i samma sats rullas tillbaka.
-- SECURITY DEFINER så att det fungerar även när en tekniker tar bort ärendet.
-- Bara poster med samma case_type som tabellen (cases=contract,
-- private_cases=private, business_cases=business); tipsbonus (case_type lead) rörs inte.
--
-- Återställs ett borttaget ärende (ångrad uppsägning i terminationVisits.ts,
-- eller status ändras för hand) skapas provisionen igen av den vanliga
-- avslutskedjan när ärendet avslutas.
--
-- Körd 2026-11-23 (apply_migration stryk_vantande_provision_vid_borttagning,
-- utan städningen nedan).
--
-- De två poster som redan låg kvar på borttagna ärenden
-- (granskat 2026-11-23, båda pending_invoice, ingen faktura):
--   id e37b7e21-1296-41e7-ad10-13c73b600feb, case_id dd1f1abd-45cf-420b-816c-1682bab67db4
--     (business_cases, saknar ärendenummer), case_type business, commission_type engangsjobb,
--     technician_id ddbbd2a1-bc33-4d04-81ff-4c565e2b71ff, commission_percentage 6.00,
--     share_percentage 50.00, base_amount 6486.00, deductions 0.00, commission_amount 194.58,
--     is_rot_rut false, visit_id ae2e1bf9-46d1-4138-aa3f-4e7dd5bca747, visit_number 1,
--     created_at 2026-10-20 11:58:51.904067+00, övriga datum- och godkännandefält null
--   id cc81fd2b-5a93-4040-95a7-d737296bdf17, samma ärende och värden, men
--     technician_id 35e82f86-bcca-4d00-b079-d5dc3dad1b07
-- case_title och technician_name hämtas vid behov från ärendet och technicians.

create or replace function public.stryk_vantande_provision_vid_borttagning()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  delete from public.commission_posts cp
   where cp.case_id = new.id::text
     and cp.status = 'pending_invoice'
     and cp.case_type = case tg_table_name
                          when 'cases' then 'contract'
                          when 'private_cases' then 'private'
                          when 'business_cases' then 'business'
                        end;
  return null;
end;
$fn$;

revoke all on function public.stryk_vantande_provision_vid_borttagning() from public, anon, authenticated;

comment on function public.stryk_vantande_provision_vid_borttagning() is
  'Raderar ärendets provisionsposter i pending_invoice när ärendet får status Borttaget. Poster i senare läge rörs inte.';

create or replace trigger stryk_vantande_provision_vid_borttagning
  after update of status on public.cases
  for each row
  when (new.status = 'Borttaget' and old.status is distinct from 'Borttaget')
  execute function public.stryk_vantande_provision_vid_borttagning();

create or replace trigger stryk_vantande_provision_vid_borttagning
  after update of status on public.private_cases
  for each row
  when (new.status = 'Borttaget' and old.status is distinct from 'Borttaget')
  execute function public.stryk_vantande_provision_vid_borttagning();

create or replace trigger stryk_vantande_provision_vid_borttagning
  after update of status on public.business_cases
  for each row
  when (new.status = 'Borttaget' and old.status is distinct from 'Borttaget')
  execute function public.stryk_vantande_provision_vid_borttagning();

-- Städningen av de två posterna ovan ligger i
-- 20261123_stada_provision_borttagna_arenden.sql. Den nekades när den låg i
-- samma migration och är INTE körd (2026-11-23).
