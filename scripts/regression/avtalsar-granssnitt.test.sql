-- Steg 12 (avtalsåret på avtalsdag): prov av 20261030_avtalsar_granssnitt.sql.
-- Körs efter migrationen (eller efter migrationens SQL i samma anrop).
-- Rullas alltid tillbaka: blocket slutar med raise exception 'PROV KLART: ...'
-- där varje fall står som "Tn ok". Ett fel ger 'FEL Tn ...'.
--
-- Roller: Sofia Pålshagen (koordinator med befogenheten), Hans Norman
-- (tekniker), Maikel Saliba (admin utan befogenhet), Jimmy Shamon (säljare,
-- skrivrätt på contracts via RLS), kundkontot tim.eriksson.
-- Körd 2026-10-30 före skarp migration och efter: alla fall ok.
do $$
declare
  v_sofia uuid := '395413af-414f-4a67-ba53-9caa3c53ddce';
  v_hans uuid := 'd3248841-577d-42c5-83d1-840c69e811d0';
  v_maikel uuid := '2793f364-2134-4bc8-9d5f-f06bc717be0c';
  v_jimmy uuid := '27c87b2f-0781-4911-a3cc-ef3e6a311584';
  v_cust_user uuid := '7cd89f77-9924-49e4-a1c0-9d3e851a3d5c';
  v_cust uuid := 'c297f967-7928-4815-9580-03d3b687bab9';
  v_fw_contract uuid := '5c00b63c-34d4-4ae1-ab44-ee4b6a137ed5';
  v_fw_sibling uuid := 'd86fbf4e-7a59-41c9-a4a4-d830f7c2e2e9';
  v_fev uuid := '72818957-73cb-4860-9080-ebcde5351670';
  v_cust_contract uuid; v_res jsonb; v_view jsonb; c record; v_ok boolean; v_events int; v_sofia_profile uuid;
  v_log text := '';
begin
  select id into v_sofia_profile from profiles where user_id = v_sofia;
  select id into v_cust_contract from contracts where customer_id = v_cust and status in ('signed', 'active') limit 1;

  -- T1 kundens avtalsblad som kund (föll förut på pli.price); T1b kunden får inte sätta avtalsåret
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_cust_user, 'role', 'authenticated')::text, true);
  v_view := public.contract_customer_view(v_cust_contract);
  if v_view is null or jsonb_typeof(v_view->'prices') <> 'array' then raise exception 'FEL T1: kundvyn gav %', v_view; end if;
  if not ((v_view->'premium') ? 'billing_anchor_mode') then raise exception 'FEL T1: billing_anchor_mode saknas'; end if;
  if v_view->'premium'->>'anchor_day' is not null then raise exception 'FEL T1: anchor_day'; end if;
  v_log := v_log || format('T1 ok %s priser; ', jsonb_array_length(v_view->'prices'));
  begin
    perform public.contract_set_billing_anchor_mode(v_cust_contract, 'start_day', 'prov');
    raise exception 'FEL T1b';
  exception when others then if sqlerrm like 'FEL%' then raise; end if; v_log := v_log || 'T1b ok ' || sqlerrm || '; '; end;
  execute 'reset role';

  -- T2 tekniker stoppas (avtalsår och tilläggsregler)
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_hans, 'role', 'authenticated')::text, true);
  begin perform public.contract_set_billing_anchor_mode(v_fev, 'start_day', 'prov'); raise exception 'FEL T2';
  exception when others then if sqlerrm like 'FEL%' then raise; end if; v_log := v_log || 'T2 ok ' || sqlerrm || '; '; end;
  begin perform public.contract_set_addon_rules(v_fev, 'v2'); raise exception 'FEL T2b';
  exception when others then if sqlerrm like 'FEL%' then raise; end if; v_log := v_log || 'T2b ok; '; end;
  execute 'reset role';

  -- T3 admin utan befogenheten stoppas
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_maikel, 'role', 'authenticated')::text, true);
  begin perform public.contract_set_billing_anchor_mode(v_fev, 'start_day', 'prov'); raise exception 'FEL T3';
  exception when others then if sqlerrm like 'FEL%' then raise; end if; v_log := v_log || 'T3 ok; '; end;
  execute 'reset role';

  -- T4 säljare med skrivrätt på contracts kan inte skriva fälten direkt; T4c vanliga fält passerar
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_jimmy, 'role', 'authenticated')::text, true);
  begin update contracts set billing_anchor_mode = 'start_day' where id = v_fev; if found then raise exception 'FEL T4'; end if; v_log := v_log || 'T4 ok (RLS); ';
  exception when others then if sqlerrm like 'FEL%' then raise; end if; v_log := v_log || 'T4 ok ' || sqlerrm || '; '; end;
  begin update contracts set addon_rules = 'v2' where id = v_fev; if found then raise exception 'FEL T4b'; end if;
  exception when others then if sqlerrm like 'FEL%' then raise; end if; v_log := v_log || 'T4b ok; '; end;
  update contracts set agreement_text = agreement_text where id = v_fev;
  v_log := v_log || 'T4c ok; ';
  execute 'reset role';

  -- T5 Sofia sätter avtalsdagen på ett avtal med ramavtal: anteckning krävs,
  -- verified_by = profiles.id, contract_start_date i framework_overrides, loggat
  select count(*) into v_events from contract_events where contract_id = v_fw_contract;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_sofia, 'role', 'authenticated')::text, true);
  begin perform public.contract_set_billing_anchor_mode(v_fw_contract, 'start_day', '  '); raise exception 'FEL T5a';
  exception when others then if sqlerrm like 'FEL%' then raise; end if; v_log := v_log || 'T5a ok; '; end;
  begin perform public.contract_set_billing_anchor_mode(v_fw_contract, 'annual', 'x'); raise exception 'FEL T5b';
  exception when others then if sqlerrm like 'FEL%' then raise; end if; v_log := v_log || 'T5b ok; '; end;
  v_res := public.contract_set_billing_anchor_mode(v_fw_contract, 'start_day', 'Startdatum kontrollerat mot Oneflow-avtalet (prov)');
  execute 'reset role';
  select * into c from contracts where id = v_fw_contract;
  if c.billing_anchor_mode is distinct from 'start_day' or c.billing_anchor_verified_at is null or c.billing_anchor_verified_by is distinct from v_sofia_profile then raise exception 'FEL T5 %', row_to_json(c); end if;
  if not ('contract_start_date' = any(c.framework_overrides)) then raise exception 'FEL T5 overrides %', c.framework_overrides; end if;
  if c.contract_start_date <> '2026-06-30' then raise exception 'FEL T5 start'; end if;
  if (select count(*) from contract_events where contract_id = v_fw_contract) <> v_events + 1 then raise exception 'FEL T5 logg'; end if;
  v_log := v_log || format('T5 ok overrides %s logg "%s"; ', c.framework_overrides, (select detail from contract_events where contract_id = v_fw_contract order by created_at desc limit 1));

  -- T5c kundvyn visar avtalsdagen och nästa periodstart på avtalsdagen
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_sofia, 'role', 'authenticated')::text, true);
  v_view := public.contract_customer_view(v_fw_contract);
  execute 'reset role';
  if v_view->'premium'->>'anchor_day' <> '2026-06-30' then raise exception 'FEL T5c %', v_view->'premium'; end if;
  v_log := v_log || 'T5c ok ' || (v_view->'premium')::text || '; ';

  -- T6 ramavtalet skriver inte över den kontrollerade avtalsdagen (syskonet följer ramavtalet)
  update framework_agreements set contract_start_date = '2026-07-01' where id = c.framework_id;
  perform public.apply_framework_to_contract(v_fw_contract);
  perform public.apply_framework_to_contract(v_fw_sibling);
  if (select contract_start_date from contracts where id = v_fw_contract) <> '2026-06-30' then raise exception 'FEL T6'; end if;
  v_log := v_log || format('T6 ok syskon %s; ', (select contract_start_date from contracts where id = v_fw_sibling));

  -- T7 ändrat startdatum tar bort kontrollmarkeringen, avtalet hamnar i arbetslistan
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_sofia, 'role', 'authenticated')::text, true);
  update contracts set contract_start_date = '2026-06-29' where id = v_fw_contract;
  execute 'reset role';
  select * into c from contracts where id = v_fw_contract;
  if c.billing_anchor_verified_at is not null or c.billing_anchor_mode is distinct from 'start_day' or c.billing_anchor_verified_note not like 'Startdatumet ändrades%' then raise exception 'FEL T7 %', row_to_json(c); end if;
  if not exists (select 1 from public.contract_work_items_internal(null) w where w.kind = 'anchor_verify' and w.contract_id = v_fw_contract) then raise exception 'FEL T7 arbetslista'; end if;
  v_log := v_log || 'T7 ok; ';

  -- T8 kontrollera igen, tillbaka till den 1:a, spärren på igen efter anropet, tilläggsregler
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_sofia, 'role', 'authenticated')::text, true);
  perform public.contract_set_billing_anchor_mode(v_fw_contract, 'start_day', 'Kontrollerat igen (prov)');
  v_ok := (select billing_anchor_verified_at is not null from contracts where id = v_fw_contract);
  perform public.contract_set_billing_anchor_mode(v_fw_contract, null, null);
  begin update contracts set billing_anchor_mode = 'start_day' where id = v_fw_contract; raise exception 'FEL T8 spärr';
  exception when others then if sqlerrm like 'FEL%' then raise; end if; end;
  perform public.contract_set_addon_rules(v_fw_contract, 'v2');
  if (select addon_rules from contracts where id = v_fw_contract) is distinct from 'v2' then raise exception 'FEL T8 v2'; end if;
  perform public.contract_set_addon_rules(v_fw_contract, null);
  begin perform public.contract_set_addon_rules(v_fw_contract, 'v3'); raise exception 'FEL T8 v3';
  exception when others then if sqlerrm like 'FEL%' then raise; end if; end;
  execute 'reset role';
  select * into c from contracts where id = v_fw_contract;
  if not v_ok or c.billing_anchor_mode is not null or c.addon_rules is not null then raise exception 'FEL T8'; end if;
  v_log := v_log || 'T8 ok; ';

  -- T9 SQL-editorn och service role (ingen inloggad användare) passerar vakten
  perform set_config('request.jwt.claims', '', true);
  update contracts set addon_rules = 'v2' where id = v_fev;
  update contracts set addon_rules = null where id = v_fev;
  v_log := v_log || 'T9 ok; ';

  -- T10 körrätt
  if has_function_privilege('anon', 'public.contract_set_billing_anchor_mode(uuid, text, text)', 'execute')
     or has_function_privilege('anon', 'public.contract_set_addon_rules(uuid, text)', 'execute')
     or has_function_privilege('authenticated', 'public.trg_contract_billing_mode_guard()', 'execute') then raise exception 'FEL T10'; end if;
  v_log := v_log || 'T10 ok';

  raise exception 'PROV KLART: %', v_log;
end $$;
