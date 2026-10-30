-- Steg 9 (avtalsåret på avtalsdag): pro rata version 2, reservtriggern och
-- pro rata-täckningen. Körs efter migrationen 20261030_prorata_v2_placed_case.sql.
-- Allt i ett block som alltid slutar med raise exception, så ingenting sparas.
--
-- Falu kommun 5006 (enhet c67ae185, avtal 23a115e3) görs i transaktionen till
-- målbilden i datadokumentet avsnitt 7: avtalsdag 2026-06-30, slut 2028-06-29,
-- option, ingen premie, addon_rules v2. Ljusfällan f8d6e371 hör till BE-0009544
-- och Auroconfällan 489d7fe6 till BE-0009545 (båda öppnas igen i transaktionen).
do $$
declare
  v_unit uuid := 'c67ae185-2dd8-47bf-a778-6448333fe070';
  v_contract uuid := '23a115e3-c492-486c-830a-976a454c4ea0';
  v_light uuid := 'f8d6e371-2c63-46b6-abaa-7dfebb920876';
  v_auro uuid := '489d7fe6-ecaa-40ac-9b12-7b3abd3cc98f';
  v_case1 uuid := 'a75c7c3c-34ab-4d01-b84d-4feb32999052'; -- BE-0009544
  v_case2 uuid := '5a12422b-8250-4dae-bc68-fd5d17537c57'; -- BE-0009545
  v_fev_contract uuid := 'bca4c235-e9ad-421d-9ef9-3a94550ac6be';
  v_fev_invoice uuid := 'b2100ee5-e609-4601-aa24-3ef6415b1d1c'; -- INV-202609-0338
  v_fev_station uuid := '712c758f-c143-4669-9c62-aa9ca91e60b9';
  v_tech uuid := 'd3248841-577d-42c5-83d1-840c69e811d0';     -- Hans Norman, tekniker
  v_admin uuid := '4ef86aa9-8f9f-4602-a4fd-967d0424697a';    -- Christian K
  v_out text[] := '{}';
  v_res jsonb;
  v_n int;
  v_txt text;
  v_row record;
  v_new uuid;
  v_ok boolean;
  e record;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- Före v2: Falu går legacy-vägen (avtalet saknar addon_rules)
  v_out := v_out || ('T0 uses_v2 före = ' || addon_prorata_uses_v2(v_unit));

  -- Målbilden
  update contracts set contract_start_date = '2026-06-30', contract_end_date = '2028-06-29',
         billing_frequency = null, billing_anchor_mode = 'start_day', addon_rules = 'v2', renewal_mode = 'option'
  where id = v_contract;
  update cases set status = 'Bokad' where id in (v_case1, v_case2);
  update equipment_placements set addon_contract_id = v_contract, addon_contract_mode = 'separate'
  where id in (v_light, v_auro);
  update equipment_placements set addon_unit_price_annual = 1686 where id = v_light;
  update equipment_placements set addon_unit_price_annual = 2348 where id = v_auro;

  -- T1: beslutade men utan ärende: inga rader, båda rapporteras no_case
  v_res := sync_addon_prorata_line(v_unit, null, null, null, null);
  v_out := v_out || ('T1 utan ärende: found=' || (v_res->>'found') || ' count=' || (v_res->>'count')
                     || ' no_case=' || (select count(*) from jsonb_array_elements(v_res->'skipped') x where x->>'reason' = 'no_case'));

  -- T2: med ärende: en rad per ärende, 246 dagar (2026-10-27 t.o.m. 2027-06-29)
  update equipment_placements set placed_case_id = v_case1 where id = v_light;
  update equipment_placements set placed_case_id = v_case2 where id = v_auro;
  v_res := sync_addon_prorata_line(v_unit, null, null, null, null);
  v_out := v_out || ('T2 svar: v2=' || (v_res->>'v2') || ' count=' || (v_res->>'count') || ' total=' || (v_res->>'total'));
  for v_row in
    select c.case_number, b.quantity, b.unit_price, b.total_price, b.billing_start_date, b.station_ids
    from case_billing_items b join cases c on c.id = b.case_id
    where b.case_id in (v_case1, v_case2) and b.is_addon_prorata_line and b.status = 'pending' and not b.is_addon_labour_line
    order by c.case_number
  loop
    v_out := v_out || format('T2 %s: %s st à %s = %s, slut %s, stationer %s', v_row.case_number, v_row.quantity,
                             v_row.unit_price, v_row.total_price, v_row.billing_start_date, v_row.station_ids);
  end loop;

  -- T3: samma anrop igen ändrar inget (idempotent)
  v_res := sync_addon_prorata_line(v_unit, null, null, null, null);
  select count(*) into v_n from case_billing_items
  where case_id in (v_case1, v_case2) and is_addon_prorata_line and status = 'pending' and not is_addon_labour_line;
  v_out := v_out || ('T3 igen: väntande rader = ' || v_n || ', total ' || (v_res->>'total'));

  -- T4: p_case_id begränsar till ärendet (kontrollrundans anrop)
  v_res := sync_addon_prorata_line(v_unit, null, null, null, v_case1);
  v_out := v_out || ('T4 bara BE-0009544: count=' || (v_res->>'count') || ' cases=' || (v_res->'cases')::text);
  select count(*) into v_n from case_billing_items
  where case_id = v_case2 and is_addon_prorata_line and status = 'pending' and not is_addon_labour_line;
  v_out := v_out || ('T4 rad på BE-0009545 orörd = ' || v_n);

  -- T5 (P5): efterskänkt 2026-10-27 t.o.m. 2026-12-31 på ljusfällan: dagar från 2027-01-01 (180)
  insert into addon_station_coverage (station_id, station_kind, unit_customer_id, contract_id, covered_from, covered_to, source, note, created_by_name)
  values (v_light, 'outdoor', v_unit, v_contract, '2026-10-27', '2026-12-31', 'waived', 'test steg 9', 'test');
  perform sync_addon_prorata_line(v_unit, null, null, null, null);
  select b.unit_price into v_txt from case_billing_items b
  where b.case_id = v_case1 and b.is_addon_prorata_line and b.status = 'pending' and not b.is_addon_labour_line;
  v_out := v_out || ('T5 ljusfällan efter efterskänkt: à ' || v_txt || ' (1686 x 180 / 365 = ' || round(1686 * 180 / 365.0, 2) || ')');

  -- T6: raden faktureras: täckningen skrivs bara över glappet 2027-01-01 t.o.m. 2027-06-29
  update case_billing_items set status = 'billed'
  where case_id = v_case1 and is_addon_prorata_line and status = 'pending' and not is_addon_labour_line;
  select string_agg(source || ' ' || covered_from || '..' || covered_to, '; ' order by covered_from) into v_txt
  from addon_station_coverage where station_id = v_light and released_at is null;
  v_out := v_out || ('T6 täckning ljusfällan: ' || coalesce(v_txt, 'ingen'));
  select count(*) into v_n from addon_coverage_conflicts where station_id = v_light;
  v_out := v_out || ('T6 konflikter = ' || v_n);

  -- T7: nästa synk skapar ingen ny rad för den fakturerade ljusfällan
  v_res := sync_addon_prorata_line(v_unit, null, null, null, null);
  select count(*) into v_n from case_billing_items
  where case_id = v_case1 and is_addon_prorata_line and status = 'pending' and not is_addon_labour_line;
  v_out := v_out || ('T7 väntande på BE-0009544 efter fakturering = ' || v_n || ', skäl '
                     || coalesce((select string_agg(x->>'reason', ',') from jsonb_array_elements(v_res->'skipped') x where x->>'station_id' = v_light::text), '-'));

  -- T8 (P4): uppsagt med effective_end_date 2027-03-31: Aurocon kapas, slut 2027-04-01 (156 dagar, 2026-10-27 t.o.m. 2027-03-31)
  update contracts set terminated_at = now(), effective_end_date = '2027-03-31' where id = v_contract;
  perform sync_addon_prorata_line(v_unit, null, null, null, null);
  select b.billing_start_date::text || ' à ' || b.unit_price into v_txt from case_billing_items b
  where b.case_id = v_case2 and b.is_addon_prorata_line and b.status = 'pending' and not b.is_addon_labour_line;
  v_out := v_out || ('T8 Aurocon uppsagt: slut ' || v_txt || ' (2348 x 156 / 365 = ' || round(2348 * 156 / 365.0, 2) || ')');
  update contracts set terminated_at = null, effective_end_date = null where id = v_contract;

  -- T9: obeslutad station på v2-avtal får ingen rad (beslutsspärren)
  update equipment_placements set addon_contract_id = null, addon_contract_mode = null where id = v_auro;
  v_res := sync_addon_prorata_line(v_unit, null, null, null, null);
  select count(*) into v_n from case_billing_items
  where case_id = v_case2 and is_addon_prorata_line and status = 'pending' and not is_addon_labour_line;
  v_out := v_out || ('T9 obeslutad: väntande på BE-0009545 = ' || v_n || ', undecided = '
                     || (select count(*) from jsonb_array_elements(v_res->'skipped') x where x->>'reason' = 'undecided'));
  update equipment_placements set addon_contract_id = v_contract, addon_contract_mode = 'separate' where id = v_auro;

  -- T10: stängt ärende ger ingen rad på ärendet (glappet tas av steg 11)
  update cases set status = 'Avslutat' where id = v_case2;
  v_res := sync_addon_prorata_line(v_unit, null, null, null, null);
  v_out := v_out || ('T10 stängt ärende: case_closed = '
                     || (select count(*) from jsonb_array_elements(v_res->'skipped') x where x->>'reason' = 'case_closed'));
  update cases set status = 'Bokad' where id = v_case2;

  -- T11: ledtidsregeln på FEV (bca4c235): tilläggsutkastet 2027-07-01 t.o.m. 2028-06-30 skickas i transaktionen
  update invoices set status = 'sent' where id = v_fev_invoice;
  select * into e from addon_prorata_v2_end(v_fev_contract, v_fev_station, '2027-03-01');
  v_out := v_out || format('T11a station på fakturan: ordinarie %s, slut %s', e.ordinary, e.end_day);
  select * into e from addon_prorata_v2_end(v_fev_contract, gen_random_uuid(), '2027-03-01');
  v_out := v_out || format('T11b station inte på fakturan: slut %s (ledtid), kapad %s', e.end_day, e.capped);
  update invoice_items set station_ids = null where invoice_id = v_fev_invoice;
  select * into e from addon_prorata_v2_end(v_fev_contract, gen_random_uuid(), '2027-03-01');
  v_out := v_out || format('T11c fakturan utan station_ids: slut %s, okänd %s', e.end_day, e.unknown_invoice);

  -- T12: reservtriggern. Ett öppet etableringsärende på Falu (BE-0009545 stängs först)
  update cases set status = 'Avslutat' where id = v_case2;
  insert into equipment_placements (customer_id, station_type_id, equipment_type, latitude, longitude, status, is_addon, addon_billing_model)
  values (v_unit, 'bd223f3e-09c7-451c-b4d6-942c2f5b9e8f', 'mekanisk_falla', 60.6, 15.6, 'active', true, 'per_year') returning id into v_new;
  select placed_case_id::text into v_txt from equipment_placements where id = v_new;
  v_out := v_out || ('T12a ett öppet ärende: placed_case_id = ' || coalesce(v_txt, 'NULL') || ' (väntat ' || v_case1 || ')');
  update cases set status = 'Bokad' where id = v_case2;
  insert into equipment_placements (customer_id, station_type_id, equipment_type, latitude, longitude, status, is_addon, addon_billing_model)
  values (v_unit, 'bd223f3e-09c7-451c-b4d6-942c2f5b9e8f', 'mekanisk_falla', 60.6, 15.6, 'active', true, 'per_year') returning id into v_new;
  select placed_case_id::text into v_txt from equipment_placements where id = v_new;
  v_out := v_out || ('T12b två öppna ärenden: placed_case_id = ' || coalesce(v_txt, 'NULL'));
  insert into equipment_placements (customer_id, station_type_id, equipment_type, latitude, longitude, status, is_addon)
  values (v_unit, 'bd223f3e-09c7-451c-b4d6-942c2f5b9e8f', 'mekanisk_falla', 60.6, 15.6, 'active', false) returning id into v_new;
  select placed_case_id::text into v_txt from equipment_placements where id = v_new;
  v_out := v_out || ('T12c ingen tilläggsstation: placed_case_id = ' || coalesce(v_txt, 'NULL'));

  -- T13: som tekniker (RLS). Utsättning med placed_case_id, läsa tillbaka, synka.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tech, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true); -- blocket slutar som tekniker och rullas tillbaka
  insert into equipment_placements (customer_id, station_type_id, equipment_type, latitude, longitude, status, is_addon, addon_billing_model, placed_case_id)
  values (v_unit, 'bd223f3e-09c7-451c-b4d6-942c2f5b9e8f', 'mekanisk_falla', 60.6, 15.6, 'active', true, 'per_year', v_case1) returning id into v_new;
  select placed_case_id::text into v_txt from equipment_placements where id = v_new;
  v_out := v_out || ('T13a tekniker satte ut och läser tillbaka placed_case_id = ' || coalesce(v_txt, 'NULL'));
  v_res := sync_addon_prorata_line(v_unit, null, null, 'Hans Norman', null);
  v_out := v_out || ('T13b tekniker synkar: found=' || (v_res->>'found') || ' v2=' || (v_res->>'v2'));
  select count(*) into v_n from case_billing_items where case_id = v_case2 and is_addon_prorata_line and status = 'pending';
  v_out := v_out || ('T13c tekniker ser väntande rader på BE-0009545 = ' || v_n);
  begin
    perform sync_addon_prorata_line_v2(v_unit, null, null, null, null);
    v_out := v_out || 'T13d tekniker anropar v2-grenen direkt: GICK (fel)'::text;
  exception when insufficient_privilege then
    v_out := v_out || 'T13d tekniker anropar v2-grenen direkt: nekad (rätt)'::text;
  end;

  raise exception E'RESULT\n%', array_to_string(v_out, E'\n');
end $$;
