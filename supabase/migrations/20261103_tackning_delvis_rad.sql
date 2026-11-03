-- Steg 0 (2026-11-03), del 2: täckningen när en faktura med en delvis täckt
-- station låses (skickas, bokförs, betalas).
--
-- Planeringen (decorateV2Period i src/shared/addonPlanV2.ts) fakturerar en
-- station som redan har täckning för början eller slutet av perioden bara för
-- de otäckta dagarna. Triggern skrev förut täckning för hela fakturaperioden,
-- och den krockade då med den befintliga täckningen (konfliktrad i stället
-- för täckning). Nu börjar täckningen dagen efter en befintlig täckning som
-- omfattar periodens början, och slutar dagen före en befintlig täckning som
-- omfattar periodens slut. Hela perioden redan täckt, eller ett hål mitt i,
-- ger konflikt som förut (dubbeldebitering ska synas).
--
-- Fakturor utan befintlig täckning för stationen får exakt samma täckning
-- som förut.

create or replace function public.trg_invoice_locked_coverage()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  it record;
  v_sid uuid;
  st record;
  v_kind text := coalesce(new.contract_invoice_kind, 'premium');
  v_source text;
  v_inv_v2 boolean := false;
  v_from date;
  v_to date;
  v_edge date;
begin
  if new.invoice_type is distinct from 'contract'
     or new.billing_period_start is null
     or new.billing_period_end is null
     or v_kind not in ('premium', 'equipment', 'equipment_monthly', 'equipment_gap') then
    return new;
  end if;
  begin
    v_source := case when v_kind = 'equipment_gap' then 'gap_invoice' else 'invoice' end;
    if new.contract_id is not null then
      select coalesce(c.addon_rules = 'v2', false) into v_inv_v2 from contracts c where c.id = new.contract_id;
    end if;
    for it in
      select ii.id, ii.station_ids
      from invoice_items ii
      where ii.invoice_id = new.id
        and ii.station_ids is not null
        and cardinality(ii.station_ids) > 0
        and (v_kind <> 'premium' or ii.line_kind in ('equipment_annual', 'equipment_monthly'))
    loop
      foreach v_sid in array it.station_ids loop
        select * into st from addon_station_lookup(v_sid, null) limit 1;
        if st.unit_customer_id is null then
          continue;
        end if;
        if not (coalesce(v_inv_v2, false)
                or exists (select 1 from contracts c where c.id = st.contract_id and c.addon_rules = 'v2')
                or exists (select 1 from addon_station_coverage a where a.station_id = v_sid and a.station_kind = st.station_kind)) then
          continue;
        end if;
        v_from := greatest(new.billing_period_start, coalesce(st.effective_from, new.billing_period_start));
        v_to := new.billing_period_end;
        -- Delvis täckt station: hoppa över täckning som omfattar periodens början
        loop
          select max(a.covered_to) into v_edge
          from addon_station_coverage a
          where a.station_id = v_sid and a.station_kind = st.station_kind and a.released_at is null
            and a.invoice_id is distinct from new.id
            and a.covered_from <= v_from and a.covered_to >= v_from and a.covered_to < v_to;
          exit when v_edge is null;
          v_from := v_edge + 1;
        end loop;
        -- ... och täckning som omfattar periodens slut
        loop
          select min(a.covered_from) into v_edge
          from addon_station_coverage a
          where a.station_id = v_sid and a.station_kind = st.station_kind and a.released_at is null
            and a.invoice_id is distinct from new.id
            and a.covered_from <= v_to and a.covered_to >= v_to and a.covered_from > v_from;
          exit when v_edge is null;
          v_to := v_edge - 1;
        end loop;
        if v_from > v_to then
          continue;
        end if;
        perform addon_coverage_write_or_conflict(v_sid, st.station_kind, st.unit_customer_id,
                                                 coalesce(new.contract_id, st.contract_id),
                                                 v_from, v_to, v_source,
                                                 new.id, it.id, null);
      end loop;
    end loop;
  exception when others then
    raise warning 'trg_invoice_locked_coverage: täckning för faktura % kunde inte skrivas: %',
      coalesce(new.invoice_number, new.id::text), sqlerrm;
  end;
  return new;
end $function$;
