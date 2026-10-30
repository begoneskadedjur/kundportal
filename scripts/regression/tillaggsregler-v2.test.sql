-- Steg 11 (avtalsåret på avtalsdag): tilläggsregler version 2 i databasen.
-- Körs efter 20261030_tillaggsregler_v2_funktioner.sql och
-- 20261030_tillaggsregler_v2_vakt.sql. Allt i ett block som alltid slutar med
-- raise exception, så ingenting sparas.
--
-- Falu kommun 5006 (avtal 23a115e3) i målbilden: exakt avtalsdag 2026-06-30,
-- option, ingen premie, v2. Ljusfällan på BE-0009544 och Auroconfällan på
-- BE-0009545, båda ärendena stängda: glappfaktura till 2027-06-29.
-- FEV avtal 72818957: överlappsvakten med marking_key.
do $$
declare
  v_unit uuid := 'c67ae185-2dd8-47bf-a778-6448333fe070';
  v_contract uuid := '23a115e3-c492-486c-830a-976a454c4ea0';
  v_light uuid := 'f8d6e371-2c63-46b6-abaa-7dfebb920876';
  v_auro uuid := '489d7fe6-ecaa-40ac-9b12-7b3abd3cc98f';
  v_case1 uuid := 'a75c7c3c-34ab-4d01-b84d-4feb32999052'; -- BE-0009544
  v_case2 uuid := '5a12422b-8250-4dae-bc68-fd5d17537c57'; -- BE-0009545
  v_fev uuid;
  v_fev_cust uuid;
  v_out text := '';
  v_n int;
  v_txt text;
  r record;
begin
  -- T1: dagens läge
  v_out := v_out || format(E'\nT1 split_ready = %s (false så länge drop-raderna från steg 5 inte är körda)', invoice_marking_split_ready());
  select count(*) into v_n from contract_invoice_overlaps where number_a not like 'F-%' and number_b not like 'F-%';
  v_out := v_out || format(E'\nT1b överlappspar utan F-: %s %s', v_n, case when v_n = 8 then 'OK' else 'FEL' end);
  select count(*) into v_n from invoices where marking_key is not null;
  v_out := v_out || format(E'\nT1c fakturor med marking_key: %s %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);

  -- T2: Falu i målbilden
  update contracts set contract_start_date = '2026-06-30', contract_end_date = '2028-06-29',
         billing_frequency = null, billing_anchor_mode = 'start_day', addon_rules = 'v2', renewal_mode = 'option'
  where id = v_contract;
  v_out := v_out || format(E'\nT2 tilläggens nästa periodstart från 2026-10-27: %s %s',
    contract_addon_next_period_start(v_contract, '2026-10-27'),
    case when contract_addon_next_period_start(v_contract, '2026-10-27') = '2027-06-30' then 'OK' else 'FEL' end);
  update cases set status = 'Avslutat' where id in (v_case1, v_case2);
  update equipment_placements set placed_case_id = v_case1, addon_contract_id = v_contract, addon_contract_mode = 'separate', addon_unit_price_annual = 1686 where id = v_light;
  update equipment_placements set placed_case_id = v_case2, addon_contract_id = v_contract, addon_contract_mode = 'separate', addon_unit_price_annual = 2348 where id = v_auro;
  update case_billing_items set status = 'cancelled' where case_id in (v_case1, v_case2) and is_addon_prorata_line and status = 'pending';
  for r in select * from addon_gap_candidates(v_contract) order by station_id loop
    v_out := v_out || format(E'\nT2b glapp %s %s à %s: %s t.o.m. %s, %s dagar, märkning [%s]',
      r.type_name, r.station_id, r.annual, r.gap_from, r.gap_to, r.days, r.marking_key);
  end loop;
  select instruction into v_txt from contract_work_items_internal(v_unit) where kind = 'gap_invoice' limit 1;
  v_out := v_out || format(E'\nT2c arbetslistan: %s', v_txt);
  -- Öppet ärende: inget glapp (pro rata på ärendet tar det)
  update cases set status = 'Bokad' where id = v_case1;
  select count(*) into v_n from addon_gap_candidates(v_contract) where station_id = v_light;
  v_out := v_out || format(E'\nT2d öppet ärende ger inget glapp: %s %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);
  update cases set status = 'Avslutat' where id = v_case1;
  -- Efterskänkt del: färre dagar
  insert into addon_station_coverage (station_id, station_kind, unit_customer_id, contract_id, covered_from, covered_to, source, note, created_by_name)
  values (v_light, 'outdoor', v_unit, v_contract, '2026-10-27', '2026-12-31', 'waived', 'prov', 'prov');
  select gap_from, days into r from addon_gap_candidates(v_contract) where station_id = v_light;
  v_out := v_out || format(E'\nT2e efter efterskänkt t.o.m. 2026-12-31: från %s, %s dagar %s', r.gap_from, r.days,
    case when r.gap_from = '2027-01-01' and r.days = 180 then 'OK' else 'FEL' end);
  -- Gammalt avtal: inga kandidater
  update contracts set addon_rules = null where id = v_contract;
  select count(*) into v_n from addon_gap_candidates(v_contract);
  v_out := v_out || format(E'\nT2f utan v2: %s kandidater %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);
  update contracts set addon_rules = 'v2' where id = v_contract;

  -- T3: överlappsvakten med märkning (FEV 72818957). Perioderna börjar en dag
  -- isär så att gamla unika indexet (avtal, start, typ) inte slår till först.
  select id, customer_id into v_fev, v_fev_cust from contracts where id::text like '72818957%';
  insert into invoices (customer_name, invoice_number, invoice_type, customer_id, contract_id, contract_invoice_kind, status,
                        billing_period_start, billing_period_end, subtotal, vat_amount, total_amount, marking_key)
  values ('Prov', 'PROV-T3-A', 'contract', v_fev_cust, v_fev, 'equipment', 'pending_approval', '2029-07-01', '2030-06-30', 1, 0, 1, 'YX201');
  begin
    insert into invoices (customer_name, invoice_number, invoice_type, customer_id, contract_id, contract_invoice_kind, status,
                          billing_period_start, billing_period_end, subtotal, vat_amount, total_amount, marking_key)
    values ('Prov', 'PROV-T3-B', 'contract', v_fev_cust, v_fev, 'equipment', 'pending_approval', '2029-07-02', '2030-07-01', 1, 0, 1, 'YX206');
    v_out := v_out || E'\nT3a annan märkning samma period: går igenom OK';
  exception when others then
    v_out := v_out || format(E'\nT3a annan märkning samma period: FEL %s', sqlerrm);
  end;
  begin
    insert into invoices (customer_name, invoice_number, invoice_type, customer_id, contract_id, contract_invoice_kind, status,
                          billing_period_start, billing_period_end, subtotal, vat_amount, total_amount, marking_key)
    values ('Prov', 'PROV-T3-C', 'contract', v_fev_cust, v_fev, 'equipment', 'pending_approval', '2029-07-03', '2030-07-02', 1, 0, 1, 'YX201');
    v_out := v_out || E'\nT3b samma märkning samma period: FEL, gick igenom';
  exception when others then
    v_out := v_out || format(E'\nT3b samma märkning samma period: stoppad OK (%s)', sqlerrm);
  end;
  begin
    insert into invoices (customer_name, invoice_number, invoice_type, customer_id, contract_id, contract_invoice_kind, status,
                          billing_period_start, billing_period_end, subtotal, vat_amount, total_amount)
    values ('Prov', 'PROV-T3-D', 'contract', v_fev_cust, v_fev, 'equipment', 'pending_approval', '2031-07-04', '2032-07-03', 1, 0, 1);
    begin
      insert into invoices (customer_name, invoice_number, invoice_type, customer_id, contract_id, contract_invoice_kind, status,
                            billing_period_start, billing_period_end, subtotal, vat_amount, total_amount)
      values ('Prov', 'PROV-T3-E', 'contract', v_fev_cust, v_fev, 'equipment', 'pending_approval', '2031-07-05', '2032-07-04', 1, 0, 1);
      v_out := v_out || E'\nT3c utan märkning två gånger: FEL, gick igenom';
    exception when others then
      v_out := v_out || format(E'\nT3c utan märkning två gånger: stoppad OK (%s)', sqlerrm);
    end;
  exception when others then
    v_out := v_out || format(E'\nT3c första fakturan utan märkning: FEL %s', sqlerrm);
  end;
  -- Byte av märkning på en befintlig faktura prövas
  begin
    update invoices set marking_key = 'YX201' where invoice_number = 'PROV-T3-B';
    v_out := v_out || E'\nT3d märkningsbyte till krock: FEL, gick igenom';
  exception when others then
    v_out := v_out || format(E'\nT3d märkningsbyte till krock: stoppad OK (%s)', sqlerrm);
  end;
  -- Gamla indexet: samma start, olika märkning
  begin
    insert into invoices (customer_name, invoice_number, invoice_type, customer_id, contract_id, contract_invoice_kind, status,
                          billing_period_start, billing_period_end, subtotal, vat_amount, total_amount, marking_key)
    values ('Prov', 'PROV-T3-F', 'contract', v_fev_cust, v_fev, 'equipment', 'pending_approval', '2029-07-01', '2030-06-30', 1, 0, 1, 'YX301');
    v_out := v_out || E'\nT3e samma start, ny märkning: går igenom (gamla indexet borta)';
  exception when others then
    v_out := v_out || format(E'\nT3e samma start, ny märkning: stoppad (%s), väntat så länge gamla indexet finns', sqlerrm);
  end;
  -- equipment_gap tillåts inte av kind-checken före drop-raderna
  begin
    insert into invoices (customer_name, invoice_number, invoice_type, customer_id, contract_id, contract_invoice_kind, status,
                          billing_period_start, billing_period_end, subtotal, vat_amount, total_amount)
    values ('Prov', 'PROV-T3-G', 'contract', v_fev_cust, v_fev, 'equipment_gap', 'pending_approval', '2026-11-10', '2027-06-29', 1, 0, 1);
    v_out := v_out || E'\nT3f equipment_gap: går igenom (kind-checken utökad)';
  exception when others then
    v_out := v_out || format(E'\nT3f equipment_gap: stoppad (%s), väntat före drop-raderna', sqlerrm);
  end;

  raise exception 'PROV STEG 11%', v_out;
end $$;

-- T4: läget efter drop-raderna från steg 5, prövat på en temp-kopia av
-- invoices med nya indexet och den utökade kind-checken (gamla indexet och
-- vakten finns inte på kopian). Körs som eget block.
do $$
declare v_out text := ''; v_fev uuid; v_cust uuid;
begin
  select id, customer_id into v_fev, v_cust from contracts where id::text like '72818957%';
  create temp table t4_invoices (like public.invoices including defaults) on commit drop;
  alter table t4_invoices add constraint t4_kind check (contract_invoice_kind = any (array['premium', 'equipment', 'equipment_monthly', 'adjustment', 'equipment_gap']));
  create unique index t4_marking_key on t4_invoices (contract_id, billing_period_start, contract_invoice_kind, coalesce(marking_key, ''))
    where invoice_type = 'contract' and contract_id is not null and contract_invoice_kind <> 'adjustment' and status <> 'cancelled' and invoice_number !~~ 'F-%';
  insert into t4_invoices (customer_name, invoice_number, invoice_type, customer_id, contract_id, contract_invoice_kind, status, billing_period_start, billing_period_end, subtotal, vat_amount, total_amount, marking_key)
  values ('Prov', 'T4-A', 'contract', v_cust, v_fev, 'equipment', 'pending_approval', '2027-06-30', '2028-06-29', 1, 0, 1, 'YX201');
  begin
    insert into t4_invoices (customer_name, invoice_number, invoice_type, customer_id, contract_id, contract_invoice_kind, status, billing_period_start, billing_period_end, subtotal, vat_amount, total_amount, marking_key)
    values ('Prov', 'T4-B', 'contract', v_cust, v_fev, 'equipment', 'pending_approval', '2027-06-30', '2028-06-29', 1, 0, 1, 'YX206');
    v_out := v_out || E'\nT4a samma start, annan märkning efter drop: igenom OK';
  exception when others then v_out := v_out || format(E'\nT4a FEL %s', sqlerrm); end;
  begin
    insert into t4_invoices (customer_name, invoice_number, invoice_type, customer_id, contract_id, contract_invoice_kind, status, billing_period_start, billing_period_end, subtotal, vat_amount, total_amount, marking_key)
    values ('Prov', 'T4-C', 'contract', v_cust, v_fev, 'equipment', 'pending_approval', '2027-06-30', '2028-06-29', 1, 0, 1, 'YX201');
    v_out := v_out || E'\nT4b samma märkning två gånger: FEL igenom';
  exception when others then v_out := v_out || format(E'\nT4b samma märkning stoppad OK (%s)', sqlerrm); end;
  begin
    insert into t4_invoices (customer_name, invoice_number, invoice_type, customer_id, contract_id, contract_invoice_kind, status, billing_period_start, billing_period_end, subtotal, vat_amount, total_amount, marking_key)
    values ('Prov', 'T4-D', 'contract', v_cust, v_fev, 'equipment_gap', 'pending_approval', '2026-11-10', '2027-06-29', 1, 0, 1, 'YX201');
    v_out := v_out || E'\nT4c equipment_gap efter drop: igenom OK';
  exception when others then v_out := v_out || format(E'\nT4c FEL %s', sqlerrm); end;
  raise exception 'PROV T4%', v_out;
end $$;
