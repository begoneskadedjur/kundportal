-- Steg 8, täckningsmotorn: bevis som alltid rullas tillbaka.
-- Körs EFTER migrationen 20261030_tackning_stationer.sql (eller med migrationen
-- inklistrad först). Blocket avslutas med raise exception så att inget sparas;
-- resultatet står i felmeddelandet, en rad per fall.
--
-- Testdata (bara inne i transaktionen):
--   FEV:s tilläggsutkast INV-202609-0338 (avtal bca4c235, 17 stationer med station_ids)
--   pro rata-raden ae5d1266 (BE-0009544, billing_start_date 2026-11-01) och stationen 489d7fe6
--
-- Fall:
--  0   paid_through för alla tilläggsstationer före täckning = svaret före migrationen (md5)
--  1   avtal utan addon_rules: faktura till sent skriver ingen täckning
--  2   addon_rules v2: faktura till sent skriver en invoice-rad per station, rätt datum
--  2b  station med manuell Fortnox-rad före sändning ger konflikt, ingen invoice-rad
--  3   faktura makulerad: raderna står kvar med invoice_cancelled_at, inget glapp
--  4   addon_coverage_release: hela perioden blir glapp
--  5   addon_coverage_waive: inget glapp, en waived-rad, den gamla släppt; delar utanför perioden behålls
--  6   manuell registrering som överlappar en aktiv rad stoppas
--  7   pro rata till billed med station_ids: prorata-rad från stationens startdag till dagen före billing_start_date
--  8   paid_through läser täckningen (källa, referens, cancelled_unresolved)
--  9   roller: tekniker och koordinator utan befogenhet ser raderna men får inte skriva; Sofia får
--  10  återställd faktura tar bort makuleringsmarkeringen
--  11  anon har ingen körrätt

do $$
declare
  v_out text := '';
  v_n int;
  v_h text;
  v_err text;
  v_j jsonb;
  v_inv uuid := 'b2100ee5-e609-4601-aa24-3ef6415b1d1c';      -- INV-202609-0338
  v_contract uuid := 'bca4c235-e9ad-421d-9ef9-3a94550ac6be';
  v_st uuid := '712c758f-c143-4669-9c62-aa9ca91e60b9';        -- inomhus, på INV-0338
  v_st2 uuid := '21482957-40ab-4551-9309-97c8de9d9250';       -- samma rad på INV-0338
  v_cbi uuid := 'ae5d1266-3df9-4cac-bdce-203955347735';
  v_pr uuid := '489d7fe6-ecaa-40ac-9b12-7b3abd3cc98f';        -- utomhus, pro rata BE-0009544
  v_tech text := '35f0733c-f6d1-4498-a4b5-4fd40fecae81';
  v_sofia text := '395413af-414f-4a67-ba53-9caa3c53ddce';
  v_kind text;
  v_kind2 text;
  v_ids uuid[];
begin
  -- 0
  perform set_config('request.jwt.claims', json_build_object('sub', v_sofia, 'role', 'authenticated')::text, true);
  select md5(string_agg(id::text || indoor::text || addon_station_paid_through(id, indoor)::text, '|' order by id)), count(*)
    into v_h, v_n
  from (select id, false as indoor from equipment_placements where is_addon
        union all select id, true from indoor_stations where is_addon) s;
  v_out := v_out || format(E'\n0 paid_through %s stationer md5 %s (före: 3a7bf24f9c04d922fcfaeaf610bae7c1) %s',
                           v_n, v_h, case when v_h = '3a7bf24f9c04d922fcfaeaf610bae7c1' then 'OK' else 'SKILLNAD' end);
  perform set_config('request.jwt.claims', '', true);

  select station_kind into v_kind from addon_station_lookup(v_st, null);
  select station_kind into v_kind2 from addon_station_lookup(v_st2, null);

  -- 1
  update invoices set status = 'sent' where id = v_inv;
  select count(*) into v_n from addon_station_coverage where invoice_id = v_inv;
  v_out := v_out || format(E'\n1 legacy-avtal, sent: %s täckningsrader (ska 0) %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);
  update invoices set status = 'pending_approval' where id = v_inv;

  -- 2b förberedelse: manuell rad på v_st2 i augusti 2027 (som postgres, direkt insert)
  insert into addon_station_coverage (station_id, station_kind, unit_customer_id, covered_from, covered_to, source, fortnox_document_number)
  select v_st2, v_kind2, unit_customer_id, '2027-08-01', '2027-08-31', 'fortnox_manual', 'TEST-1'
  from addon_station_lookup(v_st2, null);

  -- 2
  update contracts set addon_rules = 'v2' where id = v_contract;
  update invoices set status = 'sent' where id = v_inv;
  select count(*), count(*) filter (where covered_from = '2027-07-01' and covered_to = '2028-06-30' and source = 'invoice')
    into v_n, v_err
  from addon_station_coverage where invoice_id = v_inv;
  select count(distinct s) into v_h from invoice_items ii, unnest(ii.station_ids) s where ii.invoice_id = v_inv;
  v_out := v_out || format(E'\n2 v2, sent: %s rader, %s med 2027-07-01 t.o.m. 2028-06-30, stationer på fakturan %s (en har manuell rad) %s',
                           v_n, v_err, v_h, case when v_n = v_h::int - 1 and v_err::int = v_n then 'OK' else 'FEL' end);
  select count(*) into v_n from addon_coverage_conflicts where invoice_id = v_inv and station_id = v_st2 and conflict_with is not null;
  v_out := v_out || format(E'\n2b konflikt för stationen med manuell rad: %s %s', v_n, case when v_n = 1 then 'OK' else 'FEL' end);

  -- 3
  update invoices set status = 'cancelled' where id = v_inv;
  select count(*) into v_n from addon_station_coverage where invoice_id = v_inv and invoice_cancelled_at is not null and released_at is null;
  v_out := v_out || format(E'\n3a makulerad: %s rader med invoice_cancelled_at, ej släppta', v_n);
  select count(*) into v_n from addon_station_gaps(v_st, v_kind, '2027-07-01', '2028-06-30');
  v_out := v_out || format(E'\n3b glapp efter makulering: %s (ska 0) %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);

  -- 4 och 5 som Sofia (koordinator med befogenheten)
  perform set_config('request.jwt.claims', json_build_object('sub', v_sofia, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select array_agg(id) into v_ids from addon_station_coverage where station_id = v_st and released_at is null;
  v_n := addon_coverage_release(v_ids, 'Test: fakturera igen');
  select string_agg(gap_from || '..' || gap_to, ',') into v_err from addon_station_gaps(v_st, v_kind, '2027-07-01', '2028-06-30');
  v_out := v_out || format(E'\n4 release %s rad, glapp %s %s', v_n, v_err, case when v_err = '2027-07-01..2028-06-30' then 'OK' else 'FEL' end);

  v_n := addon_coverage_waive(array[v_st], v_kind, '2027-07-01', '2028-06-30', 'Test: efterskänkt');
  select count(*) into v_n from addon_station_gaps(v_st, v_kind, '2027-07-01', '2028-06-30');
  select count(*) into v_h from addon_station_coverage where station_id = v_st and released_at is null and source = 'waived';
  v_out := v_out || format(E'\n5a waive: glapp %s, aktiva waived %s %s', v_n, v_h, case when v_n = 0 and v_h = '1' then 'OK' else 'FEL' end);

  -- 5b waive över halva perioden på v_st2 i juli 2027 (stationen har bara manuell aug-rad): ok, och
  -- waive över 2027-08-15..2027-09-15 klipper den manuella raden och behåller 08-01..08-14
  v_n := addon_coverage_waive(array[v_st2], v_kind2, '2027-08-15', '2027-09-15', 'Test: delvis');
  select string_agg(source || ' ' || covered_from || '..' || covered_to, ', ' order by covered_from) into v_err
  from addon_station_coverage where station_id = v_st2 and released_at is null;
  v_out := v_out || format(E'\n5b delvis waive behåller resten: %s %s', v_err,
    case when v_err = 'fortnox_manual 2027-08-01..2027-08-14, waived 2027-08-15..2027-09-15' then 'OK' else 'FEL' end);

  -- 6
  begin
    perform addon_coverage_register_manual(array[v_st], v_kind, '2027-12-01', '2027-12-31', '9999', 'Test');
    v_out := v_out || E'\n6 manuell över aktiv rad: gick igenom FEL';
  exception when others then
    v_out := v_out || format(E'\n6 manuell över aktiv rad stoppas OK: %s', sqlerrm);
  end;
  -- 6b manuell utan överlapp går igenom
  v_n := addon_coverage_register_manual(array[v_st], v_kind, '2028-07-01', '2029-06-30', '9999', 'Test');
  v_out := v_out || format(E'\n6b manuell utan överlapp: %s rad %s', v_n, case when v_n = 1 then 'OK' else 'FEL' end);

  -- 9 roller: tekniker
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_tech, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from addon_station_coverage where station_id = v_st;
  v_out := v_out || format(E'\n9a tekniker ser %s rader', v_n);
  select count(*) into v_n from addon_station_gaps(v_st, v_kind, '2027-01-01', '2027-12-31');
  v_out := v_out || format(E'\n9b tekniker läser glapp: %s', v_n);
  begin
    perform addon_coverage_register_manual(array[v_st], v_kind, '2030-01-01', '2030-01-31', '1', 'x');
    v_out := v_out || E'\n9c tekniker registrerar: gick igenom FEL';
  exception when others then v_out := v_out || format(E'\n9c tekniker registrerar stoppas OK: %s', sqlerrm);
  end;
  begin
    perform addon_coverage_waive(array[v_st], v_kind, '2030-01-01', '2030-01-31', 'x');
    v_out := v_out || E'\n9d tekniker efterskänker: gick igenom FEL';
  exception when others then v_out := v_out || format(E'\n9d tekniker efterskänker stoppas OK: %s', sqlerrm);
  end;
  begin
    perform addon_coverage_release(v_ids, 'x');
    v_out := v_out || E'\n9e tekniker släpper: gick igenom FEL';
  exception when others then v_out := v_out || format(E'\n9e tekniker släpper stoppas OK: %s', sqlerrm);
  end;
  begin
    insert into addon_station_coverage (station_id, station_kind, unit_customer_id, covered_from, covered_to, source)
    values (v_st, v_kind, (select unit_customer_id from addon_station_coverage limit 1), '2031-01-01', '2031-01-02', 'invoice');
    v_out := v_out || E'\n9f tekniker rå insert: gick igenom FEL';
  exception when others then v_out := v_out || format(E'\n9f tekniker rå insert stoppas OK: %s', sqlerrm);
  end;
  -- koordinator utan befogenhet (Sofia med can_approve_invoices av inne i transaktionen)
  execute 'reset role';
  update profiles set can_approve_invoices = false where user_id = v_sofia::uuid;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sofia, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from addon_station_coverage where station_id = v_st;
  v_out := v_out || format(E'\n9g koordinator utan befogenhet ser %s rader', v_n);
  begin
    perform addon_coverage_waive(array[v_st], v_kind, '2030-01-01', '2030-01-31', 'x');
    v_out := v_out || E'\n9h koordinator utan befogenhet efterskänker: gick igenom FEL';
  exception when others then v_out := v_out || format(E'\n9h koordinator utan befogenhet stoppas OK: %s', sqlerrm);
  end;
  begin
    perform addon_coverage_register_manual(array[v_st], v_kind, '2030-01-01', '2030-01-31', '1', 'x');
    v_out := v_out || E'\n9i koordinator utan befogenhet registrerar: gick igenom FEL';
  exception when others then v_out := v_out || format(E'\n9i koordinator utan befogenhet registrerar stoppas OK: %s', sqlerrm);
  end;
  execute 'reset role';
  update profiles set can_approve_invoices = true where user_id = v_sofia::uuid;

  -- 10 återställd faktura
  perform set_config('request.jwt.claims', '', true);
  update invoices set status = 'sent' where id = v_inv;
  select count(*) into v_n from addon_station_coverage where invoice_id = v_inv and released_at is null and invoice_cancelled_at is not null;
  v_out := v_out || format(E'\n10 återställd: kvar med makuleringsmarkering %s (ska 0) %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);

  -- 7 pro rata
  update case_billing_items set status = 'pending', station_ids = array[v_pr] where id = v_cbi;
  update case_billing_items set status = 'billed' where id = v_cbi;
  select string_agg(source || ' ' || covered_from || '..' || covered_to, ',') into v_err
  from addon_station_coverage where case_billing_item_id = v_cbi;
  v_out := v_out || format(E'\n7 pro rata: %s %s', v_err, case when v_err = 'prorata 2026-10-27..2026-10-31' then 'OK' else 'FEL' end);

  -- 8 paid_through läser täckningen
  perform set_config('request.jwt.claims', json_build_object('sub', v_tech, 'role', 'authenticated')::text, true);
  v_j := addon_station_paid_through(v_pr, false);
  v_out := v_out || format(E'\n8a pro rata-stationen: %s', v_j::text);
  v_j := addon_station_paid_through(v_st, v_kind = 'indoor');
  v_out := v_out || format(E'\n8b efterskänkt station (täckning bara framåt, ej idag): %s', v_j::text);
  -- cancelled_unresolved: makulera fakturan igen
  perform set_config('request.jwt.claims', '', true);
  update invoices set status = 'cancelled' where id = v_inv;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tech, 'role', 'authenticated')::text, true);
  select addon_station_paid_through(s, (select station_kind from addon_station_lookup(s, null)) = 'indoor') into v_j
  from (select station_id s from addon_station_coverage where invoice_id = v_inv and released_at is null limit 1) q;
  v_out := v_out || format(E'\n8c station med makulerad faktura: cancelled_unresolved=%s', v_j ->> 'cancelled_unresolved');

  -- 11 anon
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v_n from information_schema.routine_privileges
  where routine_schema = 'public' and grantee in ('anon', 'PUBLIC')
    and routine_name in ('addon_coverage_register_manual', 'addon_coverage_waive', 'addon_coverage_release',
                         'addon_station_coverage_list', 'addon_station_gaps', 'addon_station_paid_through',
                         'addon_station_paid_through_legacy', 'addon_station_lookup', 'addon_coverage_approver');
  v_out := v_out || format(E'\n11 körrätter för anon/public: %s (ska 0) %s', v_n, case when v_n = 0 then 'OK' else 'FEL' end);

  raise exception 'RESULTAT (rullas tillbaka):%', v_out;
end $$;
