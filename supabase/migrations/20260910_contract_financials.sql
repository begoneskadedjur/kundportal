-- Ekonomins läsyta och historik
--
-- En anropspunkt för avtalets ekonomi: premie i kraft (trappan), nästa steg,
-- tilläggsintäkt och inköp ur stationerna, intern kostnad ur § 4-artiklarna,
-- fakturerat och betalt ur fakturorna. Pappret, pulsen och ekonomisidan läser
-- samma funktion. Marginalprocenten räknas fortfarande i src/shared/marginEngine.ts
-- (en motor), på rader som den här funktionen också returnerar.
--
-- Historik: premiesteg får source (karta, tillagg, index, import, oneflow, system).

alter table public.contract_premium_events add column if not exists source text;
update public.contract_premium_events set source = case
  when source is not null then source
  when event_type = 'addition' then 'tillagg'
  when event_type = 'indexation' then 'index'
  when note ilike 'Backfill%' then 'system'
  when note ilike '%Oneflow%' then 'oneflow'
  when note ilike '%import%' then 'import'
  else 'karta' end;
comment on column public.contract_premium_events.source is 'Var steget kom ifrån: karta, tillagg, index, import, oneflow, system';

create or replace function public.contract_financials(p_contract_id uuid, p_asof date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_premium numeric;
  v_next jsonb;
  v_addon_annual numeric;
  v_addon_cost numeric;
  v_addon_active int;
  v_addon_removed int;
  v_internal_cost numeric;
  v_labour_hours numeric;
  v_invoiced numeric;
  v_paid numeric;
  v_open numeric;
  v_invoice_count int;
  v_last_invoice date;
begin
  if not public.intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;

  v_premium := public.contract_annual_value_in_force(p_contract_id, p_asof);
  select jsonb_build_object('effective_from', e.effective_from, 'annual_value', e.annual_value, 'event_type', e.event_type)
    into v_next
  from public.contract_premium_events e
  where e.contract_id = p_contract_id and e.effective_from > p_asof
  order by e.effective_from asc limit 1;

  -- Tillägg utöver premien, ur stationerna (pris och inköp låsta per station)
  select coalesce(sum(case when l.removed_at is null then l.unit_price_annual end), 0),
         coalesce(sum(l.unit_cost), 0),
         count(*) filter (where l.removed_at is null),
         count(*) filter (where l.removed_at is not null)
    into v_addon_annual, v_addon_cost, v_addon_active, v_addon_removed
  from public.contract_addon_ledger(p_contract_id) l;

  -- Intern kostnad för premien: artikelrader mappade mot en premietjänst
  select coalesce(sum(a.total_price), 0),
         coalesce(sum(case when ar.category = 'Arbetstid' then a.quantity end), 0)
    into v_internal_cost, v_labour_hours
  from public.case_billing_items a
  left join public.articles ar on ar.id = a.article_id
  left join public.case_billing_items s on s.id = a.mapped_service_id
  where a.case_id = p_contract_id and a.case_type = 'contract' and a.item_type = 'article'
    and a.status <> 'cancelled'
    and (a.mapped_service_id is null or coalesce(s.billing_model, 'premium') = 'premium');

  -- Fakturerat och betalt: fakturor som bär avtalets id
  select coalesce(sum(i.total_amount) filter (where i.status in ('sent', 'paid')), 0),
         coalesce(sum(i.total_amount) filter (where i.status = 'paid'), 0),
         coalesce(sum(i.total_amount) filter (where i.status = 'sent'), 0),
         count(*) filter (where i.status <> 'cancelled'),
         max(i.billing_period_start) filter (where i.status <> 'cancelled')
    into v_invoiced, v_paid, v_open, v_invoice_count, v_last_invoice
  from public.invoices i
  where i.contract_id = p_contract_id;

  return jsonb_build_object(
    'asof', p_asof,
    'premium_in_force', v_premium,
    'premium_next', v_next,
    'addon_annual', v_addon_annual,
    'addon_cost', v_addon_cost,
    'addon_stations_active', v_addon_active,
    'addon_stations_removed', v_addon_removed,
    'internal_cost_annual', v_internal_cost,
    'labour_hours', v_labour_hours,
    'revenue_annual', coalesce(v_premium, 0) + v_addon_annual,
    'invoiced', v_invoiced,
    'paid', v_paid,
    'outstanding', v_open,
    'invoice_count', v_invoice_count,
    'last_invoice_period_start', v_last_invoice
  );
end;
$$;

grant execute on function public.contract_financials(uuid, date) to authenticated;
