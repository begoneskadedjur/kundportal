-- Steg 5, datamodellen: bevis som alltid rullas tillbaka.
-- Körs EFTER migrationen 20261030_avtalsar_datamodell.sql (eller med migrationen
-- inklistrad först). Hela blocket avslutas med raise exception så att inget
-- sparas; resultatet står i felmeddelandet, en rad per fall.
--
-- Fall:
--  1-6  inga befintliga rader har värden i de nya kolumnerna, täckningen är tom
--  7    ingen befintlig rad bryter mot det nya unika indexet (samma gruppering)
--  8    två avtalsfakturor med samma avtal, period, typ och marking_key NULL stoppas
--       av nya indexets definition (temp-kopia utan gamla indexet); 8c samma på invoices
--  9    olika marking_key på samma avtal, period och typ går igenom, samma stoppas (9b)
--  10   check: billing_anchor_mode bara start_day, addon_rules bara v2
--  11   tekniker: ser täckningsrader, får inte skriva
--  12   koordinator med can_approve_invoices: ser, får inte skriva
--  13   kund: ser inget, får inte skriva
--  14   anon: ingen behörighet alls

do $$
declare
  v_out text := '';
  v_n int;
  v_src uuid := '6bb4e370-058f-4582-a559-4d2af8b7f799'; -- ett redigerbart INV-utkast på ett avtal
  v_ep uuid := 'cc91ce53-24f9-4aba-b5ea-ff83a543c7d8';
  v_ep_cust uuid := 'ba413d88-19f1-4156-8c3f-9f03bec04c89';
  v_tech text := '35f0733c-f6d1-4498-a4b5-4fd40fecae81';
  v_koord text := '395413af-414f-4a67-ba53-9caa3c53ddce';
  v_cust text := '7cd89f77-9924-49e4-a1c0-9d3e851a3d5c';
  v_err text;
  v_role text;
  v_user text;
begin
  select count(*) into v_n from contracts where billing_anchor_mode is not null or addon_rules is not null
    or billing_anchor_verified_at is not null or billing_anchor_verified_by is not null or billing_anchor_verified_note is not null;
  v_out := v_out || format(E'\n1 contracts med nya fält: %s', v_n);
  select count(*) into v_n from invoices where marking_key is not null;
  v_out := v_out || format(E'\n2 invoices.marking_key: %s', v_n);
  select count(*) into v_n from equipment_placements where placed_case_id is not null;
  v_out := v_out || format(E'\n3 equipment_placements.placed_case_id: %s', v_n);
  select count(*) into v_n from indoor_stations where placed_case_id is not null;
  v_out := v_out || format(E'\n4 indoor_stations.placed_case_id: %s', v_n);
  select count(*) into v_n from case_billing_items where station_ids is not null;
  v_out := v_out || format(E'\n5 case_billing_items.station_ids: %s', v_n);
  select count(*) into v_n from addon_station_coverage;
  v_out := v_out || format(E'\n6 addon_station_coverage: %s', v_n);

  select count(*) into v_n from (
    select 1 from invoices
    where invoice_type = 'contract' and contract_id is not null and contract_invoice_kind <> 'adjustment'
      and status <> 'cancelled' and invoice_number !~~ 'F-%'
    group by contract_id, billing_period_start, contract_invoice_kind, coalesce(marking_key, '')
    having count(*) > 1) d;
  v_out := v_out || format(E'\n7 grupper som bryter mot nya indexet: %s', v_n);

  -- 8 och 9: det gamla indexet (contract_id, period, typ) ligger kvar tills Christian
  -- tar bort det och slår alltid till först. Det nya indexets definition prövas
  -- därför på en tillfällig kopia av invoices utan det gamla indexet.
  create temp table inv_t (like invoices including defaults);
  create unique index inv_t_marking_key
    on inv_t (contract_id, billing_period_start, contract_invoice_kind, coalesce(marking_key, ''))
    where invoice_type = 'contract' and contract_id is not null and contract_invoice_kind <> 'adjustment'
      and status <> 'cancelled' and invoice_number !~~ 'F-%';
  insert into inv_t select * from invoices i where i.id = v_src;
  begin
    insert into inv_t select (jsonb_populate_record(null::inv_t,
      to_jsonb(i) || jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'INV-TEST-STEG5-A'))).*
    from invoices i where i.id = v_src;
    v_out := v_out || E'\n8 FEL: dubbletten med marking_key NULL gick igenom';
  exception when unique_violation then
    v_out := v_out || E'\n8 dubblett med marking_key NULL stoppad av nya indexets definition';
  end;
  update inv_t set marking_key = 'TEST-A' where id = v_src;
  begin
    insert into inv_t select (jsonb_populate_record(null::inv_t,
      to_jsonb(i) || jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'INV-TEST-STEG5-B', 'marking_key', 'TEST-B'))).*
    from invoices i where i.id = v_src;
    v_out := v_out || E'\n9 olika marking_key på samma avtal, period och typ: gick igenom';
  exception when unique_violation then
    v_out := v_out || E'\n9 FEL: olika marking_key stoppades';
  end;
  begin
    insert into inv_t select (jsonb_populate_record(null::inv_t,
      to_jsonb(i) || jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'INV-TEST-STEG5-C', 'marking_key', 'TEST-B'))).*
    from invoices i where i.id = v_src;
    v_out := v_out || E'\n9b FEL: samma marking_key två gånger gick igenom';
  exception when unique_violation then
    v_out := v_out || E'\n9b samma marking_key två gånger stoppad';
  end;
  -- 8c: på riktiga tabellen stoppas dubbletten (överlappsvakten avstängd via nödventilen).
  perform set_config('app.allow_period_overlap', 'on', true);
  begin
    insert into invoices
    select (jsonb_populate_record(null::invoices,
      to_jsonb(i) || jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'INV-TEST-STEG5-D', 'fortnox_document_number', null))).*
    from invoices i where i.id = v_src;
    v_out := v_out || E'\n8c FEL: dubbletten gick igenom på invoices';
  exception when unique_violation then
    get stacked diagnostics v_err = constraint_name;
    v_out := v_out || format(E'\n8c dubblett på invoices stoppad av %s', v_err);
  end;

  begin
    update contracts set billing_anchor_mode = 'first_day' where id = (select id from contracts limit 1);
    v_out := v_out || E'\n10 FEL: billing_anchor_mode first_day gick igenom';
  exception when check_violation then
    v_out := v_out || E'\n10 billing_anchor_mode first_day stoppad';
  end;
  begin
    update contracts set addon_rules = 'v3' where id = (select id from contracts limit 1);
    v_out := v_out || E'\n10b FEL: addon_rules v3 gick igenom';
  exception when check_violation then
    v_out := v_out || E'\n10b addon_rules v3 stoppad';
  end;

  -- En täckningsrad som superanvändare, för läsprovet.
  insert into addon_station_coverage (station_id, station_kind, unit_customer_id, covered_from, covered_to, source, note)
  values (v_ep, 'outdoor', v_ep_cust, '2026-01-01', '2026-12-31', 'backfill', 'test steg 5');

  foreach v_role in array array['tekniker', 'koordinator', 'kund'] loop
    v_user := case v_role when 'tekniker' then v_tech when 'koordinator' then v_koord else v_cust end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into v_n from addon_station_coverage;
    v_out := v_out || format(E'\n%s %s ser %s rad(er)',
      case v_role when 'tekniker' then '11' when 'koordinator' then '12' else '13' end, v_role, v_n);
    begin
      insert into addon_station_coverage (station_id, station_kind, unit_customer_id, covered_from, covered_to, source)
      values (v_ep, 'outdoor', v_ep_cust, '2027-01-01', '2027-12-31', 'backfill');
      v_out := v_out || format(E'\n   FEL: %s fick skriva', v_role);
    exception when insufficient_privilege then
      v_out := v_out || format(E'\n   %s får inte skriva (%s)', v_role, sqlerrm);
    end;
    begin
      update addon_station_coverage set note = 'x' where note = 'test steg 5';
      get diagnostics v_n = row_count;
      v_out := v_out || format(E'\n   %s update påverkade %s rad(er)', v_role, v_n);
    exception when insufficient_privilege then
      v_out := v_out || format(E'\n   %s får inte uppdatera', v_role);
    end;
    execute 'reset role';
  end loop;

  execute 'set local role anon';
  begin
    select count(*) into v_n from addon_station_coverage;
    v_out := v_out || format(E'\n14 FEL: anon ser %s rad(er)', v_n);
  exception when insufficient_privilege then
    v_out := v_out || E'\n14 anon saknar behörighet';
  end;
  execute 'reset role';

  raise exception 'RESULTAT (rullas tillbaka):%', v_out;
end $$;
