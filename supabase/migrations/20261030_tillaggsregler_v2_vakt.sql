-- Steg 11 (avtalsåret på avtalsdag), del 2 av 3: ersätter tre objekt (punkt 1 till 3).
-- Punkt 4 ligger i 20261030_tillaggsregler_v2_arbetslista.sql (del 3).
-- Inget av dem ändrar beteende för avtal utan addon_rules = 'v2' eller för
-- fakturor utan marking_key (alla i dag). Backning:
-- 20261030_tillaggsregler_v2_vakt_backning.sql.
--
-- 1. addon_prorata_v2_end: ordinarie periodstart enligt tilläggens takt
--    (contract_addon_next_period_start) och ledtidsregeln bara mot fakturor
--    för stationens märkning. Anropas bara av version 2 (inga v2-avtal i dag).
-- 2. guard_contract_invoice_overlap: samma period med olika marking_key är
--    ingen dubblett (tilläggsfakturor per referenskod). marking_key är NULL på
--    alla fakturor i dag, så vakten beter sig som förut. Triggern lyssnar också
--    på marking_key.
-- 3. contract_invoice_overlaps: samma märkning, glappfakturor räknas inte.
-- 4. contract_work_items_internal: glappradens text säger att fakturan väntar
--    på databasändringen så länge drop-raderna från steg 5 inte är körda.

create or replace function public.addon_prorata_v2_end(p_contract_id uuid, p_station_id uuid, p_start date)
returns table(end_day date, ordinary date, capped boolean, unknown_invoice text)
language plpgsql stable security definer set search_path = public as $$
declare
  c record;
  inv record;
  v_end date;
  v_last date;
  v_guard int := 0;
  v_key text;
begin
  select * into c from contracts where id = p_contract_id;
  if not found or p_start is null then
    return;
  end if;
  -- Steg 11: tilläggens takt (premiens perioder, eller årsdagen utan premie)
  ordinary := contract_addon_next_period_start(p_contract_id, p_start);
  v_key := addon_marking_key_for_unit((select l.unit_customer_id from addon_station_lookup(p_station_id, null) l limit 1), p_contract_id);
  if ordinary is null then
    return;
  end if;
  v_end := ordinary;
  capped := false;
  unknown_invoice := null;
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 60;
    select i.id, coalesce(i.invoice_number, i.id::text) as nr,
           coalesce(i.billing_period_end, i.billing_period_start) as pe,
           exists (select 1 from invoice_items ii where ii.invoice_id = i.id and p_station_id = any(ii.station_ids)) as has_station,
           exists (select 1 from invoice_items ii where ii.invoice_id = i.id
                   and (ii.line_kind in ('equipment_annual', 'equipment_monthly') or i.contract_invoice_kind in ('equipment', 'equipment_monthly', 'equipment_gap'))
                   and coalesce(cardinality(ii.station_ids), 0) > 0) as has_ids
      into inv
    from invoices i
    where i.contract_id = p_contract_id
      and i.invoice_type = 'contract'
      and i.status in ('booked', 'sent', 'overdue', 'paid')
      and i.billing_period_start <= v_end
      and coalesce(i.billing_period_end, i.billing_period_start) >= v_end
      -- Steg 11: bara fakturor för stationens märkning (NULL = en faktura för hela avtalet)
      and (i.marking_key is null or i.marking_key = v_key)
      and (i.contract_invoice_kind in ('equipment', 'equipment_monthly', 'equipment_gap')
           or (coalesce(i.contract_invoice_kind, 'premium') = 'premium'
               and exists (select 1 from invoice_items ii where ii.invoice_id = i.id
                           and ii.line_kind in ('equipment_annual', 'equipment_monthly'))))
    order by i.billing_period_start desc, i.created_at desc
    limit 1;
    exit when not found;
    exit when inv.has_station;
    if not inv.has_ids then
      unknown_invoice := inv.nr;
      exit;
    end if;
    exit when inv.pe + 1 <= v_end;
    v_end := inv.pe + 1;
  end loop;

  if c.terminated_at is not null or c.renewal_mode = 'option' or c.status in ('ended', 'trashed', 'declined') then
    v_last := coalesce(c.effective_end_date, c.contract_end_date);
    if v_last is not null and v_last + 1 < v_end then
      v_end := v_last + 1;
      capped := true;
    end if;
  end if;
  end_day := v_end;
  return next;
end $$;

create or replace function public.guard_contract_invoice_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_new_end date := coalesce(new.billing_period_end, new.billing_period_start);
  v_share numeric;
  v_restore boolean := false;
begin
  if new.invoice_type is distinct from 'contract'
     or new.status = 'cancelled'
     or coalesce(new.is_historical, false)
     or coalesce(new.invoice_number, '') like 'F-%'
     or new.billing_period_start is null
     or coalesce(new.contract_invoice_kind, 'premium') not in ('premium', 'equipment', 'equipment_monthly') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_restore := old.status is not distinct from 'cancelled';
    if not v_restore
       and old.billing_period_start is not distinct from new.billing_period_start
       and old.billing_period_end is not distinct from new.billing_period_end
       and old.contract_invoice_kind is not distinct from new.contract_invoice_kind
       and old.contract_id is not distinct from new.contract_id
       and old.is_consolidated is not distinct from new.is_consolidated
       and old.marking_key is not distinct from new.marking_key
       and old.invoice_type is not distinct from new.invoice_type
       and coalesce(old.is_historical, false) = coalesce(new.is_historical, false)
       and (coalesce(old.invoice_number, '') like 'F-%') = (coalesce(new.invoice_number, '') like 'F-%') then
      -- Bara statusbyte eller andra fält: perioden är redan prövad
      return new;
    end if;
  end if;

  if coalesce(current_setting('app.allow_period_overlap', true), '') = 'on' then
    return new;
  end if;

  for r in
    select i.id, i.invoice_number, i.status, i.billing_period_start as s,
           coalesce(i.billing_period_end, i.billing_period_start) as e
    from invoices i
    where i.id <> new.id
      and i.invoice_type = 'contract'
      and i.status <> 'cancelled'
      and coalesce(i.contract_invoice_kind, 'premium') = coalesce(new.contract_invoice_kind, 'premium')
      -- Steg 11: tilläggsfakturor delas per märkning; samma period med olika märkning är ingen dubblett
      and coalesce(i.marking_key, '') = coalesce(new.marking_key, '')
      and (
        (new.contract_id is not null and i.contract_id = new.contract_id and not coalesce(i.is_consolidated, false))
        or (coalesce(new.is_consolidated, false) and coalesce(i.is_consolidated, false) and i.customer_id = new.customer_id)
      )
      and i.billing_period_start <= v_new_end
      and coalesce(i.billing_period_end, i.billing_period_start) >= new.billing_period_start
  loop
    -- Steg 7: samma andel som portalens matchning (periodOverlapShare i
    -- src/shared/contractInvoiceMatch.ts), räknad i en gemensam funktion.
    v_share := public.contract_period_overlap_share(r.s, r.e, new.billing_period_start, v_new_end);

    if v_restore and new.fortnox_document_number is not null then
      if v_share >= 0.5 then
        raise warning 'Återställd faktura % (% t.o.m. %) överlappar faktura % (% t.o.m. %)',
          coalesce(new.invoice_number, new.id::text), new.billing_period_start, v_new_end,
          coalesce(r.invoice_number, r.id::text), r.s, r.e;
      end if;
      continue;
    end if;

    if v_share >= 0.5 then
      raise exception using errcode = '23P01',
        message = format('Perioden %s t.o.m. %s finns redan på faktura %s (%s t.o.m. %s)',
                         new.billing_period_start, v_new_end, coalesce(r.invoice_number, r.id::text), r.s, r.e);
    end if;

    if tg_op = 'INSERT'
       and r.status not in ('booked', 'sent', 'overdue', 'paid')
       and coalesce(r.invoice_number, '') not like 'F-%' then
      raise exception using errcode = '23P01',
        message = format('Perioden %s t.o.m. %s överlappar utkastet %s (%s t.o.m. %s). Ändra utkastet i stället.',
                         new.billing_period_start, v_new_end, coalesce(r.invoice_number, r.id::text), r.s, r.e);
    end if;
  end loop;

  return new;
end $$;

create or replace trigger trg_invoices_period_overlap_guard
  before insert or update of billing_period_start, billing_period_end, contract_invoice_kind, contract_id, is_consolidated, status, marking_key
  on public.invoices
  for each row execute function public.guard_contract_invoice_overlap();

create or replace view public.contract_invoice_overlaps
with (security_invoker = true) as
  select a.id as invoice_a, a.invoice_number as number_a, a.status as status_a,
         b.id as invoice_b, b.invoice_number as number_b, b.status as status_b,
         a.customer_id, a.contract_id, coalesce(a.contract_invoice_kind, 'premium') as kind,
         greatest(a.billing_period_start, b.billing_period_start) as overlap_from,
         least(coalesce(a.billing_period_end, a.billing_period_start), coalesce(b.billing_period_end, b.billing_period_start)) as overlap_to
  from invoices a join invoices b on a.id < b.id
   and a.invoice_type = 'contract' and b.invoice_type = 'contract'
   and a.status <> 'cancelled' and b.status <> 'cancelled'
   and coalesce(a.contract_invoice_kind, 'premium') = coalesce(b.contract_invoice_kind, 'premium')
   and coalesce(a.contract_invoice_kind, 'premium') not in ('adjustment', 'equipment_gap')
   and a.customer_id = b.customer_id
   and a.contract_id is not distinct from b.contract_id
   and coalesce(a.is_consolidated, false) = coalesce(b.is_consolidated, false)
   and coalesce(a.marking_key, '') = coalesce(b.marking_key, '')
   and a.billing_period_start <= coalesce(b.billing_period_end, b.billing_period_start)
   and b.billing_period_start <= coalesce(a.billing_period_end, a.billing_period_start);

revoke all on public.contract_invoice_overlaps from anon, authenticated;

revoke all on function public.addon_prorata_v2_end(uuid, uuid, date) from public, anon, authenticated;
