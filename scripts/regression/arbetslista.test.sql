-- Steg 10 (avtalsåret på avtalsdag): beslutsspärr och arbetslista.
-- Körs efter migrationen 20261030_arbetslista_avtalskartan.sql. Allt i ett
-- block som alltid slutar med raise exception, så ingenting sparas.
--
-- Falu kommun 5006 (enhet och huvudkund c67ae185, avtal 23a115e3) görs i
-- transaktionen till avtal med nya tilläggsregler (addon_rules v2). Ljusfällan
-- f8d6e371 hör till BE-0009544, Auroconfällan 489d7fe6 till BE-0009545.
do $$
declare
  v_unit uuid := 'c67ae185-2dd8-47bf-a778-6448333fe070';
  v_contract uuid := '23a115e3-c492-486c-830a-976a454c4ea0';
  v_light uuid := 'f8d6e371-2c63-46b6-abaa-7dfebb920876';
  v_auro uuid := '489d7fe6-ecaa-40ac-9b12-7b3abd3cc98f';
  v_case1 uuid := 'a75c7c3c-34ab-4d01-b84d-4feb32999052'; -- BE-0009544
  v_case2 uuid := '5a12422b-8250-4dae-bc68-fd5d17537c57'; -- BE-0009545
  v_inv78 uuid := '72a67b66-f3e8-4152-bad4-71b689c480f2'; -- INV-202610-0078, makulerad
  v_admin text := '4ef86aa9-8f9f-4602-a4fd-967d0424697a';  -- Christian K, admin med befogenhet
  v_sofia text := '395413af-414f-4a67-ba53-9caa3c53ddce';  -- koordinator med befogenhet
  v_maikel text := '2793f364-2134-4bc8-9d5f-f06bc717be0c'; -- admin utan befogenhet
  v_kristian text := '6b508d7b-d6cf-4048-81c0-7c4124ca77e4'; -- tekniker med is_admin, utan befogenhet
  v_tech text := '35f0733c-f6d1-4498-a4b5-4fd40fecae81';  -- tekniker
  v_out text := '';
  v_n int;
  v_txt text;
  v_res jsonb;
  v_cov uuid;
  v_ids uuid[];
  r record;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- A1: dagens läge, inget avtal har v2
  for r in select w.kind, count(*) n, count(distinct w.root_customer_id) roots, sum(w.station_count) st
           from contract_work_items_internal(null) w group by w.kind order by 1 loop
    v_out := v_out || format(E'\nA1 %s: %s rader, %s kunder, %s stationer', r.kind, r.n, r.roots, r.st);
  end loop;
  select count(*) into v_n from (
    select root_customer_id from addon_pending_summary()
    except select root_customer_id from contract_work_items_internal(null) where kind = 'addon_decide') x;
  v_out := v_out || format(E'\nA1b kunder i addon_pending_summary som saknas i arbetslistan: %s %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);
  select count(*) into v_n from (
    select root_customer_id, stations from addon_pending_summary()
    except select root_customer_id, sum(station_count)::int from contract_work_items_internal(null) where kind = 'addon_decide' group by 1) x;
  v_out := v_out || format(E'\nA1c stationer per kund skiljer: %s %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);
  select instruction into v_txt from contract_work_items_internal(v_unit) where kind = 'addon_decide' limit 1;
  v_out := v_out || format(E'\nA1d Falu i dag (gamla regler): %s', v_txt);

  -- A2: v2 på Falu, stationerna obeslutade med ärende: ingen pro rata (spärren)
  update contracts set contract_start_date = '2026-06-30', contract_end_date = '2028-06-29',
         billing_frequency = null, billing_anchor_mode = 'start_day', addon_rules = 'v2', renewal_mode = 'option'
  where id = v_contract;
  update cases set status = 'Bokad' where id in (v_case1, v_case2);
  update equipment_placements set placed_case_id = v_case1 where id = v_light;
  update equipment_placements set placed_case_id = v_case2 where id = v_auro;
  update equipment_placements set addon_contract_id = null, addon_contract_mode = null where id in (v_light, v_auro);
  update case_billing_items set status = 'cancelled' where case_id in (v_case1, v_case2) and is_addon_prorata_line and status = 'pending';
  -- avtalet blir v2 via addon_contract_for_unit
  v_res := sync_addon_prorata_line(v_unit, null, null, null, null);
  select count(*) into v_n from case_billing_items
  where case_id in (v_case1, v_case2) and is_addon_prorata_line and status = 'pending' and not is_addon_labour_line;
  v_out := v_out || format(E'\nA2 obeslutade på v2: v2=%s väntande rader %s, undecided %s %s', v_res->>'v2', v_n,
    (select count(*) from jsonb_array_elements(v_res->'skipped') x where x->>'reason' = 'undecided'),
    case when v_n = 0 then 'OK' else 'FEL' end);
  select instruction into v_txt from contract_work_items_internal(v_unit) where kind = 'addon_decide' limit 1;
  v_out := v_out || format(E'\nA2b arbetslistan: %s', v_txt);

  -- A3: beslut (som addAddonStationsSeparate) och sync per ärende: raden skapas
  update cases set status = 'Avslutat' where id = v_case2;  -- Auroconfällans ärende stängt -> glapp
  update equipment_placements set addon_contract_id = v_contract, addon_contract_mode = 'separate' where id in (v_light, v_auro);
  update equipment_placements set addon_unit_price_annual = 1686 where id = v_light;
  update equipment_placements set addon_unit_price_annual = 2348 where id = v_auro;
  perform sync_addon_period_lines(v_unit, v_contract, 1686);
  v_res := sync_addon_prorata_line(v_unit, null, null, null, v_case1);
  select count(*) into v_n from case_billing_items
  where case_id = v_case1 and is_addon_prorata_line and status = 'pending' and not is_addon_labour_line;
  v_out := v_out || format(E'\nA3 efter beslut: rader på BE-0009544 %s, total %s %s', v_n, v_res->>'total', case when v_n = 1 then 'OK' else 'FEL' end);
  select count(*) into v_n from contract_work_items_internal(v_unit) where kind = 'addon_decide';
  v_out := v_out || format(E'\nA3b addon_decide kvar för Falu: %s %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);

  -- A4: stängt ärende -> glappfaktura i arbetslistan
  for r in select kind, instruction, period_from, period_to from contract_work_items_internal(v_unit) where kind = 'gap_invoice' loop
    v_out := v_out || format(E'\nA4 %s: %s', r.kind, r.instruction);
  end loop;

  -- A5: station utan ärende
  update equipment_placements set placed_case_id = null where id = v_auro;
  select instruction, station_ids into v_txt, v_ids from contract_work_items_internal(v_unit) where kind = 'addon_no_case';
  v_out := v_out || format(E'\nA5 %s', coalesce(v_txt, 'ingen rad FEL'));

  -- A6: täckning med makulerad faktura
  insert into addon_station_coverage (station_id, station_kind, unit_customer_id, contract_id, covered_from, covered_to,
                                      source, invoice_id, invoice_cancelled_at, created_by_name)
  values (v_light, 'outdoor', v_unit, v_contract, '2027-06-30', '2028-06-29', 'invoice', v_inv78, now(), 'test steg 10')
  returning id into v_cov;
  select instruction into v_txt from contract_work_items_internal(v_unit) where kind = 'coverage_cancelled';
  v_out := v_out || format(E'\nA6 %s', coalesce(v_txt, 'ingen rad FEL'));

  -- A7: konflikt
  insert into addon_coverage_conflicts (invoice_id, station_id, station_kind, covered_from, covered_to, source, conflict_with)
  values (v_inv78, v_light, 'outdoor', '2027-07-01', '2027-12-31', 'invoice', v_cov);
  select instruction into v_txt from contract_work_items_internal(v_unit) where kind = 'coverage_conflict';
  v_out := v_out || format(E'\nA7 %s', coalesce(v_txt, 'ingen rad FEL'));

  -- A8: avtalsdagen inte kontrollerad
  select instruction into v_txt from contract_work_items_internal(v_unit) where kind = 'anchor_verify';
  v_out := v_out || format(E'\nA8 %s', coalesce(v_txt, 'ingen rad FEL'));

  -- A9: notisen (triggrarna har redan kört; kör en gång till)
  perform addon_pending_refresh_notifications(v_unit);
  select string_agg(distinct title || ' | ' || preview, ' || ') into v_txt from notifications
  where case_type = 'customer' and case_id = v_unit and not is_read;
  v_out := v_out || format(E'\nA9 notis: %s', coalesce(v_txt, 'ingen FEL'));
  select count(*) into v_n from notifications n join profiles p on p.id = n.recipient_id
  where n.case_type = 'customer' and n.case_id = v_unit and not n.is_read and not coalesce(p.can_approve_invoices, false);
  v_out := v_out || format(E'\nA9b notiser till personal utan befogenhet: %s %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);

  -- A10: roller
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_sofia, 'role', 'authenticated')::text, true);
  select count(*) into v_n from contract_work_items(v_unit);
  v_out := v_out || format(E'\nA10a Sofia ser %s rader', v_n);
  v_n := addon_station_set_case(v_ids, 'outdoor', v_case1);
  v_out := v_out || format(E'\nA10b Sofia väljer ärende: %s station %s', v_n, case when v_n = 1 then 'OK' else 'FEL' end);
  select count(*) into v_n from contract_work_items(v_unit) where kind = 'addon_no_case';
  v_out := v_out || format(E'\nA10c addon_no_case kvar: %s %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);
  select coverage_ids into v_ids from contract_work_items(v_unit) where kind = 'coverage_cancelled';
  perform addon_coverage_waive(array[v_light], 'outdoor', '2027-06-30', '2028-06-29', 'Test: efterskänkt steg 10');
  select count(*) into v_n from contract_work_items(v_unit) where kind = 'coverage_cancelled';
  v_out := v_out || format(E'\nA10d efterskänk: coverage_cancelled kvar %s %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);
  select conflict_ids into v_ids from contract_work_items(v_unit) where kind = 'coverage_conflict';
  v_n := addon_coverage_conflict_resolve(v_ids);
  select count(*) into v_n from contract_work_items(v_unit) where kind = 'coverage_conflict';
  v_out := v_out || format(E'\nA10e konflikt hanterad: kvar %s %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);

  perform set_config('request.jwt.claims', json_build_object('sub', v_maikel, 'role', 'authenticated')::text, true);
  select count(*) into v_n from contract_work_items(v_unit);
  v_out := v_out || format(E'\nA10f admin utan befogenhet läser %s rader', v_n);
  begin
    perform addon_coverage_conflict_resolve(array[gen_random_uuid()]);
    v_out := v_out || E'\nA10g admin utan befogenhet skriver: gick igenom FEL';
  exception when others then v_out := v_out || format(E'\nA10g admin utan befogenhet skriver stoppas OK: %s', sqlerrm);
  end;

  foreach v_txt in array array[v_tech, v_kristian] loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_txt, 'role', 'authenticated')::text, true);
    begin
      perform count(*) from contract_work_items(v_unit);
      v_out := v_out || format(E'\nA10h tekniker %s läser: gick igenom FEL', left(v_txt, 8));
    exception when others then v_out := v_out || format(E'\nA10h tekniker %s läser stoppas OK: %s', left(v_txt, 8), sqlerrm);
    end;
    begin
      perform addon_station_set_case(array[v_auro], 'outdoor', v_case1);
      v_out := v_out || format(E'\nA10i tekniker %s väljer ärende: gick igenom FEL', left(v_txt, 8));
    exception when others then v_out := v_out || format(E'\nA10i tekniker %s väljer ärende stoppas OK: %s', left(v_txt, 8), sqlerrm);
    end;
  end loop;

  execute 'reset role';
  update profiles set can_approve_invoices = false where user_id = v_sofia::uuid;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_sofia, 'role', 'authenticated')::text, true);
  begin
    perform count(*) from contract_work_items(v_unit);
    v_out := v_out || E'\nA10j koordinator utan befogenhet läser: gick igenom FEL';
  exception when others then v_out := v_out || format(E'\nA10j koordinator utan befogenhet läser stoppas OK: %s', sqlerrm);
  end;
  begin
    perform contract_work_items_internal(v_unit);
    v_out := v_out || E'\nA10k klient anropar den interna: gick igenom FEL';
  exception when others then v_out := v_out || format(E'\nA10k klient anropar den interna stoppas OK: %s', sqlerrm);
  end;
  execute 'reset role';

  -- A11: anon och public saknar körrätt
  select count(*) into v_n from information_schema.routine_privileges
  where routine_schema = 'public' and grantee in ('anon', 'PUBLIC')
    and routine_name in ('contract_work_items', 'contract_work_items_internal', 'addon_station_set_case',
                         'addon_coverage_conflict_resolve', 'work_items_root_of', 'work_items_notify_coverage',
                         'work_items_notify_conflict', 'work_items_notify_contract');
  v_out := v_out || format(E'\nA11 körrätter för anon/public: %s (ska 0) %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);

  raise exception 'RESULTAT (rullas tillbaka):%', v_out;
end $$;
