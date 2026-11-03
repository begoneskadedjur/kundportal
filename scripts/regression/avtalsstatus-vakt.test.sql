-- Avtalsstatus: logg och spärr (20261103_avtalsstatus_vakt.sql), prov i ett
-- block som alltid rullas tillbaka (raise exception med resultatet, inget skrivs).
--
-- T1: aktivt avtal utan uppsägning → trashed stoppas av contracts_status_guard.
-- T2: samma övergång till ended och declined stoppas också.
-- T3: Säg upp (terminated_at i samma uppdatering) → ended går igenom.
-- T4: expire-contracts (terminated_at satt sedan tidigare) → ended går igenom.
-- T5: contract_mark_replaced (ersatt av nytt avtal) → ended, termination_reason,
--     updated_at och två rader i contract_events (status + ersatt).
-- T6: contract_set_status_manual → trashed går igenom med källa manual.
-- T7: app.status_source = 'sync-oneflow' räcker inte → stoppas.
-- T8: avtal före signering (pending) → trashed går igenom (Oneflow styr där).
-- T9: signerad offert → trashed går igenom (spärren gäller avtal).
-- T10: varje statusändring ovan har en loggrad med from/to/source/by.
-- T11: active → signed (gamla nattliga driften) loggas men stoppas inte.
--
-- Körd 2026-11-03 med migrationen först i samma transaktion (rullad tillbaka):
-- T1, T2 och T7 stoppade med felet "Avtalet är aktivt och kan inte få status
-- borttaget här. ..."; T3 och T4 ended; T5 ended, termination_reason "Ersatt av
-- nytt avtal i portalen", updated_at satt, två händelser, källan nollställd
-- efteråt; T6 trashed (källa manual); T8 och T9 trashed; T11 active (ingen
-- statusändring, ingen loggrad); T10 en loggrad per ändring med källa
-- replaced/manual eller ingen, av "system".
do $$
declare
  r jsonb := '{}'::jsonb;
  a1 uuid; a2 uuid; a3 uuid; a4 uuid; a5 uuid; a6 uuid;
  p1 uuid; o1 uuid;
  v_err text;
  v_status text;
  v_n int;
  v_ts timestamptz := now(); -- transaktionens tid, samma som created_at och updated_at
begin
  select id into a1 from contracts where type = 'contract' and status = 'active' and terminated_at is null order by id limit 1 offset 0;
  select id into a2 from contracts where type = 'contract' and status = 'active' and terminated_at is null order by id limit 1 offset 1;
  select id into a3 from contracts where type = 'contract' and status = 'active' and terminated_at is null order by id limit 1 offset 2;
  select id into a4 from contracts where type = 'contract' and status = 'active' and terminated_at is null order by id limit 1 offset 3;
  select id into a5 from contracts where type = 'contract' and status = 'active' and terminated_at is null order by id limit 1 offset 4;
  select id into a6 from contracts where type = 'contract' and status = 'active' and terminated_at is null order by id limit 1 offset 5;
  select id into p1 from contracts where type = 'contract' and status = 'pending' order by id limit 1;
  select id into o1 from contracts where type = 'offer' and status = 'signed' order by id limit 1;

  -- T1
  begin
    update contracts set status = 'trashed' where id = a1;
    r := r || jsonb_build_object('T1', 'GICK IGENOM (fel)');
  exception when others then
    r := r || jsonb_build_object('T1', 'stoppad: ' || sqlerrm);
  end;

  -- T2
  begin
    update contracts set status = 'ended' where id = a1;
    r := r || jsonb_build_object('T2_ended', 'GICK IGENOM (fel)');
  exception when others then
    r := r || jsonb_build_object('T2_ended', 'stoppad');
  end;
  begin
    update contracts set status = 'declined' where id = a1;
    r := r || jsonb_build_object('T2_declined', 'GICK IGENOM (fel)');
  exception when others then
    r := r || jsonb_build_object('T2_declined', 'stoppad');
  end;

  -- T3: Säg upp med passerat slutdatum (terminateContract)
  begin
    update contracts set terminated_at = now(), effective_end_date = current_date - 1, status = 'ended', billing_active = false where id = a2;
    select status into v_status from contracts where id = a2;
    r := r || jsonb_build_object('T3', v_status);
  exception when others then
    r := r || jsonb_build_object('T3', 'STOPPAD (fel): ' || sqlerrm);
  end;

  -- T4: expire-contracts, uppsagt sedan tidigare
  begin
    update contracts set terminated_at = now() - interval '10 days', effective_end_date = current_date - 1 where id = a3;
    update contracts set status = 'ended', billing_active = false where id = a3;
    select status into v_status from contracts where id = a3;
    r := r || jsonb_build_object('T4', v_status);
  exception when others then
    r := r || jsonb_build_object('T4', 'STOPPAD (fel): ' || sqlerrm);
  end;

  -- T5: ersatt av nytt avtal
  begin
    perform contract_mark_replaced(a4, a5);
    select count(*) into v_n from contract_events where contract_id = a4 and created_at = v_ts;
    select status into v_status from contracts where id = a4;
    r := r || jsonb_build_object('T5', jsonb_build_object(
      'status', v_status,
      'reason', (select termination_reason from contracts where id = a4),
      'updated_at_ny', (select updated_at = v_ts from contracts where id = a4),
      'handelser', v_n,
      'kalla_efter', nullif(current_setting('app.status_source', true), '')));
  exception when others then
    r := r || jsonb_build_object('T5', 'STOPPAD (fel): ' || sqlerrm);
  end;

  -- T6: administratör för hand
  begin
    perform contract_set_status_manual(a6, 'trashed', 'Prov i regressionstest');
    select status into v_status from contracts where id = a6;
    r := r || jsonb_build_object('T6', v_status);
  exception when others then
    r := r || jsonb_build_object('T6', 'STOPPAD (fel): ' || sqlerrm);
  end;

  -- T7: okänd källa
  begin
    perform set_config('app.status_source', 'sync-oneflow', true);
    update contracts set status = 'trashed' where id = a5;
    r := r || jsonb_build_object('T7', 'GICK IGENOM (fel)');
  exception when others then
    r := r || jsonb_build_object('T7', 'stoppad');
  end;
  perform set_config('app.status_source', '', true);

  -- T8: före signering
  if p1 is not null then
    begin
      update contracts set status = 'trashed' where id = p1;
      select status into v_status from contracts where id = p1;
      r := r || jsonb_build_object('T8', v_status);
    exception when others then
      r := r || jsonb_build_object('T8', 'STOPPAD (fel): ' || sqlerrm);
    end;
  else
    r := r || jsonb_build_object('T8', 'inget pending-avtal');
  end if;

  -- T9: signerad offert
  begin
    update contracts set status = 'trashed' where id = o1;
    select status into v_status from contracts where id = o1;
    r := r || jsonb_build_object('T9', v_status);
  exception when others then
    r := r || jsonb_build_object('T9', 'STOPPAD (fel): ' || sqlerrm);
  end;

  -- T11: active → signed (triggern contract_signed_becomes_active vänder tillbaka)
  begin
    update contracts set status = 'signed', terminated_at = null where id = a1;
    select status into v_status from contracts where id = a1;
    r := r || jsonb_build_object('T11', v_status);
  exception when others then
    r := r || jsonb_build_object('T11', 'STOPPAD (fel): ' || sqlerrm);
  end;

  -- T10: loggen
  r := r || jsonb_build_object('T10', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'avtal', case e.contract_id when a2 then 'a2' when a3 then 'a3' when a4 then 'a4' when a6 then 'a6' when p1 then 'p1' when o1 then 'o1' when a1 then 'a1' end,
      'titel', e.title, 'detalj', e.detail,
      'from', e.metadata->>'from', 'to', e.metadata->>'to', 'source', e.metadata->>'source', 'by', e.metadata->>'by',
      'av', e.created_by_name) order by e.created_at, e.title), '[]'::jsonb)
    from contract_events e
    where e.created_at = v_ts and e.contract_id in (a1, a2, a3, a4, a6, p1, o1)));

  raise exception 'RESULTAT %', r::text;
end $$;
