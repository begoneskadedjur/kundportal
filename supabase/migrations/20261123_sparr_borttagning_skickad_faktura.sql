-- Spärr i databasen: ett ärende vars faktura är skickad går inte att ta bort
-- (status 'Borttaget'), oavsett roll och ingång. Godkänd av Christian 2026-11-23.
--
-- Klienten har samma spärr i src/services/caseDeleteService.ts
-- (hittaSkickadFaktura, forstaSkickade, SKICKADE_FAKTURASTATUSAR). Ändras
-- definitionen ska den ändras på BÅDA ställena. Definitionen:
--   1. invoices med case_id = ärendet (utan filter på case_type, avtalsärendens
--      merförsäljning har case_type null)
--   2. bara cases (avtalsärenden): contract_billing_items med case_id = ärendet
--      och status booked/sent/overdue/paid
--   3. bara cases: invoices som raderna i 2 pekar på via invoice_id
--      (månadens samlade merförsäljningsfaktura har inget case_id)
--   En faktura räknas som skickad om status inte är 'cancelled' och den har
--   fortnox_document_number (ej tom) eller status booked/sent/overdue/paid.
--
-- Bara uppdateringar till 'Borttaget' prövas (WHEN-villkoret), andra
-- statusbyten påverkas inte. Hårda raderingar av rader ingår inte:
-- api/delete-clickup-list.ts raderar alla ärenden för en kund och flera
-- rensningar raderar schemabesök, så en sådan spärr kräver en egen genomgång.
--
-- SECURITY DEFINER så att spärren ser fakturorna även när den som ändrar
-- (t.ex. en tekniker) inte har läsrätt till dem. Funktionen är en
-- triggerfunktion och kan inte anropas som RPC.

create or replace function public.stoppa_borttagning_med_skickad_faktura()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_faktura record;
  v_rad_status text;
  v_nummer text;
begin
  -- 1. Fakturor med ärendets id
  select i.invoice_number, i.fortnox_document_number, i.status
    into v_faktura
    from public.invoices i
   where i.case_id = new.id
     and i.status <> 'cancelled'
     and (coalesce(i.fortnox_document_number, '') <> ''
          or i.status in ('booked', 'sent', 'overdue', 'paid'))
   limit 1;

  if not found and tg_table_name = 'cases' then
    -- 2. Merförsäljningsrader med skickad status
    select cbi.status
      into v_rad_status
      from public.contract_billing_items cbi
     where cbi.case_id = new.id
       and cbi.status in ('booked', 'sent', 'overdue', 'paid')
     limit 1;

    if found then
      raise exception 'Ärendet går inte att ta bort eftersom fakturan redan är skickad till Fortnox.'
        using errcode = 'P0001';
    end if;

    -- 3. Fakturor som merförsäljningsraderna pekar på
    select i.invoice_number, i.fortnox_document_number, i.status
      into v_faktura
      from public.invoices i
     where i.id in (select cbi.invoice_id
                      from public.contract_billing_items cbi
                     where cbi.case_id = new.id
                       and cbi.invoice_id is not null)
       and i.status <> 'cancelled'
       and (coalesce(i.fortnox_document_number, '') <> ''
            or i.status in ('booked', 'sent', 'overdue', 'paid'))
     limit 1;
  end if;

  if found then
    v_nummer := coalesce(nullif(v_faktura.invoice_number, ''), nullif(v_faktura.fortnox_document_number, ''));
    raise exception '%', 'Ärendet går inte att ta bort eftersom fakturan'
      || coalesce(' ' || v_nummer, '') || ' redan är skickad till Fortnox.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$fn$;

revoke all on function public.stoppa_borttagning_med_skickad_faktura() from public, anon, authenticated;

comment on function public.stoppa_borttagning_med_skickad_faktura() is
  'Stoppar status Borttaget på ärenden med skickad faktura. Samma definition som hittaSkickadFaktura i src/services/caseDeleteService.ts, håll i synk.';

create or replace trigger stoppa_borttagning_skickad_faktura
  before update of status on public.cases
  for each row
  when (new.status = 'Borttaget' and old.status is distinct from 'Borttaget')
  execute function public.stoppa_borttagning_med_skickad_faktura();

create or replace trigger stoppa_borttagning_skickad_faktura
  before update of status on public.private_cases
  for each row
  when (new.status = 'Borttaget' and old.status is distinct from 'Borttaget')
  execute function public.stoppa_borttagning_med_skickad_faktura();

create or replace trigger stoppa_borttagning_skickad_faktura
  before update of status on public.business_cases
  for each row
  when (new.status = 'Borttaget' and old.status is distinct from 'Borttaget')
  execute function public.stoppa_borttagning_med_skickad_faktura();
