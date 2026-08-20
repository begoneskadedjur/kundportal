-- 20260820_backfyll_avtalsfalt_wizard.sql
-- Backfyller avtalsfält på SIGNERADE avtal skapade via Oneflow-wizarden.
--
-- Bakgrund: Oneflow-flödet skrev historiskt bara metadata till contracts och
-- lade de faktiska avtalsvärdena på kundraden. Följden blev att portalens
-- avtalsvyer (Avtalskartan, premietrappan, faktureringsunderlaget) stod tomma
-- för signerade avtal — bara 33 av 65 hade premie och startdatum, och de
-- värdena kom från manuell efterhandsredigering.
--
-- Framåt fylls fälten automatiskt vid signering av completeContractFieldsOnSign
-- i api/oneflow/webhook.ts. Denna migration åtgärdar historiken.
--
-- Avgränsning: ENDAST status='signed'. Utgångna signeringsförfrågningar
-- (overdue), trashade och avvisade är inte avtal och rörs inte.
-- Befintliga värden skrivs aldrig över (coalesce).
-- contract_end_date backfylls inte — contract_length saknas på de raderna.

update contracts c
   set contract_start_date = coalesce(c.contract_start_date, c.start_date),
       annual_value = coalesce(c.annual_value, nullif(c.total_value, 0)),
       total_contract_value = coalesce(c.total_contract_value, nullif(c.total_value, 0))
 where c.type = 'contract'
   and c.status = 'signed'
   and c.template_id in ('8486368','8462854','8465556','8732196','9324573')
   and (c.contract_start_date is null or c.annual_value is null)
   and (c.start_date is not null or c.total_value is not null);

-- Premietrappans startpunkt för avtal som nu fått premie och startdatum,
-- så tidslinjen och kommande höjningar har ett underlag.
insert into contract_premium_events (contract_id, effective_from, annual_value, event_type, note)
select c.id, c.contract_start_date, c.annual_value, 'start',
       'Backfyllt från signerat Oneflow-avtal'
  from contracts c
 where c.type = 'contract'
   and c.status = 'signed'
   and c.annual_value > 0
   and c.contract_start_date is not null
   and not exists (select 1 from contract_premium_events e where e.contract_id = c.id);
