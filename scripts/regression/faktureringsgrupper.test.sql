-- Faktureringsgrupper (20261103_faktureringsgrupper.sql), prov i ett block som
-- alltid rullas tillbaka (raise exception med resultatet, inget skrivs).
--
-- Maserfrakt 4c40f714 (v2, årspremie från 2026-03-01, exakt avtalsdag) får en
-- månadsgrupp (märkning MÅN-1) och en kvartalsgrupp (startdag 2027-01-01).
-- Betesstationerna (per månad) flyttas till månadsgruppen och ljusfällan
-- 060-… (per år, inomhus) till kvartalsgruppen.
--
-- T1: utan grupp ger fyrpartsvarianten samma svar som trepartsvarianten.
-- T2: gruppernas nästa periodstart från 2026-11-03.
-- T3: set_addon_station_billing_group: alla stationer på en rad flyttas = raden
--     byter grupp; en del av raden stoppas tills cbi_addon_period_line_key är borta.
-- T4: addon_prorata_v2_end räknar till gruppens nästa periodstart.
-- T5: set_addon_line_billing_group flyttar raden och stationerna tillbaka.
-- T6: överlappsvakten släpper två grupper med samma period och märkning, men
--     gamla unika indexet stoppar dem tills drop-raden körts (och
--     invoice_group_split_ready är falsk). Olika märkning går igenom.
-- T7: en grupp på ett avtal utan v2 räknas inte (addon_billing_group_valid).
--
-- Körd 2026-11-03 efter båda migrationerna (i transaktion, rullad tillbaka):
-- T1 0; T2 månad 2026-12-01, kvartal 2027-01-01 (från 2027-02-10: 2027-04-01);
-- T3 betesstationerna på raden i Månadsvis, ljusfällan på 8ab3f2d1 i
-- Kvartalsvis, övriga rader utan grupp, fyra rader efter ny synk; T4
-- ljusfällan 2027-01-01, betet 2026-12-01; T6 samma märkning stoppas av
-- invoices_contract_period_marking_key (split_ready falsk), annan märkning
-- går igenom, vakten stoppar överlapp i samma grupp; T7 null.
do $$
declare
  c uuid := '4c40f714-6174-45c1-8907-bf9fab7fdd99';
  gm uuid;
  gk uuid;
  r jsonb := '{}'::jsonb;
  v date;
  n int;
  i1 uuid;
  i2 uuid;
  v_err text;
  cust uuid;
begin
  -- T1
  select count(*) into n from generate_series('2026-01-01'::date, '2028-01-01'::date, '11 days') d
  where contract_addon_next_period_start(c, d::date, 'per_month', null::uuid) is distinct from contract_addon_next_period_start(c, d::date, 'per_month')
     or contract_addon_next_period_start(c, d::date, 'per_year', null::uuid) is distinct from contract_addon_next_period_start(c, d::date, 'per_year');
  r := r || jsonb_build_object('T1_skillnader', n);

  insert into contract_addon_billing_groups (contract_id, name, cadence, marking) values (c, 'Månadsvis', 'monthly', 'MÅN-1') returning id into gm;
  insert into contract_addon_billing_groups (contract_id, name, cadence, anchor_date) values (c, 'Kvartalsvis', 'quarterly', '2027-01-01') returning id into gk;

  -- T2
  r := r || jsonb_build_object(
    'T2_manad', contract_addon_next_period_start(c, '2026-11-03', 'per_year', gm),
    'T2_kvartal', contract_addon_next_period_start(c, '2026-11-03', 'per_year', gk),
    'T2_kvartal_2027_02_10', contract_addon_next_period_start(c, '2027-02-10', 'per_year', gk),
    'T2_ankare', contract_addon_billing_group_anchor(gm));

  -- T3: betesstationerna (bd223f3e) till månadsgruppen, ljusfällan c060f40c till kvartalsgruppen
  perform set_addon_station_billing_group(
    array(select id from equipment_placements where addon_contract_id = c and station_type_id = 'bd223f3e-09c7-451c-b4d6-942c2f5b9e8f' and status = 'active'),
    '{}'::uuid[], gm);
  -- Ljusfällan är ensam på sin rad (enheten 8ab3f2d1): hela raden byter grupp
  perform set_addon_station_billing_group('{}'::uuid[], array['c060f40c-b774-4723-81e1-dc824c51f3e1'::uuid], gk);
  -- En av två mekaniska fällor på samma rad: stoppas så länge cbi_addon_period_line_key finns
  begin
    perform set_addon_station_billing_group(array(select id from equipment_placements where addon_contract_id = c and station_type_id = 'af638f8f-3e18-43ee-abe2-b099d6d6bc51' limit 1), '{}'::uuid[], gm);
    v_err := 'gick igenom';
  exception when others then v_err := sqlerrm; end;
  r := r || jsonb_build_object('T3_halva_raden', v_err);
  r := r || jsonb_build_object('T3_rader', (
    select jsonb_agg(jsonb_build_object('typ', left(b.station_type_id::text, 8), 'modell', b.billing_model, 'antal', b.quantity,
                                        'start', b.billing_start_date, 'grupp', g.name) order by b.station_type_id, g.name nulls first, b.quantity)
    from case_billing_items b left join contract_addon_billing_groups g on g.id = b.addon_billing_group_id
    where b.case_id = c and b.billing_model in ('per_year', 'per_month') and b.status <> 'cancelled' and not coalesce(b.is_addon_labour_line, false)));

  -- T4
  select e.end_day into v from addon_prorata_v2_end(c, 'c060f40c-b774-4723-81e1-dc824c51f3e1', '2026-11-03') e;
  r := r || jsonb_build_object('T4_ljusfalla_kvartal', v);
  select e.end_day into v from addon_prorata_v2_end(c, (select id from equipment_placements where addon_contract_id = c and station_type_id = 'bd223f3e-09c7-451c-b4d6-942c2f5b9e8f' limit 1), '2026-11-03') e;
  r := r || jsonb_build_object('T4_bete_manad', v);
  select e.end_day into v from addon_prorata_v2_end(c, '0e0610f9-7bcb-4541-9c88-ec2e727170c0', '2026-11-03') e;
  r := r || jsonb_build_object('T4_ljusfalla_utan_grupp', v);

  -- T5
  perform set_addon_line_billing_group((select id from case_billing_items where case_id = c and addon_billing_group_id = gm limit 1), null);
  select count(*) into n from equipment_placements where addon_contract_id = c and addon_billing_group_id = gm;
  r := r || jsonb_build_object('T5_stationer_kvar_i_manadsgruppen', n);

  -- T6
  select customer_id into cust from contracts where id = c;
  insert into invoices (invoice_number, invoice_type, customer_id, customer_name, contract_id, contract_invoice_kind, status, billing_period_start, billing_period_end,
                        subtotal, vat_amount, total_amount, marking_key, addon_billing_group_id)
  values ('TEST-GRP-1', 'contract', cust, 'Test', c, 'equipment', 'draft', '2027-04-01', '2027-06-30', 1, 0, 1, 'X', gk) returning id into i1;
  begin
    insert into invoices (invoice_number, invoice_type, customer_id, customer_name, contract_id, contract_invoice_kind, status, billing_period_start, billing_period_end,
                          subtotal, vat_amount, total_amount, marking_key, addon_billing_group_id)
    values ('TEST-GRP-2', 'contract', cust, 'Test', c, 'equipment', 'draft', '2027-04-01', '2027-06-30', 1, 0, 1, 'X', gm);
    v_err := 'gick igenom';
  exception when others then
    v_err := sqlstate || ' ' || sqlerrm;
  end;
  r := r || jsonb_build_object('T6_samma_marking', v_err, 'T6_split_ready', invoice_group_split_ready());
  begin
    insert into invoices (invoice_number, invoice_type, customer_id, customer_name, contract_id, contract_invoice_kind, status, billing_period_start, billing_period_end,
                          subtotal, vat_amount, total_amount, marking_key, addon_billing_group_id)
    values ('TEST-GRP-3', 'contract', cust, 'Test', c, 'equipment', 'draft', '2027-04-01', '2027-06-30', 1, 0, 1, 'Y', gm) returning id into i2;
    v_err := 'gick igenom';
  exception when others then
    v_err := sqlstate || ' ' || sqlerrm;
  end;
  r := r || jsonb_build_object('T6_annan_marking', v_err);
  begin
    insert into invoices (invoice_number, invoice_type, customer_id, customer_name, contract_id, contract_invoice_kind, status, billing_period_start, billing_period_end,
                          subtotal, vat_amount, total_amount, marking_key, addon_billing_group_id)
    values ('TEST-GRP-4', 'contract', cust, 'Test', c, 'equipment', 'draft', '2027-05-01', '2027-07-31', 1, 0, 1, 'X', gk);
    v_err := 'gick igenom';
  exception when others then
    v_err := sqlstate || ' ' || sqlerrm;
  end;
  r := r || jsonb_build_object('T6_vakten_samma_grupp', v_err);

  -- T7
  r := r || jsonb_build_object('T7_annat_avtal', addon_billing_group_valid(gm, (select id from contracts where id <> c and coalesce(addon_rules, '') <> 'v2' limit 1)));

  raise exception 'RESULTAT %', r;
end $$;
