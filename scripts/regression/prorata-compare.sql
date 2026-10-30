-- Steg 9 (avtalsåret på avtalsdag): sync_addon_prorata_line före och efter.
--
-- Kör varje funktion i listan för alla anrop som förekommer i dag och fångar
-- svaret plus pro rata-raderna efteråt. Varje anrop körs i en egen
-- deltransaktion som rullas tillbaka, och blocket slutar med raise exception,
-- så ingenting skrivs. md5 per funktion i felmeddelandet ska vara lika.
--
-- Före migrationen: bara 'sync_addon_prorata_line' (dagens kod).
-- Efter: 'sync_addon_prorata_line' (växeln) och 'sync_addon_prorata_line_legacy'
-- (dagens kod, omdöpt). 2026-10-30: 88 anrop, md5 0fae6855ebc3bcba3d8fda21d3ef6309
-- före migrationen, i transaktionen och efter skarp migration, för båda namnen.
-- Svaret beror på dagens datum (nästa periodstart), jämför samma dag.
--
-- Anropen: (enhet, null) för varje enhet med tilläggsstationer (utsättningen,
-- syncAfterStationChange) och (ärendets kund, ärende) för varje ärende med pro
-- rata-rader eller etableringsärende på en sådan enhet (kontrollrundan, avslutet).
-- JWT sätts lokalt till en intern användare så att intranet_is_internal() är sann.
do $$
declare
  c record; v_res jsonb; v_rows jsonb; v_all jsonb; v_out jsonb := '[]'::jsonb; v_n int; fn text;
begin
  perform set_config('request.jwt.claims', '{"sub":"4ef86aa9-8f9f-4602-a4fd-967d0424697a","role":"authenticated"}', true);
  foreach fn in array array['sync_addon_prorata_line', 'sync_addon_prorata_line_legacy'] loop
    if not exists (select 1 from pg_proc where proname = fn and pronamespace = 'public'::regnamespace) then
      continue;
    end if;
    v_all := '[]'::jsonb; v_n := 0;
    for c in
      with units as (
        select distinct customer_id as unit from equipment_placements where is_addon
        union
        select distinct fp.customer_id from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id where s.is_addon
      ), calls as (
        select unit as customer_id, null::uuid as case_id from units
        union
        select cs.customer_id, cs.id from cases cs
        where exists (select 1 from case_billing_items b where b.case_id = cs.id and b.is_addon_prorata_line)
           or (cs.service_type = 'establishment' and cs.customer_id in (select unit from units))
      )
      select * from calls order by customer_id, case_id nulls first
    loop
      v_n := v_n + 1;
      begin
        execute format('select public.%I($1, null, null, null, $2)', fn) into v_res using c.customer_id, c.case_id;
        select coalesce(jsonb_agg(to_jsonb(b) - 'id' - 'created_at' - 'updated_at' - 'mapped_service_id'
                                  order by b.case_id, b.station_type_id, b.addon_model, b.status, b.quantity, b.total_price), '[]'::jsonb)
          into v_rows
        from case_billing_items b
        where b.is_addon_prorata_line and (b.customer_id = c.customer_id or b.case_id = c.case_id);
        raise exception 'rollback_call';
      exception when others then
        if sqlerrm <> 'rollback_call' then v_res := jsonb_build_object('error', sqlerrm); v_rows := '[]'::jsonb; end if;
      end;
      -- radernas id skiljer mellan körningar (nya rader), därför bort ur svaret
      v_res := v_res - 'row_id';
      if v_res ? 'rows' then
        v_res := jsonb_set(v_res, '{rows}', coalesce((select jsonb_agg(e - 'row_id') from jsonb_array_elements(v_res->'rows') e), '[]'::jsonb));
      end if;
      v_all := v_all || jsonb_build_object('customer_id', c.customer_id, 'case_id', c.case_id, 'result', v_res, 'rows', v_rows);
    end loop;
    v_out := v_out || jsonb_build_object('fn', fn, 'calls', v_n, 'md5', md5(v_all::text),
       'found', (select count(*) from jsonb_array_elements(v_all) e where (e->'result'->>'found')::boolean),
       'errors', (select count(*) from jsonb_array_elements(v_all) e where e->'result' ? 'error'));
  end loop;
  raise exception 'RESULT %', v_out;
end $$;
