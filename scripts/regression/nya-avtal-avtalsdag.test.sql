-- Steg 15: prov av contract_default_addon_rules och vakten vid INSERT.
-- Körs efter migrationen 20261030_nya_avtal_avtalsdag.sql (eller i samma
-- transaktion som den). Slutar alltid med raise exception, så att inget
-- sparas; resultatet står i felmeddelandet.
do $$
declare
  v_out text := '';
  v_new_cust uuid;
  v_fev uuid := '9da6ff49-eaab-4bbe-a657-9c59ce8cfac7';
  v_sofia uuid := '395413af-414f-4a67-ba53-9caa3c53ddce';
  v_id uuid;
  v_ok boolean;
  r record;
begin
  -- Testkund utan avtal
  insert into customers (company_name, contact_email, is_active) values ('Steg 15 provkund', 'prov@example.invalid', true) returning id into v_new_cust;

  -- T1 standardvärdet
  v_out := v_out || format('T1 ny kund=%s, FEV=%s, okänd kund=%s; ',
    contract_default_addon_rules(v_new_cust), coalesce(contract_default_addon_rules(v_fev), 'NULL'),
    contract_default_addon_rules(gen_random_uuid()));

  -- T2 service role (ingen inloggad användare): signeringen skriver fälten
  insert into contracts (customer_id, oneflow_contract_id, template_id, source_type, type, status, label,
                         contract_start_date, start_date, billing_frequency, annual_value, signed_at)
  values (v_new_cust, 'steg15-prov-' || gen_random_uuid(), 'local', 'manual', 'contract', 'signed', 'Prov',
          '2026-11-17', '2026-11-17', 'annual', 12000, '2026-10-30')
  returning id into v_id;
  update contracts set billing_anchor_mode = 'start_day', billing_anchor_verified_at = now(),
         billing_anchor_verified_note = 'Startdatum ur Oneflow vid signering', addon_rules = 'v2'
   where id = v_id;
  select billing_anchor_mode, addon_rules, billing_anchor_verified_at is not null as ver into r from contracts where id = v_id;
  v_out := v_out || format('T2 service role update: %s/%s/%s; ', r.billing_anchor_mode, r.addon_rules, r.ver);
  select * into r from contract_period_on(v_id, '2026-11-17');
  v_out := v_out || format('T2 period %s t.o.m. %s, nästa start %s; ', r.period_start, r.period_end,
                           contract_next_period_start(v_id, '2026-11-17'));
  -- Nytt avtal på samma kund: det första har v2, alltså v2 igen
  v_out := v_out || format('T2b andra avtalet på kunden=%s; ', contract_default_addon_rules(v_new_cust, null));

  -- T3 Sofia skapar tomt avtal med avtalsdag + v2: går
  perform set_config('request.jwt.claims', json_build_object('sub', v_sofia, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into contracts (customer_id, oneflow_contract_id, template_id, source_type, type, status, label,
                         billing_anchor_mode, addon_rules)
  values (v_new_cust, 'local-' || gen_random_uuid(), 'local', 'manual', 'contract', 'active', 'Prov tomt', 'start_day', 'v2')
  returning id into v_id;
  v_out := v_out || 'T3 Sofia tomt avtal start_day+v2 ok; ';

  -- T4 Sofia med kontrollmarkering: stoppas
  v_ok := false;
  begin
    insert into contracts (customer_id, oneflow_contract_id, template_id, source_type, type, status, label,
                           billing_anchor_mode, billing_anchor_verified_at)
    values (v_new_cust, 'local-' || gen_random_uuid(), 'local', 'manual', 'contract', 'active', 'Prov', 'start_day', now());
  exception when insufficient_privilege then v_ok := true;
  end;
  v_out := v_out || format('T4 kontrollmarkering stoppad=%s; ', v_ok);

  -- T5 Sofia v2 på FEV (har avtal med gamla regler): stoppas
  v_ok := false;
  begin
    insert into contracts (customer_id, oneflow_contract_id, template_id, source_type, type, status, label, addon_rules)
    values (v_fev, 'local-' || gen_random_uuid(), 'local', 'manual', 'contract', 'active', 'Prov', 'v2');
  exception when insufficient_privilege then v_ok := true;
  end;
  v_out := v_out || format('T5 v2 på FEV stoppad=%s; ', v_ok);

  -- T6 Sofia avtal på FEV utan fälten (som i dag): går
  insert into contracts (customer_id, oneflow_contract_id, template_id, source_type, type, status, label, billing_anchor_mode)
  values (v_fev, 'local-' || gen_random_uuid(), 'local', 'manual', 'contract', 'active', 'Prov', 'start_day');
  v_out := v_out || 'T6 FEV start_day utan v2 ok; ';

  -- T7 Sofia ändrar läget direkt (steg 12:s vakt): stoppas fortfarande
  v_ok := false;
  begin
    update contracts set addon_rules = null where id = v_id;
  exception when insufficient_privilege then v_ok := true;
  end;
  v_out := v_out || format('T7 update förbi RPC stoppad=%s; ', v_ok);
  reset role;

  -- T8 befintliga avtal orörda
  v_out := v_out || format('T8 befintliga med läge/regler (utom provet)=%s',
    (select count(*) from contracts where (billing_anchor_mode is not null or addon_rules is not null)
       and customer_id not in (v_new_cust) and oneflow_contract_id not like 'local-%'));

  raise exception 'PROV KLART (rullas tillbaka): %', v_out;
end $$;
